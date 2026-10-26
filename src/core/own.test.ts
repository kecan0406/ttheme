import { spyOn } from 'bun:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { brotliDecompressSync, deflateRawSync, inflateRawSync } from 'node:zlib'
import { readMarketplaceDir, warning } from '../store/local.ts'
import { codeOf, type Draft, paletteToml, readOwnText, shareLink, withPictures } from './draft.ts'
import { fromCode, readCodes, recolor, resign, shareCode } from './own.ts'
import { quoted } from './text.ts'
import { publisherOf } from './theme.ts'

const draft: Draft = {
  name: 'kecan0406@dust/rei',
  subject: 'sword-art-online/alice',
  from: 'ttheme/alice',
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
  assert.match(code, /^tt5:[A-Za-z0-9_-]+$/)
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
  assert.equal(link, `https://ttheme.dev/builder/${code}`)
  assert.equal(codeOf(link), code)
  assert.equal(codeOf(`  ${link}/\n`), code)
  assert.equal(codeOf(`${link}?utm_source=chat`), code)
  assert.equal(codeOf(link.replace('tt5:', 'tt5%3A')), code)
  assert.equal(codeOf(code), code)
  assert.equal(codeOf('https://ttheme.dev/marketplace'), undefined)
  assert.equal(codeOf('https://ttheme.dev/builder/miku'), undefined)
  assert.equal(codeOf(`https://ttheme.dev/p/${code}`), undefined)
  assert.equal(codeOf('kecan0406@dust/rei'), undefined)
})

const UNPACK = [(b: Buffer) => b, (b: Buffer) => inflateRawSync(b), (b: Buffer) => brotliDecompressSync(b)]

const bodyOf = (code: string): Buffer => {
  const payload = Buffer.from(code.slice(4), 'base64url').subarray(0, -4)

  return (UNPACK[payload[0] as number] as (b: Buffer) => Buffer)(payload.subarray(1))
}

const signed = (payload: Buffer): string =>
  `tt5:${Buffer.concat([payload, createHash('sha256').update(payload).digest().subarray(0, 4)]).toString('base64url')}`

const raw = (body: Buffer): string => signed(Buffer.concat([Buffer.from([0]), body]))

test('a share code that was cut, padded or retyped is refused, and so is one from an older ttheme', () => {
  const code = shareCode([draft])
  assert.throws(() => fromCode(code.slice(0, -6)), /does not add up/)
  assert.throws(() => fromCode(`${code}AAAA`), /does not add up/)
  assert.throws(() => fromCode('tt5:AAA'), /cut short/)
  assert.throws(() => fromCode(code.replace('tt5:', 'tt2:')), /reads tt5: share codes, not tt2:/)
  assert.throws(() => fromCode(code.replace('tt5:', 'xx:')), /starts with tt5:/)
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
  assert.match(code, /^tt5:[A-Za-z0-9_-]+$/)
  assert.deepEqual(fromCode(code), [draft, { ...bare, other: lit }])
  assert.equal(codeOf(shareLink(code)), code)
  const { subject: _subject, from: _from, ...plain } = draft
  assert.deepEqual(fromCode(shareCode([plain])), [plain])
  assert.throws(() => shareCode([]), /1 to 255 palettes/)
})

