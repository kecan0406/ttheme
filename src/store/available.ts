import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { aboutOf, type Commons, mergeWorks, parseCommons, shelfOf, type Work, wordsOf } from '../core/commons.ts'
import { boundOf, GATE_RULES, measure, missedRules, shownOf } from '../core/contrast.ts'
import {
  type Bundle,
  entryProblem,
  inMode,
  type Manifest,
  type PaletteEntry,
  parseBuiltin,
  toTheme,
} from '../core/manifest.ts'
import { marketplaceLayout, type Report, readMarketplaceFiles, readWorkFiles, workLayout } from '../core/own.ts'
import { containsText } from '../core/text.ts'
import { BUILTIN, type Identity, isBuiltin, MARKETPLACE_FILE, marketplaceId, slugOf } from '../core/theme.ts'
import { writeAtomic } from './edits.ts'
import { readLocal, warning } from './local.ts'
import {
  cachePath,
  isLocal,
  isRemote,
  localIdentity,
  type MarketplaceInfo,
  marketplaceSources,
  readMarketplaceInfo,
  remoteOwner,
  shownSource,
} from './sources.ts'
import { readTone, tuned } from './tone.ts'
import { modeFor } from './wiring.ts'

const TIMEOUT = 20_000

export function builtinPath(configHome: string): string {
  return join(configHome, 'ttheme', 'builtin.json')
}

export function commonsPath(configHome: string): string {
  return join(configHome, 'ttheme', 'commons.json')
}

export interface Bundled {
  builtin: Bundle
  commons: Commons
}

export function writeBundled(configHome: string, { builtin, commons }: Bundled): void {
  writeAtomic(builtinPath(configHome), `${JSON.stringify(builtin, null, 2)}\n`)
  writeAtomic(commonsPath(configHome), `${JSON.stringify(commons, null, 2)}\n`)
}

export function readPackaged(root: string): Bundled {
  return {
    builtin: parseBuiltin(readFileSync(join(root, 'dist', 'builtin.json'), 'utf8')),
    commons: parseCommons(readFileSync(join(root, 'dist', 'commons.json'), 'utf8')),
  }
}

export function readBundled(configHome: string): Bundled {
  const path = builtinPath(configHome)

  if (!existsSync(path) || !existsSync(commonsPath(configHome))) {
    throw new Error(`no built-in palettes at ${path} — run \`ttheme init\` first`)
  }

  return {
    builtin: parseBuiltin(readFileSync(path, 'utf8')),
    commons: parseCommons(readFileSync(commonsPath(configHome), 'utf8')),
  }
}

export interface Archive {
  etag?: string
  files: Record<string, string>
}

export function readMarketplaces(configHome: string, warn = true, bundled?: Bundled): Manifest {
  const sources = marketplaceSources(configHome)
  const { builtin, commons } = bundled ?? readBundled(configHome)
  const remote = sources.filter(isRemote).flatMap((source) => readCached(configHome, source, warn) ?? [])
  const palettes = [...(sources.includes(BUILTIN) ? builtin.palettes : []), ...remote.flatMap((m) => m.entries)]

  return {
    version: builtin.version,
    gate: builtin.gate,
    palettes,
    works: mergeWorks(
      commons.works,
      remote.flatMap((m) => m.works),
    ),
  }
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
  if (source === BUILTIN) {
    return BUILTIN
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
  works: Work[]
}

export function readArchive(source: string, archive: Archive, report: Report): ReadMarketplace {
  const info = archiveInfo(source, archive)
  const id = remoteId(source, info)
  const shown = shownSource(source)
  const texts = new Map(Object.entries(archive.files).map(([path, text]) => [`${shown}/${path}`, text]))
  const paths = Object.keys(archive.files)
  const at = (path: string) => `${shown}/${path}`
  const read = (file: { path: string }) => texts.get(file.path) ?? ''

  return {
    id,
    info,
    entries: readMarketplaceFiles(marketplaceLayout(paths, at), read, id, report, true),
    works: readWorkFiles(workLayout(paths, at), read, report, true),
  }
}

function readCached(configHome: string, source: string, warn: boolean): ReadMarketplace | undefined {
  const path = cachePath(configHome, source)

  if (!existsSync(path)) {
    return undefined
  }

  try {
    return readArchive(source, readCachedArchive(configHome, source), warning(false))
  } catch (error) {
    if (warn) {
      process.stderr.write(`ttheme: skipping ${path} — ${(error as Error).message}\n`)
    }

    return undefined
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

    return !isBuiltin(p.name) && was !== undefined && looks(was) !== looks(p)
  })
}

