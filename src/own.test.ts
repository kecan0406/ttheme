import assert from 'node:assert/strict'
import { test } from 'node:test'

import { type Draft, fromCode, paletteToml, readOwnText, recolor, shareCode } from './own.ts'

const draft: Draft = {
  name: 'kecan0406/dusk',
  base: 'alice',
  group: 'Sword Art Online',
  booru: 'alice_zuberg',
  signature: ['cursor', 'selection', 'ansi5'],
  background: '#1b170c',
  foreground: '#ede2c6',
  cursor: '#e8d082',
  selection: '#10409c',
  ansi: [
    '#272318',
    '#ff7849',
    '#9ab566',
    '#e3b53a',
    '#799dfe',
    '#a79af4',
    '#71c189',
    '#cec6b4',
    '#7d7767',
    '#ffad92',
    '#bdd594',
    '#f9da8b',
    '#8bc3f7',
    '#dbbaf6',
    '#9be1ae',
    '#f9edd0',
  ],
  waive: ['accents'],
  reason: 'the red is the character',
  pictures: [
    { site: 'danbooru', id: 7123456, size: 130, position: 'top-right', opacity: 0.22 },
    { site: 'yande', id: 42, size: 'fill' },
  ],
}

test('a share code carries the whole palette, its waiver and its pictures', () => {
  const code = shareCode(draft)
  assert.match(code, /^tt1:[A-Za-z0-9_-]+$/)
  assert.deepEqual(fromCode(code), draft)
})

test('a share code that was cut, padded or retyped is refused', () => {
  const code = shareCode(draft)
  assert.throws(() => fromCode(code.slice(0, -6)), /cut short|left over/)
  assert.throws(() => fromCode(`${code}AAAA`), /left over/)
  assert.throws(() => fromCode(code.replace('tt1:', 'tt2:')), /starts with tt1:/)
  assert.throws(() => fromCode(`${code}!`), /characters it never uses/)
})

test('the TOML a draft writes reads back as the same palette', () => {
  const theme = readOwnText(draft.name, paletteToml(draft), [])
  assert.equal(theme.name, 'kecan0406/dusk')
  assert.equal(theme.base, 'alice')
  assert.equal(theme.waiveReason, 'the red is the character')
  assert.deepEqual(theme.pictures, draft.pictures)
  assert.deepEqual(theme.ansi, draft.ansi)
})

test('recolor rewrites the foreground, selection and ANSI list and nothing else', () => {
  const source = paletteToml(draft)
  const ansi = draft.ansi.map((c, i) => (i === 1 ? '#ff0000' : c))
  const out = recolor(source, { foreground: '#ffffff', selectionBackground: '#000080', ansi })
  const theme = readOwnText(draft.name, out, [])
  assert.equal(theme.foreground, '#ffffff')
  assert.equal(theme.selectionBackground, '#000080')
  assert.equal(theme.ansi[1], '#ff0000')
  assert.equal(theme.background, draft.background)
  assert.equal(out.split('\n').length, source.split('\n').length)
})
