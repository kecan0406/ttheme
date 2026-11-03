import { expect, test } from 'bun:test'
import {
  anilistIdsOf,
  castFrom,
  familyOf,
  foundSlugs,
  heldNamed,
  MOST_FOUND,
  membersOf,
  nativeLang,
  titleOf,
} from '@/lib/found'
import type { CastMember, NameHit, TaggedWork } from '../../src/core/names.ts'

function hit(label: string, tags: string[]): NameHit {
  return { id: `work/${label}`, label, names: [], tags }
}

function tagged(id: string, tags: string[], more: Partial<TaggedWork> = {}): TaggedWork {
  return {
    id,
    label: id,
    names: [],
    tags,
    refs: [],
    origin: [],
    year: null,
    medium: null,
    genres: [],
    nature: null,
    family: null,
    ...more,
  }
}

test('a work hit gives the slug of its main tag, unless a work holds it already', () => {
  const harbor = hit('月明かりの港', ['moonlit_harbor_(series)', 'moonlit_harbor_movie'])
  const cameo = hit('Starfall Arena', ['starfall_arena'])

  expect(foundSlugs([harbor], new Set())).toEqual(['moonlit-harbor'])
  expect(foundSlugs([hit('Drifter', [])], new Set())).toEqual([])
  expect(foundSlugs([cameo, harbor], new Set(['moonlit-harbor']))).toEqual(['starfall-arena'])
})

test('found slugs stop at the most a search shows', () => {
  const hits = Array.from({ length: MOST_FOUND + 2 }, (_, at) => hit(`Glass ${at}`, [`glass_orchard_${at}`]))

  expect(foundSlugs(hits, new Set())).toHaveLength(MOST_FOUND)
})

test('a character with a palette is found in its work by a word of its name or by a native name', () => {
  const held = [
    { id: 'harbor-nell', keys: ['harbor_nell', 'ハーバー・ネル'] },
    { id: 'tide-oren', keys: ['tide_oren'] },
  ]

  expect(heldNamed('nell', held).map((holder) => holder.id)).toEqual(['harbor-nell'])
  expect(heldNamed('ネル', held).map((holder) => holder.id)).toEqual(['harbor-nell'])
  expect(heldNamed('quill', held)).toEqual([])
})

test('the members of a slug are the works one of whose tags makes it', () => {
  const works = [
    tagged('w/1', ['moonlit_harbor_(series)']),
    tagged('w/2', ['moonlit_harbor']),
    tagged('w/3', ['moonlit_harbor_2']),
  ]

  expect(membersOf('moonlit-harbor', works).map((work) => work.id)).toEqual(['w/1', 'w/2'])
})

test('a title comes from the eldest work and those with its native title, never a sibling with another', () => {
  const sibling = tagged('w/3', [], {
    label: 'ハーバー外伝',
    year: 2016,
    names: [
      { text: 'Pier', lang: 'en', official: true },
      { text: 'ハーバー外伝', lang: 'ja', official: true, preferred: true },
    ],
  })

  const members = [
    sibling,
    tagged('w/1', [], {
      label: '月明かりの港',
      year: 2009,
      names: [
        { text: 'The Lunar Saga of the Bay', lang: 'en', official: true },
        { text: '月の港', lang: 'ja', official: false },
        { text: '月明かりの港', lang: 'ja', official: true, preferred: true },
      ],
    }),
    tagged('w/2', [], {
      label: '月明かりの港',
      year: 2012,
      names: [
        { text: 'Lunar Saga', lang: 'en', official: true },
        { text: 'LS', lang: 'en', official: false },
      ],
    }),
  ]

  expect(titleOf('tsukiakari-no-minato', members)).toEqual({ name: 'Lunar Saga', native: '月明かりの港', lang: 'ja' })
  expect(titleOf('pier', members).name).toBe('Pier')
})

