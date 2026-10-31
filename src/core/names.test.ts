import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Work } from './commons.ts'
import { askedOf, type NameHit, namedWorks, paletteNameOf, requestUrl } from './names.ts'

const works: Work[] = [
  {
    id: 'starfall',
    name: 'Starfall Academy',
    native: 'スターフォール学園',
    danbooru: 'starfall_academy',
    characters: [{ id: 'mira', danbooru: 'mira_(starfall)', also: ['tidewater'] }],
  },
  { id: 'tidewater', name: 'Tidewater', characters: [{ id: 'oren', danbooru: 'oren_(tidewater)' }] },
]

function hit(kind: NameHit['kind'], label: string, tags: string[] = [], more: Partial<NameHit> = {}): NameHit {
  return { id: `${kind}/${label}`, kind, label, names: [], tags, works: [], ...more }
}

test('a work is known by its danbooru tag first, then by its name or native title', () => {
  assert.deepEqual(
    namedWorks([hit('work', 'Something else', ['starfall_academy'])], works).works.map((w) => w.id),
    ['starfall'],
  )
  assert.deepEqual(
    namedWorks([hit('work', 'スターフォール 学園')], works).works.map((w) => w.id),
    ['starfall'],
  )
  assert.deepEqual(
    namedWorks([hit('work', 'tide-water')], works).works.map((w) => w.id),
    ['tidewater'],
  )
})

test('a character names its own work and every work its also lists, else the works the provider gives it', () => {
  assert.deepEqual(
    namedWorks([hit('character', 'Mira', ['mira_(starfall)'])], works).works.map((w) => w.id),
    ['starfall', 'tidewater'],
  )
  const stranger = hit('character', 'Nobody', ['nobody'], { works: [hit('work', 'Tidewater')] })
  assert.deepEqual(
    namedWorks([stranger], works).works.map((w) => w.id),
    ['tidewater'],
  )
})

test("a character the index gives a home goes to that home's work, or to none, never to a work it guests in", () => {
  const guest = { works: [hit('work', 'Tidewater')] }
  const pupil = hit('character', 'Pip', ['pip'], { ...guest, home: 'starfall_academy' })
  const visitor = hit('character', 'Wren', ['wren'], { ...guest, home: 'moonlit_harbor' })
  const named = namedWorks([pupil, visitor], works)

  assert.deepEqual(
    named.works.map((w) => [w.id, w.hit.label]),
    [['starfall', 'Pip']],
  )
  assert.deepEqual(named.unknown, [visitor])
})

test('a hit no work matches is kept apart, and a work found twice is listed once, by its first hit', () => {
  const lost = hit('work', 'Moonlit Harbor', ['moonlit_harbor'])

  const named = namedWorks(
    [hit('work', 'Starfall Academy'), lost, hit('character', 'Mira', ['mira_(starfall)'])],
    works,
  )

  assert.deepEqual(
    named.works.map((w) => [w.id, w.hit.label]),
    [
      ['starfall', 'Starfall Academy'],
      ['tidewater', 'Mira'],
    ],
  )
  assert.deepEqual(named.unknown, [lost])
})

test('a request names what was asked for in the palette form', () => {
  const url = new URL(requestUrl('Moonlit Harbor'))
  assert.equal(url.searchParams.get('template'), 'palette.yml')
  assert.equal(url.searchParams.get('character'), 'Moonlit Harbor')
  assert.match(url.pathname, /\/issues\/new$/)
})

test('a request asks for a character with its work, a work by its name, and else for what was typed', () => {
  const harbor = hit('work', 'Moonlit Harbor')
  assert.equal(askedOf('mh', harbor), 'Moonlit Harbor')
  assert.equal(askedOf('nell', hit('character', 'Nell', [], { works: [harbor] })), 'Nell, Moonlit Harbor')
  assert.equal(
    askedOf('nell', hit('character', 'Nell', [], { works: [harbor], home: 'tidewater_(series)' })),
    'Nell, tidewater',
  )
  assert.equal(askedOf('달빛 항구', undefined), '달빛 항구')
})

test("a palette's name comes from a danbooru tag without its qualifier, then a Latin name, then what was typed", () => {
  assert.equal(paletteNameOf('넬', hit('character', 'ネル', ['nell_(moonlit_harbor)'])), 'nell')
  assert.equal(
    paletteNameOf('항구', hit('work', '月明かりの港', [], { names: ['月明かりの港', 'Moonlit Harbor'] })),
    'moonlit-harbor',
  )
  assert.equal(paletteNameOf('Café Nell!', undefined), 'cafe-nell')
  assert.equal(paletteNameOf('a'.repeat(50), undefined), 'a'.repeat(40))
  assert.equal(paletteNameOf('달빛 항구', undefined), undefined)
})
