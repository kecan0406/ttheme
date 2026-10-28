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

const STARFALL = `name = "Starfall"
native = "スターフォール"
lead = "starfall/pip"

[[character]]
id = "orla"
native = ["オルラ"]
danbooru = "orla_(starfall)"
sites = { konachan = "starfall_orla" }

[[character]]
id = "wren"
danbooru = "wren_(starfall)"

[[character]]
id = "pip"
danbooru = "pip_(starfall)"
`

const starfall = readWork('works/starfall.toml', STARFALL, 'starfall')

test('a work holds its name, native title, lead and characters in cast order, and writes back as it was read', () => {
  assert.equal(starfall.name, 'Starfall')
  assert.equal(starfall.native, 'スターフォール')
  assert.deepEqual(
    starfall.characters.map((c) => c.id),
    ['orla', 'wren', 'pip'],
  )
  assert.deepEqual(starfall.characters[0]?.sites, { konachan: ['starfall_orla'] })
  assert.equal(leadOf(starfall), 'starfall/pip')
  assert.equal(leadOf({ ...starfall, lead: undefined }), 'starfall/orla')
  assert.equal(leadOf({ id: 'tidewater', name: 'Tidewater', characters: [] }), 'tidewater')
  assert.deepEqual(readWork('w.toml', workToml(starfall), 'starfall'), starfall)
})

test('a work refuses a lead outside it, a character listed twice, a bad id and the built-in name', () => {
  assert.throws(() => readWork('w.toml', 'name = "E"\nlead = "tidewater/wren"', 'starfall'), /names neither/)
  assert.throws(() => readWork('w.toml', 'name = "E"\nlead = "starfall/bram"', 'starfall'), /names neither/)
  assert.equal(readWork('w.toml', 'name = "E"\nlead = "starfall"', 'starfall').lead, 'starfall')

  assert.throws(
    () => readWork('w.toml', 'name = "E"\n[[character]]\nid = "wren"\n[[character]]\nid = "wren"', 'starfall'),
    /listed twice/,
  )

  assert.throws(() => readWork('w.toml', 'name = "E"\n[[character]]\nid = "Wren"', 'starfall'), /lowercase/)
  assert.throws(
    () =>
      readWork('w.toml', 'name = "E"\n[[character]]\nid = "wren"\nsites = { zerochan = "Wren.Starfall" }', 'starfall'),
    /character\[0\]\.sites renames character\[0\]\.danbooru per site, so it needs character\[0\]\.danbooru/,
  )
  assert.throws(() => readWork('w.toml', 'name = "E"', 'ttheme'), /built-in marketplace/)
  assert.throws(() => readWork('w.toml', 'native = "E"', 'starfall'), /name must be a non-empty string/)
})

test('a work that names a lead, a tag or a name with characters that steer a terminal is refused without echoing them', () => {
  for (const source of [
    'name = "E"\nlead = "x\\u001b]52;c;aGk=\\u0007"',
    'name = "E"\n[[character]]\nid = "wren"\ndanbooru = "wren\\u001b[2J"',
    `name = "E"\n[[character]]\nid = "wren"\nnative = ["潮${RLO}レン"]`,
  ]) {
    assert.throws(
      () => readWork('w.toml', source, 'starfall'),
      (error: Error) => !error.message.includes('\x1b') && !error.message.includes(RLO),
    )
  }
})

test("sites renames a character's tag per site, as one tag or a list, and an empty list skips the site", () => {
  assert.deepEqual(
    readSites('moon-tide.toml', 'sites', {
      yande: 'juno',
      konachan: ['juno', 'juno_(moon_tide)'],
      danbooru: 'moon_tide_juno',
    }),
    { yande: ['juno'], konachan: ['juno', 'juno_(moon_tide)'], danbooru: ['moon_tide_juno'] },
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
    id: 'starfall',
    name: 'Falling Star',
    characters: [{ id: 'wren', danbooru: 'other' }, { id: 'tamsin' }],
  }

  const tidewater: Work = { id: 'tidewater', name: 'Tidewater', characters: [{ id: 'quill' }] }
  const merged = mergeWorks([starfall], [proposal, tidewater, { ...tidewater, name: 'Later' }])
  const [first, second] = merged
  assert.equal(first?.name, 'Starfall')
  assert.deepEqual(
    first?.characters.map((c) => [c.id, c.danbooru]),
    [
      ['orla', 'orla_(starfall)'],
      ['wren', 'wren_(starfall)'],
      ['pip', 'pip_(starfall)'],
      ['tamsin', undefined],
    ],
  )
  assert.equal(second?.name, 'Tidewater')
  assert.equal(merged.length, 2)
})

