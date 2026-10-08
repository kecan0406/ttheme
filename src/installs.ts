import { existsSync } from 'node:fs'
import { available, readCatalog, readKept, search, updatesOf, writeKept } from './catalog.ts'
import { adopt } from './craft.ts'
import { liveOf } from './live.ts'
import { listed, type Manifest, type PaletteEntry } from './manifest.ts'
import { addSource, idOf, localLine } from './marketplaces.ts'
import { knowAliases } from './names.ts'
import { colorless } from './osc.ts'
import { codeOf, readLocal, SHARE_URL } from './own.ts'
import { PalettePrompt, type PickerScope, promptFx } from './palette-prompt.ts'
import { commit, configHome, forget, readInstalled, startupPalette, sync } from './palettes.ts'
import { pending, say } from './pending.ts'
import { bringPictures, since } from './pictures.ts'
import { applyRefreshed, attempt, failureLine, type Refreshed, refreshLine, updatesLine } from './refresh.ts'
import { newerRelease, upgradeTo } from './release.ts'
import { installedPath, isLocal, marketplaceSources, OFFICIAL, shownSource } from './sources.ts'
import { type Wired, wirings } from './terminals/index.ts'
import type { Pointed } from './terminals/types.ts'
import { alphabetical, marketplaceOf, shelfOf } from './theme.ts'
import { readTone } from './tone.ts'

export function reload(count: number): void {
  say(`\n${count} palettes installed — open a new tab, or reload your terminal config`)
}

export function inMarketplace(given: string[], id: string): string[] {
  return given.map((name) => {
    if (codeOf(name)) {
      return name
    }
    const marketplace = marketplaceOf(name)
    if (marketplace === undefined) {
      return id === OFFICIAL ? name : `${id}/${name}`
    }
    if (marketplace !== id) {
      throw new Error(`${name} is not in ${id} — give its bare name, or leave --marketplace out`)
    }
    return name
  })
}

export async function runAdd(asked: string[], marketplace?: string): Promise<void> {
  const link = asked.find((n) => /^https?:\/\//i.test(n.trim()) && !codeOf(n))
  if (link) {
    throw new Error(`${link} is not a share link — one reads ${SHARE_URL}tt2:…`)
  }
  const home = configHome()
  const given = marketplace ? inMarketplace(asked, (await addSource(home, marketplace)).id) : asked
  const catalog = readCatalog(home)
  const shared = new Map<string, PaletteEntry>()
  const names = [
    ...new Set(
      given.map((n) => {
        const code = codeOf(n)
        if (!code) {
          return n
        }
        const entry = adopt(home, code, catalog)
        shared.set(entry.name, entry)
        return entry.name
      }),
    ),
  ]
  const state = readInstalled(home)
  const already = names.filter((n) => state.palettes.includes(n))
  const fresh = names.filter((n) => !state.palettes.includes(n))
  if (fresh.length === 0) {
    sync(home, catalog, state)
    console.log(`Already installed: ${already.join(', ')}`)
    return
  }
  const next = { ...state, palettes: [...state.palettes, ...fresh] }
  commit(home, catalog, state, next)
  for (const name of fresh) {
    console.log(`  + ${name}`)
  }
  await bringPictures(
    home,
    available(home, catalog, false)
      .palettes.filter((e) => fresh.includes(e.name))
      .map((e) => {
        const code = shared.get(e.name)
        return code ? { ...e, pictures: code.pictures } : e
      }),
    next.terminals,
  )
  reload(next.palettes.length)
}

export function runRemove(names: string[]): number {
  const home = configHome()
  const catalog = readCatalog(home)
  const state = readInstalled(home)
  const gone = names.filter((n) => state.palettes.includes(n))
  const absent = names.filter((n) => !state.palettes.includes(n))
  if (gone.length === 0) {
    throw new Error(`not installed: ${absent.join(', ')} — \`ttheme list\` marks what is`)
  }
  const next = { ...state, palettes: state.palettes.filter((n) => !gone.includes(n)) }
  commit(home, catalog, state, next)
  forget(home, catalog, state.terminals, gone)
  for (const name of gone) {
    console.log(`  - ${name}`)
  }
  reload(next.palettes.length)
  if (absent.length > 0) {
    console.error(`ttheme remove: not installed: ${absent.join(', ')}`)
    return 1
  }
  return 0
}

export function runDefault(name: string): void {
  const home = configHome()
  const catalog = readCatalog(home)
  const state = readInstalled(home)
  if (!state.palettes.includes(name)) {
    throw new Error(`${name} is not installed — \`ttheme add ${name}\` first`)
  }
  const { off: _, ...rest } = state
  const pointed = commit(home, catalog, state, { ...rest, startup: name }, true)
  console.log(defaultNote(name, state.terminals, pointed).join('\n'))
}

export function runSync(): void {
  const home = configHome()
  sync(home, readCatalog(home), readInstalled(home))
}

export function runOn(): void {
  const home = configHome()
  const state = readInstalled(home)
  const name = startupPalette(state)
  if (!name) {
    throw new Error('no palettes installed — `ttheme` picks some')
  }
  if (!state.off) {
    console.log(`Already on · ${name}`)
    return
  }
  const { off: _, ...next } = state
  const pointed = commit(home, readCatalog(home), state, next)
  console.log(defaultNote(name, next.terminals, pointed).join('\n'))
}

export function runOff(): void {
  const home = configHome()
  const state = readInstalled(home)
  if (state.off) {
    console.log('Already off')
    return
  }
  const pointed = commit(home, readCatalog(home), state, { ...state, off: true })
  const name = startupPalette(state)
  console.log(`Off · new tabs open in the terminal's own colors${name ? ` — \`ttheme on\` wears ${name} again` : ''}`)
  for (const wiring of wirings(state.terminals)) {
    if (pointed.get(wiring.id)?.restart) {
      console.log(`${wiring.name} new tabs open on your own profile once ${wiring.name} restarts`)
    }
  }
}

function defaultNote(name: string, terminals: Wired[], pointed: ReadonlyMap<Wired, Pointed>): string[] {
  const wearing = wirings(terminals).filter((wiring) => !wiring.defaults)
  const lines =
    wearing.length > 0
      ? [
          `Default ${name} · ${wearing.map((wiring) => wiring.name).join(', ')} open new tabs with it once their config reloads`,
        ]
      : []
  for (const wiring of wirings(terminals)) {
    const profile = wiring.defaults?.profile(name)
    if (profile) {
      lines.push(
        pointed.get(wiring.id)?.restart
          ? `${wiring.name} new tabs open with it once ${wiring.name} restarts — "${profile}" is now its default profile`
          : `${wiring.name} new tabs open with it — "${profile}" is its default profile`,
      )
    }
  }
  return lines.length > 0
    ? lines
    : [`Default ${name} · no terminal is wired to open with it — \`ttheme init\` wires one`]
}

