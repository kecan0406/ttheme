import type { NamesAnswer } from '@/lib/names'
import type { Work } from '../../src/core/commons.ts'
import { askedOf, type NameHit, namedWorks, paletteNameOf, requestUrl } from '../../src/core/names.ts'

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
    request: requestUrl(askedOf(query, hits[0])),
    name: paletteNameOf(query, hits[0]) ?? null,
  }
}
