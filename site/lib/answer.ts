import type { FoundWork } from '@/lib/found'
import type { NamesAnswer } from '@/lib/names'
import type { Work } from '../../src/core/commons.ts'
import { type NameHit, namedWorks, paletteNameOf, requestUrl } from '../../src/core/names.ts'

export function answerOf(
  query: string,
  hits: readonly NameHit[],
  works: readonly Work[],
  shelved: ReadonlySet<string>,
  found: FoundWork[],
): NamesAnswer {
  return {
    works: namedWorks(hits, works).works.filter((id) => shelved.has(id)),
    found,
    label: query,
    request: requestUrl(query),
    name: paletteNameOf(query) ?? null,
  }
}