type Source = 'marketplace' | 'mine' | 'kept'

function sources(home: string, catalog: Manifest): Map<string, Source> {
  const out = new Map<string, Source>(catalog.palettes.map((p) => [p.name, 'marketplace']))
  for (const p of readLocal(home, catalog.palettes, false)) {
    out.set(p.name, 'mine')
  }
  return out
}

export function runList(query: string | undefined, json = false): void {
  const home = configHome()
  const catalog = readCatalog(home)
  const installed = new Set(readInstalled(home).palettes)
  const from = sources(home, catalog)
  const all = listed(available(home, catalog).palettes)
  if (query) knowAliases(all)
  const hits = alphabetical(query ? search(all, query) : all)
  const source = (name: string): Source => from.get(name) ?? 'kept'
  if (json) {
    const rows = hits.map((p) => ({
      name: p.name,
      marketplace: marketplaceOf(p.name) ?? OFFICIAL,
      ...(p.catalog ? { catalog: p.catalog } : {}),
      installed: installed.has(p.name),
      source: source(p.name),
    }))
    console.log(JSON.stringify(rows, null, 2))
    return
  }
  const pad = Math.max(...hits.map((p) => p.name.length), 0)
  const note: Record<Source, string> = { marketplace: '', mine: '  · yours', kept: '  · in no marketplace you added' }
  const tone = readTone(home)
  for (const p of hits) {
    const tuned = tone[p.name] ? '  · tuned' : ''
    console.log(
      `  ${installed.has(p.name) ? '●' : '○'} ${p.name.padEnd(pad)}  ${shelfOf(p)}${note[source(p.name)]}${tuned}`,
    )
  }
  if (process.stdout.isTTY) {
    const shown = query ? `${hits.length} of ${all.length}` : `${all.length}`
    console.log(`\n${shown} palettes — ${hits.filter((p) => installed.has(p.name)).length} installed`)
  }
}

