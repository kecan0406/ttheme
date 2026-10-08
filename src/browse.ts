import { available, readKept, readMarketplaces, updatesOf } from './available.ts'
import { type BrowseIo, BrowsePanel, type BrowseResult, type Marketplace } from './browse-panel.ts'
import { HUB_CLOSED, hubOf } from './hub.ts'
import { reload, takeUpdates } from './installs.ts'
import { liveOf } from './live.ts'
import { listed, type PaletteEntry } from './manifest.ts'
import { dropCache, findMarketplaces, idOf, keptNote, lastUpdate, withMarketplaces } from './marketplaces.ts'
import { knowAliases } from './names.ts'
import { colorless } from './osc.ts'
import { readMarketplaceDir, warning } from './own.ts'
import { promptFx } from './palette-prompt.ts'
import { commit, configHome, forget, type Installed, readInstalled, worn, writeInstalled } from './palettes.ts'
import { into, say } from './pending.ts'
import { bringPictures } from './pictures.ts'
import {
  AUTO_TIMEOUT,
  applyRefreshed,
  cachedEntries,
  cachedMarketplace,
  counted,
  dueSources,
  type Fetched,
  fetchMarketplace,
  readTries,
  refreshMarketplace,
  storeMarketplace,
  type Tried,
  updateNote,
} from './refresh.ts'
import { autoWanted } from './release.ts'
import {
  autoUpdates,
  isLocal,
  isRemote,
  localIdentity,
  marketplaceId,
  marketplacesOf,
  OFFICIAL,
  repoOf,
  shownSource,
} from './sources.ts'
import { alphabetical, marketplaceOf } from './theme.ts'
import { readTone } from './tone.ts'

function marketplaceState(home: string, state: Installed, source: string, tries: Record<string, Tried>): Marketplace {
  const marketplace = source === OFFICIAL ? undefined : cachedMarketplace(home, source)
  let id: string
  try {
    id = marketplace?.id ?? idOf(home, source)
  } catch {
    id = isRemote(source) ? repoOf(source) : shownSource(source)
  }
  return {
    source,
    id,
    ...(marketplace?.info.description ? { description: marketplace.info.description } : {}),
    shown: shownSource(source),
    entries: source === OFFICIAL ? cachedEntries(home, source) : (marketplace?.entries ?? []),
    auto: autoUpdates(source, state.updates),
    status: lastUpdate(home, source, tries),
  }
}

function updateNames(home: string): string[] {
  return updatesOf(home, readMarketplaces(home, false)).map((e) => e.name)
}

function browseIo(
  home: string,
  state: Installed,
  fetched: Map<string, Fetched>,
  lookups: AbortSignal,
  apply: BrowseIo['apply'],
): BrowseIo {
  return {
    refresh: async (source) => {
      if (isLocal(source)) {
        const marketplace = marketplaceState(home, state, source, readTries())
        return {
          marketplace,
          refreshed: {
            source,
            id: marketplace.id,
            count: listed(marketplace.entries).length,
            change: { added: [], changed: [], gone: [] },
          },
          updates: updateNames(home),
        }
      }
      const refreshed = await refreshMarketplace(home, source, AUTO_TIMEOUT)
      return { marketplace: marketplaceState(home, state, source, readTries()), refreshed, updates: updateNames(home) }
    },
    fetch: async (source) => {
      if (isLocal(source)) {
        const info = localIdentity(source)
        const id = marketplaceId(info)
        return {
          source,
          id,
          ...(info.description ? { description: info.description } : {}),
          shown: shownSource(source),
          entries: readMarketplaceDir(source, id, cachedEntries(home, OFFICIAL), warning(false)),
          auto: false,
          status: 'read in place',
        }
      }
      const got = await fetchMarketplace(home, source, undefined, lookups)
      fetched.set(source, got)
      return {
        source,
        id: got.id,
        ...('info' in got && got.info.description ? { description: got.info.description } : {}),
        shown: shownSource(source),
        entries: got.entries,
        auto: autoUpdates(source, {}),
        status: 'not added yet',
      }
    },
    search: (query) => findMarketplaces(query, lookups),
    apply,
  }
}

function applyAndSay(...args: Parameters<typeof applyRefreshed>): void {
  for (const line of applyRefreshed(...args)) {
    say(line)
  }
}

function marketplaceChanges(result: BrowseResult, marketplaces: Marketplace[], wanted: string[]): string[] {
  const lines: string[] = []
  for (const m of result.adds) {
    const auto = m.source !== OFFICIAL && (result.auto[m.source] ?? m.auto)
    lines.push(
      `Added ${m.id} · ${m.shown} — ${counted(listed(m.entries).length)}${auto ? ', updating on its own' : ''}`,
    )
  }
  for (const source of result.removes) {
    const id = marketplaces.find((m) => m.source === source)?.id ?? source
    lines.push(`Removed ${id} · ${shownSource(source)}`)
    const kept = wanted.filter((name) => (marketplaceOf(name) ?? OFFICIAL) === id)
    if (kept.length > 0) {
      lines.push(keptNote(kept))
    }
  }
  for (const [source, on] of Object.entries(result.auto)) {
    const marketplace = marketplaces.find((m) => m.source === source)
    if (marketplace && !result.removes.includes(source)) {
      lines.push(`${marketplace.id} ${on ? 'updates on its own now' : 'no longer updates on its own'}`)
    }
  }
  return lines
}

