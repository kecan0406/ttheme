import assert from 'node:assert/strict'
import { test } from 'node:test'

import { booruTags, gateFailures, parseCatalog, search, siteTags } from './catalog.ts'
import type { PaletteEntry } from './emit/manifest.ts'

function entry(partial: Partial<PaletteEntry> = {}): PaletteEntry {
  return {
    name: 'gojo',
    group: 'Jujutsu Kaisen',
    order: 1,
    ansiSource: 'Horizon + Jujutsu',
    background: '#11191c',
    foreground: '#e3e2e7',
    cursor: '#7cc1d6',
    selection: '#383b5b',
    signature: ['#7cc1d6', '#e3e2e7', '#d7bcf3'],
    signatureSlots: ['cursor', 'foreground', 'ansi13'],
    ansi: Array.from({ length: 16 }, () => '#808080'),
    gate: [13.8, 6.8, 0.02, 10.4, 4.0],
    ...partial,
  }
}

function catalogJson(palettes: PaletteEntry[]): string {
  return JSON.stringify({ version: '0.1.0', gate: [], font: { family: 'Mono', size: 14, codepointMap: [] }, palettes })
}

test('parseCatalog rejects a document without palettes', () => {
  assert.throws(() => parseCatalog('{"version":"0.1.0"}'), /no version or palettes/)
})

test('parseCatalog rejects text that is not JSON', () => {
  assert.throws(() => parseCatalog('<html>'), /not valid JSON/)
})

test('parseCatalog rejects an entry missing its 16 ANSI colors', () => {
  const short = entry({ ansi: ['#808080'] })
  assert.throws(() => parseCatalog(catalogJson([short])), /16 ANSI colors/)
})

test('parseCatalog accepts a well formed catalog', () => {
  assert.equal(parseCatalog(catalogJson([entry()])).palettes[0]?.name, 'gojo')
})

test('gateFailures is empty when every rule is met', () => {
  assert.deepEqual(gateFailures(entry()), [])
})

test('gateFailures reports a ratio below its minimum', () => {
  assert.match(gateFailures(entry({ gate: [4, 6.8, 0.02, 10.4, 4.0] }))[0] ?? '', /foreground on background 4 < 7/)
})

test('gateFailures reports a value above its maximum', () => {
  assert.match(gateFailures(entry({ gate: [13.8, 6.8, 0.9, 10.4, 4.0] }))[0] ?? '', /ansi0 luminance 0.9 > 0.15/)
})

test('gateFailures honours a waiver by rule name', () => {
  assert.deepEqual(gateFailures(entry({ gate: [4, 6.8, 0.02, 10.4, 4.0], waived: ['foreground'] })), [])
})

test('search matches the palette, the series and the ANSI source', () => {
  const palettes = [entry(), entry({ name: 'miku', group: 'Vocaloid', ansiSource: 'vauxe Miku' })]
  assert.deepEqual(
    search(palettes, 'jujutsu').map((p) => p.name),
    ['gojo'],
  )
  assert.deepEqual(
    search(palettes, 'vocaloid').map((p) => p.name),
    ['miku'],
  )
  assert.deepEqual(
    search(palettes, 'vauxe').map((p) => p.name),
    ['miku'],
  )
})

test('booruTags finds the booru tags that hold what was typed, this palette and its series first', () => {
  const suzuha = entry({ name: 'suzuha', group: 'Steins;Gate', booru: 'amane_suzuha' })
  const ruka = entry({ name: 'ruka', group: 'Steins;Gate', booru: 'urushibara_ruka' })
  const lulu = entry({ name: 'lulu', group: 'Hololive', booru: 'suzuhara_lulu' })
  const none = entry({ name: 'none', group: 'Steins;Gate' })
  assert.deepEqual(
    booruTags([lulu, ruka, none, suzuha], suzuha, 'SUZU').map((p) => p.name),
    ['suzuha', 'lulu'],
  )
  assert.deepEqual(
    booruTags([lulu, ruka, suzuha], ruka, 'u').map((p) => p.name),
    ['ruka', 'suzuha', 'lulu'],
  )
})

test('siteTags reads the names a site goes by, else the one booru tag, else none', () => {
  const moon = entry({ booru: 'sailor_moon', booruSites: { yande: ['tsukino_usagi'], konachan: [] } })
  assert.deepEqual(siteTags(moon, 'yande'), ['tsukino_usagi'])
  assert.deepEqual(siteTags(moon, 'konachan'), [])
  assert.deepEqual(siteTags(moon, 'danbooru'), ['sailor_moon'])
  assert.deepEqual(siteTags(entry(), 'danbooru'), [])
})
