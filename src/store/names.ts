import { join } from 'node:path'
import { cachedSource, httpSource, Names, type Source } from '@kecan0406/aninames'
import { AGENT } from '../core/booru.ts'
import { type CastMember, cutSlug, type NameHit, slugOfTag, type TaggedWork, type WorkName } from '../core/names.ts'
import { inert } from '../core/text.ts'
import { cacheRoot } from './paths.ts'

export const NAMES_URL = 'https://names.ttheme.dev'

export const PROVIDERS = ['aninames', 'off'] as const

export type NameSearch = (query: string, signal: AbortSignal) => Promise<NameHit[]>

export interface NameIndex {
  search: NameSearch
  tagged(slug: string, signal: AbortSignal): Promise<TaggedWork[]>
  cast(slug: string, signal: AbortSignal, limit: number): Promise<CastMember[]>
  find(query: string, slug: string, tags: readonly string[], signal: AbortSignal): Promise<CastMember[]>
  person(tag: string, signal: AbortSignal): Promise<CastMember | undefined>
  open(signal: AbortSignal): Promise<void>
}

const LIMIT = 10

const FIND_LIMIT = 50

const RETRIES = [150, 500]

const ODD = /[\s\p{Cc}\p{Bidi_Control}]/u

const LANG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/

const REF = /^[a-z]+:[\w./-]+$/

const COUNTRY = /^[A-Z]{2}$/

const MEDIUM = /^[a-z]{2,8}$/

function text(value: unknown): string | undefined {
  const shown = typeof value === 'string' ? inert(value).trim() : ''

  return shown || undefined
}

function strings(value: unknown, keep: (s: string) => boolean): string[] {
  return Array.isArray(value) ? value.flatMap((v) => (typeof v === 'string' && keep(v) ? [v] : [])) : []
}

const LATIN_QUERY = /^[\x20-\x7e]+$/

const SURE = new Set(['name', 'family', 'prefix'])

function sureOf(match: unknown, query: string): boolean {
  if (match === 'part') {
    return [...query].length >= (LATIN_QUERY.test(query) ? 5 : 3)
  }

  return typeof match === 'string' && SURE.has(match)
}

function hitOf(value: unknown, query: string): NameHit | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const v = value as Record<string, unknown>
  const id = typeof v.id === 'string' ? v.id : undefined
  const label = text(v.label)

  if (!id || !label || v.kind !== 'work' || !sureOf(v.match, query)) {
    return undefined
  }

  const names = (Array.isArray(v.names) ? v.names : []).flatMap((n: unknown) =>
    typeof n === 'object' && n !== null ? (text((n as Record<string, unknown>).text) ?? []) : [],
  )

  return { id, label, names, tags: strings(v.danbooru, (t) => t !== '' && !ODD.test(t)) }
}

function workNamesOf(value: unknown): WorkName[] {
  return (Array.isArray(value) ? value : []).flatMap((n: unknown) => {
    if (typeof n !== 'object' || n === null) {
      return []
    }

    const v = n as Record<string, unknown>
    const shown = text(v.text)

    return shown
      ? [
          {
            text: shown,
            lang: typeof v.lang === 'string' && LANG.test(v.lang) ? v.lang : null,
            official: v.kind === 'official' || v.kind === 'main',
          },
        ]
      : []
  })
}

function taggedOf(value: unknown): TaggedWork | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const v = value as Record<string, unknown>
  const id = typeof v.id === 'string' ? v.id : undefined
  const label = text(v.label)

  if (!id || !label || v.kind !== 'work') {
    return undefined
  }

  return {
    id,
    label,
    names: workNamesOf(v.names),
    tags: strings(v.danbooru, (t) => t !== '' && !ODD.test(t)),
    refs: strings(v.refs, (r) => REF.test(r)),
    origin: strings(v.origin, (c) => COUNTRY.test(c)),
    year: Number.isSafeInteger(v.year) && (v.year as number) > 0 ? (v.year as number) : null,
    medium: typeof v.medium === 'string' && MEDIUM.test(v.medium) ? v.medium : null,
  }
}

