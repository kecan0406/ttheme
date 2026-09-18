import { existsSync } from 'node:fs'
import * as p from '@clack/prompts'
import { catalogPath, fetchCatalog, REGISTRY_URL, readCatalog, search, writeCatalog } from './catalog.ts'
import { listed } from './emit/manifest.ts'
import { paletteOsc, queryTerminalColors, restoreOsc } from './osc.ts'
import { PalettePrompt, promptFx } from './palette-prompt.ts'
import { configHome, forget, readInstalled, sync, writeInstalled } from './palettes.ts'
import { alphabetical } from './theme.ts'

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
  sync(home, catalog, next)
  writeInstalled(home, next)
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
  sync(home, catalog, next)
  forget(home, catalog, state.terminals, gone)
  writeInstalled(home, next)
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
  const next = { ...state, startup: name }
  sync(home, catalog, next)
  writeInstalled(home, next)
  console.log(`new tabs open with ${name} — reload your terminal config to pick it up`)
}

export function runList(query?: string): void {
  const home = configHome()
  const catalog = readCatalog(home)
  const installed = new Set(readInstalled(home).palettes)
  const all = listed(catalog.palettes)
  const hits = alphabetical(query ? search(all, query) : all)
  const pad = Math.max(...hits.map((p) => p.name.length), 0)
  for (const p of hits) {
    console.log(`  ${installed.has(p.name) ? '●' : '○'} ${p.name.padEnd(pad)}  ${p.group}`)
  }
  const shown = query ? `${hits.length} of ${all.length}` : `${all.length}`
  console.log(`\n${shown} palettes — ${hits.filter((p) => installed.has(p.name)).length} installed`)
}

export async function runUpdate(): Promise<void> {
  const home = configHome()
  const before = existsSync(catalogPath(home)) ? readCatalog(home).palettes.length : 0
  const catalog = await fetchCatalog(REGISTRY_URL)
  writeCatalog(home, catalog)
  const added = catalog.palettes.length - before
  console.log(`catalog ${catalog.version} — ${catalog.palettes.length} palettes${added > 0 ? ` (+${added})` : ''}`)
}

export async function runBrowse(): Promise<void> {
  const home = configHome()
  const catalog = readCatalog(home)
  const state = readInstalled(home)
  const entries = process.env.TTHEME_SORT === 'series' ? catalog.palettes : alphabetical(catalog.palettes)
  const live = process.stdout.isTTY === true && !process.env.NO_COLOR
  const saved = live ? await queryTerminalColors() : new Map<string, string>()
  const prompt = new PalettePrompt({
    entries,
    title: 'catalog',
    multi: true,
    installed: state.palettes,
    color: !process.env.NO_COLOR,
    fx: promptFx(process.env.TTHEME_FX),
    onFocus: live ? (entry) => process.stdout.write(paletteOsc(entry)) : undefined,
  })
  const done = await prompt.prompt()
  process.stdout.write(restoreOsc(saved))
  if (p.isCancel(done)) {
    console.log('nothing changed')
    return
  }
  const wanted = catalog.palettes.filter((e) => prompt.picked.has(e.name)).map((e) => e.name)
  const dropped = state.palettes.filter((n) => !prompt.picked.has(n))
  const added = wanted.filter((n) => !state.palettes.includes(n))
  if (added.length === 0 && dropped.length === 0) {
    console.log('nothing changed')
    return
  }
  const next = { ...state, palettes: wanted }
  sync(home, catalog, next)
  forget(home, catalog, state.terminals, dropped)
  writeInstalled(home, next)
  for (const name of added) {
    console.log(`  + ${name}`)
  }
  for (const name of dropped) {
    console.log(`  - ${name}`)
  }
  reload(next.palettes.length)
}
