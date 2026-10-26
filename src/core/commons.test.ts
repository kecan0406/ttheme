import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  aboutOf,
  commonsProblems,
  followSubject,
  leadOf,
  mergeWorks,
  parseCommons,
  readSites,
  readWork,
  shelfOf,
  siteTags,
  type Work,
  workToml,
  worldOrder,
} from './commons.ts'

const RLO = String.fromCodePoint(0x202e)

const EVA = `name = "Evangelion"
native = "エヴァンゲリオン"
lead = "evangelion/eva01"

[[character]]
id = "asuka"
native = ["惣流・アスカ・ラングレー"]
danbooru = "souryuu_asuka_langley"
sites = { konachan = "soryu_asuka_langley" }

[[character]]
id = "rei"
danbooru = "ayanami_rei"

[[character]]
id = "eva01"
danbooru = "eva_01"
`

const eva = readWork('works/evangelion.toml', EVA, 'evangelion')

test('a work holds its name, native title, lead and characters in cast order, and writes back as it was read', () => {
  assert.equal(eva.name, 'Evangelion')
  assert.equal(eva.native, 'エヴァンゲリオン')
  assert.deepEqual(
    eva.characters.map((c) => c.id),
    ['asuka', 'rei', 'eva01'],
  )
  assert.deepEqual(eva.characters[0]?.sites, { konachan: ['soryu_asuka_langley'] })
  assert.equal(leadOf(eva), 'evangelion/eva01')
  assert.equal(leadOf({ ...eva, lead: undefined }), 'evangelion/asuka')
  assert.equal(leadOf({ id: 'lain', name: 'Lain', characters: [] }), 'lain')
  assert.deepEqual(readWork('w.toml', workToml(eva), 'evangelion'), eva)
})

test('a work refuses a lead outside it, a character listed twice, a bad id and the built-in name', () => {
  assert.throws(() => readWork('w.toml', 'name = "E"\nlead = "eva/rei"', 'evangelion'), /names neither/)
  assert.throws(() => readWork('w.toml', 'name = "E"\nlead = "evangelion/kaji"', 'evangelion'), /names neither/)
  assert.equal(readWork('w.toml', 'name = "E"\nlead = "evangelion"', 'evangelion').lead, 'evangelion')

  assert.throws(
    () => readWork('w.toml', 'name = "E"\n[[character]]\nid = "rei"\n[[character]]\nid = "rei"', 'evangelion'),
    /listed twice/,
  )

  assert.throws(() => readWork('w.toml', 'name = "E"\n[[character]]\nid = "Rei"', 'evangelion'), /lowercase/)
  assert.throws(() => readWork('w.toml', 'name = "E"', 'ttheme'), /built-in marketplace/)
  assert.throws(() => readWork('w.toml', 'native = "E"', 'evangelion'), /name must be a non-empty string/)
})

test('a work that names a lead, a tag or a name with characters that steer a terminal is refused without echoing them', () => {
  for (const source of [
    'name = "E"\nlead = "x\\u001b]52;c;aGk=\\u0007"',
    'name = "E"\n[[character]]\nid = "rei"\ndanbooru = "ayanami\\u001b[2J"',
    `name = "E"\n[[character]]\nid = "rei"\nnative = ["綾波${RLO}レイ"]`,
  ]) {
    assert.throws(
      () => readWork('w.toml', source, 'evangelion'),
      (error: Error) => !error.message.includes('\x1b') && !error.message.includes(RLO),
    )
  }
})

test("sites renames a character's tag per site, as one tag or a list, and an empty list skips the site", () => {
  assert.deepEqual(
    readSites('moon.toml', 'sites', {
      yande: 'tsukino_usagi',
      konachan: ['tsukino_usagi', 'sailor_moon_(character)'],
      danbooru: 'sailor_moon',
    }),
    { yande: ['tsukino_usagi'], konachan: ['tsukino_usagi', 'sailor_moon_(character)'], danbooru: ['sailor_moon'] },
  )
  assert.deepEqual(readSites('x.toml', 'sites', { yande: [] }), { yande: [] })
  assert.deepEqual(readSites('x.toml', 'sites', { danbooru: ['version', 'cast'] }), { danbooru: ['version', 'cast'] })
  assert.equal(readSites('x.toml', 'sites', undefined), undefined)
  assert.throws(() => readSites('x.toml', 'sites', { danbooru: ['a', 'b', 'c'] }), /takes 2 tags at most/)
  assert.throws(() => readSites('x.toml', 'sites', { gelbooru: 'x' }), /not a find site/)
  assert.throws(() => readSites('x.toml', 'sites', { yande: 'two words' }), /one tag or a list/)
  assert.throws(() => readSites('x.toml', 'sites', { zerochan: ['a', 'b'] }), /takes one tag/)
  assert.deepEqual(readSites('x.toml', 'sites', { gelbooru: 'x', yande: 'y' }, true), { yande: ['y'] })
})

test('a proposal adds the works and characters the commons lacks and changes nothing the commons holds', () => {
  const proposal: Work = {
    id: 'evangelion',
    name: 'Neon Genesis',
    characters: [{ id: 'rei', danbooru: 'other' }, { id: 'mari' }],
  }

  const frieren: Work = { id: 'frieren', name: 'Frieren', characters: [{ id: 'frieren' }] }
  const merged = mergeWorks([eva], [proposal, frieren, { ...frieren, name: 'Later' }])
  const [first, second] = merged
  assert.equal(first?.name, 'Evangelion')
  assert.deepEqual(
    first?.characters.map((c) => [c.id, c.danbooru]),
    [
      ['asuka', 'souryuu_asuka_langley'],
      ['rei', 'ayanami_rei'],
      ['eva01', 'eva_01'],
      ['mari', undefined],
    ],
  )
  assert.equal(second?.name, 'Frieren')
  assert.equal(merged.length, 2)
})

