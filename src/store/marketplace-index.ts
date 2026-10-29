import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PaletteEntry } from '../core/manifest.ts'
import { containsText, inert } from '../core/text.ts'
import { nameProblem, subjectProblem, textProblem } from '../core/theme.ts'
import { reach } from './available.ts'
import { writeAtomic } from './edits.ts'
import { cacheRoot } from './paths.ts'
import { isRemote, parseSource } from './sources.ts'

export const INDEX_URL = 'https://index.ttheme.dev/marketplaces.json'

const HEX = /^#[0-9a-f]{6}$/i
const DAY = /^\d{4}-\d{2}-\d{2}$/

export interface ListedPalette {
  name: string
  subject?: string
  background: string
  foreground: string
  cursor: string
  selection: string
  ansi: string[]
}

export interface Listed {
  id: string
  source: string
  about: string
  stars: number
  updated: string
  palettes: ListedPalette[]
  works: ListedWork[]
}

export interface ListedWork {
  id: string
  name: string
  native?: string
}

export interface Listing {
  marketplaces: Listed[]
  at: number
  offline?: string
}

interface Cached {
  etag: string
  at: number
  text: string
}

function word(value: unknown): string | undefined {
  return typeof value === 'string' ? inert(value) : undefined
}

function color(value: unknown): string | undefined {
  return typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : undefined
}

function readPalette(id: string, value: unknown): ListedPalette | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const v = value as Record<string, unknown>
  const name = word(v.name)
  const [background, foreground, cursor, selection] = [v.background, v.foreground, v.cursor, v.selection].map(color)
  const ansi = Array.isArray(v.ansi) ? v.ansi.map(color) : []

  if (
    !name ||
    nameProblem(`${id}/${name}`) ||
    !background ||
    !foreground ||
    !cursor ||
    !selection ||
    ansi.length !== 16 ||
    ansi.some((c) => c === undefined)
  ) {
    return undefined
  }

  const subject = typeof v.subject === 'string' && !subjectProblem(v.subject) ? v.subject : undefined

  return {
    name,
    ...(subject ? { subject } : {}),
    background,
    foreground,
    cursor,
    selection,
    ansi: ansi.filter((c): c is string => c !== undefined),
  }
}

function readListedWork(value: unknown): ListedWork | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const v = value as Record<string, unknown>
  const name = word(v.name)
  const native = word(v.native)

  if (typeof v.id !== 'string' || subjectProblem(v.id) || v.id.includes('/') || !name || textProblem(name)) {
    return undefined
  }

  return { id: v.id, name, ...(native && !textProblem(native) ? { native } : {}) }
}

function readListed(value: unknown): Listed | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const v = value as Record<string, unknown>
  const id = word(v.id)
  const typed = word(v.source)

  if (!id || !typed || nameProblem(`${id}/x`)) {
    return undefined
  }

  let source: string

  try {
    source = parseSource(typed)
  } catch {
    return undefined
  }

  if (!isRemote(source)) {
    return undefined
  }

  const palettes = (Array.isArray(v.palettes) ? v.palettes : []).flatMap((p) => readPalette(id, p) ?? [])

  if (palettes.length === 0) {
    return undefined
  }

  const stars = typeof v.stars === 'number' && Number.isFinite(v.stars) && v.stars >= 0 ? Math.floor(v.stars) : 0
  const updated = word(v.updated) ?? ''

  return {
    id,
    source,
    about: word(v.about) ?? '',
    stars,
    updated: DAY.test(updated) ? updated : '',
    palettes,
    works: (Array.isArray(v.works) ? v.works : []).flatMap((w) => readListedWork(w) ?? []),
  }
}

export function parseIndex(text: string): Listed[] {
  const doc: unknown = JSON.parse(text)
  const listed = typeof doc === 'object' && doc !== null ? (doc as Record<string, unknown>).marketplaces : undefined

  if (!Array.isArray(listed)) {
    throw new Error('the marketplace index lists no marketplaces')
  }

  const seen = new Set<string>()

  return listed.flatMap((value) => {
    const m = readListed(value)

    if (!m || seen.has(m.id)) {
      return []
    }

    seen.add(m.id)

    return [m]
  })
}

function indexCache(): string {
  return join(cacheRoot(), 'marketplace-index.json')
}

function readCached(path: string): Cached | undefined {
  try {
    const doc: unknown = JSON.parse(readFileSync(path, 'utf8'))
    const v = typeof doc === 'object' && doc !== null ? (doc as Record<string, unknown>) : {}

    return typeof v.etag === 'string' && typeof v.at === 'number' && typeof v.text === 'string'
      ? { etag: v.etag, at: v.at, text: v.text }
      : undefined
  } catch {
    return undefined
  }
}

export async function readIndex(signal?: AbortSignal, path = indexCache(), url = INDEX_URL): Promise<Listing> {
  const cached = readCached(path)
  let marketplaces: Listed[] | undefined

  try {
    marketplaces = cached ? parseIndex(cached.text) : undefined
  } catch {
    marketplaces = undefined
  }

  try {
    const response = await reach(url, undefined, signal, cached && marketplaces ? { 'if-none-match': cached.etag } : {})
    const at = Date.now()

    if (response.status === 304 && cached && marketplaces) {
      writeAtomic(path, JSON.stringify({ ...cached, at }))

      return { marketplaces, at }
    }

    const text = await response.text()
    const fresh = parseIndex(text)
    writeAtomic(path, JSON.stringify({ etag: response.headers.get('etag') ?? '', at, text }))

    return { marketplaces: fresh, at }
  } catch (error) {
    if (!cached || !marketplaces) {
      throw error
    }

    return { marketplaces, at: cached.at, offline: error instanceof Error ? error.message : String(error) }
  }
}

export function listedMatches(m: Listed, query: string): boolean {
  return containsText(
    [m.id, m.source, m.about, ...m.palettes.flatMap((e) => [e.name, e.subject ?? '']), ...m.works.map((w) => w.name)],
    query,
  )
}

export interface Shown {
  id: string
  repo: string
  add: string
  about: string
  stars: number
  pushedAt: string
  license: string | null
  palettes: PaletteEntry[]
  works: ListedWork[]
}