test('a share code that packs too much, names a palette twice or marks an other mode it cannot read is refused', () => {
  const code = shareCode([draft, asuna])
  assert.throws(() => fromCode(code.slice(0, -6)), /does not add up/)
  assert.throws(() => fromCode(code.replace('tt5:', 'tt9:')), /reads tt5: share codes, not tt9:/)
  assert.throws(() => fromCode(signed(Buffer.from([7, 1, 2]))), /packed in a way/)
  const flood = Buffer.concat([Buffer.from([1]), deflateRawSync(Buffer.alloc(200_000, 1))])
  assert.throws(() => fromCode(signed(flood)), { name: 'Error', message: /does not unpack/ })
  assert.throws(() => fromCode(shareCode([draft, draft])), /holds kecan0406@dust\/rei twice/)
  const one = bodyOf(shareCode([draft]))
  const marked = Buffer.from(one)
  marked[one.length - 1] = 2
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

test('a share code whose subject or palette name breaks the rules is refused, so it never reaches kept.json', () => {
  const rlo = String.fromCodePoint(0x202e)

  for (const subject of ['../../alacritty', 'Vocaloid', 'ttheme/miku', 'a/b/c']) {
    assert.throws(() => readCodes(shareCode([{ ...draft, subject }])), /subject/, subject)
  }

  for (const name of ['kecan0406@dust\ncommand = x/rei', `kecan0406@du${rlo}st/rei`, 'dust/rei', 'a@b@c/rei', 'Rei']) {
    assert.throws(() => readCodes(shareCode([{ ...draft, name }])), /the share code's palette/, name)
  }

  assert.equal(readCodes(shareCode([draft]))[0]?.name, 'kecan0406@dust/rei')
  assert.equal(readCodes(shareCode([draft]))[0]?.subject, 'sword-art-online/alice')
  assert.equal(readCodes(shareCode([{ ...draft, name: 'ttheme/rei' }]))[0]?.name, 'ttheme/rei')
})

test('a share code may carry a palette no marketplace holds yet, named by its slug alone', () => {
  const [unplaced] = readCodes(shareCode([{ ...draft, name: 'rei-tuned' }]))
  assert.equal(unplaced?.name, 'rei-tuned')
  assert.equal(unplaced?.from, 'ttheme/alice')
})

test('the TOML a draft writes reads back as the same palette', () => {
  const theme = readOwnText(draft.name, paletteToml(draft))
  assert.equal(theme.name, 'kecan0406@dust/rei')
  assert.equal(theme.subject, 'sword-art-online/alice')
  assert.equal(theme.from, 'ttheme/alice')
  assert.equal(readOwnText(asuna.name, paletteToml(asuna)).from, 'kecan0406@sao/asuna')
  assert.equal(theme.waiveReason, 'the red is the character')
  assert.deepEqual(theme.pictures, draft.pictures)
  assert.deepEqual(theme.ansi, draft.ansi)
})

test('recolor rewrites the twenty colors and nothing else', () => {
  const source = paletteToml(draft)
  const ansi = draft.ansi.map((c, i) => (i === 1 ? '#ff0000' : c))
  const colors = { background: '#101010', foreground: '#ffffff', cursor: '#00ff00', selection: '#000080', ansi }
  const out = recolor(source, colors)
  const theme = readOwnText(draft.name, out)
  assert.equal(theme.background, '#101010')
  assert.equal(theme.foreground, '#ffffff')
  assert.equal(theme.cursor, '#00ff00')
  assert.equal(theme.selectionBackground, '#000080')
  assert.equal(theme.ansi[1], '#ff0000')
  assert.deepEqual(theme.signatureSlots, draft.signature)
  assert.equal(out.split('\n').length, source.split('\n').length)
  const marked = readOwnText(draft.name, resign(out, ['ansi1', 'foreground', 'cursor']))
  assert.deepEqual(marked.signatureSlots, ['ansi1', 'foreground', 'cursor'])
  const pictured = readOwnText(draft.name, withPictures(out, [{ site: 'danbooru', id: 42, size: 'fill' }]))
  assert.deepEqual(pictured.pictures?.at(-1), { site: 'danbooru', id: 42, size: 'fill' })
})

test('a marketplace reads its palettes flat, named by their files, and its proposed works beside them', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-shop-'))
  const { waive: _, reason: __, pictures: ___, ...plain } = draft

  const put = (path: string, subject?: string) => {
    mkdirSync(join(dir, 'palettes', path, '..'), { recursive: true })
    writeFileSync(join(dir, 'palettes', path), paletteToml({ ...plain, subject }))
  }

  put('arcade.toml', 'neon/arcade')
  put('neon/volt.toml', 'neon/volt')
  put('dusk.toml')
  mkdirSync(join(dir, 'works'))
  writeFileSync(join(dir, 'works', 'neon.toml'), 'name = "Neon"\n[[character]]\nid = "arcade"\n')
  const { entries, works } = readMarketplaceDir(dir, 'kec@shop', warning(false))
  assert.deepEqual(
    entries.map((e) => [e.name, e.subject]),
    [
      ['kec@shop/arcade', 'neon/arcade'],
      ['kec@shop/dusk', undefined],
    ],
  )
  assert.ok(entries.every((e) => publisherOf(e.name) === 'kec@shop'))
  assert.deepEqual(
    works.map((w) => [w.id, w.name, w.characters.map((c) => c.id)]),
    [['neon', 'Neon', ['arcade']]],
  )
})

test('a palette or work file whose name holds a control character or a direction mark is skipped with it spelled out', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-shop-'))
  const { waive: _, reason: __, pictures: ___, ...plain } = draft
  const night = `night${String.fromCodePoint(0x202e)}`
  const odd = 'x\x1b]52;c;aGk=\x07'
  mkdirSync(join(dir, 'palettes'), { recursive: true })
  mkdirSync(join(dir, 'works'), { recursive: true })
  writeFileSync(join(dir, 'palettes', `${odd}.toml`), paletteToml(plain))
  writeFileSync(join(dir, 'works', `${night}.toml`), 'name = "Night"\n')
  const said: string[] = []

  const write = spyOn(process.stderr, 'write').mockImplementation((text) => {
    said.push(String(text))

    return true
  })

  try {
    assert.deepEqual(readMarketplaceDir(dir, 'kec@shop', warning(true)), { entries: [], works: [] })
  } finally {
    write.mockRestore()
  }

  assert.equal(said.length, 2)
  assert.ok(said.every((line) => !/[\p{Cc}\p{Bidi_Control}]/u.test(line.slice(0, -1))))
  assert.ok(said.some((line) => line.includes(`the file name ${quoted(odd)}`)))
  assert.ok(said.some((line) => line.includes(`the work ${quoted(night)}`)))
})
