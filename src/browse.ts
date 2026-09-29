import { existsSync, readFileSync } from 'node:fs'
import * as p from '@clack/prompts'
import { type BrowseIo, BrowsePanel, type BrowseResult, type Market, type Problem } from './browse-panel.ts'
import { available, catalogPath, parseCatalog, readCachedIndex, readCatalog, readKept } from './catalog.ts'
import { listed, type PaletteEntry } from './emit/manifest.ts'
import { reload } from './market.ts'
import { dropCache, findMarkets, idOf, keptNote, lastUpdate, withMarkets } from './markets.ts'
import { colorless } from './osc.ts'
import { type MarketFile, marketFileProblem, marketFiles, readMarketDir, readOwnText } from './own.ts'
import { promptFx } from './palette-prompt.ts'
import { commit, configHome, forget, type Installed, readInstalled, worn, writeInstalled } from './palettes.ts'
import { bringPictures, since } from './pictures.ts'
import {
  AUTO_TIMEOUT,
  ago,
  applyRefreshed,
  cachedEntries,
  counted,
  dueSources,
  type Fetched,
  fetchedAt,
  fetchMarket,
  readTries,
  refreshMarket,
  storeMarket,
  type Tried,
  updateNote,
} from './refresh.ts'
import {
  autoUpdates,
  cachePath,
  isLocal,
  isRemote,
  localIdentity,
  marketId,
  marketsOf,
  OFFICIAL,
  repoOf,
  shownSource,
} from './sources.ts'
import { livePaint } from './terminal.ts'
import { alphabetical, marketOf } from './theme.ts'
import { warpLive } from './warp-live.ts'

function marketState(home: string, state: Installed, source: string, tries: Record<string, Tried>): Market {
  let id: string
  try {
    id = idOf(home, source)
  } catch {
    id = isRemote(source) ? repoOf(source) : shownSource(source)
  }
  let entries: PaletteEntry[] = []
  if (isLocal(source)) {
    try {
      entries = readMarketDir(source, id, cachedEntries(home, OFFICIAL), false)
    } catch {
      entries = []
    }
  } else {
    entries = cachedEntries(home, source)
  }
  return {
    source,
    id,
    shown: shownSource(source),
    entries,
    auto: autoUpdates(source, state.updates),
    status: lastUpdate(home, source, tries),
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function problemsOf(home: string, state: Installed, tries: Record<string, Tried>, markets: Market[]): Problem[] {
  const names = new Map(markets.map((m) => [m.source, m.id]))
  const problems: Problem[] = []
  for (const source of marketsOf(state.markets)) {
    const where = names.get(source) ?? shownSource(source)
    const failed = tries[source]
    const at = fetchedAt(home, source)
    if (failed && (at === undefined || failed.at > at)) {
      problems.push({ where, source, update: true, message: `Update failed ${ago(failed.at)}: ${failed.error}` })
    }
    if (source === OFFICIAL) {
      try {
        parseCatalog(readFileSync(catalogPath(home), 'utf8'))
      } catch (error) {
        problems.push({ where, source, message: `${shownSource(catalogPath(home))}: ${message(error)}` })
      }
    } else if (isRemote(source)) {
      if (!existsSync(cachePath(home, source))) {
        problems.push({ where, source, message: 'No copy of its index yet — `ttheme update` fetches it' })
      } else {
        try {
          readCachedIndex(home, source)
        } catch (error) {
          problems.push({ where, source, message: `${shownSource(cachePath(home, source))}: ${message(error)}` })
        }
      }
    } else {
      try {
        const id = marketId(localIdentity(source))
        const seen = new Map<string, MarketFile>()
        for (const file of marketFiles(source)) {
          try {
            const problem = marketFileProblem(file, seen)
            if (problem) {
              throw new Error(problem)
            }
            seen.set(file.slug, file)
            readOwnText(`${id}/${file.slug}`, readFileSync(file.path, 'utf8'), cachedEntries(home, OFFICIAL))
          } catch (error) {
            problems.push({ where: shownSource(file.path), message: message(error) })
          }
        }
      } catch (error) {
        problems.push({ where, message: message(error) })
      }
    }
  }
  return problems
}

function browseIo(home: string, state: Installed, fetched: Map<string, Fetched>, lookups: AbortSignal): BrowseIo {
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
        }
      }
      const refreshed = await refreshMarket(home, source, AUTO_TIMEOUT)
      return { market: marketState(home, state, source, readTries()), refreshed }
    },
    fetch: async (source) => {
      if (isLocal(source)) {
        const id = marketId(localIdentity(source))
        return {
          source,
          id,
          shown: shownSource(source),
          entries: readMarketDir(source, id, cachedEntries(home, OFFICIAL), false),
          auto: false,
          status: 'read in place',
        }
      }
      const got = await fetchMarket(source, undefined, lookups)
      fetched.set(source, got)
      return {
        source,
        id: got.id,
        shown: shownSource(source),
        entries: got.entries,
        auto: autoUpdates(source, {}),
        status: 'not added yet',
      }
    },
    search: (query) => findMarkets(query, lookups),
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
  was: PaletteEntry[],
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
  if (!moved && added.length === 0 && dropped.length === 0) {
    await applyRefreshed(home, current, was, result.refreshed)
    console.log('Nothing changed')
    return
  }
  const next = { ...placed, palettes: wanted }
  commit(home, catalog, current, next)
  forget(home, catalog, current.terminals, dropped)
  for (const line of marketChanges(result, markets, wanted)) {
    console.log(line)
  }
  for (const name of added) {
    console.log(`  + ${name}`)
  }
  for (const name of dropped) {
    console.log(`  - ${name}`)
  }
  const pictures = new Map(was.map((e) => [e.name, e.pictures]))
  const touched = new Set(result.refreshed.flatMap((r) => [...r.change.changed, ...r.change.gone]))
  const after = available(home, catalog, false).palettes
  await bringPictures(
    home,
    [
      ...after.filter((e) => added.includes(e.name)),
      ...after
        .filter(
          (e) => wanted.includes(e.name) && !added.includes(e.name) && touched.has(e.name) && pictures.has(e.name),
        )
        .map((e) => since(e, pictures.get(e.name))),
    ],
    next.terminals,
  )
  if (added.length > 0 || dropped.length > 0) {
    reload(next.palettes.length)
  }
}

