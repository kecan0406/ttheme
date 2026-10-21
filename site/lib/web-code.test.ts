import { expect, test } from 'bun:test'
import { brotliCompressSync } from 'node:zlib'
import { codeBody, type Draft, draftOf, paletteToml, sealed } from '../../src/core/draft.ts'
import { fromCode, shareCode } from '../../src/core/own.ts'
import { official } from './official'
import { textDraft, webCode, webDrafts } from './web-code'

const miku = official.find((entry) => entry.name === 'miku')

const draft: Draft = {
  ...draftOf(miku as NonNullable<typeof miku>, 'miku-tuned'),
  background: '#101820',
  waive: ['distinct'],
  reason: 'two greens stand for the character',
  pictures: [{ site: 'danbooru', id: 1234567, size: 'fill', position: 'center-right', opacity: 0.6 }],
}

test('a link the builder makes in a browser is one the CLI reads, both modes, waiver and pictures included', async () => {
  const code = await webCode([draft])
  expect(code).toMatch(/^tt4:[A-Za-z0-9_-]+$/)
  expect(fromCode(code)).toEqual([draft])
})

test('the builder opens the links the CLI makes, but a brotli-packed one only in a terminal', async () => {
  expect(await webDrafts(shareCode([draft]))).toEqual([draft])
  const packed = Uint8Array.from([2, ...brotliCompressSync(codeBody([draft]))])
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', packed.slice()))
  await expect(webDrafts(sealed(packed, digest))).rejects.toThrow(/brotli/)
})

test('a palette file the builder writes opens back as the same palette, but for the catalog its folder names', () => {
  const { catalog: _, ...filed } = draft
  expect(textDraft('miku-tuned (1).toml', paletteToml(draft))).toEqual(filed)
})
