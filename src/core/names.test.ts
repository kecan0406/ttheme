import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Work } from './commons.ts'
import { type NameHit, namedWorks, paletteNameOf, requestUrl, slugOfTag } from './names.ts'

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

function hit(label: string, tags: string[] = []): NameHit {
  return { id: `work/${label}`, label, names: [], tags }
}

test('a work is known by its danbooru tag first, then by its name or native title', () => {
  assert.deepEqual(namedWorks([hit('Something else', ['starfall_academy'])], works).works, ['starfall'])
  assert.deepEqual(namedWorks([hit('スターフォール 学園')], works).works, ['starfall'])
  assert.deepEqual(namedWorks([hit('tide-water')], works).works, ['tidewater'])
})

test('a hit no work matches is kept apart, and a work found twice is listed once', () => {
  const lost = hit('Moonlit Harbor', ['moonlit_harbor'])
  const named = namedWorks([hit('Starfall Academy'), lost, hit('Other', ['starfall_academy'])], works)

  assert.deepEqual(named.works, ['starfall'])
  assert.deepEqual(named.unknown, [lost])
})

test('a request names what was asked for in the palette form', () => {
  const url = new URL(requestUrl('Moonlit Harbor'))
  assert.equal(url.searchParams.get('template'), 'palette.yml')
  assert.equal(url.searchParams.get('character'), 'Moonlit Harbor')
  assert.match(url.pathname, /\/issues\/new$/)
})

test("a slug is a tag without its qualifier and with hyphens, in the tag's own order", () => {
  assert.equal(slugOfTag('harbor_nell'), 'harbor-nell')
  assert.equal(slugOfTag('nell_(moonlit_harbor)'), 'nell')
  assert.equal(slugOfTag('n.e._ll'), 'n-e-ll')
})

test("a palette's name to make is what was typed, as a slug", () => {
  assert.equal(paletteNameOf('Café Nell!'), 'cafe-nell')
  assert.equal(paletteNameOf('a'.repeat(50)), 'a'.repeat(40))
  assert.equal(paletteNameOf('달빛 항구'), undefined)
})
