import { expect, test } from 'bun:test'
import { brotliCompressSync } from 'node:zlib'
import { CODE, codeBody, type Draft, paletteToml, sealed } from '../../src/core/draft.ts'
import { fromCode, readCodes } from '../../src/core/own.ts'
import { setText } from '../../src/core/sets.ts'
import { textDraft, webCheck, webCode } from './web-code'

const ansi = [
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
]

const draft: Draft = {
  name: 'orla-tuned',
  subject: 'starfall/orla',
  from: 'ttheme/orla',
  ansiSource: 'alice',
  signature: ['cursor', 'selection', 'ansi5'],
  background: '#1b170c',
  foreground: '#ede2c6',
  cursor: '#e8d082',
  selection: '#10409c',
  ansi,
  other: {
    background: '#fbf8ff',
    foreground: '#1d1a24',
    cursor: '#9a3f5a',
    selection: '#e0d8f0',
    ansi: ansi.map((_, i) => `#${(0x30 + i * 4).toString(16).padStart(2, '0').repeat(3)}`),
  },
  waive: ['distinct'],
  reason: 'two greens stand for the character',
  pictures: [{ site: 'danbooru', id: 1234567, size: 'fill', position: 'center-right', opacity: 0.6 }],
}

test('a link the builder makes in a browser is one the CLI reads, both modes, waiver and pictures included', async () => {
  const code = await webCode([draft])
  expect(code).toMatch(new RegExp(`^${CODE}[A-Za-z0-9_-]+$`))
  expect(fromCode(code)).toEqual([draft])
  expect(readCodes(code).map((entry) => [entry.name, entry.subject, entry.from])).toEqual([
    [draft.name, draft.subject, draft.from],
  ])
})

async function packedAs(method: number, bytes: Uint8Array): Promise<string> {
  const packed = Uint8Array.from([method, ...bytes])

  return sealed(packed, new Uint8Array(await crypto.subtle.digest('SHA-256', packed.slice())))
}

test('the builder sends a link of any packing to its page, and turns away a code that does not add up', async () => {
  const code = await packedAs(2, brotliCompressSync(codeBody([draft])))
  await webCheck(code)
  await expect(webCheck(`${code.slice(0, 6)}${code[6] === 'A' ? 'B' : 'A'}${code.slice(7)}`)).rejects.toThrow(/add up/)
})

test('a set file the builder writes opens back as its first palette, named by its slug', () => {
  const set = setText([
    { slug: draft.name, text: paletteToml(draft) },
    { slug: 'orla', text: paletteToml({ ...draft, name: 'orla' }) },
  ])

  expect(textDraft('starfall (1).toml', set)).toEqual(draft)
})
