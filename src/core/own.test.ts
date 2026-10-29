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
import { setText } from './sets.ts'
import { quoted } from './text.ts'
import { publisherOf } from './theme.ts'

const draft: Draft = {
  name: 'kumquat09@dust/wren',
  subject: 'starfall/orla',
  from: 'ttheme/orla',
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
  pictures: [
    { site: 'danbooru', id: 7123456, size: 130, position: 'top-right', strength: 1.5 },
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

test('a share code carries the whole palette, its pictures and its other mode', () => {
  const code = shareCode([draft])
  assert.match(code, /^tt6:[A-Za-z0-9_-]+$/)
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
  assert.equal(codeOf(link.replace('tt6:', 'tt6%3A')), code)
  assert.equal(codeOf(code), code)
  assert.equal(codeOf('https://ttheme.dev/marketplace'), undefined)
  assert.equal(codeOf('https://ttheme.dev/builder/pip'), undefined)
  assert.equal(codeOf(`https://ttheme.dev/p/${code}`), undefined)
  assert.equal(codeOf('kumquat09@dust/wren'), undefined)
})

const UNPACK = [(b: Buffer) => b, (b: Buffer) => inflateRawSync(b), (b: Buffer) => brotliDecompressSync(b)]

const bodyOf = (code: string): Buffer => {
  const payload = Buffer.from(code.slice(4), 'base64url').subarray(0, -4)

  return (UNPACK[payload[0] as number] as (b: Buffer) => Buffer)(payload.subarray(1))
}

const signed = (payload: Buffer): string =>
  `tt6:${Buffer.concat([payload, createHash('sha256').update(payload).digest().subarray(0, 4)]).toString('base64url')}`

const raw = (body: Buffer): string => signed(Buffer.concat([Buffer.from([0]), body]))

test('a share code that was cut, padded or retyped is refused, and so is one from an older ttheme', () => {
  const code = shareCode([draft])
  assert.throws(() => fromCode(code.slice(0, -6)), /does not add up/)
  assert.throws(() => fromCode(`${code}AAAA`), /does not add up/)
  assert.throws(() => fromCode('tt6:AAA'), /cut short/)
  assert.throws(() => fromCode(code.replace('tt6:', 'tt2:')), /reads tt6: share codes, not tt2:/)
  assert.throws(() => fromCode(code.replace('tt6:', 'xx:')), /starts with tt6:/)
  assert.throws(() => fromCode(`${code}!`), /characters it never uses/)
  const body = bodyOf(code)
  assert.deepEqual(fromCode(raw(body)), [draft])
  assert.throws(() => fromCode(raw(body.subarray(0, -1))), /cut short/)
  assert.throws(() => fromCode(raw(Buffer.concat([body, Buffer.from([0])]))), /left over/)
  const bad = Buffer.from(body)
  bad[2] = 0xff
  assert.throws(() => fromCode(raw(bad)), { name: 'Error', message: /text it cannot read/ })
})

const juno: Draft = { ...draft, name: 'kumquat09@dust/juno', from: 'kumquat09@tide/juno', pictures: [] }

test('a share link carries several palettes, where each one came from and the other modes they keep', () => {
  const { pictures: _, ...bare } = juno
  const code = shareCode([draft, { ...bare, other: lit }])
  assert.match(code, /^tt6:[A-Za-z0-9_-]+$/)
  assert.deepEqual(fromCode(code), [draft, { ...bare, other: lit }])
  assert.equal(codeOf(shareLink(code)), code)
  const { subject: _subject, from: _from, ...plain } = draft
  assert.deepEqual(fromCode(shareCode([plain])), [plain])
  assert.throws(() => shareCode([]), /1 to 255 palettes/)
})

test('a share code that packs too much, names a palette twice or marks an other mode it cannot read is refused', () => {
  assert.throws(() => fromCode(signed(Buffer.from([7, 1, 2]))), /packed in a way/)
  const flood = Buffer.concat([Buffer.from([1]), deflateRawSync(Buffer.alloc(200_000, 1))])
  assert.throws(() => fromCode(signed(flood)), { name: 'Error', message: /does not unpack/ })
  assert.throws(() => fromCode(shareCode([draft, draft])), /holds kumquat09@dust\/wren twice/)
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

  for (const subject of ['../../alacritty', 'Starfall', 'ttheme/pip', 'a/b/c']) {
    assert.throws(() => readCodes(shareCode([{ ...draft, subject }])), /subject/, subject)
  }

  for (const name of [
    'kumquat09@dust\ncommand = x/wren',
    `kumquat09@du${rlo}st/wren`,
    'dust/wren',
    'a@b@c/wren',
    'Wren',
  ]) {
    assert.throws(() => readCodes(shareCode([{ ...draft, name }])), /the share code's palette/, name)
  }

  assert.equal(readCodes(shareCode([draft]))[0]?.name, 'kumquat09@dust/wren')
  assert.equal(readCodes(shareCode([draft]))[0]?.subject, 'starfall/orla')
  assert.equal(readCodes(shareCode([{ ...draft, name: 'ttheme/wren' }]))[0]?.name, 'ttheme/wren')
})

test('a share code may carry a palette no marketplace holds yet, named by its slug alone', () => {
  const [unplaced] = readCodes(shareCode([{ ...draft, name: 'wren-tuned' }]))
  assert.equal(unplaced?.name, 'wren-tuned')
  assert.equal(unplaced?.from, 'ttheme/orla')
})

test('the TOML a draft writes reads back as the same palette', () => {
  const theme = readOwnText(draft.name, paletteToml(draft))
  assert.equal(theme.name, 'kumquat09@dust/wren')
  assert.equal(theme.subject, 'starfall/orla')
  assert.equal(theme.from, 'ttheme/orla')
  assert.equal(readOwnText(juno.name, paletteToml(juno)).from, 'kumquat09@tide/juno')
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

test('a marketplace reads its palettes from the set files flat in sets/, named by their slugs, and its proposed works beside them', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-shop-'))
  const { pictures: _, ...plain } = draft

  const put = (path: string, slug: string, subject?: string) => {
    mkdirSync(join(dir, 'sets', path, '..'), { recursive: true })
    writeFileSync(join(dir, 'sets', path), setText([{ slug, text: paletteToml({ ...plain, subject }) }]))
  }

  put('neon.toml', 'arcade', 'neon/arcade')
  put('neon/volt.toml', 'volt', 'neon/volt')
  put('original.toml', 'dusk')
  mkdirSync(join(dir, 'works'))
  writeFileSync(join(dir, 'works', 'neon.toml'), 'name = "Neon"\n[[character]]\nid = "arcade"\n')
  const { entries, works } = readMarketplaceDir(dir, 'kai@shop', warning(false))
  assert.deepEqual(
    entries.map((e) => [e.name, e.subject]),
    [
      ['kai@shop/arcade', 'neon/arcade'],
      ['kai@shop/dusk', undefined],
    ],
  )
  assert.ok(entries.every((e) => publisherOf(e.name) === 'kai@shop'))
  assert.deepEqual(
    works.map((w) => [w.id, w.name, w.characters.map((c) => c.id)]),
    [['neon', 'Neon', ['arcade']]],
  )
})

test('a palette whose slug, or a set or work file whose name, holds a control character or a direction mark is skipped with it spelled out', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-shop-'))
  const { pictures: _, ...plain } = draft
  const night = `night${String.fromCodePoint(0x202e)}`
  const odd = 'x\x1b]52;c;aGk=\x07'
  mkdirSync(join(dir, 'sets'), { recursive: true })
  mkdirSync(join(dir, 'works'), { recursive: true })
  writeFileSync(join(dir, 'sets', `${odd}.toml`), setText([{ slug: odd, text: paletteToml(plain) }]))
  writeFileSync(join(dir, 'works', `${night}.toml`), 'name = "Night"\n')
  const said: string[] = []

  const write = spyOn(process.stderr, 'write').mockImplementation((text) => {
    said.push(String(text))

    return true
  })

  try {
    assert.deepEqual(readMarketplaceDir(dir, 'kai@shop', warning(true)), { entries: [], works: [] })
  } finally {
    write.mockRestore()
  }

  assert.equal(said.length, 2)
  assert.ok(said.every((line) => !/[\p{Cc}\p{Bidi_Control}]/u.test(line.slice(0, -1))))
  assert.ok(said.some((line) => line.includes(`the slug ${quoted(odd)}`)))
  assert.ok(said.some((line) => line.includes(`the work ${quoted(night)}`)))
})

test('a slug two set files of one marketplace hold is reported, and the second is skipped', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-shop-'))
  const { pictures: _, ...plain } = draft
  const palette = (subject?: string) => paletteToml({ ...plain, subject })
  mkdirSync(join(dir, 'sets'))
  writeFileSync(join(dir, 'sets', 'neon.toml'), setText([{ slug: 'arcade', text: palette('neon/arcade') }]))

  writeFileSync(
    join(dir, 'sets', 'original.toml'),
    setText([
      { slug: 'arcade', text: palette() },
      { slug: 'dusk', text: palette() },
    ]),
  )

  const said: [string, string][] = []
  const { entries } = readMarketplaceDir(dir, 'kai@shop', (where, message) => said.push([where, message]))

  assert.deepEqual(
    entries.map((e) => [e.name, e.subject]),
    [
      ['kai@shop/arcade', 'neon/arcade'],
      ['kai@shop/dusk', undefined],
    ],
  )
  assert.deepEqual(said, [
    [join(dir, 'sets', 'original.toml'), 'arcade is in neon.toml too — a slug is used once in a marketplace'],
  ])
})