function withSubject(entry: PaletteEntry, subject: string | undefined): PaletteEntry {
  if (entry.subject === subject) {
    return entry
  }

  const { subject: _, ...rest } = entry

  return subject === undefined ? rest : { ...rest, subject }
}

export function untuned(configHome: string, manifest: Manifest, warn = true): Manifest {
  const kept = readKept(configHome)
  const pinned = new Map(kept.filter((p) => !isBuiltin(p.name)).map((p) => [p.name, p]))
  const local = readLocal(configHome, warn)

  const palettes = [
    ...manifest.palettes.map((p) => {
      const was = pinned.get(p.name)

      return was ? withSubject(was, p.subject) : p
    }),
    ...local.entries,
  ]

  const known = new Set(palettes.map((p) => p.name))

  return {
    ...manifest,
    palettes: [...palettes, ...kept.filter((p) => !known.has(p.name))],
    works: mergeWorks(manifest.works, local.works),
  }
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

export class Unreachable extends Error {}

class Limited extends Unreachable {}

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
    throw new Unreachable(`cannot reach ${url} — ${error instanceof Error ? error.message : String(error)}`)
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

export function find(palettes: PaletteEntry[], name: string, installed: readonly string[] = []): PaletteEntry {
  const exact = palettes.find((p) => p.name === name)

  if (exact) {
    return exact
  }

  const same = palettes.filter((p) => slugOf(p.name) === name)
  const mine = same.filter((p) => installed.includes(p.name))
  const hit = mine.length === 1 ? mine[0] : same.length === 1 ? same[0] : undefined

  if (hit) {
    return hit
  }

  if (same.length > 1) {
    throw new Error(`${name} is ${same.map((p) => p.name).join(', ')} — name the one you mean`)
  }

  throw new Error(`no palette named ${name} in your marketplaces — ${nearest(palettes, [name])}`)
}

export function nearest(palettes: PaletteEntry[], names: string[]): string {
  const needles = names.map((n) => n.toLowerCase())
  const named = palettes.filter((p) => needles.some((n) => p.name.includes(n)))

  const shelved = palettes.filter(
    (p) => !named.includes(p) && needles.some((n) => (p.subject ?? '').toLowerCase().includes(n)),
  )

  const near = [...named, ...shelved].map((p) => p.name).slice(0, 3)

  return near.length > 0 ? `did you mean: ${near.join(', ')}?` : 'the Browse tab of `ttheme` shows what is there'
}

export function search(palettes: PaletteEntry[], works: readonly Work[], query: string): PaletteEntry[] {
  return palettes.filter((p) => {
    const about = aboutOf(works, p.subject)

    return containsText([p.name, shelfOf(p, works), ...wordsOf(about)], query)
  })
}

export function booruTags(
  palettes: PaletteEntry[],
  works: readonly Work[],
  near: PaletteEntry,
  token: string,
): PaletteEntry[] {
  const needle = token.toLowerCase()
  const home = aboutOf(works, near.subject)?.work.id
  const rank = (p: PaletteEntry) => (p.name === near.name ? 0 : aboutOf(works, p.subject)?.work.id === home ? 1 : 2)

  return palettes
    .filter((p) => aboutOf(works, p.subject)?.character?.danbooru?.toLowerCase().includes(needle))
    .sort((a, b) => rank(a) - rank(b))
}
