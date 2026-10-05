import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  codeOf,
  type Draft,
  fromCode,
  paletteToml,
  readMarketDir,
  readOwnText,
  recolor,
  resign,
  shareCode,
  shareLink,
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
  assert.match(code, /^tt2:[A-Za-z0-9_-]+$/)
  assert.deepEqual(fromCode(code), draft)
})

test('a share link reads as the code it carries, however it was pasted', () => {
  const code = shareCode(draft)
  const link = shareLink(code)
  assert.equal(link, `https://ttheme.vercel.app/p/${code}`)
  assert.equal(codeOf(link), code)
  assert.equal(codeOf(`  ${link}/\n`), code)
  assert.equal(codeOf(`${link}?utm_source=chat`), code)
  assert.equal(codeOf(link.replace('tt2:', 'tt2%3A')), code)
  assert.equal(codeOf(code), code)
  assert.equal(codeOf('https://ttheme.vercel.app/market'), undefined)
  assert.equal(codeOf('https://ttheme.vercel.app/p/miku'), undefined)
  assert.equal(codeOf('kecan0406@dust/rei'), undefined)
})

const signed = (bytes: Buffer): string =>
  `tt2:${Buffer.concat([bytes, createHash('sha256').update(bytes).digest().subarray(0, 4)]).toString('base64url')}`

test('a share code that was cut, padded or retyped is refused', () => {
  const code = shareCode(draft)
  assert.throws(() => fromCode(code.slice(0, -6)), /does not add up/)
  assert.throws(() => fromCode(`${code}AAAA`), /does not add up/)
  assert.throws(() => fromCode('tt2:AAA'), /cut short/)
  assert.throws(() => fromCode(code.replace('tt2:', 'tt1:')), /reads tt2: share codes, not tt1:/)
  assert.throws(() => fromCode(code.replace('tt2:', 'xx:')), /starts with tt2:/)
  assert.throws(() => fromCode(`${code}!`), /characters it never uses/)
  const payload = Buffer.from(code.slice(4), 'base64url').subarray(0, -4)
  assert.throws(() => fromCode(signed(payload.subarray(0, -1))), /cut short/)
  assert.throws(() => fromCode(signed(Buffer.concat([payload, Buffer.from([0])]))), /left over/)
  const bad = Buffer.from(payload)
  bad[1] = 0xff
  assert.throws(() => fromCode(signed(bad)), { name: 'Error', message: /text it cannot read/ })
})

test('a share code with any one character changed is refused', () => {
  const code = shareCode(draft)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  for (let at = 4; at < code.length - 1; at++) {
    const other = alphabet[(alphabet.indexOf(code[at] as string) + 17) % 64]
    assert.throws(() => fromCode(`${code.slice(0, at)}${other}${code.slice(at + 1)}`), /does not add up/)
  }
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
