import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isHex } from './color.ts'
import { GATE_RULES, measure } from './contrast.ts'
import { writeAtomic } from './edits.ts'
import { emptyManifest, type Manifest, type PaletteEntry, toTheme } from './emit/manifest.ts'
import { readLocal } from './own.ts'
import { cachePath, isRemote, marketSources, OFFICIAL, remoteOwner } from './sources.ts'
import { nameProblem, ownerOf, textProblem } from './theme.ts'

export const REGISTRY_URL = 'https://kecan0406.github.io/ttheme/manifest.json'
const TIMEOUT = 20_000

export function catalogPath(configHome: string): string {
  return join(configHome, 'ttheme', 'catalog.json')
}

export function writeCatalog(configHome: string, catalog: Manifest): void {
  writeAtomic(catalogPath(configHome), `${JSON.stringify(catalog, null, 2)}\n`)
}

export interface MarketIndex extends Manifest {
  owner: string
}

export function readCatalog(configHome: string): Manifest {
  const sources = marketSources(configHome)
  const path = catalogPath(configHome)
  let base = emptyManifest()
  if (sources.includes(OFFICIAL)) {
    if (!existsSync(path)) {
      throw new Error(`no catalog at ${path} — run \`ttheme init\` first`)
    }
    base = parseCatalog(readFileSync(path, 'utf8'))
  }
  const remote = sources.filter(isRemote).flatMap((source) => readCached(configHome, source))
  return { ...base, palettes: joined(base.palettes, remote) }
}

function readCached(configHome: string, source: string): PaletteEntry[] {
  const path = cachePath(configHome, source)
  if (!existsSync(path)) {
    return []
  }
  try {
    return marketEntries(parseIndex(readFileSync(path, 'utf8')), remoteOwner(source))
  } catch (error) {
    process.stderr.write(`ttheme: skipping ${path} — ${(error as Error).message}\n`)
    return []
  }
}

export function parseIndex(source: string): MarketIndex {
  const index = parseCatalog(source) as MarketIndex
  if (typeof index.owner !== 'string' || nameProblem(`x@${index.owner}`)) {
    throw new Error('market index has no "owner"')
  }
  const named = index.palettes.find((p) => ownerOf(p.name) !== undefined)
  if (named) {
    throw new Error(`market index names ${named.name} with its owner — its entries are bare palette names`)
  }
  return index
}

export function marketEntries(index: Manifest, owner: string): PaletteEntry[] {
  return index.palettes.map(({ lead: _, default: __, ...entry }) => ({ ...entry, name: `${entry.name}@${owner}` }))
}

export function joined(base: PaletteEntry[], extra: PaletteEntry[]): PaletteEntry[] {
  const palettes = [...base]
  for (const o of extra) {
    const kin = palettes.findLastIndex((p) => o.base !== undefined && (p.name === o.base || p.base === o.base))
    const at = kin >= 0 ? kin : palettes.findLastIndex((p) => p.group === o.group)
    palettes.splice(at < 0 ? palettes.length : at + 1, 0, o)
  }
  return palettes
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
  for (const field of [p.group, p.native ?? '-', p.ansiSource]) {
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

export function available(configHome: string, catalog: Manifest, warn = true): Manifest {
  const palettes = joined(catalog.palettes, readLocal(configHome, catalog.palettes, warn))
  const known = new Set(palettes.map((p) => p.name))
  return { ...catalog, palettes: [...palettes, ...readKept(configHome).filter((p) => !known.has(p.name))] }
}

export function readAvailable(configHome: string): Manifest {
  return available(configHome, readCatalog(configHome))
}

export class Missing extends Error {}

export class Limited extends Error {}

export async function fetchParsed<T>(url: string, parse: (source: string) => T): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) })
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
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`)
  }
  return parse(await response.text())
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
  const needle = query.toLowerCase()
  return palettes.filter((p) =>
    [p.name, p.group, p.native ?? '', p.ansiSource].some((field) => field.toLowerCase().includes(needle)),
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
