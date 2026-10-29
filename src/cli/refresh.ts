import { existsSync, mkdirSync, readFileSync, statSync, utimesSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { WORKS_DIR, type Work } from '../core/commons.ts'
import type { PaletteEntry } from '../core/manifest.ts'
import { SETS_DIR } from '../core/sets.ts'
import { untar } from '../core/tarball.ts'
import { BUILTIN, MARKETPLACE_FILE, marketplaceId } from '../core/theme.ts'
import {
  type Archive,
  builtinPath,
  Missing,
  type ReadMarketplace,
  reach,
  readArchive,
  readBundled,
  readCachedArchive,
  readMarketplaces,
  updatesOf,
} from '../store/available.ts'
import { writeAtomic } from '../store/edits.ts'
import { type Installed, readInstalled } from '../store/installed.ts'
import { readMarketplaceDir, warning } from '../store/local.ts'
import { configHome } from '../store/paths.ts'
import {
  archiveUrl,
  autoUpdates,
  cachePath,
  installedPath,
  isLocal,
  isRemote,
  localIdentity,
  type MarketplaceInfo,
  marketplacesDir,
  marketplacesOf,
  refOf,
  shownSource,
} from '../store/sources.ts'
import { cap } from '../tui/keycaps.ts'
import { pending } from '../tui/pending.ts'
import { MARKS } from '../tui/style.ts'
import { autoWanted, initCommand } from './release.ts'
import { behindOf, conflictLine, updatable } from './upstreams.ts'

export const REFRESH_AFTER = 24 * 60 * 60 * 1000
export const RETRY_AFTER = 60 * 60 * 1000
export const AUTO_TIMEOUT = 5_000
const ARCHIVE_MOST = 16 * 1024 * 1024
const MARKETPLACE_PATH = new RegExp(`^(?:${SETS_DIR}|${WORKS_DIR})/[^/]+\\.toml$`)

export interface Tried {
  at: number
  error: string
}

export interface FetchedMarketplace {
  source: string
  id: string
  entries: PaletteEntry[]
  works: Work[]
  archive: Archive
  info: MarketplaceInfo
}

export type Fetched = FetchedMarketplace | { source: string; id: string; entries: PaletteEntry[]; works: Work[] }

function triesPath(): string {
  return join(process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'), 'ttheme', 'marketplaces.json')
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
  const path = isRemote(source) ? cachePath(home, source) : undefined

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

  return marketplacesOf(state.marketplaces).filter((source) =>
    isDue(autoUpdates(source, state.updates), fetchedAt(home, source), tries[source]?.at, now),
  )
}

function archiveOf(tarball: Uint8Array, etag: string | null): Archive {
  const text = new TextDecoder()

  const files = Object.fromEntries(
    untar(tarball)
      .entries()
      .filter(([path]) => path === MARKETPLACE_FILE || MARKETPLACE_PATH.test(path))
      .map(([path, data]) => [path, text.decode(data)]),
  )

  return { ...(etag ? { etag } : {}), files }
}

async function archiveBytes(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader()

  if (!reader) {
    return new Uint8Array(await response.arrayBuffer())
  }

  const chunks: Uint8Array[] = []
  let size = 0

  for (;;) {
    const { done, value } = await reader.read()

    if (done) {
      return Buffer.concat(chunks)
    }

    size += value.length

    if (size > ARCHIVE_MOST) {
      await reader.cancel()
      throw new Error(`the archive is more than ${ARCHIVE_MOST / 1024 / 1024} MB`)
    }

    chunks.push(value)
  }
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

  return archiveOf(await archiveBytes(response), response.headers.get('etag'))
}

export function fromArchive(source: string, archive: Archive): FetchedMarketplace {
  const { id, info, entries, works } = readArchive(source, archive, warning(false))

  return { source, id, entries, works, archive, info }
}

export async function fetchMarketplace(
  home: string,
  source: string,
  timeout?: number,
  signal?: AbortSignal,
): Promise<Fetched> {
  if (source === BUILTIN) {
    if (!existsSync(builtinPath(home))) {
      throw new Error(`the built-in palettes are not on this machine — \`${initCommand()}\` puts them back`)
    }

    return { source, id: BUILTIN, entries: cachedEntries(home, BUILTIN), works: [] }
  }

  const archive = await fetchArchive(source, timeout, signal)

  if (!archive) {
    throw new Error(`${shownSource(source)} answered as if nothing had changed`)
  }

  return fromArchive(source, archive)
}

export function storeMarketplace(home: string, fetched: Fetched): void {
  if (!('archive' in fetched)) {
    return
  }

  mkdirSync(marketplacesDir(home), { recursive: true })
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
    if (source === BUILTIN) {
      return readBundled(home).builtin.palettes
    }

    return readArchive(source, readCachedArchive(home, source), warning(false)).entries
  } catch {
    return []
  }
}

async function fetchNewer(home: string, source: string, timeout?: number): Promise<Fetched | undefined> {
  if (!isRemote(source)) {
    return fetchMarketplace(home, source, timeout)
  }

  const cached = cachedArchive(home, source)
  const archive = await fetchArchive(source, timeout, undefined, cached?.etag)

  return archive && fromArchive(source, archive)
}

export async function refreshMarketplace(home: string, source: string, timeout?: number): Promise<void> {
  let fetched: Fetched | undefined

  try {
    fetched = await fetchNewer(home, source, timeout)
  } catch (error) {
    writeTry(source, (error as Error).message)
    throw error
  }

  if (fetched) {
    storeMarketplace(home, fetched)
  } else {
    const now = new Date()
    utimesSync(cachePath(home, source), now, now)
  }

  writeTry(source, undefined)
}

export async function attempt(home: string, source: string, timeout?: number): Promise<Error | undefined> {
  try {
    await refreshMarketplace(home, source, timeout)

    return undefined
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error))
  }
}

export function failureLine(source: string, failure: Error): string {
  return `${shownSource(source)}: ${failure.message}`
}

export function cachedMarketplace(home: string, source: string): ReadMarketplace | undefined {
  try {
    if (isLocal(source)) {
      const info = localIdentity(source)
      const id = marketplaceId(info)

      return { id, info, ...readMarketplaceDir(source, id, warning(false)) }
    }

    return isRemote(source) ? readArchive(source, readCachedArchive(home, source), warning(false)) : undefined
  } catch {
    return undefined
  }
}

export function updatesLine(home: string): string | undefined {
  const manifest = readMarketplaces(home, false)
  const names = [...updatesOf(home, manifest).map((e) => e.name), ...updatable(home, manifest)]

  const lines = [
    ...(names.length > 0
      ? [
          `${names.join(', ')} ${names.length === 1 ? 'has an update' : 'have updates'} — ${cap('ctrl+r')} on a palette marked ${MARKS.update} in Browse (\`ttheme\`) takes it`,
        ]
      : []),
    ...behindOf(home, manifest).flatMap((behind) => conflictLine(behind) ?? []),
  ]

  return lines.length > 0 ? lines.join('\n') : undefined
}

export async function autoRefresh(home = configHome()): Promise<void> {
  try {
    if (!autoWanted() || !existsSync(installedPath(home))) {
      return
    }

    const due = dueSources(home, readInstalled(home))

    if (due.length === 0) {
      return
    }

    const line = pending(`Checking ${due.map(shownSource).join(', ')} for updates`)
    await Promise.all(due.map((source) => attempt(home, source, AUTO_TIMEOUT)))
    line.done()
  } catch {
    return
  }
}
