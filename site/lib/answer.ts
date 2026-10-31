import type { FoundWork } from '@/lib/found'
import type { NamesAnswer } from '@/lib/names'
import type { Work } from '../../src/core/commons.ts'
import { askedOf, type NameHit, namedWorks, paletteNameOf, requestUrl } from '../../src/core/names.ts'

function charactersOf(hit: NameHit, works: readonly Work[]): string[] {
  if (hit.kind !== 'character') return []

  return works.flatMap((work) =>
    work.characters.flatMap((character) =>
      character.danbooru && hit.tags.includes(character.danbooru) ? [character.id] : [],
    ),
  )
}

export function answerOf(
  query: string,
  hits: readonly NameHit[],
  works: readonly Work[],
  shelved: ReadonlySet<string>,
  found: FoundWork[],
): NamesAnswer {
  return {
    works: namedWorks(hits, works)
      .works.filter((work) => shelved.has(work.id))
      .map(({ id, hit }) => ({ id, read: hit.label, by: hit.kind, characters: charactersOf(hit, works) })),
    found,
    label: hits[0]?.label ?? query,
    request: requestUrl(askedOf(query, hits[0])),
    name: paletteNameOf(query, hits[0]) ?? null,
  }
}