export function taggedWorks(found: unknown): TaggedWork[] {
  return (Array.isArray(found) ? found : []).flatMap((f: unknown) => taggedOf(f) ?? [])
}

function memberOf(value: unknown): CastMember | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const v = value as Record<string, unknown>
  const id = typeof v.id === 'string' ? v.id : undefined
  const label = text(v.label)

  if (!id || !label || v.kind !== 'character') {
    return undefined
  }

  return {
    id,
    label,
    names: workNamesOf(v.names),
    tags: strings(v.danbooru, (t) => t !== '' && !ODD.test(t)),
    refs: strings(v.refs, (r) => REF.test(r)),
    lead: v.role === 'lead',
  }
}

export function castMembers(found: unknown): CastMember[] {
  return (Array.isArray(found) ? found : []).flatMap((f: unknown) => memberOf(f) ?? [])
}

export function hitsOf(found: unknown, query: string): NameHit[] {
  return (Array.isArray(found) ? found : []).flatMap((f: unknown) => hitOf(f, query) ?? [])
}

function cardsOf(found: unknown): Record<string, unknown>[] {
  return (Array.isArray(found) ? found : []).flatMap((f: unknown) =>
    typeof f === 'object' && f !== null ? [f as Record<string, unknown>] : [],
  )
}

function passing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)

  return !message.startsWith('aninames:') || /answered 5\d\d$/.test(message)
}

async function again<T>(run: () => Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run()
    } catch (error) {
      const wait = RETRIES[attempt]

      if (wait === undefined || signal?.aborted || !passing(error)) {
        throw error
      }

      await new Promise((resolve) => setTimeout(resolve, wait))
    }
  }
}

function retrying(source: Source): Source {
  return {
    manifest: (signal) => again(() => source.manifest(signal), signal),
    file: (path, signal) => again(() => source.file(path, signal), signal),
  }
}

export function liveSource(base = NAMES_URL): Source {
  return httpSource(base, { headers: { 'user-agent': AGENT } })
}

export function nameIndex(source: Source): NameIndex {
  const names = new Names(retrying(source))

  const ask = async (query: string, signal: AbortSignal) => {
    const found: unknown = await names.search(query, { kind: 'work', limit: LIMIT, adult: false, signal })

    return hitsOf(found, query)
  }

  return {
    async search(query, signal) {
      try {
        return await ask(query, signal)
      } catch (error) {
        if (signal.aborted) {
          throw error
        }

        return ask(query, signal)
      }
    },
    async tagged(slug, signal) {
      const found: unknown = await names.tagged(slug, { kind: 'work', adult: false, prefix: cutSlug(slug), signal })

      return taggedWorks(found)
    },
    async cast(slug, signal, limit) {
      const found: unknown = await names.cast(slug, { adult: false, limit, prefix: cutSlug(slug), signal })

      return castMembers(found)
    },
    async find(query, slug, tags, signal) {
      const [found, works]: unknown[] = await Promise.all([
        names.search(query, { kind: 'character', limit: FIND_LIMIT, adult: false, signal }),
        names.tagged(slug, { kind: 'work', adult: false, prefix: cutSlug(slug), signal }),
      ])

      const ids = new Set(cardsOf(works).flatMap((card) => (typeof card.id === 'string' ? [card.id] : [])))

      return castMembers(
        cardsOf(found).filter(
          (card) =>
            (typeof card.home === 'string' && slugOfTag(card.home) === slug) ||
            strings(card.works, Boolean).some((id) => ids.has(id)) ||
            strings(card.danbooru, Boolean).some((tag) => tags.includes(tag)),
        ),
      )
    },
    async person(tag, signal) {
      const found: unknown = await names.tagged(tag, { kind: 'character', adult: false, signal })

      return castMembers(found).find((member) => member.tags.includes(tag))
    },
    async open(signal) {
      await names.lookup([], signal)
    },
  }
}

export function nameSearch(provider: string | undefined, base = NAMES_URL): NameSearch | undefined {
  return provider === 'off' ? undefined : nameIndex(cachedSource(liveSource(base), join(cacheRoot(), 'names'))).search
}
