import { join } from 'node:path'
import { cachedSource, httpSource, Names } from '@kecan0406/aninames'
import { AGENT } from '../core/booru.ts'
import type { NameHit } from '../core/names.ts'
import { inert } from '../core/text.ts'
import { cacheRoot } from './paths.ts'

export const NAMES_URL = 'https://names.ttheme.dev'

export const PROVIDERS = ['aninames', 'off'] as const

export type NameSearch = (query: string, signal: AbortSignal) => Promise<NameHit[]>

const LIMIT = 10

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

function worksOf(found: unknown): string[] {
  const ids = (Array.isArray(found) ? found : []).flatMap((f: unknown) =>
    typeof f === 'object' && f !== null && (f as Record<string, unknown>).kind === 'character'
      ? strings((f as Record<string, unknown>).works, Boolean)
      : [],
  )

  return [...new Set(ids)]
}

export function nameSearch(provider: string | undefined, base = NAMES_URL): NameSearch | undefined {
  if (provider === 'off') {
    return undefined
  }

  const names = new Names(
    cachedSource(httpSource(base, { headers: { 'user-agent': AGENT } }), join(cacheRoot(), 'names')),
  )

  const ask = async (query: string, signal: AbortSignal) => {
    const found: unknown = await names.search(query, { limit: LIMIT, adult: false, signal })
    const ids = worksOf(found)
    const works: unknown = ids.length > 0 ? await names.lookup(ids, signal) : []

    return hitsOf(found, works)
  }

  return async (query, signal) => {
    try {
      return await ask(query, signal)
    } catch (error) {
      if (signal.aborted) {
        throw error
      }

      return ask(query, signal)
    }
  }
}
