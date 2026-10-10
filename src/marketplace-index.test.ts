import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PaletteEntry } from './manifest.ts'
import { indexText, parseIndex } from './marketplace-index.ts'
import type { Shown } from './showcase.ts'

function palette(name: string): PaletteEntry {
  return {
    name,
    catalog: 'Neon',
    order: 1,
    ansiSource: 'Test',
    background: '#000000',
    foreground: '#eeeeee',
    cursor: '#ffffff',
    selection: '#222222',
    signature: ['#ffffff', '#eeeeee', '#000000'],
    signatureSlots: ['foreground', 'cursor', 'background'],
    ansi: Array.from({ length: 16 }, () => '#808080'),
    gate: [16.1, 3.9, 0, 16.1, 3.9, 16.1, 0, 0, 0],
    backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
  }
}

function shown(id: string, add: string, stars: number, about: string): Shown {
  return {
    id,
    repo: add,
    add,
    about,
    stars,
    pushedAt: '2026-10-09',
    license: null,
    palettes: [palette('glow'), palette('haze')],
  }
}

test('the index the CI writes reads back as it was, most starred first', () => {
  const text = indexText([
    shown('alice@pastel', 'alice/ttheme-pastel', 3, 'Soft'),
    shown('bob@neon', 'bob/ttheme-neon', 12, 'Neon'),
  ])
  const read = parseIndex(text)
  assert.deepEqual(
    read.map((m) => [m.id, m.source, m.stars, m.updated, m.palettes.map((e) => e.name)]),
    [
      ['bob@neon', 'bob/ttheme-neon', 12, '2026-10-09', ['glow', 'haze']],
      ['alice@pastel', 'alice/ttheme-pastel', 3, '2026-10-09', ['glow', 'haze']],
    ],
  )
  assert.deepEqual(read[0]?.palettes[0], {
    name: 'glow',
    catalog: 'Neon',
    background: '#000000',
    foreground: '#eeeeee',
    cursor: '#ffffff',
    selection: '#222222',
    ansi: Array.from({ length: 16 }, () => '#808080'),
    signatureSlots: ['foreground', 'cursor', 'background'],
  })
})

test('a listed marketplace comes back without the control characters its text holds, and one that does not read is dropped', () => {
  const [good] = JSON.parse(indexText([shown('bob@neon', 'bob/ttheme-neon', 1, 'x')])).marketplaces
  const text = JSON.stringify({
    marketplaces: [
      { ...good, about: 'Pastel\x1b]52;c;ZWNobyBoaQ==\x07 palettes\x1b[2J\nnext\tline' },
      { ...good, id: 'mallory\x1b[8m@evil' },
      { ...good, id: 'eve@neon', source: '/tmp/local' },
      { ...good, id: 'eve@empty', palettes: [{ ...good.palettes[0], ansi: ['#zzzzzz'] }] },
    ],
  })
  const read = parseIndex(text)
  assert.deepEqual(
    read.map((m) => m.id),
    ['bob@neon'],
  )
  assert.equal(read[0]?.about, 'Pastel ]52;c;ZWNobyBoaQ== palettes [2J next line')
})