test("a tag a title holds names the whole family, spelled as that title spells it and with no one work's native title", () => {
  const blade = tagged('w/1', [], {
    label: '星の剣 第一部',
    year: 2009,
    names: [
      { text: 'Star-Blade Saga: The First Crossing', lang: 'en', official: true },
      { text: '星の剣 第一部', lang: 'ja', official: true, preferred: true },
    ],
  })

  expect(titleOf('star-blade-saga', [blade])).toEqual({ name: 'Star-Blade Saga', native: null, lang: 'ja' })
  expect(
    titleOf('saga', [tagged('w/2', [], { names: [{ text: 'Mobile Saga', lang: 'en', official: true }] })]),
  ).toEqual({
    name: 'Saga',
    native: null,
    lang: 'ja',
  })
  expect(titleOf('first-crossing', [blade])).toEqual({
    name: 'Star-Blade Saga: The First Crossing',
    native: '星の剣 第一部',
    lang: 'ja',
  })
})

test('a title the tag alone spells takes that spelling, and a native title spelling the same is dropped', () => {
  const spoken = tagged('w/1', [], {
    label: 'ハーバー',
    year: 2009,
    names: [
      { text: 'moonlit harbor', lang: null, official: true },
      { text: 'Moonlit Harbor Side', lang: 'en', official: false },
    ],
  })

  expect(titleOf('moonlit-harbor', [spoken])).toEqual({ name: 'Moonlit Harbor', native: null, lang: 'ja' })

  const loud = tagged('w/3', [], {
    names: [
      { text: 'Moonlit Harbor', lang: 'en', official: true },
      { text: 'MOONLIT HARBOR', lang: 'ja', official: true, preferred: true },
    ],
  })

  expect(titleOf('moonlit-harbor', [loud])).toEqual({ name: 'Moonlit Harbor', native: null, lang: 'ja' })

  const unspelled = tagged('w/4', [], {
    label: '月明かりの港',
    names: [{ text: '月の港', lang: 'ja', official: true, preferred: true }],
  })

  expect(titleOf('moonlit-harbor', [unspelled])).toEqual({ name: '月明かりの港', native: '月の港', lang: 'ja' })
})

test("a native title is in the language of the first member's country of origin, Japanese when none says, and none from elsewhere", () => {
  const names = [
    { text: 'Starfall Arena', lang: 'en', official: true },
    { text: 'スターフォール・アリーナ', lang: 'ja', official: true },
    { text: '星落竞技场', lang: 'zh-Hans', official: true },
    { text: '星落競技場', lang: 'zh-Hant', official: true },
  ]

  const of = (...origins: string[][]) =>
    titleOf(
      'starfall-arena',
      origins.map((origin, at) => tagged(`w/${at}`, [], { names, origin })),
    )

  expect(of(['US'])).toEqual({ name: 'Starfall Arena', native: null, lang: null })
  expect(of(['US'], ['JP'])).toEqual({ name: 'Starfall Arena', native: null, lang: null })
  expect(of([], ['US', 'JP'])).toEqual({ name: 'Starfall Arena', native: 'スターフォール・アリーナ', lang: 'ja' })
  expect(of(['CN'])).toEqual({ name: 'Starfall Arena', native: '星落竞技场', lang: 'zh-Hans' })
  expect(of(['TW'])).toEqual({ name: 'Starfall Arena', native: '星落競技場', lang: 'zh-Hant' })
  expect(of([])).toEqual({ name: 'Starfall Arena', native: 'スターフォール・アリーナ', lang: 'ja' })

  expect(titleOf('starfall-arena', [tagged('w/9', [], { names: names.filter((name) => name.lang !== 'ja') })])).toEqual(
    {
      name: 'Starfall Arena',
      native: null,
      lang: 'ja',
    },
  )
})

