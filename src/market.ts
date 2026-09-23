import { existsSync } from 'node:fs'
import * as p from '@clack/prompts'
import { catalogPath, fetchCatalog, REGISTRY_URL, readCatalog, search, writeCatalog } from './catalog.ts'
import { listed, type Manifest } from './emit/manifest.ts'
import { colorless, paletteOsc, queryTerminalColors, restoreOsc } from './osc.ts'
import { PalettePrompt, type PickerScope, promptFx } from './palette-prompt.ts'
import {
  configHome,
  forget,
  type Installed,
  itermDefaults,
  pointItermDefault,
  readInstalled,
  startupPalette,
  sync,
  withItermBase,
  worn,
  writeInstalled,
} from './palettes.ts'
import { alphabetical } from './theme.ts'
import type { InitTerminal } from './wiring.ts'

function commit(home: string, catalog: Manifest, before: Installed, after: Installed): boolean {
  const prefs = itermDefaults()
  const moves = Boolean(worn(before)) !== Boolean(worn(after))
  const next = moves ? withItermBase(after, prefs) : after
  sync(home, catalog, next)
  writeInstalled(home, next)
  return moves && pointItermDefault(next, prefs) && prefs.running()
}

function reload(count: number): void {
  console.log(`\n${count} palettes installed — open a new tab, or reload your terminal config`)
}

export function runAdd(names: string[]): void {
  const home = configHome()
  const catalog = readCatalog(home)
  const state = readInstalled(home)
  const already = names.filter((n) => state.palettes.includes(n))
  const fresh = names.filter((n) => !state.palettes.includes(n))
  if (fresh.length === 0) {
    console.log(`already installed: ${already.join(', ')}`)
    return
  }
  const next = { ...state, palettes: [...state.palettes, ...fresh] }
  commit(home, catalog, state, next)
  for (const name of fresh) {
    console.log(`  + ${name}`)
  }
  reload(next.palettes.length)
}

export function runRemove(names: string[]): void {
  const home = configHome()
  const catalog = readCatalog(home)
  const state = readInstalled(home)
  const gone = names.filter((n) => state.palettes.includes(n))
  if (gone.length === 0) {
    console.log(`not installed: ${names.join(', ')}`)
    return
  }
  const next = { ...state, palettes: state.palettes.filter((n) => !gone.includes(n)) }
  commit(home, catalog, state, next)
  forget(home, catalog, state.terminals, gone)
  for (const name of gone) {
    console.log(`  - ${name}`)
  }
  reload(next.palettes.length)
}

export function runDefault(name: string): void {
  const home = configHome()
  const catalog = readCatalog(home)
  const state = readInstalled(home)
  if (!state.palettes.includes(name)) {
    throw new Error(`${name} is not installed — \`ttheme add ${name}\` first`)
  }
  const { off: _, ...rest } = state
  const prefs = itermDefaults()
  const next = withItermBase({ ...rest, startup: name }, prefs)
  sync(home, catalog, next)
  writeInstalled(home, next)
  const moved = pointItermDefault(next, prefs)
  console.log(defaultNote(name, next.terminals, moved && prefs.running()).join('\n'))
}

export function runOn(): void {
  const home = configHome()
  const state = readInstalled(home)
  const name = startupPalette(state)
  if (!name) {
    throw new Error('no palettes installed — `ttheme browse` picks some')
  }
  if (!state.off) {
    console.log(`already on · ${name}`)
    return
  }
  const { off: _, ...next } = state
  const restart = commit(home, readCatalog(home), state, next)
  console.log(defaultNote(name, next.terminals, restart).join('\n'))
}

