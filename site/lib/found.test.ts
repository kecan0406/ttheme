import { expect, test } from 'bun:test'
import {
  anilistIdsOf,
  anilistOf,
  castFrom,
  familyOf,
  foundSlugs,
  igdbOf,
  MOST_FOUND,
  membersOf,
  nativeLang,
  steamOf,
  titleOf,
  tmdbOf,
} from '@/lib/found'
import type { CastMember, NameHit, TaggedWork } from '../../src/core/names.ts'

function hit(kind: NameHit['kind'], label: string, tags: string[], works: NameHit[] = []): NameHit {
  return { id: `${kind}/${label}`, kind, label, names: [], tags, works }
}

function tagged(id: string, tags: string[], more: Partial<TaggedWork> = {}): TaggedWork {
  return { id, label: id, names: [], tags, refs: [], origin: [], year: null, medium: null, ...more }
}

test('a work hit gives the slug of its main tag, and a character the one of its home, never a work it guests in', () => {
  const harbor = hit('work', '月明かりの港', ['moonlit_harbor_(series)', 'moonlit_harbor_movie'])
  const cameo = hit('work', 'Starfall Arena', ['starfall_arena'])

  const nell = {
    ...hit('character', 'ネル', ['nell_(moonlit_harbor)'], [cameo, harbor]),
    home: 'moonlit_harbor_(series)',
  }

  const drifter = hit('character', 'Drifter', ['drifter'], [cameo])

  expect(foundSlugs([nell], new Set())).toEqual(['moonlit-harbor'])
  expect(foundSlugs([harbor, nell], new Set())).toEqual(['moonlit-harbor'])
  expect(foundSlugs([drifter], new Set())).toEqual([])
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

test("a native title is in the language of the first member's country of origin, Japanese when none says, and none from elsewhere", () => {
  const names = [
    { text: 'Starfall Arena', lang: 'en', official: true },
    { text: 'スターフォール・アリーナ', lang: 'ja', official: true },
    { text: '星落竞技场', lang: 'zh-Hans', official: true },
    { text: '星落競技場', lang: 'zh-Hant', official: true },
  ]

  const of = (...origins: string[][]) => titleOf(origins.map((origin, at) => tagged(`w/${at}`, [], { names, origin })))

  expect(of(['US'])).toEqual({ name: 'Starfall Arena', native: null, lang: null })
  expect(of(['US'], ['JP'])).toEqual({ name: 'Starfall Arena', native: null, lang: null })
  expect(of([], ['US', 'JP'])).toEqual({ name: 'Starfall Arena', native: 'スターフォール・アリーナ', lang: 'ja' })
  expect(of(['CN'])).toEqual({ name: 'Starfall Arena', native: '星落竞技场', lang: 'zh-Hans' })
  expect(of(['TW'])).toEqual({ name: 'Starfall Arena', native: '星落競技場', lang: 'zh-Hant' })
  expect(of([])).toEqual({ name: 'Starfall Arena', native: 'スターフォール・アリーナ', lang: 'ja' })

  expect(titleOf([tagged('w/9', [], { names: names.filter((name) => name.lang !== 'ja') })])).toEqual({
    name: 'Starfall Arena',
    native: null,
    lang: null,
  })
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

test("a cast member's native name is Korean by its Hangul, Japanese by its kana, and else its work's language if Japanese or Chinese", () => {
  expect(nativeLang('한별', 'ja')).toBe('ko')
  expect(nativeLang('ネル', 'ko')).toBe('ja')
  expect(nativeLang('星野', 'zh-Hans')).toBe('zh-Hans')
  expect(nativeLang('星野', 'ja')).toBe('ja')
  expect(nativeLang('星野', 'ko')).toBeNull()
  expect(nativeLang('星野', null)).toBeNull()
})

test('the picture ids prefer a series to a film and an anime to a manga', () => {
  const members = [
    tagged('w/1', [], { refs: ['anilist:manga/7', 'tmdb:movie/5'] }),
    tagged('w/2', [], { refs: ['anilist:11', 'tmdb:movie/6'] }),
    tagged('w/3', [], { refs: ['anilist:9', 'tmdb:tv/3'] }),
  ]

  expect([tmdbOf(members), anilistOf(members)]).toEqual(['tv/3', 9])
  expect([tmdbOf(members.slice(0, 1)), anilistOf(members.slice(0, 1))]).toEqual(['movie/5', 7])
  expect([tmdbOf([]), anilistOf([])]).toEqual([null, null])
})

test('a game takes its Steam app and IGDB slug from whichever member has them', () => {
  const members = [
    tagged('w/1', [], { refs: ['igdb:starfall-arena', 'wikidata:Q1'] }),
    tagged('w/2', [], { refs: ['igdb:starfall-arena--1', 'steam:420'] }),
  ]

  expect([steamOf(members), igdbOf(members)]).toEqual(['420', 'starfall-arena'])
  expect([steamOf([]), igdbOf([])]).toEqual([null, null])
})

test("a cast member shows a Latin name and its name in the work's language, a Danbooru name without its qualifier, and once, pictured by Bangumi before AniList, named as most of its names agree", () => {
  const member = (id: string, label: string, names: CastMember['names'], refs: string[] = []): CastMember => ({
    id,
    label,
    names,
    tags: [],
    refs,
  })

  const pictures = new Map([[31, 'https://s4.anilist.co/file/anilistcdn/character/large/b31.png']])

  const cast = castFrom(
    [
      member(
        'c/1',
        'ネル',
        [
          { text: 'Nell Moonlit', lang: 'en', official: true },
          { text: 'ネル', lang: 'ja', official: true },
        ],
        ['anilist:31'],
      ),
      member('c/2', 'ネル', [
        { text: 'Nell Moonlit', lang: 'en', official: true },
        { text: 'ネル', lang: 'ja', official: true },
      ]),
      member('c/3', 'k.ra (starfall arena)', [{ text: 'k.ra (starfall arena)', lang: null, official: true }]),
      member('c/4', 'Wren', [
        { text: 'Wren', lang: 'en', official: true },
        { text: '雷恩', lang: 'zh-Hans', official: true },
      ]),
      member('c/5', 'ピップ', [{ text: 'Pip', lang: 'en', official: true }], ['anilist:44', 'bangumi:9001']),
      member('c/6', 'ルフ', [
        { text: 'Ruff Tidewell', lang: 'en', official: true },
        { text: 'Tidewell Ruff', lang: 'en', official: false },
        { text: 'Tidewell Ruuff', lang: 'ja-Latn', official: false },
        { text: 'Ruf T', lang: 'en', official: true },
      ]),
    ],
    pictures,
    'ja',
  )

  expect(cast).toEqual([
    { name: 'Nell Moonlit', native: 'ネル', picture: 'https://s4.anilist.co/file/anilistcdn/character/large/b31.png' },
    { name: 'K.Ra', native: null, picture: null },
    { name: 'Wren', native: null, picture: null },
    { name: 'Pip', native: null, picture: 'https://api.bgm.tv/v0/characters/9001/image?type=medium' },
    { name: 'Ruff Tidewell', native: null, picture: null },
  ])

  expect(
    anilistIdsOf([
      member('c/1', 'ネル', [], ['anilist:31']),
      member('c/5', 'ピップ', [], ['anilist:44', 'bangumi:9001']),
    ]),
  ).toEqual([31])
})

test("a found work's family lists each work once by its English name, the oldest first and the undated last", () => {
  const named = (text: string) => [{ text, lang: 'en', official: true }]

  expect(
    familyOf([
      tagged('w/3', [], { label: '月明かりの港 劇場版', year: null, medium: 'anime' }),
      tagged('w/2', [], { names: named('Moonlit Harbor'), year: 2019, medium: 'anime' }),
      tagged('w/1', [], { names: named('Moonlit Harbor'), year: 2016, medium: 'manga' }),
      tagged('w/4', [], { names: named('Moonlit Harbor'), year: 2019, medium: 'anime' }),
    ]),
  ).toEqual([
    { name: 'Moonlit Harbor', year: 2016, medium: 'manga' },
    { name: 'Moonlit Harbor', year: 2019, medium: 'anime' },
    { name: '月明かりの港 劇場版', year: null, medium: 'anime' },
  ])
})