export async function runBrowse(): Promise<void> {
  const home = configHome()
  const state = readInstalled(home)
  const was = readKept(home)
  const tries = readTries()
  const markets = marketsOf(state.markets).map((source) => marketState(home, state, source, tries))
  const names = new Set(markets.flatMap((m) => m.entries.map((e) => e.name)))
  const kept = was.filter((e) => state.palettes.includes(e.name) && !names.has(e.name))
  const fetched = new Map<string, Fetched>()
  const lookups = new AbortController()
  const tty = process.stdout.isTTY === true
  const live = livePaint(process.env, tty) ?? warpLive(process.env, tty, home)
  const saved = live ? await live.saved() : new Map<string, string>()
  const startup = worn(state)
  const panel = new BrowsePanel({
    markets,
    kept,
    installed: state.palettes,
    ...(startup ? { startup } : {}),
    problems: problemsOf(home, state, tries, markets),
    due: dueSources(home, state),
    io: browseIo(home, state, fetched, lookups.signal),
    ...(process.env.TTHEME_SORT === 'series' ? {} : { order: alphabetical }),
    color: !colorless(),
    fx: promptFx(process.env.TTHEME_FX),
    ...(live ? { onFocus: (entry: PaletteEntry) => process.stdout.write(live.paint(entry)) } : {}),
  })
  const done = await panel.prompt()
  if (live) {
    process.stdout.write(live.restore(saved))
  }
  lookups.abort()
  await panel.idle()
  const result = panel.result()
  for (const refreshed of result.refreshed) {
    const note = updateNote(refreshed)
    if (note) {
      console.log(note)
    }
  }
  if (p.isCancel(done)) {
    await applyRefreshed(home, readInstalled(home), was, result.refreshed)
    console.log('Nothing changed')
    return
  }
  await applyBrowse(home, was, markets, result, fetched)
}
