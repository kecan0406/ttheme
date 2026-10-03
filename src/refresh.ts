import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import pkg from '../package.json' with { type: 'json' }
import {
  available,
  catalogPath,
  fetchParsed,
  type MarketIndex,
  Missing,
  marketEntries,
  parseCatalog,
  parseIndex,
  REGISTRY_URL,
  readCachedIndex,
  readCatalog,
  readKept,
  remoteId,
  TooNew,
  UPDATE_COMMAND,
  writeCatalog,
} from './catalog.ts'
import { writeAtomic } from './edits.ts'
import { listed, type Manifest, type PaletteEntry } from './manifest.ts'
import { advise } from './notice.ts'
import { configHome, type Installed, readInstalled, sync } from './palettes.ts'
import { pending } from './pending.ts'
import { bringPictures, since } from './pictures.ts'
import {
  autoUpdates,
  cachePath,
  INDEX,
  installedPath,
  isRemote,
  marketsDir,
  marketsOf,
  OFFICIAL,
  rawUrl,
  shownSource,
} from './sources.ts'

export const REFRESH_AFTER = 24 * 60 * 60 * 1000
export const RETRY_AFTER = 60 * 60 * 1000
export const AUTO_TIMEOUT = 5_000

export interface Tried {
  at: number
  error: string
}

export interface Fetched {
  source: string
  id: string
  manifest: Manifest
  entries: PaletteEntry[]
}

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

export async function fetchIndex(source: string, timeout?: number, signal?: AbortSignal): Promise<MarketIndex> {
  try {
    return await fetchParsed(rawUrl(source), parseIndex, timeout, signal)
  } catch (error) {
    if (error instanceof Missing) {
      throw new Error(`${shownSource(source)} has no ${INDEX} — is the repository public, and has its action run?`)
    }
    throw error
  }
}

export async function fetchMarket(source: string, timeout?: number, signal?: AbortSignal): Promise<Fetched> {
  if (source === OFFICIAL) {
    const manifest = await fetchParsed(REGISTRY_URL, parseCatalog, timeout, signal)
    return { source, id: OFFICIAL, manifest, entries: manifest.palettes }
  }
  const index = await fetchIndex(source, timeout, signal)
  const id = remoteId(source, index)
  return { source, id, manifest: index, entries: marketEntries(index, id) }
}

export function storeMarket(home: string, fetched: Fetched): void {
  if (fetched.source === OFFICIAL) {
    writeCatalog(home, fetched.manifest)
    return
  }
  mkdirSync(marketsDir(home), { recursive: true })
  writeAtomic(cachePath(home, fetched.source), `${JSON.stringify(fetched.manifest, null, 2)}\n`)
}

export function cachedEntries(home: string, source: string): PaletteEntry[] {
  try {
    if (source === OFFICIAL) {
      return parseCatalog(readFileSync(catalogPath(home), 'utf8')).palettes
    }
    const index = readCachedIndex(home, source)
    return marketEntries(index, remoteId(source, index))
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

export async function refreshMarket(home: string, source: string, timeout?: number): Promise<Refreshed> {
  const before = cachedEntries(home, source)
  let fetched: Fetched
  try {
    fetched = await fetchMarket(source, timeout)
  } catch (error) {
    writeTry(source, (error as Error).message)
    throw error
  }
  storeMarket(home, fetched)
  writeTry(source, undefined)
  return {
    source,
    id: fetched.id,
    ...(source === OFFICIAL ? { version: fetched.manifest.version } : {}),
    count: listed(fetched.entries).length,
    change: diffEntries(before, fetched.entries),
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

export async function applyRefreshed(
  home: string,
  state: Installed,
  was: PaletteEntry[],
  done: Refreshed[],
): Promise<string[]> {
  const touched = new Set(done.flatMap((r) => [...r.change.changed, ...r.change.gone]))
  const mine = state.palettes.filter((name) => touched.has(name))
  if (mine.length === 0) {
    return []
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
  return left
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
