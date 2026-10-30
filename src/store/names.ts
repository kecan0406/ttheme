import { join } from 'node:path'
import { cachedSource, httpSource, Names, type Source } from '@kecan0406/aninames'
import { AGENT } from '../core/booru.ts'
import type { Work } from '../core/commons.ts'
import { knowsCharacter, type NameHit } from '../core/names.ts'
import { inert } from '../core/text.ts'
import { cacheRoot } from './paths.ts'

export const NAMES_URL = 'https://names.ttheme.dev'

export const PROVIDERS = ['aninames', 'off'] as const

export type NameSearch = (query: string, signal: AbortSignal, works?: readonly Work[]) => Promise<NameHit[]>

export interface NameIndex {
  search: NameSearch
  open(signal: AbortSignal): Promise<void>
}

const LIMIT = 10

const RETRIES = [150, 500]

const ODD = /[\s\p{Cc}\p{Bidi_Control}]/u

function text(value: unknown): string | undefined {
  const shown = typeof value === 'string' ? inert(value).trim() : ''

  return shown || undefined
}

function strings(value: unknown, keep: (s: string) => boolean): string[] {
  return Array.isArray(value) ? value.flatMap((v) => (typeof v === 'string' && keep(v) ? [v] : [])) : []
}

function hitOf(value: unknown, works: ReadonlyMap<string, NameHit>): NameHit | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const v = value as Record<string, unknown>
  const id = typeof v.id === 'string' ? v.id : undefined
  const label = text(v.label)
  const kind = v.kind === 'work' || v.kind === 'character' ? v.kind : undefined

  if (!id || !label || !kind) {
    return undefined
  }

  const names = (Array.isArray(v.names) ? v.names : []).flatMap((n: unknown) =>
    typeof n === 'object' && n !== null ? (text((n as Record<string, unknown>).text) ?? []) : [],
  )

  return {
    id,
    kind,
    label,
    names,
    tags: strings(v.danbooru, (t) => t !== '' && !ODD.test(t)),
    works: strings(v.works, Boolean).flatMap((w) => works.get(w) ?? []),
  }
}

export function hitsOf(found: unknown, works: unknown): NameHit[] {
  const cards = new Map(
    (Array.isArray(works) ? works : []).flatMap((w: unknown) => {
      const hit = hitOf(w, new Map())

      return hit ? [[hit.id, hit] as const] : []
    }),
  )

  return (Array.isArray(found) ? found : []).flatMap((f: unknown) => hitOf(f, cards) ?? [])
}

function cardsOf(found: unknown): Record<string, unknown>[] {
  return (Array.isArray(found) ? found : []).flatMap((f: unknown) =>
    typeof f === 'object' && f !== null ? [f as Record<string, unknown>] : [],
  )
}

export function worksOf(found: unknown, known: readonly Work[] | undefined): string[] {
  const cards = cardsOf(found)
  const characters = cards.filter((card) => card.kind === 'character')

  const settled = (card: Record<string, unknown>) =>
    known !== undefined && strings(card.danbooru, Boolean).some((tag) => knowsCharacter(known, tag))

  const placed = new Set(characters.filter(settled).flatMap((card) => strings(card.works, Boolean)))
  const first = cards[0]
  const lead = first?.kind === 'character' ? strings(first.works, Boolean).slice(0, 1) : []

  const open = characters
    .filter((card) => !settled(card))
    .flatMap((card) => strings(card.works, Boolean).filter((id) => !placed.has(id)))

  return [...new Set([...lead, ...open])]
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

  const ask = async (query: string, signal: AbortSignal, known: readonly Work[] | undefined) => {
    const found: unknown = await names.search(query, { limit: LIMIT, adult: false, signal })
    const ids = worksOf(found, known)
    const works: unknown = ids.length > 0 ? await names.lookup(ids, signal) : []

    return hitsOf(found, works)
  }

  return {
    async search(query, signal, known) {
      try {
        return await ask(query, signal, known)
      } catch (error) {
        if (signal.aborted) {
          throw error
        }

        return ask(query, signal, known)
      }
    },
    async open(signal) {
      await names.lookup([], signal)
    },
  }
}

export function nameSearch(provider: string | undefined, base = NAMES_URL): NameSearch | undefined {
  return provider === 'off' ? undefined : nameIndex(cachedSource(liveSource(base), join(cacheRoot(), 'names'))).search
}
