import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { brotliDecompressSync, deflateRawSync, inflateRawSync } from 'node:zlib'
import { readMarketplaceDir, warning } from './local.ts'
import {
  codeOf,
  type Draft,
  fromCode,
  paletteToml,
  readCodes,
  readOwnText,
  recolor,
  resign,
  shareCode,
  shareLink,
  withPictures,
} from './own.ts'
import { marketplaceOf } from './theme.ts'

const draft: Draft = {
  name: 'kecan0406@dust/rei',
  base: 'alice',
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

const lit = {
  background: '#fbf8ff',
  foreground: '#1d1a24',
  cursor: '#9a3f5a',
  selection: '#e0d8f0',
  ansi: draft.ansi.map((_, i) => `#${(0x30 + i * 4).toString(16).padStart(2, '0').repeat(3)}`),
}

test('a share code carries the whole palette, its waiver, its pictures and its other mode', () => {
  const code = shareCode([draft])
  assert.match(code, /^tt4:[A-Za-z0-9_-]+$/)
  assert.deepEqual(fromCode(code), [draft])
  assert.deepEqual(fromCode(shareCode([{ ...draft, other: lit }])), [{ ...draft, other: lit }])
})

test('a share code refuses more pictures than its count can carry instead of dropping them all', () => {
  const pictures = Array.from({ length: 256 }, (_, i) => ({ site: 'danbooru', id: i + 1 }))
  assert.throws(() => shareCode([{ ...draft, pictures }]), /at most 255 pictures/)
  assert.equal(fromCode(shareCode([{ ...draft, pictures: pictures.slice(0, 255) }]))[0]?.pictures?.length, 255)
})

test('a share link reads as the code it carries, however it was pasted', () => {
  const code = shareCode([draft])
  const link = shareLink(code)
  assert.equal(link, `https://ttheme.vercel.app/p/${code}`)
  assert.equal(codeOf(link), code)
  assert.equal(codeOf(`  ${link}/\n`), code)
  assert.equal(codeOf(`${link}?utm_source=chat`), code)
  assert.equal(codeOf(link.replace('tt4:', 'tt4%3A')), code)
  assert.equal(codeOf(code), code)
  assert.equal(codeOf('https://ttheme.vercel.app/marketplace'), undefined)
  assert.equal(codeOf('https://ttheme.vercel.app/p/miku'), undefined)
  assert.equal(codeOf('kecan0406@dust/rei'), undefined)
})

const UNPACK = [(b: Buffer) => b, (b: Buffer) => inflateRawSync(b), (b: Buffer) => brotliDecompressSync(b)]

const bodyOf = (code: string): Buffer => {
  const payload = Buffer.from(code.slice(4), 'base64url').subarray(0, -4)

  return (UNPACK[payload[0] as number] as (b: Buffer) => Buffer)(payload.subarray(1))
}

const signed = (payload: Buffer): string =>
  `tt4:${Buffer.concat([payload, createHash('sha256').update(payload).digest().subarray(0, 4)]).toString('base64url')}`

const raw = (body: Buffer): string => signed(Buffer.concat([Buffer.from([0]), body]))

test('a share code that was cut, padded or retyped is refused, and so is one from an older ttheme', () => {
  const code = shareCode([draft])
  assert.throws(() => fromCode(code.slice(0, -6)), /does not add up/)
  assert.throws(() => fromCode(`${code}AAAA`), /does not add up/)
  assert.throws(() => fromCode('tt4:AAA'), /cut short/)
  assert.throws(() => fromCode(code.replace('tt4:', 'tt2:')), /reads tt4: share codes, not tt2:/)
  assert.throws(() => fromCode(code.replace('tt4:', 'xx:')), /starts with tt4:/)
  assert.throws(() => fromCode(`${code}!`), /characters it never uses/)
  const body = bodyOf(code)
  assert.deepEqual(fromCode(raw(body)), [draft])
  assert.throws(() => fromCode(raw(body.subarray(0, -1))), /cut short/)
  assert.throws(() => fromCode(raw(Buffer.concat([body, Buffer.from([0])]))), /left over/)
  const bad = Buffer.from(body)
  bad[2] = 0xff
  assert.throws(() => fromCode(raw(bad)), { name: 'Error', message: /text it cannot read/ })
})

const asuna: Draft = { ...draft, name: 'kecan0406@dust/asuna', from: 'kecan0406@sao/asuna', pictures: [] }

test('a share link carries several palettes, where each one came from and the other modes they keep', () => {
  const { pictures: _, ...bare } = asuna
  const code = shareCode([draft, { ...bare, other: lit }])
  assert.match(code, /^tt4:[A-Za-z0-9_-]+$/)
  assert.deepEqual(fromCode(code), [draft, { ...bare, other: lit }])
  assert.equal(codeOf(shareLink(code)), code)
  assert.deepEqual(fromCode(shareCode([{ ...draft, from: 'rei' }])), [{ ...draft, from: 'rei' }])
  assert.throws(() => shareCode([]), /1 to 255 palettes/)
})

test('a share code that packs too much, names a palette twice or marks an other mode it cannot read is refused', () => {
  const code = shareCode([draft, asuna])
  assert.throws(() => fromCode(code.slice(0, -6)), /does not add up/)
  assert.throws(() => fromCode(code.replace('tt4:', 'tt9:')), /reads tt4: share codes, not tt9:/)
  assert.throws(() => fromCode(signed(Buffer.from([7, 1, 2]))), /packed in a way/)
  const flood = Buffer.concat([Buffer.from([1]), deflateRawSync(Buffer.alloc(200_000, 1))])
  assert.throws(() => fromCode(signed(flood)), { name: 'Error', message: /does not unpack/ })
  assert.throws(() => fromCode(shareCode([draft, draft])), /holds kecan0406@dust\/rei twice/)
  const one = bodyOf(shareCode([draft]))
  const marked = Buffer.from(one)
  marked[one.length - 2] = 2
  assert.throws(() => fromCode(raw(marked)), /palette it cannot read/)
})

test('a share code with any one character changed is refused', () => {
  const code = shareCode([draft])
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

  for (let at = 4; at < code.length - 1; at++) {
    const other = alphabet[(alphabet.indexOf(code[at] as string) + 17) % 64]
    assert.throws(() => fromCode(`${code.slice(0, at)}${other}${code.slice(at + 1)}`), /does not add up/)
  }
})

test('a share code whose catalog could not be a catalog folder is refused, so no copy of it lands outside one', () => {
  for (const catalog of ['../../../../alacritty', 'vocaloid/miku', '.hidden', 'a"b']) {
    assert.throws(() => readCodes(shareCode([{ ...draft, catalog }]), []), /the share code's catalog/, catalog)
  }

  assert.equal(readCodes(shareCode([{ ...draft, catalog: 'Vocaloid' }]), [])[0]?.catalog, 'Vocaloid')
})

test('the TOML a draft writes reads back as the same palette', () => {
  const theme = readOwnText(draft.name, paletteToml(draft), [])
  assert.equal(theme.name, 'kecan0406@dust/rei')
  assert.equal(theme.base, 'alice')
  assert.equal(readOwnText(asuna.name, paletteToml(asuna), []).from, 'kecan0406@sao/asuna')
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

test('a marketplace takes its catalogs from folders, keeps loose palettes after them, and skips a name used twice', () => {
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
  const entries = readMarketplaceDir(dir, 'kec@shop', [], warning(false))
  assert.deepEqual(
    entries.map((e) => [e.name, e.catalog]),
    [
      ['kec@shop/arcade', 'neon'],
      ['kec@shop/sakura', 'pastel'],
      ['kec@shop/dusk', undefined],
    ],
  )
  assert.ok(entries.every((e) => marketplaceOf(e.name) === 'kec@shop'))
})
