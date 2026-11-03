import { isHex } from '../core/color.ts'
import type { Sort } from '../core/commons.ts'
import { inMode, type Manifest, type PaletteEntry } from '../core/manifest.ts'
import { type Mode, modeOf } from '../core/mode.ts'
import { counted } from '../core/text.ts'
import { BUILTIN, marketplaceId, publisherOf } from '../core/theme.ts'
import { available, idOf, type Read, readAll, readKept, readMarketplaces, untuned, updatesOf } from '../store/available.ts'
import { type Installed, readInstalled, worn, writeInstalled } from '../store/installed.ts'
import { readMarketplaceDir, warning } from '../store/local.ts'
import { readIndex } from '../store/marketplace-index.ts'
import { nameSearch } from '../store/names.ts'
import { configHome } from '../store/paths.ts'
import { autoUpdates, isLocal, isRemote, localIdentity, marketplacesOf, repoOf, shownSource } from '../store/sources.ts'
import { readTone, tunedIn } from '../store/tone.ts'
import { modeFor } from '../store/wiring.ts'
import { liveOf } from '../terminals/live.ts'
import { colorless } from '../terminals/osc.ts'
import { BrowsePanel } from '../tui/browse/browse.ts'
import type { BrowseIo, BrowseResult, Marketplace } from '../tui/browse/types.ts'
import { HUB_CLOSED, HUB_UPDATE, hubOf } from '../tui/hub.ts'
import { promptFx } from '../tui/palette-prompt.ts'
import { into, say } from '../tui/pending.ts'
import { interactive } from '../tui/terminal.ts'
import { EXIT } from './answer.ts'
import { reload, takeUpdates } from './installs.ts'
import { dropCache, keptNote, lastUpdate, withMarketplaces } from './marketplaces.ts'
import { bringPictures } from './pictures.ts'
import {
  AUTO_TIMEOUT,
  cachedMarketplace,
  dueSources,
  type Fetched,
  fetchMarketplace,
  readTries,
  refreshMarketplace,
  storeMarketplace,
  type Tried,
} from './refresh.ts'
import { autoWanted, releaseLine } from './release.ts'
import { commit, forget } from './sync.ts'
import { updatable } from './upstreams.ts'
import { visit } from './visit.ts'

function inWear(mode: Mode, entries: readonly PaletteEntry[]): PaletteEntry[] {
  return entries.map((entry) => (modeOf(entry) === mode ? entry : inMode(entry, mode)))
}

function sortOf(value: string | undefined): Sort {
  return value === 'cast' ? 'cast' : 'abc'
}

function marketplaceState(
  home: string,
  state: Installed,
  source: string,
  tries: Record<string, Tried>,
  read: Read,
  mode: Mode,
): Marketplace {
  const held = read.sourced.find((sourced) => sourced.source === source)?.read
  const marketplace = source === BUILTIN ? undefined : (held ?? cachedMarketplace(home, source))
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
    entries: inWear(mode, source === BUILTIN ? read.bundled.builtin.palettes : (marketplace?.entries ?? [])),
    works: marketplace?.works ?? [],
    auto: autoUpdates(source, state.updates),
    status: lastUpdate(home, source, tries),
  }
}

function updateNames(home: string, manifest: Manifest): string[] {
  return [...updatesOf(home, manifest).map((e) => e.name), ...updatable(home, manifest)]
}

function browseIo(
  home: string,
  state: Installed,
  fetched: Map<string, Fetched>,
  lookups: AbortSignal,
  apply: BrowseIo['apply'],
): BrowseIo {
  const names = nameSearch(process.env.TTHEME_NAME_LOOKUP)

  return {
    refresh: async (source) => {
      if (!isLocal(source)) {
        await refreshMarketplace(home, source, AUTO_TIMEOUT)
      }

      const read = readAll(home, false)

      return {
        marketplace: marketplaceState(home, state, source, readTries(), read, modeFor(home)),
        updates: updateNames(home, read.manifest),
      }
    },
    fetch: async (source) => {
      if (isLocal(source)) {
        const info = localIdentity(source)
        const id = marketplaceId(info)
        const { entries, works } = readMarketplaceDir(source, id, warning(false))

        return {
          source,
          id,
          ...(info.description ? { description: info.description } : {}),
          shown: shownSource(source),
          entries: inWear(modeFor(home), entries),
          works,
          auto: false,
          status: 'always up to date',
        }
      }

      const got = await fetchMarketplace(home, source, undefined, lookups)
      fetched.set(source, got)

      return {
        source,
        id: got.id,
        ...('info' in got && got.info.description ? { description: got.info.description } : {}),
        shown: shownSource(source),
        entries: inWear(modeFor(home), got.entries),
        works: got.works,
        auto: autoUpdates(source, {}),
        status: 'not added yet',
      }
    },
    index: () => readIndex(lookups),
    ...(names ? { names: (query, signal) => names(query, AbortSignal.any([signal, lookups])) } : {}),
    visit,
    apply,
  }
}

