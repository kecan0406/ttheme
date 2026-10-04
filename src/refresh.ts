import { existsSync, mkdirSync, readFileSync, statSync, utimesSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import pkg from '../package.json' with { type: 'json' }
import { moveRacks } from './backdrop.ts'
import {
  type Archive,
  archiveId,
  available,
  catalogPath,
  fetchParsed,
  Missing,
  parseCatalog,
  REGISTRY_URL,
  type ReadMarket,
  reach,
  readArchive,
  readCachedArchive,
  readCatalog,
  readKept,
  writeCatalog,
} from './catalog.ts'
import { writeAtomic } from './edits.ts'
import { listed, type Manifest, type PaletteEntry, TooNew, UPDATE_COMMAND } from './manifest.ts'
import { advise } from './notice.ts'
import { readMarketDir, warning } from './own.ts'
import { commit, configHome, forget, type Installed, readInstalled, sync } from './palettes.ts'
import { pending } from './pending.ts'
import { bringPictures, since } from './pictures.ts'
import { movePins } from './pins.ts'
import { type Moves, plan } from './renames.ts'
import {
  archiveUrl,
  autoUpdates,
  cachePath,
  installedPath,
  isLocal,
  isRemote,
  localIdentity,
  MARKET_FILE,
  type MarketInfo,
  marketId,
  marketsDir,
  marketsOf,
  OFFICIAL,
  refOf,
  shownSource,
} from './sources.ts'
import { untar } from './tarball.ts'
import { slugOf } from './theme.ts'
import { moveTone } from './tone.ts'

export const REFRESH_AFTER = 24 * 60 * 60 * 1000
export const RETRY_AFTER = 60 * 60 * 1000
export const AUTO_TIMEOUT = 5_000

export interface Tried {
  at: number
  error: string
}

export interface FetchedMarket {
  source: string
  id: string
  entries: PaletteEntry[]
  archive: Archive
  info: MarketInfo
}

export type Fetched = FetchedMarket | { source: string; id: string; entries: PaletteEntry[]; manifest: Manifest }

export interface Change {
  added: string[]
  changed: string[]
  gone: string[]
}

export interface Refreshed {
  source: string
  id: string
  version?: string
  count: number
  change: Change
}

export function triesPath(): string {
  return join(process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'), 'ttheme', 'markets.json')
}

export function readTries(): Record<string, Tried> {
  try {
    const doc = JSON.parse(readFileSync(triesPath(), 'utf8')) as Record<string, Partial<Tried>>
    return Object.fromEntries(
      Object.entries(doc).filter(
        (pair): pair is [string, Tried] => typeof pair[1]?.at === 'number' && typeof pair[1].error === 'string',
      ),
    )
  } catch {
    return {}
  }
}

function writeTry(source: string, error: string | undefined): void {
  const tries = readTries()
  if (error === undefined) {
    if (!(source in tries)) {
      return
    }
    delete tries[source]
  } else {
    tries[source] = { at: Date.now(), error }
  }
  mkdirSync(dirname(triesPath()), { recursive: true })
  writeAtomic(triesPath(), `${JSON.stringify(tries, null, 2)}\n`)
}

export function fetchedAt(home: string, source: string): number | undefined {
  const path = source === OFFICIAL ? catalogPath(home) : isRemote(source) ? cachePath(home, source) : undefined
  try {
    return path ? statSync(path).mtimeMs : undefined
  } catch {
    return undefined
  }
}

export function isDue(auto: boolean, fetched: number | undefined, failed: number | undefined, now: number): boolean {
  return (
    auto &&
    (fetched === undefined || now - fetched >= REFRESH_AFTER) &&
    (failed === undefined || now - failed >= RETRY_AFTER)
  )
}

export function dueSources(home: string, state: Installed, now = Date.now()): string[] {
  const tries = readTries()
  return marketsOf(state.markets).filter((source) =>
    isDue(autoUpdates(source, state.updates), fetchedAt(home, source), tries[source]?.at, now),
  )
}

function archiveOf(tarball: Uint8Array, etag: string | null): Archive {
  const files: Record<string, string> = {}
  const text = new TextDecoder()
  for (const [path, data] of untar(tarball)) {
    if (path === MARKET_FILE || (path.startsWith('palettes/') && path.endsWith('.toml'))) {
      files[path] = text.decode(data)
    }
  }
  return { ...(etag ? { etag } : {}), files }
}

export async function fetchArchive(
  source: string,
  timeout?: number,
  signal?: AbortSignal,
  etag?: string,
): Promise<Archive | undefined> {
  let response: Response
  try {
    response = await reach(archiveUrl(source), timeout, signal, etag ? { 'if-none-match': etag } : {})
  } catch (error) {
    if (error instanceof Missing) {
      const ref = refOf(source)
      throw new Error(`${shownSource(source)}${ref ? ` has no ${ref}` : ' is not there'} — is the repository public?`)
    }
    throw error
  }
  if (response.status === 304) {
    return undefined
  }
  return archiveOf(new Uint8Array(await response.arrayBuffer()), response.headers.get('etag'))
}

export function fromArchive(source: string, archive: Archive, official: PaletteEntry[]): FetchedMarket {
  const { id, info, entries } = readArchive(source, archive, official, warning(false))
  return { source, id, entries, archive, info }
}

function officialOf(home: string): PaletteEntry[] {
  return cachedEntries(home, OFFICIAL)
}

export async function fetchMarket(
  home: string,
  source: string,
  timeout?: number,
  signal?: AbortSignal,
): Promise<Fetched> {
  if (source === OFFICIAL) {
    const manifest = await fetchParsed(REGISTRY_URL, parseCatalog, timeout, signal)
    return { source, id: OFFICIAL, manifest, entries: manifest.palettes }
  }
  const archive = await fetchArchive(source, timeout, signal)
  if (!archive) {
    throw new Error(`${shownSource(source)} answered as if nothing had changed`)
  }
  return fromArchive(source, archive, officialOf(home))
}

export function storeMarket(home: string, fetched: Fetched): void {
  if ('manifest' in fetched) {
    writeCatalog(home, fetched.manifest)
    return
  }
  mkdirSync(marketsDir(home), { recursive: true })
  writeAtomic(cachePath(home, fetched.source), `${JSON.stringify(fetched.archive)}\n`)
}

function cachedArchive(home: string, source: string): Archive | undefined {
  try {
    return readCachedArchive(home, source)
  } catch {
    return undefined
  }
}

export function cachedEntries(home: string, source: string): PaletteEntry[] {
  try {
    if (source === OFFICIAL) {
      return parseCatalog(readFileSync(catalogPath(home), 'utf8')).palettes
    }
    return readArchive(source, readCachedArchive(home, source), officialOf(home), warning(false)).entries
  } catch {
    return []
  }
}

export function diffEntries(before: PaletteEntry[], after: PaletteEntry[]): Change {
  const was = new Map(before.map((e) => [e.name, JSON.stringify(e)]))
  const now = new Map(after.map((e) => [e.name, JSON.stringify(e)]))
  return {
    added: [...now.keys()].filter((name) => !was.has(name)),
    changed: [...now].filter(([name, json]) => was.has(name) && was.get(name) !== json).map(([name]) => name),
    gone: [...was.keys()].filter((name) => !now.has(name)),
  }
}

async function fetchNewer(home: string, source: string, timeout?: number): Promise<Fetched | undefined> {
  if (!isRemote(source)) {
    return fetchMarket(home, source, timeout)
  }
  const cached = cachedArchive(home, source)
  const archive = await fetchArchive(source, timeout, undefined, cached?.etag)
  return archive && fromArchive(source, archive, officialOf(home))
}

export async function refreshMarket(home: string, source: string, timeout?: number): Promise<Refreshed> {
  const before = cachedEntries(home, source)
  let fetched: Fetched | undefined
  try {
    fetched = await fetchNewer(home, source, timeout)
  } catch (error) {
    writeTry(source, (error as Error).message)
    throw error
  }
  if (fetched) {
    storeMarket(home, fetched)
  } else {
    const now = new Date()
    utimesSync(cachePath(home, source), now, now)
  }
  writeTry(source, undefined)
  const entries = fetched?.entries ?? before
  return {
    source,
    id: fetched?.id ?? archiveId(source, readCachedArchive(home, source)),
    ...(fetched && 'manifest' in fetched ? { version: fetched.manifest.version } : {}),
    count: listed(entries).length,
    change: diffEntries(before, entries),
  }
}

export type Outcome = { source: string; refreshed: Refreshed } | { source: string; failure: Error }

export async function attempt(home: string, source: string, timeout?: number): Promise<Outcome> {
  try {
    return { source, refreshed: await refreshMarket(home, source, timeout) }
  } catch (error) {
    return { source, failure: error instanceof Error ? error : new Error(String(error)) }
  }
}

export function failureLine(source: string, failure: Error): string {
  return `${shownSource(source)}: ${failure.message}`
}

export function refusal(outcome: Outcome): string | undefined {
  return 'failure' in outcome && outcome.failure instanceof TooNew
    ? failureLine(outcome.source, outcome.failure)
    : undefined
}

export function counted(n: number): string {
  return `${n} palette${n === 1 ? '' : 's'}`
}

export function ago(at: number, now = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - at) / 60_000)
  if (minutes < 1) {
    return 'just now'
  }
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.floor(minutes / 60)
  return hours < 48 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`
}

function changed({ added, changed, gone }: Change): string {
  return [
    added.length > 0 ? `${added.length} new` : '',
    changed.length > 0 ? `${changed.length} changed` : '',
    gone.length > 0 ? `${gone.length} gone` : '',
  ]
    .filter(Boolean)
    .join(', ')
}

export function refreshLine(r: Refreshed): string {
  const parts = changed(r.change)
  return `${r.version ? `${r.id} ${r.version}` : r.id} — ${counted(r.count)}${parts ? ` (${parts})` : ''}`
}

export function updateNote(r: Refreshed): string | undefined {
  return changed(r.change) ? `Updated ${refreshLine(r)}` : undefined
}

const RELEASE = /^(\d+)\.(\d+)\.(\d+)$/

export function isNewer(latest: string, running: string): boolean {
  const a = RELEASE.exec(latest)
  const b = RELEASE.exec(running)
  if (!a || !b) {
    return false
  }
  for (const part of [1, 2, 3]) {
    const gap = Number(a[part]) - Number(b[part])
    if (gap !== 0) {
      return gap > 0
    }
  }
  return false
}

export function outdatedNote(r: Refreshed, running: string = pkg.version): string | undefined {
  return r.version && isNewer(r.version, running)
    ? `ttheme ${r.version} is out, you have ${running} — \`${UPDATE_COMMAND}\` updates it`
    : undefined
}