function marketplaceNamed(home: string, sources: string[], name: string): string {
  const id = (source: string) => {
    try {
      return idOf(home, source)
    } catch {
      return undefined
    }
  }
  const hit = sources.find((s) => s === name || shownSource(s) === name || id(s) === name)
  if (!hit) {
    throw new Error(`no marketplace named ${name} — \`ttheme marketplace\` lists them`)
  }
  return hit
}

export async function runUpdate(asked: string[] = []): Promise<number> {
  const home = configHome()
  const all = marketplaceSources(home)
  const named = asked.map((name) => marketplaceNamed(home, all, name))
  const release = await newerRelease()
  let stuck = false
  if (release.latest) {
    try {
      return upgradeTo(release.latest, asked)
    } catch (error) {
      stuck = true
      console.log(`  ttheme could not update to ${release.latest}: ${(error as Error).message}`)
    }
  } else {
    console.log(release.note)
  }
  const marketplaces = (named.length > 0 ? named : all).filter((source) => source !== OFFICIAL)
  if (named.length === 0 && marketplaces.length === 0) {
    console.log('No marketplaces to update — `ttheme marketplace add <owner>/<repo>` adds one')
  }
  const kept = (source: string, failure: Error): string =>
    `${failureLine(source, failure)} — kept the copy from the last update`
  for (const source of marketplaces.filter(isLocal)) {
    try {
      console.log(`  ${localLine(home, source)}`)
    } catch (error) {
      console.log(`  ${kept(source, error as Error)}`)
    }
  }
  const remote = marketplaces.filter((source) => !isLocal(source))
  const waiting = new Set(remote)
  const done: Refreshed[] = []
  const line = pending()
  const show = (): void =>
    line.set(
      `Updating ${[...waiting].map(shownSource).join(', ')}${remote.length > 1 ? ` · ${remote.length - waiting.size}/${remote.length}` : ''}`,
    )
  show()
  await Promise.all(
    remote.map(async (source) => {
      const outcome = await attempt(home, source)
      if ('refreshed' in outcome) {
        done.push(outcome.refreshed)
      }
      waiting.delete(source)
      if (waiting.size > 0) {
        show()
      } else {
        line.done()
      }
      line.say(`  ${'refreshed' in outcome ? refreshLine(outcome.refreshed) : kept(source, outcome.failure)}`)
    }),
  )
  line.done()
  if (!existsSync(installedPath(home))) {
    return stuck ? 1 : 0
  }
  for (const moved of applyRefreshed(home, done)) {
    console.log(`  ${moved}`)
  }
  const updates = updatesLine(home)
  if (updates) {
    console.log(updates)
  }
  return stuck ? 1 : 0
}

export async function takeUpdates(home: string, names: string[]): Promise<void> {
  const catalog = readCatalog(home, false)
  const fresh = new Map(
    updatesOf(home, catalog)
      .filter((e) => names.includes(e.name))
      .map((e) => [e.name, e]),
  )
  if (fresh.size === 0) {
    return
  }
  const was = readKept(home)
  writeKept(
    home,
    was.map((e) => fresh.get(e.name) ?? e),
  )
  const state = readInstalled(home)
  sync(home, catalog, state)
  const pictures = new Map(was.map((e) => [e.name, e.pictures]))
  await bringPictures(
    home,
    available(home, catalog, false)
      .palettes.filter((e) => fresh.has(e.name))
      .map((e) => since(e, pictures.get(e.name))),
    state.terminals,
  )
}

export async function pickPalettes(
  catalog: Manifest,
  installed: string[],
  scope: PickerScope,
  required = false,
): Promise<string[] | undefined> {
  const entries = process.env.TTHEME_SORT === 'catalog' ? catalog.palettes : alphabetical(catalog.palettes)
  knowAliases(entries)
  const tty = process.stdout.isTTY === true
  const live = liveOf(process.env, tty, configHome())
  const saved = live ? await live.saved() : new Map<string, string>()
  const prompt = new PalettePrompt({
    entries,
    scope,
    installed,
    required,
    color: !colorless(),
    fx: promptFx(process.env.TTHEME_FX),
    onFocus: live ? (entry) => process.stdout.write(live.paint(entry)) : undefined,
  })
  const done = await prompt.prompt()
  if (live) {
    process.stdout.write(live.restore(saved))
  }
  if (done === 'cancel') {
    return undefined
  }
  return catalog.palettes.filter((e) => prompt.picked.has(e.name)).map((e) => e.name)
}
