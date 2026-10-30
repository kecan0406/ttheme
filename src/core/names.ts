import pkg from '../../package.json' with { type: 'json' }
import type { Work } from './commons.ts'
import { searchKey } from './text.ts'
import { slugProblem } from './theme.ts'

export const MAKE_URL = 'https://ttheme.dev/docs/guide/make'

export const NAME_PAUSE = 600

const QUALIFIER = /_\([^)]*\)$/

export function requestUrl(asked: string): string {
  return `${pkg.bugs}/new?${new URLSearchParams({ template: 'palette.yml', character: asked })}`
}

export type NameKind = 'work' | 'character'

export interface NameHit {
  id: string
  kind: NameKind
  label: string
  names: string[]
  tags: string[]
  works: NameHit[]
}

export interface NamedWork {
  id: string
  hit: NameHit
}

export interface Named {
  works: NamedWork[]
  unknown: NameHit[]
}

interface Keys {
  works: Map<string, string>
  characters: Map<string, string[]>
  names: Map<string, string>
}

const KEYS = new WeakMap<readonly Work[], Keys>()

function keysOf(works: readonly Work[]): Keys {
  const cached = KEYS.get(works)

  if (cached) {
    return cached
  }

  const keys: Keys = { works: new Map(), characters: new Map(), names: new Map() }

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

    for (const character of work.characters) {
      if (character.danbooru && !keys.characters.has(character.danbooru)) {
        keys.characters.set(character.danbooru, [work.id, ...(character.also ?? [])])
      }
    }
  }

  KEYS.set(works, keys)

  return keys
}

function workFor(hit: NameHit, keys: Keys): string[] {
  const tagged = hit.tags.flatMap((tag) => keys.works.get(tag) ?? [])

  if (tagged.length > 0) {
    return tagged.slice(0, 1)
  }

  return [hit.label, ...hit.names].flatMap((name) => keys.names.get(searchKey(name)) ?? []).slice(0, 1)
}

function characterFor(hit: NameHit, keys: Keys): string[] {
  const tagged = hit.tags.map((tag) => keys.characters.get(tag)).find((ids) => ids !== undefined)

  return tagged ?? hit.works.flatMap((work) => workFor(work, keys))
}

export function namedWorks(hits: readonly NameHit[], works: readonly Work[]): Named {
  const keys = keysOf(works)
  const seen = new Set<string>()
  const named: Named = { works: [], unknown: [] }

  for (const hit of hits) {
    const ids = hit.kind === 'work' ? workFor(hit, keys) : characterFor(hit, keys)

    if (ids.length === 0) {
      named.unknown.push(hit)
    }

    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id)
        named.works.push({ id, hit })
      }
    }
  }

  return named
}

export function askedOf(query: string, hit: NameHit | undefined): string {
  const work = hit?.kind === 'character' ? hit.works[0] : undefined

  return hit ? (work ? `${hit.label}, ${work.label}` : hit.label) : query
}

function slugFrom(text: string): string | undefined {
  const plain = text.normalize('NFKD').replace(/\p{M}/gu, '')

  if (!/^[\x20-\x7e]+$/.test(plain)) {
    return undefined
  }

  const slug = plain
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '')

  return slug && !slugProblem(slug) ? slug : undefined
}

export function paletteNameOf(query: string, hit: NameHit | undefined): string | undefined {
  const tags = (hit?.tags ?? []).map((tag) => tag.replace(QUALIFIER, ''))

  return [...tags, ...(hit ? [hit.label, ...hit.names] : []), query].map(slugFrom).find((slug) => slug !== undefined)
}