export function cachedMarket(home: string, source: string, official = officialOf(home)): ReadMarket | undefined {
  try {
    if (isLocal(source)) {
      const info = localIdentity(source)
      const id = marketId(info)
      return { id, info, entries: readMarketDir(source, id, official, warning(false)) }
    }
    return isRemote(source) ? readArchive(source, readCachedArchive(home, source), official, warning(false)) : undefined
  } catch {
    return undefined
  }
}

export function followMarkets(home: string): string[] {
  if (!existsSync(installedPath(home))) {
    return []
  }
  const state = readInstalled(home)
  const official = officialOf(home)
  const moves: Moves = { renamed: new Map(), removed: [] }
  for (const source of marketsOf(state.markets)) {
    const market = cachedMarket(home, source, official)
    if (market) {
      plan(market.id, market.info, new Set(market.entries.map((e) => slugOf(e.name))), state.palettes, moves)
    }
  }
  if (moves.renamed.size === 0 && moves.removed.length === 0) {
    return []
  }
  const catalog = readCatalog(home, false)
  forget(home, catalog, state.terminals, [...moves.renamed.keys(), ...moves.removed])
  moveTone(home, moves.renamed, moves.removed)
  moveRacks(home, moves.renamed)
  movePins(home, moves.renamed, moves.removed)
  const palettes = [
    ...new Set(state.palettes.filter((n) => !moves.removed.includes(n)).map((n) => moves.renamed.get(n) ?? n)),
  ]
  const { startup, ...rest } = state
  const kept = startup && !moves.removed.includes(startup) ? (moves.renamed.get(startup) ?? startup) : undefined
  commit(home, catalog, state, { ...rest, palettes, ...(kept ? { startup: kept } : {}) })
  return [
    ...[...moves.renamed].map(([from, to]) => `${from} is ${to} now — its market renamed it`),
    ...moves.removed.map((name) => `${name} was removed from its market`),
  ]
}