async function applyBrowse(
  home: string,
  marketplaces: Marketplace[],
  result: BrowseResult,
  fetched: Map<string, Fetched>,
): Promise<void> {
  const current = readInstalled(home)
  const moved = result.adds.length + result.removes.length + Object.keys(result.auto).length > 0
  for (const m of result.adds) {
    const got = fetched.get(m.source)
    if (got) {
      storeMarketplace(home, got)
    }
  }
  for (const source of result.removes) {
    dropCache(home, source)
  }
  const sources = [
    ...marketplacesOf(current.marketplaces).filter((s) => !result.removes.includes(s)),
    ...result.adds.map((m) => m.source),
  ]
  const placed = withMarketplaces(current, sources, { ...current.updates, ...result.auto })
  if (moved) {
    writeInstalled(home, placed)
  }
  const manifest = readMarketplaces(home, false)
  const wanted = available(home, manifest, false)
    .palettes.filter((e) => result.picked.has(e.name))
    .map((e) => e.name)
  const dropped = current.palettes.filter((n) => !wanted.includes(n))
  const added = wanted.filter((n) => !current.palettes.includes(n))
  const renew = result.renew.filter((n) => wanted.includes(n))
  if (!moved && added.length === 0 && dropped.length === 0 && renew.length === 0) {
    applyAndSay(home, result.refreshed)
    say('Nothing changed')
    return
  }
  const next = { ...placed, palettes: wanted }
  commit(home, manifest, current, next)
  forget(home, manifest, current.terminals, dropped)
  for (const line of marketplaceChanges(result, marketplaces, wanted)) {
    say(line)
  }
  for (const name of added) {
    say(`  + ${name}`)
  }
  for (const name of dropped) {
    say(`  - ${name}`)
  }
  for (const line of applyRefreshed(home, result.refreshed)) {
    say(line)
  }
  await bringPictures(
    home,
    available(home, manifest, false).palettes.filter((e) => added.includes(e.name)),
    next.terminals,
  )
  if (renew.length > 0) {
    await takeUpdates(home, renew)
    for (const name of renew) {
      say(`  ↑ ${name}`)
    }
  }
  if (added.length > 0 || dropped.length > 0) {
    reload(next.palettes.length)
  }
}

export async function runBrowse(): Promise<number> {
  const hub = hubOf(process.env)
  const home = configHome()
  const state = readInstalled(home)
  const was = readKept(home)
  const tries = readTries()
  const auto = autoWanted()
  const marketplaces = marketplacesOf(state.marketplaces).map((source) => marketplaceState(home, state, source, tries))
  const names = new Set(marketplaces.flatMap((m) => m.entries.map((e) => e.name)))
  const kept = was.filter((e) => state.palettes.includes(e.name) && !names.has(e.name))
  knowAliases([...marketplaces.flatMap((m) => m.entries), ...kept])
  const fetched = new Map<string, Fetched>()
  const lookups = new AbortController()
  const tty = process.stdout.isTTY === true
  const live = liveOf(process.env, tty, home)
  const saved = live && !hub ? await live.saved() : new Map<string, string>()
  const startup = worn(state)
  if (hub) {
    process.stdout.write('\x1b[?2026h')
  }
  const panel = new BrowsePanel({
    marketplaces,
    kept,
    installed: state.palettes,
    updates: updateNames(home),
    tuned: Object.keys(readTone(home)),
    ...(startup ? { startup } : {}),
    ...(hub ? { hub } : {}),
    due: auto ? dueSources(home, state) : [],
    io: browseIo(home, state, fetched, lookups.signal, (result, report) =>
      into({ say: report.say, set: report.status }, () => applyBrowse(home, marketplaces, result, fetched)),
    ),
    ...(process.env.TTHEME_SORT === 'catalog' ? {} : { order: alphabetical }),
    color: !colorless(),
    lookups: process.env.TTHEME_MARKETPLACE_LOOKUP !== 'off',
    fx: promptFx(process.env.TTHEME_FX),
    owns: tty && !hub,
    ...(live ? { onFocus: (entry: PaletteEntry) => process.stdout.write(live.paint(entry)) } : {}),
  })
  try {
    await panel.run()
  } finally {
    live?.stop?.()
    if (live && (!hub || panel.next() === undefined)) {
      process.stdout.write(live.restore(saved))
    }
    lookups.abort()
  }
  await panel.idle()
  const result = panel.result()
  const go = panel.next()
  if (hub && go !== undefined) {
    applyAndSay(home, result.refreshed)
    return go
  }
  if (tty && hub) {
    process.stdout.write('\x1b[?1049l\x1b[?25h')
  }
  for (const refreshed of result.refreshed) {
    const note = updateNote(refreshed)
    if (note) {
      console.log(note)
    }
  }
  if (panel.applied()) {
    for (const line of panel.lines()) {
      console.log(line)
    }
    const failure = panel.failure()
    if (failure) {
      throw failure
    }
  } else {
    for (const line of applyRefreshed(home, result.refreshed)) {
      console.log(line)
    }
    console.log('Nothing changed')
  }
  return hub ? HUB_CLOSED : 0
}
