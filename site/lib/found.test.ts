import { expect, test } from 'bun:test'
import { anilistOf, foundSlugs, MOST_FOUND, membersOf, titleOf, tmdbOf } from '@/lib/found'
import type { NameHit, TaggedWork } from '../../src/core/names.ts'

function hit(kind: NameHit['kind'], label: string, tags: string[], works: NameHit[] = []): NameHit {
  return { id: `${kind}/${label}`, kind, label, names: [], tags, works }
}

function tagged(id: string, tags: string[], more: Partial<TaggedWork> = {}): TaggedWork {
  return { id, label: id, names: [], tags, refs: [], ...more }
}

test('a work hit gives the slug of its main tag, and a character the one of its first tagged work', () => {
  const harbor = hit('work', '月明かりの港', ['moonlit_harbor_(series)', 'moonlit_harbor_movie'])
  const cameo = hit('work', 'Starfall Arena', ['starfall_arena'])
  const nell = hit('character', 'ネル', ['nell_(moonlit_harbor)'], [hit('work', 'Untagged Special', []), harbor, cameo])

  expect(foundSlugs([nell], new Set())).toEqual(['moonlit-harbor'])
  expect(foundSlugs([harbor, nell], new Set())).toEqual(['moonlit-harbor'])
  expect(foundSlugs([cameo, harbor], new Set(['moonlit-harbor']))).toEqual(['starfall-arena'])
})

test('found slugs stop at the most a search shows', () => {
  const hits = Array.from({ length: MOST_FOUND + 2 }, (_, at) => hit('work', `Glass ${at}`, [`glass_orchard_${at}`]))

  expect(foundSlugs(hits, new Set())).toHaveLength(MOST_FOUND)
})

test('the members of a slug are the works one of whose tags makes it', () => {
  const works = [
    tagged('w/1', ['moonlit_harbor_(series)']),
    tagged('w/2', ['moonlit_harbor']),
    tagged('w/3', ['moonlit_harbor_2']),
  ]

  expect(membersOf('moonlit-harbor', works).map((work) => work.id)).toEqual(['w/1', 'w/2'])
})

test('a title is the shortest official English and native names any member has', () => {
  const members = [
    tagged('w/1', [], {
      label: '月明かりの港 第1期',
      names: [
        { text: 'Moonlit Harbor season 1', lang: 'en', official: true },
        { text: '月明かりの港 第1期', lang: 'ja', official: true },
        { text: 'MH', lang: 'en', official: false },
      ],
    }),
    tagged('w/2', [], {
      names: [
        { text: 'Moonlit Harbor', lang: 'en', official: true },
        { text: '月明かりの港', lang: 'ja', official: true },
      ],
    }),
  ]

  expect(titleOf(members)).toEqual({ name: 'Moonlit Harbor', native: '月明かりの港', lang: 'ja' })
})

test('a title falls back to the main title, then the label, and drops a native name that reads the same', () => {
  const romaji = tagged('w/1', [], {
    label: '港',
    names: [
      { text: 'Tsukiakari no Minato', lang: null, official: true },
      { text: 'Minato', lang: 'en', official: false },
    ],
  })

  expect(titleOf([romaji])).toEqual({ name: 'Tsukiakari no Minato', native: null, lang: null })
  expect(titleOf([tagged('w/2', [], { label: 'Pip' })])).toEqual({ name: 'Pip', native: null, lang: null })
  expect(titleOf([tagged('w/3', [], { names: [{ text: 'Pip', lang: 'ja', official: true }], label: 'Pip' })])).toEqual({
    name: 'Pip',
    native: null,
    lang: null,
  })
})

test('the picture ids prefer a series to a film and an anime to a manga', () => {
  const members = [
    tagged('w/1', [], { refs: ['anilist:manga/7', 'tmdb:movie/5'] }),
    tagged('w/2', [], { refs: ['anilist:9', 'tmdb:tv/3'] }),
  ]

  expect([tmdbOf(members), anilistOf(members)]).toEqual(['tv/3', 9])
  expect([tmdbOf(members.slice(0, 1)), anilistOf(members.slice(0, 1))]).toEqual(['movie/5', 7])
  expect([tmdbOf([]), anilistOf([])]).toEqual([null, null])
})
