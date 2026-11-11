import { existsSync, mkdirSync, utimesSync } from 'node:fs'
import { WORKS_DIR, type Work } from '../core/commons.ts'
import { freshnessOf, REFRESH_AFTER, RETRY_AFTER } from '../core/freshness.ts'
import type { PaletteEntry } from '../core/manifest.ts'
import { SETS_DIR } from '../core/sets.ts'
import { untar } from '../core/tarball.ts'
import { BUILTIN, MARKETPLACE_FILE, marketplaceId } from '../core/theme.ts'
import {
  type Archive,
  bodyWithin,
  builtinPath,
  commonsDue,
  Missing,
  type ReadMarketplace,
  reach,
  readArchive,
  readBundled,
  readCachedArchive,
  readMarketplaces,
  refreshCommons,
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
  freshness,
  installedPath,
  isLocal,
  isRemote,
  localIdentity,
  type MarketplaceInfo,
  marketplacesDir,
  marketplacesOf,
  readTries,
  refOf,
  shownSource,
  writeTry,
} from '../store/sources.ts'
import { cap } from '../tui/keycaps.ts'
import { pending } from '../tui/pending.ts'
import { MARKS } from '../tui/style.ts'
import { autoWanted, initCommand } from './release.ts'
import { behindOf, conflictLine, updatable } from './upstreams.ts'

export { REFRESH_AFTER, RETRY_AFTER }

export const AUTO_TIMEOUT = 5_000
const ARCHIVE_MOST = 16 * 1024 * 1024
const TEXT_MOST = 4 * 1024 * 1024
const MARKETPLACE_PATH = new RegExp(`^(?:${SETS_DIR}|${WORKS_DIR})/[^/]+\\.toml$`)

export interface FetchedMarketplace {
  source: string
  id: string
  entries: PaletteEntry[]
  works: Work[]
  archive: Archive
  info: MarketplaceInfo
}

export type Fetched = FetchedMarketplace | { source: string; id: string; entries: PaletteEntry[]; works: Work[] }

export function isDue(auto: boolean, fetched: number | undefined, failed: number | undefined, now: number): boolean {
  return auto && freshnessOf(fetched, failed, now).due
}

export function dueSources(home: string, state: Installed, now = Date.now()): string[] {
  const tries = readTries()

  return marketplacesOf(state.marketplaces).filter(
    (source) => autoUpdates(source, state.updates) && freshness(home, source, tries, now).due,
  )
}

function archiveOf(tarball: Uint8Array, etag: string | null): Archive {
  const text = new TextDecoder()
  const kept = [...untar(tarball)].filter(([path]) => path === MARKETPLACE_FILE || MARKETPLACE_PATH.test(path))

  if (kept.reduce((size, [, data]) => size + data.length, 0) > TEXT_MOST) {
    throw new Error(`its palette and work files are more than ${TEXT_MOST / 1024 / 1024} MB`)
  }

  const files = Object.fromEntries(kept.map(([path, data]) => [path, text.decode(data)]))

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

  const bytes = await bodyWithin(response, ARCHIVE_MOST, `the archive is more than ${ARCHIVE_MOST / 1024 / 1024} MB`)

  return archiveOf(bytes, response.headers.get('etag'))
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
  writeAtomic(cachePath(home, fetched.source), `${JSON.stringify({ ...fetched.archive, source: fetched.source })}\n`)
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
  const etag = cached && (cached.source ?? source) === source ? cached.etag : undefined
  const archive = await fetchArchive(source, timeout, undefined, etag)

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
    const works = commonsDue(home)

    if (due.length === 0 && !works) {
      return
    }

    const named = [...due.map(shownSource), ...(works ? ['the list of works'] : [])]
    const line = pending(`Checking ${named.join(', ')} for updates`)

    await Promise.all([
      ...due.map((source) => attempt(home, source, AUTO_TIMEOUT)),
      ...(works ? [refreshCommons(home, AUTO_TIMEOUT).catch(() => false)] : []),
    ])
    line.done()
  } catch {
    return
  }
}
