import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  type Draft,
  fromCode,
  paletteToml,
  readMarketDir,
  readOwnText,
  recolor,
  resign,
  shareCode,
  warning,
  withPictures,
} from './own.ts'

const draft: Draft = {
  name: 'kecan0406@dust/rei',
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
  assert.equal(theme.name, 'kecan0406@dust/rei')
  assert.equal(theme.base, 'alice')
  assert.equal(theme.waiveReason, 'the red is the character')
  assert.deepEqual(theme.pictures, draft.pictures)
  assert.deepEqual(theme.ansi, draft.ansi)
})

test('recolor rewrites the twenty colors and nothing else', () => {
  const source = paletteToml(draft)
  const ansi = draft.ansi.map((c, i) => (i === 1 ? '#ff0000' : c))
  const colors = { background: '#101010', foreground: '#ffffff', cursor: '#00ff00', selection: '#000080', ansi }
  const out = recolor(source, colors)
  const theme = readOwnText(draft.name, out, [])
  assert.equal(theme.background, '#101010')
  assert.equal(theme.foreground, '#ffffff')
  assert.equal(theme.cursor, '#00ff00')
  assert.equal(theme.selectionBackground, '#000080')
  assert.equal(theme.ansi[1], '#ff0000')
  assert.deepEqual(theme.signatureSlots, draft.signature)
  assert.equal(out.split('\n').length, source.split('\n').length)
  const marked = readOwnText(draft.name, resign(out, ['ansi1', 'foreground', 'cursor']), [])
  assert.deepEqual(marked.signatureSlots, ['ansi1', 'foreground', 'cursor'])
  const pictured = readOwnText(draft.name, withPictures(out, [{ site: 'danbooru', id: 42, size: 'fill' }]), [])
  assert.deepEqual(pictured.pictures?.at(-1), { site: 'danbooru', id: 42, size: 'fill' })
})

test('a market takes its catalogs from folders, keeps loose palettes after them, and skips a name used twice', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-shop-'))
  const { waive: _, reason: __, pictures: ___, base: ____, ...plain } = draft
  const put = (path: string, name: string) => {
    mkdirSync(join(dir, 'palettes', path, '..'), { recursive: true })
    writeFileSync(join(dir, 'palettes', path), paletteToml({ ...plain, name }))
  }
  put('neon/arcade.toml', 'arcade')
  put('pastel/arcade.toml', 'arcade')
  put('pastel/sakura.toml', 'sakura')
  put('dusk.toml', 'dusk')
  const entries = readMarketDir(dir, 'kec@shop', [], warning(false))
  assert.deepEqual(
    entries.map((e) => [e.name, e.catalog]),
    [
      ['kec@shop/arcade', 'neon'],
      ['kec@shop/sakura', 'pastel'],
      ['kec@shop/dusk', undefined],
    ],
  )
  assert.ok(entries.every((e) => e.group === 'kec@shop'))
})
