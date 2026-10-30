import type { Work } from '../../src/core/commons.ts'
import { askedOf, type NameHit, namedWorks, paletteNameOf } from '../../src/core/names.ts'

export const NAMES_PATH = '/names.json'

export const NEW_KEY = 'new'

export const MOST_ASKED = 100

export interface NamedRow {
  id: string
  read: string | null
}

export interface NamesAnswer {
  works: NamedRow[]
  label: string
  asked: string
  name: string | null
}

export function answerOf(
  query: string,
  hits: readonly NameHit[],
  works: readonly Work[],
  shelved: ReadonlySet<string>,
): NamesAnswer {
  return {
    works: namedWorks(hits, works)
      .works.filter((work) => shelved.has(work.id))
      .map(({ id, hit }) => ({ id, read: hit.kind === 'character' ? hit.label : null })),
    label: hits[0]?.label ?? query,
    asked: askedOf(query, hits[0]),
    name: paletteNameOf(query, hits[0]) ?? null,
  }
}

export function plainAnswer(query: string): NamesAnswer {
  return answerOf(query, [], [], new Set())
}

export function namesPath(query: string): string {
  return `${NAMES_PATH}?${new URLSearchParams({ q: query })}`
}

export function makePath(name: string | null): string {
  return `/builder?${new URLSearchParams({ [NEW_KEY]: name ?? '' })}`
}
