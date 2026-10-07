import { type BrowseIo, BrowsePanel, type BrowseResult, type Market } from './browse-panel.ts'
import { available, readCatalog, readKept, updatesOf } from './catalog.ts'
import { HUB_CLOSED, hubOf } from './hub.ts'
import { reload, takeUpdates } from './installs.ts'
import { liveOf } from './live.ts'
import { listed, type PaletteEntry } from './manifest.ts'
import { dropCache, findMarkets, idOf, keptNote, lastUpdate, withMarkets } from './markets.ts'
import { knowAliases } from './names.ts'
import { colorless } from './osc.ts'
import { readMarketDir, warning } from './own.ts'
import { promptFx } from './palette-prompt.ts'
import { commit, configHome, forget, type Installed, readInstalled, worn, writeInstalled } from './palettes.ts'
import { into, say } from './pending.ts'
import { bringPictures } from './pictures.ts'
import {
  AUTO_TIMEOUT,
  applyRefreshed,
  cachedEntries,
  cachedMarket,
  counted,
  dueSources,
  type Fetched,
  fetchMarket,
  readTries,
  refreshMarket,
  storeMarket,
  type Tried,
  updateNote,
} from './refresh.ts'
import { autoWanted } from './release.ts'
import {
  autoUpdates,
  isLocal,
  isRemote,
  localIdentity,
  marketId,
  marketsOf,
  OFFICIAL,
  repoOf,
  shownSource,
} from './sources.ts'
import { alphabetical, marketOf } from './theme.ts'
import { readTone } from './tone.ts'

function marketState(home: string, state: Installed, source: string, tries: Record<string, Tried>): Market {
  const market = source === OFFICIAL ? undefined : cachedMarket(home, source)
  let id: string
  try {
    id = market?.id ?? idOf(home, source)
  } catch {
    id = isRemote(source) ? repoOf(source) : shownSource(source)
  }
  return {
    source,
    id,
    ...(market?.info.description ? { description: market.info.description } : {}),
    shown: shownSource(source),
    entries: source === OFFICIAL ? cachedEntries(home, source) : (market?.entries ?? []),
    auto: autoUpdates(source, state.updates),
    status: lastUpdate(home, source, tries),
  }
}

function updateNames(home: string): string[] {
  return updatesOf(home, readCatalog(home, false)).map((e) => e.name)
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
        const market = marketState(home, state, source, readTries())
        return {
          market,
          refreshed: {
            source,
            id: market.id,
            count: listed(market.entries).length,
            change: { added: [], changed: [], gone: [] },
          },
          updates: updateNames(home),
        }
      }
      const refreshed = await refreshMarket(home, source, AUTO_TIMEOUT)
      return { market: marketState(home, state, source, readTries()), refreshed, updates: updateNames(home) }
    },
    fetch: async (source) => {
      if (isLocal(source)) {
        const info = localIdentity(source)
        const id = marketId(info)
        return {
          source,
          id,
          ...(info.description ? { description: info.description } : {}),
          shown: shownSource(source),
          entries: readMarketDir(source, id, cachedEntries(home, OFFICIAL), warning(false)),
          auto: false,
          status: 'read in place',
        }
      }
      const got = await fetchMarket(home, source, undefined, lookups)
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
    search: (query) => findMarkets(query, lookups),
    apply,
  }
}

function applyAndSay(...args: Parameters<typeof applyRefreshed>): void {
  for (const line of applyRefreshed(...args)) {
    say(line)
  }
}

function marketChanges(result: BrowseResult, markets: Market[], wanted: string[]): string[] {
  const lines: string[] = []
  for (const m of result.adds) {
    const auto = m.source !== OFFICIAL && (result.auto[m.source] ?? m.auto)
    lines.push(
      `Added ${m.id} · ${m.shown} — ${counted(listed(m.entries).length)}${auto ? ', updating on its own' : ''}`,
    )
  }
  for (const source of result.removes) {
    const id = markets.find((m) => m.source === source)?.id ?? source
    lines.push(`Removed ${id} · ${shownSource(source)}`)
    const kept = wanted.filter((name) => (marketOf(name) ?? OFFICIAL) === id)
    if (kept.length > 0) {
      lines.push(keptNote(kept))
    }
  }
  for (const [source, on] of Object.entries(result.auto)) {
    const market = markets.find((m) => m.source === source)
    if (market && !result.removes.includes(source)) {
      lines.push(`${market.id} ${on ? 'updates on its own now' : 'no longer updates on its own'}`)
    }
  }
  return lines
}

async function applyBrowse(
  home: string,
  markets: Market[],
  result: BrowseResult,
  fetched: Map<string, Fetched>,
): Promise<void> {
  const current = readInstalled(home)
  const moved = result.adds.length + result.removes.length + Object.keys(result.auto).length > 0
  for (const m of result.adds) {
    const got = fetched.get(m.source)
    if (got) {
      storeMarket(home, got)
    }
  }
  for (const source of result.removes) {
    dropCache(home, source)
  }
  const sources = [
    ...marketsOf(current.markets).filter((s) => !result.removes.includes(s)),
    ...result.adds.map((m) => m.source),
  ]
  const placed = withMarkets(current, sources, { ...current.updates, ...result.auto })
  if (moved) {
    writeInstalled(home, placed)
  }
  const catalog = readCatalog(home, false)
  const wanted = available(home, catalog, false)
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
  commit(home, catalog, current, next)
  forget(home, catalog, current.terminals, dropped)
  for (const line of marketChanges(result, markets, wanted)) {
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
    available(home, catalog, false).palettes.filter((e) => added.includes(e.name)),
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
  const markets = marketsOf(state.markets).map((source) => marketState(home, state, source, tries))
  const names = new Set(markets.flatMap((m) => m.entries.map((e) => e.name)))
  const kept = was.filter((e) => state.palettes.includes(e.name) && !names.has(e.name))
  knowAliases([...markets.flatMap((m) => m.entries), ...kept])
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
    markets,
    kept,
    installed: state.palettes,
    updates: updateNames(home),
    tuned: Object.keys(readTone(home)),
    ...(startup ? { startup } : {}),
    ...(hub ? { hub } : {}),
    due: auto ? dueSources(home, state) : [],
    io: browseIo(home, state, fetched, lookups.signal, (result, report) =>
      into({ say: report.say, set: report.status }, () => applyBrowse(home, markets, result, fetched)),
    ),
    ...(process.env.TTHEME_SORT === 'series' ? {} : { order: alphabetical }),
    color: !colorless(),
    lookups: process.env.TTHEME_MARKET_LOOKUP !== 'off',
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
