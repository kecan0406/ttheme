import pkg from '../../package.json' with { type: 'json' }
import type { Work } from './commons.ts'
import { searchKey } from './text.ts'

export const MAKE_URL = 'https://ttheme.dev/docs/guide/make'

const QUALIFIER = /_\([^)]*\)$/

const SLUG_MOST = 40

export function requestUrl(asked: string): string {
  return `${pkg.bugs}/new?${new URLSearchParams({ template: 'palette.yml', character: asked })}`
}

export interface NameHit {
  id: string
  label: string
  names: string[]
  tags: string[]
}

export interface WorkName {
  text: string
  lang: string | null
  official: boolean
  preferred?: true
}

export interface TaggedWork {
  id: string
  label: string
  names: WorkName[]
  tags: string[]
  refs: string[]
  origin: string[]
  year: number | null
  medium: string | null
}

export interface CastMember {
  id: string
  label: string
  names: WorkName[]
  tags: string[]
  refs: string[]
  lead: boolean
}

export interface Named {
  works: string[]
  unknown: NameHit[]
}

interface Keys {
  works: Map<string, string>
  names: Map<string, string>
}

const KEYS = new WeakMap<readonly Work[], Keys>()

function keysOf(works: readonly Work[]): Keys {
  const cached = KEYS.get(works)

  if (cached) {
    return cached
  }

  const keys: Keys = { works: new Map(), names: new Map() }

  for (const work of works) {
    if (work.danbooru && !keys.works.has(work.danbooru)) {
      keys.works.set(work.danbooru, work.id)
    }

    for (const name of [work.name, work.native ?? '']) {
      const key = searchKey(name)

      if (key && !keys.names.has(key)) {
        keys.names.set(key, work.id)
      }
    }
  }

  KEYS.set(works, keys)

  return keys
}

function workFor(hit: NameHit, keys: Keys): string | undefined {
  const tagged = hit.tags.flatMap((tag) => keys.works.get(tag) ?? [])[0]

  return tagged ?? [hit.label, ...hit.names].flatMap((name) => keys.names.get(searchKey(name)) ?? [])[0]
}

export function namedWorks(hits: readonly NameHit[], works: readonly Work[]): Named {
  const keys = keysOf(works)
  const named: Named = { works: [], unknown: [] }

  for (const hit of hits) {
    const id = workFor(hit, keys)

    if (id === undefined) {
      named.unknown.push(hit)
    } else if (!named.works.includes(id)) {
      named.works.push(id)
    }
  }

  return named
}

function slugFrom(text: string): string | undefined {
  const plain = text.normalize('NFKD').replace(/\p{M}/gu, '')

  if (!/^[\x20-\x7e]+$/.test(plain)) {
    return undefined
  }

  const slug = plain
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_MOST)
    .replace(/^-+|-+$/g, '')

  return slug || undefined
}

export function slugOfTag(tag: string): string | undefined {
  return slugFrom(tag.replace(QUALIFIER, ''))
}

export function cutSlug(slug: string): boolean {
  return slug.length >= SLUG_MOST - 1
}

export function paletteNameOf(query: string): string | undefined {
  return slugFrom(query)
}
