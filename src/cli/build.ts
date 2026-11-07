import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { aboutOf, type Commons, parseCommons } from '../core/commons.ts'
import { checkAll } from '../core/contrast.ts'
import { readSet, SETS_DIR, setNameOf } from '../core/sets.ts'
import { BUILTIN, fail, inOther, MARKETPLACE_FILE, type Theme, themeOf, toml } from '../core/theme.ts'
import { WIRED } from '../core/wired.ts'
import { ROOT } from '../root.ts'
import type { Emitter } from '../terminals/emit/types.ts'
import { WIRINGS } from '../terminals/index.ts'
import { bundleJson, bundleOf } from './emit-manifest.ts'
import { shellTables } from './emit-shell.ts'

export const BUILTIN_DIR = join(ROOT, 'builtin')
export const AUTHORITY_PATH = join(ROOT, 'node_modules', '@kecan0406', 'aninames', 'lib', 'authority.json')
const DIST = join(ROOT, 'dist')

const TERMINAL_EMITTERS: Emitter[] = WIRED.map((id) => WIRINGS[id].emitter)

function tomlFiles(dir: string, at: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((item) => !item.name.startsWith('.'))
    .map((item) => {
      if (item.isDirectory() || !item.name.endsWith('.toml')) {
        fail(`${at}/${item.name}`, `${at}/ holds only <name>.toml files, no folders`)
      }

      return item.name
    })
    .sort()
}

export function loadCommons(path = AUTHORITY_PATH): Commons {
  return parseCommons(readFileSync(path, 'utf8'))
}

export function loadBuiltin(dir: string, commons: Commons): Theme[] {
  const doc = toml(MARKETPLACE_FILE, readFileSync(join(dir, MARKETPLACE_FILE), 'utf8'))

  if (doc.name !== BUILTIN) {
    fail(MARKETPLACE_FILE, `name must be "${BUILTIN}", the built-in marketplace's name`)
  }

  const seen = new Map<string, string>()

  const themes = tomlFiles(join(dir, SETS_DIR), SETS_DIR).flatMap((file) => {
    const at = `${SETS_DIR}/${file}`

    return readSet(at, readFileSync(join(dir, SETS_DIR, file), 'utf8')).map(({ slug, doc }) => {
      const first = seen.get(slug)

      if (first !== undefined) {
        fail(at, `holds ${slug}, which ${first} holds too — a slug is used once in a marketplace`)
      }

      seen.set(slug, at)
      const theme = themeOf(`${at}: ${slug}`, doc, { name: `${BUILTIN}/${slug}`, builtin: true })

      const about = aboutOf(commons.works, theme.subject)

      if (about?.character && about.character.id !== slug) {
        fail(`${at}: ${slug}`, `a palette of a character takes its id for a slug: ${about.character.id}`)
      }

      if (basename(file, '.toml') !== setNameOf(theme.subject)) {
        fail(
          `${at}: ${slug}`,
          `a built-in palette sits in ${SETS_DIR}/${setNameOf(theme.subject)}.toml, its work's set`,
        )
      }

      return theme
    })
  })

  return themes
}

export async function build({ only }: { only?: string[] } = {}): Promise<void> {
  if (typeof Bun === 'undefined') {
    throw new Error('needs bun — run it from a checkout: bun src/bin.ts build')
  }

  const terminals = only && only.length > 0 ? TERMINAL_EMITTERS.filter((e) => only.includes(e.id)) : TERMINAL_EMITTERS
  const commons = loadCommons()
  const themes = loadBuiltin(BUILTIN_DIR, commons)

  const violations = [
    ...checkAll(themes),
    ...checkAll(themes.flatMap(inOther)).map((v) => ({ ...v, theme: `${v.theme} in its other mode` })),
  ]

  if (violations.length > 0) {
    for (const v of violations) {
      console.error(`  ✗ ${v.theme} [${v.rule}] ${v.detail}`)
    }

    throw new Error(`${violations.length} contrast violation(s). Fix the palette.`)
  }

  if (terminals.length === TERMINAL_EMITTERS.length) {
    rmSync(DIST, { recursive: true, force: true })
  } else {
    for (const e of terminals) {
      rmSync(join(DIST, e.id), { recursive: true, force: true })
    }
  }

  let count = 0

  for (const emitter of terminals) {
    const perTheme = themes.flatMap((t) => emitter.emit?.(t) ?? [])
    const sharedOutputs = emitter.emitShared?.(themes) ?? []

    for (const out of [...perTheme, ...sharedOutputs]) {
      await Bun.write(join(DIST, out.path), out.content)
      count++
    }

    const label =
      perTheme.length > 0
        ? `${themes.length} themes${emitter.limits ? `  (${emitter.limits})` : ''}`
        : sharedOutputs.length > 0
          ? sharedOutputs.map((out) => basename(out.path)).join(' ')
          : `no files  (${emitter.limits ?? 'nothing to write'})`

    console.log(`  ${emitter.id.padEnd(16)} ${label}`)
  }

  const bundle = bundleOf(themes)
  const tables = shellTables(bundle.palettes, commons.works)

  const shared = [
    { path: 'builtin.json', content: bundleJson(bundle) },
    { path: 'shell/palettes.zsh', content: tables.palettes },
    { path: 'shell/start.zsh', content: tables.start },
  ]

  for (const out of shared) {
    await Bun.write(join(DIST, out.path), out.content)
    count++
  }

  writeFileSync(join(ROOT, 'site', 'commons.json'), readFileSync(AUTHORITY_PATH))

  console.log(`  ${'shared'.padEnd(16)} ${shared.map((out) => out.path).join(' ')}`)

  console.log(`\n${themes.length} themes, ${commons.works.length} works -> ${count} files in dist/`)
}
