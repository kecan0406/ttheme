import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isHex } from './color.ts'
import { GATE_RULES, measure } from './contrast.ts'
import { writeAtomic } from './edits.ts'
import { emptyManifest, type Manifest, type PaletteEntry, toTheme } from './manifest.ts'
import { aliasesFor, containsText } from './names.ts'
import { marketLayout, type Report, readLocal, readMarketFiles, warning } from './own.ts'
import {
  cachePath,
  type Identity,
  isRemote,
  MARKET_FILE,
  type MarketInfo,
  marketId,
  marketSources,
  OFFICIAL,
  readMarketInfo,
  remoteOwner,
  shownSource,
} from './sources.ts'
import { marketOf, nameProblem, textProblem } from './theme.ts'
import { readTone, tuned } from './tone.ts'

const TIMEOUT = 20_000

export function catalogPath(configHome: string): string {
  return join(configHome, 'ttheme', 'catalog.json')
}

export function writeCatalog(configHome: string, catalog: Manifest): void {
  writeAtomic(catalogPath(configHome), `${JSON.stringify(catalog, null, 2)}\n`)
}

export interface Archive {
  etag?: string
  files: Record<string, string>
}

export function readCatalog(configHome: string, warn = true, official?: Manifest): Manifest {
  const sources = marketSources(configHome)
  const path = catalogPath(configHome)
  let base = emptyManifest()
  if (sources.includes(OFFICIAL)) {
    if (official) {
      base = official
    } else {
      if (!existsSync(path)) {
        throw new Error(`no catalog at ${path} — run \`ttheme init\` first`)
      }
      base = parseCatalog(readFileSync(path, 'utf8'))
    }
  }
  const remote = sources.filter(isRemote).flatMap((source) => readCached(configHome, source, base.palettes, warn))
  return { ...base, palettes: [...base.palettes, ...remote] }
}

export function parseArchive(source: string): Archive {
  let doc: { etag?: unknown; files?: unknown } | null
  try {
    doc = JSON.parse(source)
  } catch {
    throw new Error('is not valid JSON')
  }
  const files = doc?.files
  if (!files || typeof files !== 'object' || Object.values(files).some((text) => typeof text !== 'string')) {
    throw new Error('is not a copy of a market this ttheme fetched — `ttheme update` fetches it again')
  }
  return { ...(typeof doc?.etag === 'string' ? { etag: doc.etag } : {}), files: files as Record<string, string> }
}

export function readCachedArchive(configHome: string, source: string): Archive {
  return parseArchive(readFileSync(cachePath(configHome, source), 'utf8'))
}

export function remoteId(source: string, identity: Identity): string {
  return marketId({ owner: remoteOwner(source), name: identity.name })
}

export function archiveInfo(source: string, archive: Archive): MarketInfo {
  const text = archive.files[MARKET_FILE]
  if (text === undefined) {
    throw new Error(`${shownSource(source)} has no ${MARKET_FILE} — \`ttheme market init\` makes one`)
  }
  return readMarketInfo(text, MARKET_FILE)
}

export function archiveId(source: string, archive: Archive): string {
  return remoteId(source, archiveInfo(source, archive))
}

export interface ReadMarket {
  id: string
  info: MarketInfo
  entries: PaletteEntry[]
}

export function readArchive(source: string, archive: Archive, official: PaletteEntry[], report: Report): ReadMarket {
  const info = archiveInfo(source, archive)
  const id = remoteId(source, info)
  const shown = shownSource(source)
  const texts = new Map(Object.entries(archive.files).map(([path, text]) => [`${shown}/${path}`, text]))
  const files = marketLayout(Object.keys(archive.files), (path) => `${shown}/${path}`)
  return { id, info, entries: readMarketFiles(files, (file) => texts.get(file.path) ?? '', id, official, report, true) }
}

function readCached(configHome: string, source: string, official: PaletteEntry[], warn: boolean): PaletteEntry[] {
  const path = cachePath(configHome, source)
  if (!existsSync(path)) {
    return []
  }
  try {
    return readArchive(source, readCachedArchive(configHome, source), official, warning(false)).entries
  } catch (error) {
    if (warn) {
      process.stderr.write(`ttheme: skipping ${path} — ${(error as Error).message}\n`)
    }
    return []
  }
}

export function parseCatalog(source: string): Manifest {
  let doc: unknown
  try {
    doc = JSON.parse(source)
  } catch {
    throw new Error('catalog is not valid JSON')
  }
  const catalog = doc as Manifest
  if (typeof catalog?.version !== 'string' || !Array.isArray(catalog.palettes)) {
    throw new Error('catalog has no version or palettes')
  }
  for (const p of catalog.palettes) {
    const problem = entryProblem(p)
    if (problem) {
      throw new Error(`catalog entry ${JSON.stringify(p?.name)} ${problem}`)
    }
  }
  return catalog
}

function entryProblem(p: PaletteEntry): string | undefined {
  if (typeof p?.name !== 'string' || !Array.isArray(p.ansi) || p.ansi.length !== 16) {
    return 'is missing name or its 16 ANSI colors'
  }
  const named = nameProblem(p.name) ?? (p.base === undefined ? undefined : nameProblem(p.base))
  if (named) {
    return named
  }
  if (![p.background, p.foreground, p.cursor, p.selection, ...p.ansi].every((c) => typeof c === 'string' && isHex(c))) {
    return 'holds a color that is not "#rrggbb"'
  }
  for (const field of [p.group, p.native ?? '-', p.catalog ?? '-', p.ansiSource]) {
    const problem = typeof field === 'string' ? textProblem(field) : 'has a field that is not text'
    if (problem) {
      return problem
    }
  }
  return undefined
}