export async function applyRefreshed(
  home: string,
  before: Installed,
  was: PaletteEntry[],
  done: Refreshed[],
): Promise<string[]> {
  const moved = followMarkets(home)
  const state = moved.length > 0 ? readInstalled(home) : before
  const touched = new Set(done.flatMap((r) => [...r.change.changed, ...r.change.gone]))
  const mine = state.palettes.filter((name) => touched.has(name))
  if (mine.length === 0) {
    return moved
  }
  const catalog = readCatalog(home, false)
  sync(home, catalog, state)
  const gone = new Set(done.flatMap((r) => r.change.gone))
  const left = mine.filter((n) => gone.has(n)).map((name) => `${name} left its market — ttheme keeps the copy you have`)
  const pictures = new Map(was.map((e) => [e.name, e.pictures]))
  await bringPictures(
    home,
    available(home, catalog, false)
      .palettes.filter((e) => mine.includes(e.name) && pictures.has(e.name))
      .map((e) => since(e, pictures.get(e.name))),
    state.terminals,
  )
  return [...moved, ...left]
}

export async function autoRefresh(home = configHome()): Promise<void> {
  try {
    if (!existsSync(installedPath(home))) {
      return
    }
    const state = readInstalled(home)
    const due = dueSources(home, state)
    if (due.length === 0) {
      return
    }
    const was = readKept(home)
    const line = pending(`Checking ${due.map(shownSource).join(', ')} for updates`)
    const outcomes = await Promise.all(due.map((source) => attempt(home, source, AUTO_TIMEOUT)))
    line.done()
    const done = outcomes.flatMap((o) => ('refreshed' in o ? [o.refreshed] : []))
    const notes = done.flatMap((r) => updateNote(r) ?? [])
    advise(notes)
    const left = notes.length > 0 ? await applyRefreshed(home, state, was, done) : []
    advise([...left, ...outcomes.flatMap((o) => refusal(o) ?? []), ...done.flatMap((r) => outdatedNote(r) ?? [])])
  } catch {
    return
  }
}
