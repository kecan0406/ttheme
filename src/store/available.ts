import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { boundOf, GATE_RULES, measure, missedRules, shownOf } from '../core/contrast.ts'
import {
  emptyManifest,
  entryProblem,
  inMode,
  type Manifest,
  type PaletteEntry,
  parseManifest,
  toTheme,
} from '../core/manifest.ts'
import { marketplaceLayout, type Report, readMarketplaceFiles } from '../core/own.ts'
import { MARKETPLACE_FILE, marketplaceOf, shelfOf } from '../core/theme.ts'
import { writeAtomic } from './edits.ts'
import { readLocal, warning } from './local.ts'
import { aliasesFor, containsText } from './names.ts'
import {
  cachePath,
  type Identity,
  isLocal,
  isRemote,
  localIdentity,
  type MarketplaceInfo,
  marketplaceId,
  marketplaceSources,
  OFFICIAL,
  readMarketplaceInfo,
  remoteOwner,
  shownSource,
} from './sources.ts'
import { readTone, tuned } from './tone.ts'
import { modeFor } from './wiring.ts'

const TIMEOUT = 20_000

export function officialPath(configHome: string): string {
  return join(configHome, 'ttheme', 'official.json')
}

export function writeOfficial(configHome: string, manifest: Manifest): void {
  writeAtomic(officialPath(configHome), `${JSON.stringify(manifest, null, 2)}\n`)
}

export interface Archive {
  etag?: string
  files: Record<string, string>
}

export function readMarketplaces(configHome: string, warn = true, official?: Manifest): Manifest {
  const sources = marketplaceSources(configHome)
  const path = officialPath(configHome)
  let base = emptyManifest()

  if (sources.includes(OFFICIAL)) {
    if (official) {
      base = official
    } else {
      if (!existsSync(path)) {
        throw new Error(`no official marketplace at ${path} — run \`ttheme init\` first`)
      }

      base = parseManifest(readFileSync(path, 'utf8'))
    }
  }

  const remote = sources.filter(isRemote).flatMap((source) => readCached(configHome, source, base.palettes, warn))

  return { ...base, palettes: [...base.palettes, ...remote] }
}

function parseArchive(source: string): Archive {
  let doc: { etag?: unknown; files?: unknown } | null

  try {
    doc = JSON.parse(source)
  } catch {
    throw new Error('is not valid JSON')
  }

  const files = doc?.files

  if (!files || typeof files !== 'object' || Object.values(files).some((text) => typeof text !== 'string')) {
    throw new Error('is not a copy of a marketplace this ttheme fetched — `ttheme update` fetches it again')
  }

  return { ...(typeof doc?.etag === 'string' ? { etag: doc.etag } : {}), files: files as Record<string, string> }
}

export function readCachedArchive(configHome: string, source: string): Archive {
  return parseArchive(readFileSync(cachePath(configHome, source), 'utf8'))
}

function remoteId(source: string, identity: Identity): string {
  return marketplaceId({ owner: remoteOwner(source), name: identity.name })
}

export function archiveInfo(source: string, archive: Archive): MarketplaceInfo {
  const text = archive.files[MARKETPLACE_FILE]

  if (text === undefined) {
    throw new Error(`${shownSource(source)} has no ${MARKETPLACE_FILE} — \`ttheme marketplace init\` makes one`)
  }

  return readMarketplaceInfo(text, MARKETPLACE_FILE)
}

export function archiveId(source: string, archive: Archive): string {
  return remoteId(source, archiveInfo(source, archive))
}

export function idOf(configHome: string, source: string): string {
  if (source === OFFICIAL) {
    return OFFICIAL
  }

  return isLocal(source)
    ? marketplaceId(localIdentity(source))
    : archiveId(source, readCachedArchive(configHome, source))
}

export function nameOf(configHome: string, source: string): string | undefined {
  try {
    return idOf(configHome, source)
  } catch {
    return undefined
  }
}

export interface ReadMarketplace {
  id: string
  info: MarketplaceInfo
  entries: PaletteEntry[]
}

