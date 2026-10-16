import { readdirSync, readFileSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import { checkAll } from './contrast.ts'
import { meta } from './emit/manifest.ts'
import { shell } from './emit/shell.ts'
import type { Emitter } from './emit/types.ts'
import { WIRINGS } from './terminals/index.ts'
import { fail, inOther, MARKETPLACE_FILE, readCatalogs, readTheme, rotation, type Theme, toml } from './theme.ts'
import { WIRED } from './wired.ts'

const root = join(import.meta.dirname, '..')
const THEMES = join(root, 'themes')
const DIST = join(root, 'dist')

const TERMINAL_EMITTERS: Emitter[] = WIRED.map((id) => WIRINGS[id].emitter)
const SHARED_EMITTERS: Emitter[] = [shell, meta]

export const EMITTED = TERMINAL_EMITTERS.map((e) => e.id)

export async function build({ only }: { only?: string[] } = {}): Promise<void> {
  if (typeof Bun === 'undefined') {
    throw new Error('needs bun — run it from a checkout: bun src/bin.ts build')
  }

  const terminals = only && only.length > 0 ? TERMINAL_EMITTERS.filter((e) => only.includes(e.id)) : TERMINAL_EMITTERS

  const themes = loadThemes(THEMES)

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

  for (const emitter of [...terminals, ...SHARED_EMITTERS]) {
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

  console.log(
    `\n${themes.length} themes (${rotation(themes).length} in the new-tab rotation) -> ${count} files in dist/`,
  )
}

export function loadThemes(dir: string): Theme[] {
  const catalogs = readCatalogs(
    MARKETPLACE_FILE,
    toml(MARKETPLACE_FILE, readFileSync(join(dir, MARKETPLACE_FILE), 'utf8')).catalog,
  )

  if (catalogs.length === 0) {
    fail(MARKETPLACE_FILE, 'needs at least one [[catalog]] table')
  }

  const byName = new Map(catalogs.map((c) => [c.name, c]))
  const shelf = join(dir, 'palettes')

  const themes = readdirSync(shelf, { withFileTypes: true })
    .filter((item) => !item.name.startsWith('.'))
    .flatMap((item) => {
      if (!item.isDirectory()) {
        fail(
          `palettes/${item.name}`,
          'an official palette lives in a catalog folder, palettes/<catalog>/<palette>.toml',
        )
      }

      return readdirSync(join(shelf, item.name))
        .filter((f) => f.endsWith('.toml'))
        .map((f) =>
          readTheme(`palettes/${item.name}/${f}`, readFileSync(join(shelf, item.name, f), 'utf8'), {
            name: basename(f, '.toml'),
            catalog: item.name,
            catalogs: byName,
          }),
        )
    })
    .sort((a, b) => a.order - b.order)

  const orders = new Set(themes.map((t) => t.order))

  if (orders.size !== themes.length) {
    throw new Error('themes: meta.order must be unique across all themes')
  }

  const byCatalog = Map.groupBy(themes, (t) => t.catalog)

  for (const catalog of catalogs) {
    const members = byCatalog.get(catalog.name)

    if (!members) fail(MARKETPLACE_FILE, `catalog "${catalog.name}" has no palettes`)

    if (!members.some((t) => t.name === catalog.lead)) {
      fail(MARKETPLACE_FILE, `catalog "${catalog.name}" needs a lead, one of its palettes`)
    }
  }

  if ([...byCatalog.keys()].join('\n') !== catalogs.map((c) => c.name).join('\n')) {
    fail(MARKETPLACE_FILE, 'the [[catalog]] tables must follow the order meta.order gives their palettes')
  }

  return themes
}