test('a renamed work or character is followed to where it went, and a loop ends', () => {
  const renames = { 'star/wren': 'starfall/wren', neon: 'starfall', 'a/x': 'b/x', 'b/x': 'a/x' }
  assert.equal(followSubject(renames, 'star/wren'), 'starfall/wren')
  assert.equal(followSubject(renames, 'neon/orla'), 'starfall/orla')
  assert.equal(followSubject(renames, 'neon'), 'starfall')
  assert.equal(followSubject(renames, 'tidewater'), 'tidewater')
  assert.ok(['a/x', 'b/x'].includes(followSubject(renames, 'a/x')))
})

test('a subject the works do not hold reads as its id, unknown', () => {
  const works = [starfall]
  assert.deepEqual(aboutOf(works, 'starfall/wren'), {
    subject: 'starfall/wren',
    work: starfall,
    character: starfall.characters[1],
    known: true,
  })
  assert.equal(aboutOf(works, 'starfall')?.known, true)
  assert.equal(aboutOf(works, 'starfall/bram')?.known, false)
  assert.deepEqual(aboutOf(works, 'tidewater/quill'), {
    subject: 'tidewater/quill',
    work: { id: 'tidewater', name: 'tidewater', characters: [] },
    character: { id: 'quill' },
    known: false,
  })
  assert.equal(aboutOf(works, undefined), undefined)
  assert.deepEqual(siteTags(aboutOf(works, 'starfall/orla'), 'konachan'), ['starfall_orla'])
  assert.deepEqual(siteTags(aboutOf(works, 'starfall/orla'), 'danbooru'), ['orla_(starfall)'])
  assert.deepEqual(siteTags(aboutOf(works, 'starfall'), 'danbooru'), [])
})

test('palettes sit by work name, then cast or character, built-in first, and originals last by marketplace', () => {
  const tidewater: Work = { id: 'tidewater', name: 'Tidewater', characters: [{ id: 'quill' }] }
  const works = [starfall, tidewater]

  const items = [
    { name: 'kai@dust/glow' },
    { name: 'ttheme/neutral' },
    { name: 'kai@dust/wren', subject: 'starfall/wren' },
    { name: 'ttheme/pip', subject: 'starfall/pip' },
    { name: 'ttheme/wren', subject: 'starfall/wren' },
    { name: 'ttheme/orla', subject: 'starfall/orla' },
    { name: 'ttheme/comet', subject: 'starfall' },
    { name: 'ttheme/quill', subject: 'tidewater/quill' },
  ]

  assert.deepEqual(
    worldOrder(items, works, 'cast').map((i) => i.name),
    [
      'ttheme/orla',
      'ttheme/wren',
      'kai@dust/wren',
      'ttheme/pip',
      'ttheme/comet',
      'ttheme/quill',
      'ttheme/neutral',
      'kai@dust/glow',
    ],
  )
  assert.deepEqual(
    worldOrder(items, works, 'abc').map((i) => i.name),
    [
      'ttheme/orla',
      'ttheme/pip',
      'ttheme/wren',
      'kai@dust/wren',
      'ttheme/comet',
      'ttheme/quill',
      'ttheme/neutral',
      'kai@dust/glow',
    ],
  )
  assert.equal(shelfOf({ name: 'kai@dust/wren', subject: 'starfall/wren' }, works), 'kai@dust / Starfall')
  assert.equal(shelfOf({ name: 'kai@dust/glow' }, works), 'kai@dust')
})

test("a character's also never repeats a work or names its own, so no list shows it twice", () => {
  const lumi = readWork(
    'w.toml',
    'name = "Glass Arcade"\n[[character]]\nid = "lumi"\nalso = ["glass-arcade", "night-parade", "night-parade"]',
    'glass-arcade',
  )

  assert.deepEqual(lumi.characters[0]?.also, ['night-parade'])

  const alone = readWork(
    'w.toml',
    'name = "Glass Arcade"\n[[character]]\nid = "lumi"\nalso = ["glass-arcade"]',
    'glass-arcade',
  )

  assert.equal(alone.characters[0]?.also, undefined)
})

test('the commons holds together: also names another work, and one danbooru tag is one subject', () => {
  const glassArcade: Work = {
    id: 'glass-arcade',
    name: 'Glass Arcade',
    characters: [{ id: 'lumi', danbooru: 'lumi_(glass_arcade)', also: ['night-parade'] }],
  }

  const nightParade: Work = {
    id: 'night-parade',
    name: 'Night Parade',
    characters: [{ id: 'lumi2', danbooru: 'lumi_(glass_arcade)', also: ['glass-arcade'] }],
  }

  assert.deepEqual(commonsProblems([starfall]), [])
  assert.equal(commonsProblems([glassArcade]).length, 1)
  assert.match(commonsProblems([glassArcade, nightParade]).join('\n'), /one character, one subject/)
})

test('the commons reads back from the JSON init writes, and refuses another shape', () => {
  const commons = { works: [starfall], renames: { 'star/wren': 'starfall/wren' } }
  assert.deepEqual(parseCommons(JSON.stringify(commons)), commons)
  assert.throws(() => parseCommons('{"works": "x"}'), /no works or renames/)
  assert.throws(() => parseCommons('<html>'), /not valid JSON/)
})