test('a renamed work or character is followed to where it went, and a loop ends', () => {
  const renames = { 'eva/rei': 'evangelion/rei', neon: 'evangelion', 'a/x': 'b/x', 'b/x': 'a/x' }
  assert.equal(followSubject(renames, 'eva/rei'), 'evangelion/rei')
  assert.equal(followSubject(renames, 'neon/asuka'), 'evangelion/asuka')
  assert.equal(followSubject(renames, 'neon'), 'evangelion')
  assert.equal(followSubject(renames, 'lain'), 'lain')
  assert.ok(['a/x', 'b/x'].includes(followSubject(renames, 'a/x')))
})

test('a subject the works do not hold reads as its id, unknown', () => {
  const works = [eva]
  assert.deepEqual(aboutOf(works, 'evangelion/rei'), {
    subject: 'evangelion/rei',
    work: eva,
    character: eva.characters[1],
    known: true,
  })
  assert.equal(aboutOf(works, 'evangelion')?.known, true)
  assert.equal(aboutOf(works, 'evangelion/kaji')?.known, false)
  assert.deepEqual(aboutOf(works, 'frieren/fern'), {
    subject: 'frieren/fern',
    work: { id: 'frieren', name: 'frieren', characters: [] },
    character: { id: 'fern' },
    known: false,
  })
  assert.equal(aboutOf(works, undefined), undefined)
  assert.deepEqual(siteTags(aboutOf(works, 'evangelion/asuka'), 'konachan'), ['soryu_asuka_langley'])
  assert.deepEqual(siteTags(aboutOf(works, 'evangelion/asuka'), 'danbooru'), ['souryuu_asuka_langley'])
  assert.deepEqual(siteTags(aboutOf(works, 'evangelion'), 'danbooru'), [])
})

test('palettes sit by work name, then cast or character, built-in first, and originals last by marketplace', () => {
  const lain: Work = { id: 'lain', name: 'Lain', characters: [{ id: 'lain' }] }
  const works = [eva, lain]

  const items = [
    { name: 'kec@dust/glow' },
    { name: 'ttheme/neutral' },
    { name: 'kec@dust/rei', subject: 'evangelion/rei' },
    { name: 'ttheme/eva01', subject: 'evangelion/eva01' },
    { name: 'ttheme/rei', subject: 'evangelion/rei' },
    { name: 'ttheme/asuka', subject: 'evangelion/asuka' },
    { name: 'ttheme/magi', subject: 'evangelion' },
    { name: 'ttheme/lain', subject: 'lain/lain' },
  ]

  assert.deepEqual(
    worldOrder(items, works, 'cast').map((i) => i.name),
    [
      'ttheme/asuka',
      'ttheme/rei',
      'kec@dust/rei',
      'ttheme/eva01',
      'ttheme/magi',
      'ttheme/lain',
      'ttheme/neutral',
      'kec@dust/glow',
    ],
  )
  assert.deepEqual(
    worldOrder(items, works, 'abc').map((i) => i.name),
    [
      'ttheme/asuka',
      'ttheme/eva01',
      'ttheme/rei',
      'kec@dust/rei',
      'ttheme/magi',
      'ttheme/lain',
      'ttheme/neutral',
      'kec@dust/glow',
    ],
  )
  assert.equal(shelfOf({ name: 'kec@dust/rei', subject: 'evangelion/rei' }, works), 'kec@dust / Evangelion')
  assert.equal(shelfOf({ name: 'kec@dust/glow' }, works), 'kec@dust')
})

test("a character's also never repeats a work or names its own, so no list shows it twice", () => {
  const knit = readWork(
    'w.toml',
    'name = "jubeat"\n[[character]]\nid = "knit"\nalso = ["jubeat", "popn", "popn"]',
    'jubeat',
  )

  assert.deepEqual(knit.characters[0]?.also, ['popn'])
  const alone = readWork('w.toml', 'name = "jubeat"\n[[character]]\nid = "knit"\nalso = ["jubeat"]', 'jubeat')
  assert.equal(alone.characters[0]?.also, undefined)
})

test('the commons holds together: also names another work, and one danbooru tag is one subject', () => {
  const jubeat: Work = { id: 'jubeat', name: 'jubeat', characters: [{ id: 'knit', danbooru: 'knit', also: ['popn'] }] }
  const popn: Work = { id: 'popn', name: "pop'n", characters: [{ id: 'knit2', danbooru: 'knit', also: ['jubeat'] }] }
  assert.deepEqual(commonsProblems([eva]), [])
  assert.equal(commonsProblems([jubeat]).length, 1)
  assert.match(commonsProblems([jubeat, popn]).join('\n'), /one character, one subject/)
})

test('the commons reads back from the JSON init writes, and refuses another shape', () => {
  const commons = { works: [eva], renames: { 'eva/rei': 'evangelion/rei' } }
  assert.deepEqual(parseCommons(JSON.stringify(commons)), commons)
  assert.throws(() => parseCommons('{"works": "x"}'), /no works or renames/)
  assert.throws(() => parseCommons('<html>'), /not valid JSON/)
})