export function keptPath(configHome: string): string {
  return join(configHome, 'ttheme', 'kept.json')
}

export function writeKept(configHome: string, entries: PaletteEntry[]): void {
  writeAtomic(keptPath(configHome), `${JSON.stringify({ palettes: entries }, null, 2)}\n`)
}

export function readKept(configHome: string): PaletteEntry[] {
  try {
    const { palettes } = JSON.parse(readFileSync(keptPath(configHome), 'utf8')) as { palettes: PaletteEntry[] }
    return Array.isArray(palettes) ? palettes.filter((p) => entryProblem(p) === undefined) : []
  } catch {
    return []
  }
}

function looks(p: PaletteEntry): string {
  return JSON.stringify([p.background, p.foreground, p.cursor, p.selection, p.ansi, p.pictures ?? []])
}

export function updatesOf(configHome: string, catalog: Manifest): PaletteEntry[] {
  const kept = new Map(readKept(configHome).map((p) => [p.name, p]))
  return catalog.palettes.filter((p) => {
    const was = kept.get(p.name)
    return marketOf(p.name) !== undefined && was !== undefined && looks(was) !== looks(p)
  })
}

export function untuned(configHome: string, catalog: Manifest, warn = true): Manifest {
  const kept = readKept(configHome)
  const pinned = new Map(kept.filter((p) => marketOf(p.name) !== undefined).map((p) => [p.name, p]))
  const palettes = [
    ...catalog.palettes.map((p) => pinned.get(p.name) ?? p),
    ...readLocal(configHome, catalog.palettes, warn),
  ]
  const known = new Set(palettes.map((p) => p.name))
  return { ...catalog, palettes: [...palettes, ...kept.filter((p) => !known.has(p.name))] }
}

export function available(configHome: string, catalog: Manifest, warn = true): Manifest {
  const view = untuned(configHome, catalog, warn)
  return { ...view, palettes: tuned(view.palettes, readTone(configHome)) }
}

export function readAvailable(configHome: string): Manifest {
  return available(configHome, readCatalog(configHome))
}

export class Missing extends Error {}

export class Limited extends Error {}

export async function reach(
  url: string,
  timeout = TIMEOUT,
  signal?: AbortSignal,
  headers: Record<string, string> = {},
): Promise<Response> {
  let response: Response
  try {
    const limit = AbortSignal.timeout(timeout)
    response = await fetch(url, { headers, signal: signal ? AbortSignal.any([limit, signal]) : limit })
  } catch (error) {
    throw new Error(`cannot reach ${url} — ${error instanceof Error ? error.message : String(error)}`)
  }
  if (response.status === 404) {
    throw new Missing(`nothing at ${url}`)
  }
  if (response.status === 403 || response.status === 429) {
    throw new Limited(
      `${new URL(url).host} is turning requests away for now (${response.status}) — try again in a minute`,
    )
  }
  if (!response.ok && response.status !== 304) {
    throw new Error(`${url} answered ${response.status}`)
  }
  return response
}

export async function fetchParsed<T>(
  url: string,
  parse: (source: string) => T,
  timeout = TIMEOUT,
  signal?: AbortSignal,
): Promise<T> {
  return parse(await (await reach(url, timeout, signal)).text())
}

export function gateFailures(palette: PaletteEntry): string[] {
  const waived = new Set(palette.waived ?? [])
  const gate = palette.gate ?? measure(toTheme(palette))
  return GATE_RULES.flatMap((rule, i) => {
    const value = gate[i]
    if (waived.has(rule.rule) || typeof value !== 'number' || Number.isNaN(value)) {
      return []
    }
    if (rule.min !== undefined && value < rule.min) {
      return [`${rule.label} ${value} < ${rule.min}`]
    }
    if (rule.max !== undefined && value > rule.max) {
      return [`${rule.label} ${value} > ${rule.max}`]
    }
    return []
  })
}

export function find(palettes: PaletteEntry[], name: string): PaletteEntry {
  const hit = palettes.find((p) => p.name === name)
  if (!hit) {
    throw new Error(`no palette named ${name} in the catalog — ${nearest(palettes, [name])}`)
  }
  return hit
}

export function nearest(palettes: PaletteEntry[], names: string[]): string {
  const needles = names.map((n) => n.toLowerCase())
  const named = palettes.filter((p) => needles.some((n) => p.name.includes(n)))
  const grouped = palettes.filter((p) => !named.includes(p) && needles.some((n) => p.group.toLowerCase().includes(n)))
  const near = [...named, ...grouped].map((p) => p.name).slice(0, 3)
  return near.length > 0 ? `did you mean: ${near.join(', ')}?` : '`ttheme list` shows what is there'
}

export function search(palettes: PaletteEntry[], query: string): PaletteEntry[] {
  return palettes.filter((p) =>
    containsText(
      [p.name, p.group, p.native ?? '', p.ansiSource, ...(p.nativeNames ?? []), ...aliasesFor(p.booru)],
      query,
    ),
  )
}

export function booruTags(palettes: PaletteEntry[], near: PaletteEntry, token: string): PaletteEntry[] {
  const needle = token.toLowerCase()
  const rank = (p: PaletteEntry) => (p.name === near.name ? 0 : p.group === near.group ? 1 : 2)
  return palettes
    .filter((p) => p.booru?.toLowerCase().includes(needle))
    .map((p, at) => ({ p, at }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.at - b.at)
    .map(({ p }) => p)
}

export function siteTags(entry: PaletteEntry, site: string): string[] {
  return entry.booruSites?.[site] ?? (entry.booru ? [entry.booru] : [])
}