test('a title falls back to the main title, then the label, and drops a native name that reads the same', () => {
  const romaji = tagged('w/1', [], {
    label: '港',
    names: [
      { text: 'Tsukiakari no Minato', lang: null, official: true },
      { text: 'Minato', lang: 'en', official: false },
    ],
  })

  expect(titleOf('minato', [romaji])).toEqual({ name: 'Tsukiakari no Minato', native: null, lang: 'ja' })
  expect(titleOf('pip', [tagged('w/2', [], { label: 'Pip' })])).toEqual({ name: 'Pip', native: null, lang: 'ja' })
  expect(
    titleOf('pip', [tagged('w/3', [], { names: [{ text: 'Pip', lang: 'ja', official: true }], label: 'Pip' })]),
  ).toEqual({
    name: 'Pip',
    native: null,
    lang: 'ja',
  })
  expect(
    titleOf('pier', [
      tagged('w/4', [], { label: 'x', names: [{ text: 'quay stories (movie)', lang: null, official: true }] }),
    ]).name,
  ).toBe('Quay Stories')
})

test("a cast member's native name is Korean by its Hangul, Japanese by its kana, and else its work's language if Japanese or Chinese", () => {
  expect(nativeLang('한별', 'ja')).toBe('ko')
  expect(nativeLang('ネル', 'ko')).toBe('ja')
  expect(nativeLang('星野', 'zh-Hans')).toBe('zh-Hans')
  expect(nativeLang('星野', 'ja')).toBe('ja')
  expect(nativeLang('星野', 'ko')).toBeNull()
  expect(nativeLang('星野', null)).toBeNull()
})

test("a cast member shows a Latin name and its name in the work's language, a Danbooru name without its qualifier, and once, pictured by Bangumi before AniList, named by the name aninames prefers", () => {
  const member = (id: string, label: string, names: CastMember['names'], refs: string[] = []): CastMember => ({
    id,
    label,
    names,
    tags: [],
    refs,
    lead: false,
  })

  const pictures = new Map([[31, 'https://s4.anilist.co/file/anilistcdn/character/large/b31.png']])

  const cast = castFrom(
    [
      member(
        'c/1',
        'ネル',
        [
          { text: 'Nell Moonlit', lang: 'en', official: true, preferred: true },
          { text: 'ネル', lang: 'ja', official: true, preferred: true },
        ],
        ['anilist:31'],
      ),
      member('c/2', 'ネル', [
        { text: 'Nell Moonlit', lang: 'en', official: true, preferred: true },
        { text: 'ネル', lang: 'ja', official: true, preferred: true },
      ]),
      member('c/3', 'k.ra (starfall arena)', [
        { text: 'k.ra (formal) (starfall arena)', lang: null, official: true },
        { text: 'k.ra (starfall arena)', lang: null, official: true },
      ]),
      member('c/4', 'Wren', [
        { text: 'Wren', lang: 'en', official: true, preferred: true },
        { text: '雷恩', lang: 'zh-Hans', official: true, preferred: true },
      ]),
      member(
        'c/5',
        'ピップ',
        [{ text: 'Pip', lang: 'en', official: false, preferred: true }],
        ['anilist:44', 'bangumi:9001'],
      ),
      member('c/6', 'ルフ', [
        { text: 'Ruf T', lang: 'en', official: true },
        { text: 'Ruff Tidewell', lang: 'en', official: true, preferred: true },
        { text: 'ルフ', lang: 'ja', official: true },
        { text: 'ルフ・タイドウェル', lang: 'ja', official: true, preferred: true },
      ]),
      member('c/7', 'ミロ', [{ text: 'Tidewell Milo', lang: 'ja-Latn', official: false, preferred: true }]),
    ],
    pictures,
    'ja',
  )

  expect(cast).toEqual([
    { name: 'Nell Moonlit', native: 'ネル', picture: 'https://s4.anilist.co/file/anilistcdn/character/large/b31.png' },
    { name: 'K.Ra', native: null, picture: null },
    { name: 'Wren', native: null, picture: null },
    { name: 'Pip', native: null, picture: 'https://api.bgm.tv/v0/characters/9001/image?type=medium' },
    { name: 'Ruff Tidewell', native: 'ルフ・タイドウェル', picture: null },
    { name: 'Tidewell Milo', native: null, picture: null },
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
