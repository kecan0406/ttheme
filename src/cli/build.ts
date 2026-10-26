import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import {
  aboutOf,
  type Commons,
  commonsProblems,
  RENAMES_FILE,
  readRenames,
  readWork,
  WORKS_DIR,
} from '../core/commons.ts'
import { checkAll } from '../core/contrast.ts'
import {
  BUILTIN,
  fail,
  inOther,
  MARKETPLACE_FILE,
  readTheme,
  rotation,
  slugProblem,
  str,
  type Theme,
  toml,
} from '../core/theme.ts'
import { WIRED } from '../core/wired.ts'
import { ROOT } from '../root.ts'
import type { Emitter } from '../terminals/emit/types.ts'
import { WIRINGS } from '../terminals/index.ts'
import { bundleJson, bundleOf, commonsJson } from './emit-manifest.ts'
import { palettesZsh } from './emit-shell.ts'

export const BUILTIN_DIR = join(ROOT, 'builtin')
export const COMMONS_DIR = join(ROOT, 'commons')
const DIST = join(ROOT, 'dist')

const TERMINAL_EMITTERS: Emitter[] = WIRED.map((id) => WIRINGS[id].emitter)

export const EMITTED = TERMINAL_EMITTERS.map((e) => e.id)

export interface Builtin {
  themes: Theme[]
  fallback: string
}

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

export function loadCommons(dir: string): Commons {
  const works = tomlFiles(join(dir, WORKS_DIR), WORKS_DIR).map((file) =>
    readWork(`${WORKS_DIR}/${file}`, readFileSync(join(dir, WORKS_DIR, file), 'utf8'), basename(file, '.toml')),
  )

  const at = join(dir, RENAMES_FILE)
  const renames = existsSync(at) ? readRenames(RENAMES_FILE, readFileSync(at, 'utf8')) : {}
  const problems = commonsProblems(works)

  for (const [from, to] of Object.entries(renames)) {
    if (!aboutOf(works, to)?.known) {
      problems.push(`${RENAMES_FILE}: ${from} moves to ${to}, which the commons does not hold`)
    }
  }

  if (problems.length > 0) {
    throw new Error(`the commons does not hold together:\n  ${problems.join('\n  ')}`)
  }

  return { works, renames }
}

export function loadBuiltin(dir: string, commons: Commons): Builtin {
  const doc = toml(MARKETPLACE_FILE, readFileSync(join(dir, MARKETPLACE_FILE), 'utf8'))

  if (doc.name !== BUILTIN) {
    fail(MARKETPLACE_FILE, `name must be "${BUILTIN}", the built-in marketplace's name`)
  }

  const fallback = `${BUILTIN}/${str(MARKETPLACE_FILE, 'fallback', doc.fallback)}`

  const themes = tomlFiles(join(dir, 'palettes'), 'palettes').map((file) => {
    const slug = basename(file, '.toml')
    const problem = slugProblem(slug)

    if (problem) {
      fail(`palettes/${file}`, `the file name ${slug} ${problem} — it is the palette's name`)
    }

    const theme = readTheme(`palettes/${file}`, readFileSync(join(dir, 'palettes', file), 'utf8'), {
      name: `${BUILTIN}/${slug}`,
      builtin: true,
    })

    if (theme.subject !== undefined && !aboutOf(commons.works, theme.subject)?.known) {
      fail(`palettes/${file}`, `subject "${theme.subject}" is not in the commons — add it to commons/works first`)
    }

    return theme
  })

  if (!themes.some((t) => t.name === fallback)) {
    fail(MARKETPLACE_FILE, `fallback "${fallback}" is not one of its palettes`)
  }

  return { themes, fallback }
}

export async function build({ only }: { only?: string[] } = {}): Promise<void> {
  if (typeof Bun === 'undefined') {
    throw new Error('needs bun — run it from a checkout: bun src/bin.ts build')
  }

  const terminals = only && only.length > 0 ? TERMINAL_EMITTERS.filter((e) => only.includes(e.id)) : TERMINAL_EMITTERS
  const commons = loadCommons(COMMONS_DIR)
  const { themes, fallback } = loadBuiltin(BUILTIN_DIR, commons)

  const violations = [
    ...checkAll(themes),
    ...checkAll(themes.flatMap(inOther)).map((v) => ({ ...v, theme: `${v.theme} in its other mode` })),
  ]

  if (violations.length > 0) {
    for (const v of violations) {
      console.error(`  ✗ ${v.theme} [${v.rule}] ${v.detail}`)
    }

    throw new Error(
      `${violations.length} contrast violation(s). Fix the palette, or waive the rule in its [contrast] section with a reason.`,
    )
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

  const bundle = bundleOf(themes, fallback)

  const shared = [
    { path: 'builtin.json', content: bundleJson(bundle) },
    { path: 'commons.json', content: commonsJson(commons) },
    { path: 'shell/palettes.zsh', content: palettesZsh(bundle.palettes, commons.works) },
  ]

  for (const out of shared) {
    await Bun.write(join(DIST, out.path), out.content)
    count++
  }

  console.log(`  ${'shared'.padEnd(16)} ${shared.map((out) => out.path).join(' ')}`)

  console.log(
    `\n${themes.length} themes (${rotation(themes, fallback).length} in the new-tab rotation), ${commons.works.length} works -> ${count} files in dist/`,
  )
}