export function readArchive(
  source: string,
  archive: Archive,
  official: PaletteEntry[],
  report: Report,
): ReadMarketplace {
  const info = archiveInfo(source, archive)
  const id = remoteId(source, info)
  const shown = shownSource(source)
  const texts = new Map(Object.entries(archive.files).map(([path, text]) => [`${shown}/${path}`, text]))
  const files = marketplaceLayout(Object.keys(archive.files), (path) => `${shown}/${path}`)

  return {
    id,
    info,
    entries: readMarketplaceFiles(files, (file) => texts.get(file.path) ?? '', id, official, report, true),
  }
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

function keptPath(configHome: string): string {
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
  return JSON.stringify([p.background, p.foreground, p.cursor, p.selection, p.ansi, p.other ?? null, p.pictures ?? []])
}

export function updatesOf(configHome: string, manifest: Manifest): PaletteEntry[] {
  const kept = new Map(readKept(configHome).map((p) => [p.name, p]))

  return manifest.palettes.filter((p) => {
    const was = kept.get(p.name)

    return marketplaceOf(p.name) !== undefined && was !== undefined && looks(was) !== looks(p)
  })
}

export function untuned(configHome: string, manifest: Manifest, warn = true): Manifest {
  const kept = readKept(configHome)
  const pinned = new Map(kept.filter((p) => marketplaceOf(p.name) !== undefined).map((p) => [p.name, p]))

  const palettes = [
    ...manifest.palettes.map((p) => pinned.get(p.name) ?? p),
    ...readLocal(configHome, manifest.palettes, warn),
  ]

  const known = new Set(palettes.map((p) => p.name))

  return { ...manifest, palettes: [...palettes, ...kept.filter((p) => !known.has(p.name))] }
}

export function shown(configHome: string, manifest: Manifest, warn = true): Manifest {
  const view = untuned(configHome, manifest, warn)
  const mode = modeFor(configHome)

  return { ...view, palettes: view.palettes.map((entry) => inMode(entry, mode)) }
}

export function available(configHome: string, manifest: Manifest, warn = true): Manifest {
  const view = shown(configHome, manifest, warn)

  return { ...view, palettes: tuned(view.palettes, readTone(configHome)) }
}

export function readAvailable(configHome: string): Manifest {
  return available(configHome, readMarketplaces(configHome))
}

export class Missing extends Error {}

class Limited extends Error {}

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

export function gateFailures(palette: PaletteEntry): string[] {
  const theme = toTheme(palette)
  const values = measure(theme)

  return missedRules(theme).map(
    (rule) => `${rule.label} ${shownOf(values[GATE_RULES.indexOf(rule)] as number)} ${boundOf(rule)}`,
  )
}

export function find(palettes: PaletteEntry[], name: string): PaletteEntry {
  const hit = palettes.find((p) => p.name === name)

  if (!hit) {
    throw new Error(`no palette named ${name} in your marketplaces — ${nearest(palettes, [name])}`)
  }

  return hit
}

export function nearest(palettes: PaletteEntry[], names: string[]): string {
  const needles = names.map((n) => n.toLowerCase())
  const named = palettes.filter((p) => needles.some((n) => p.name.includes(n)))

  const shelved = palettes.filter(
    (p) => !named.includes(p) && needles.some((n) => shelfOf(p).toLowerCase().includes(n)),
  )

  const near = [...named, ...shelved].map((p) => p.name).slice(0, 3)

  return near.length > 0 ? `did you mean: ${near.join(', ')}?` : 'the Browse tab of `ttheme` shows what is there'
}

export function search(palettes: PaletteEntry[], query: string): PaletteEntry[] {
  return palettes.filter((p) =>
    containsText(
      [p.name, shelfOf(p), p.native ?? '', p.ansiSource, ...(p.nativeNames ?? []), ...aliasesFor(p.booru)],
      query,
    ),
  )
}

export function booruTags(palettes: PaletteEntry[], near: PaletteEntry, token: string): PaletteEntry[] {
  const needle = token.toLowerCase()
  const rank = (p: PaletteEntry) => (p.name === near.name ? 0 : shelfOf(p) === shelfOf(near) ? 1 : 2)

  return palettes.filter((p) => p.booru?.toLowerCase().includes(needle)).sort((a, b) => rank(a) - rank(b))
}

export function siteTags(entry: PaletteEntry, site: string): string[] {
  return entry.booruSites?.[site] ?? (entry.booru ? [entry.booru] : [])
}