function marketplaceChanges(result: BrowseResult, marketplaces: Marketplace[], wanted: string[]): string[] {
  const lines: string[] = []

  for (const m of result.adds) {
    const auto = m.source !== BUILTIN && (result.auto[m.source] ?? m.auto)
    lines.push(`Added ${m.id}  ${m.shown} — ${counted(m.entries.length)}${auto ? ', updating on its own' : ''}`)
  }

  for (const source of result.removes) {
    const id = marketplaces.find((m) => m.source === source)?.id ?? source
    lines.push(`Removed ${id}  ${shownSource(source)}`)
    const kept = wanted.filter((name) => publisherOf(name) === id)

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

  await bringPictures(
    home,
    available(home, manifest, false).palettes.filter((e) => added.includes(e.name)),
    next.terminals,
  )

  if (renew.length > 0) {
    const notes = await takeUpdates(home, renew)

    for (const name of renew) {
      say(`  ↑ ${name}`)
    }

    for (const note of notes) {
      say(note)
    }
  }

  if (added.length > 0 || dropped.length > 0) {
    reload(next.palettes.length)
  }
}

export async function runBrowse(): Promise<number> {
  if (!interactive()) {
    throw new Error('needs a terminal')
  }

  const hub = hubOf(process.env)
  const home = configHome()
  const state = readInstalled(home)
  const was = readKept(home)
  const tries = readTries()
  const auto = autoWanted()
  const read = readAll(home)
  const { manifest } = read
  const mode = modeFor(home)
  const view = untuned(home, manifest, false)

  const marketplaces = marketplacesOf(state.marketplaces).map((source) =>
    marketplaceState(home, state, source, tries, read, mode),
  )

  const names = new Set(marketplaces.flatMap((m) => m.entries.map((e) => e.name)))

  const kept = inWear(
    mode,
    was.filter((e) => state.palettes.includes(e.name) && !names.has(e.name)),
  )

  const fetched = new Map<string, Fetched>()
  const lookups = new AbortController()
  const tty = process.stdout.isTTY === true
  const live = liveOf(process.env, tty, home)
  const look = hub ? (process.env.TTHEME_HUB_LOOK ?? '') : undefined
  const mark = hub ? (process.env.TTHEME_HUB_MARK ?? '').split(' ').filter(isHex) : []
  const saved = live ? await live.saved(look) : new Map<string, string>()
  const startup = worn(state)

  if (hub) {
    process.stdout.write('\x1b[?2026h')
  }

  const panel = new BrowsePanel({
    marketplaces,
    kept,
    installed: state.palettes,
    updates: updateNames(home, manifest),
    tuned: tunedIn(readTone(home), view.palettes, mode),
    works: view.works,
    sort: sortOf(process.env.TTHEME_SORT),
    ...(startup ? { startup } : {}),
    ...(hub ? { hub, release: () => releaseLine(), ...(mark.length === 3 ? { mark } : {}) } : {}),
    due: auto ? dueSources(home, state) : [],
    io: browseIo(home, state, fetched, lookups.signal, (result, report) =>
      into({ say: report.say, set: report.status }, () => applyBrowse(home, marketplaces, result, fetched)),
    ),
    color: !colorless(),
    lookups: process.env.TTHEME_MARKETPLACE_LOOKUP !== 'off',
    ...(hub && process.env.TTHEME_HUB_SEARCH ? { search: process.env.TTHEME_HUB_SEARCH } : {}),
    fx: promptFx(process.env.TTHEME_FX),
    owns: tty && !hub,
    ...(live ? { onFocus: (entry: PaletteEntry) => process.stdout.write(live.paint(entry)) } : {}),
  })

  try {
    await panel.run()
  } finally {
    live?.stop?.()

    if (live && (!hub || panel.next() === undefined || panel.next() === HUB_UPDATE)) {
      process.stdout.write(live.restore(saved))
    }

    lookups.abort()
  }

  await panel.idle()
  const go = panel.next()

  if (hub && go !== undefined && go !== HUB_UPDATE) {
    return go
  }

  if (tty && hub) {
    process.stdout.write('\x1b[?1049l\x1b[?25h')
  }

  if (go === HUB_UPDATE) {
    return HUB_UPDATE
  }

  if (panel.applied()) {
    for (const line of panel.lines()) {
      console.log(line)
    }

    const failure = panel.failure()

    if (failure) {
      throw failure
    }

    return hub ? HUB_CLOSED : EXIT.done
  }

  console.log('Nothing changed')

  return hub ? HUB_CLOSED : EXIT.unchanged
}