export function runOff(): void {
  const home = configHome()
  const state = readInstalled(home)
  if (state.off) {
    console.log('already off')
    return
  }
  const restart = commit(home, readCatalog(home), state, { ...state, off: true })
  const name = startupPalette(state)
  console.log(`off · new tabs open in the terminal's own colors${name ? ` — \`ttheme on\` wears ${name} again` : ''}`)
  if (restart) {
    console.log('iterm2 new tabs open on your own profile once iTerm2 restarts')
  }
}

function defaultNote(name: string, terminals: InitTerminal[], restart: boolean): string[] {
  const wearing = terminals.filter((t) => t !== 'iterm2')
  const lines =
    wearing.length > 0
      ? [`default ${name} · ${wearing.join(', ')} open new tabs with it once their config reloads`]
      : []
  if (terminals.includes('iterm2')) {
    lines.push(
      restart
        ? `iterm2 new tabs open with it once iTerm2 restarts — "ttheme · default" is now its default profile`
        : `iterm2 new tabs open with it — "ttheme · default" is its default profile`,
    )
  }
  return lines.length > 0
    ? lines
    : [`default ${name} · no terminal is wired to open with it — \`ttheme init\` wires one`]
}

export function runList(query: string | undefined, json = false): void {
  const home = configHome()
  const catalog = readCatalog(home)
  const installed = new Set(readInstalled(home).palettes)
  const all = listed(catalog.palettes)
  const hits = alphabetical(query ? search(all, query) : all)
  if (json) {
    const rows = hits.map((p) => ({ name: p.name, group: p.group, installed: installed.has(p.name) }))
    console.log(JSON.stringify(rows, null, 2))
    return
  }
  const pad = Math.max(...hits.map((p) => p.name.length), 0)
  for (const p of hits) {
    console.log(`  ${installed.has(p.name) ? '●' : '○'} ${p.name.padEnd(pad)}  ${p.group}`)
  }
  if (process.stdout.isTTY) {
    const shown = query ? `${hits.length} of ${all.length}` : `${all.length}`
    console.log(`\n${shown} palettes — ${hits.filter((p) => installed.has(p.name)).length} installed`)
  }
}

export async function runUpdate(): Promise<void> {
  const home = configHome()
  const before = existsSync(catalogPath(home)) ? readCatalog(home).palettes.length : 0
  const catalog = await fetchCatalog(REGISTRY_URL)
  writeCatalog(home, catalog)
  const added = catalog.palettes.length - before
  console.log(`catalog ${catalog.version} — ${catalog.palettes.length} palettes${added > 0 ? ` (+${added})` : ''}`)
}

export async function pickPalettes(
  catalog: Manifest,
  installed: string[],
  scope: PickerScope,
  required = false,
): Promise<string[] | undefined> {
  const entries = process.env.TTHEME_SORT === 'series' ? catalog.palettes : alphabetical(catalog.palettes)
  const live = process.stdout.isTTY === true && !colorless()
  const saved = live ? await queryTerminalColors() : new Map<string, string>()
  const prompt = new PalettePrompt({
    entries,
    scope,
    installed,
    required,
    color: !colorless(),
    fx: promptFx(process.env.TTHEME_FX),
    onFocus: live ? (entry) => process.stdout.write(paletteOsc(entry)) : undefined,
  })
  const done = await prompt.prompt()
  process.stdout.write(restoreOsc(saved))
  if (p.isCancel(done)) {
    return undefined
  }
  return catalog.palettes.filter((e) => prompt.picked.has(e.name)).map((e) => e.name)
}

export async function runBrowse(): Promise<void> {
  const home = configHome()
  const catalog = readCatalog(home)
  const state = readInstalled(home)
  const wanted = await pickPalettes(catalog, state.palettes, 'palette')
  if (!wanted) {
    console.log('nothing changed')
    return
  }
  const dropped = state.palettes.filter((n) => !wanted.includes(n))
  const added = wanted.filter((n) => !state.palettes.includes(n))
  if (added.length === 0 && dropped.length === 0) {
    console.log('nothing changed')
    return
  }
  const next = { ...state, palettes: wanted }
  commit(home, catalog, state, next)
  forget(home, catalog, state.terminals, dropped)
  for (const name of added) {
    console.log(`  + ${name}`)
  }
  for (const name of dropped) {
    console.log(`  - ${name}`)
  }
  reload(next.palettes.length)
}
