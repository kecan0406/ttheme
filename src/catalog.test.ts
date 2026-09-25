import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  available,
  booruTags,
  gateFailures,
  parseCatalog,
  parseIndex,
  readCatalog,
  search,
  siteTags,
  writeCatalog,
  writeKept,
} from './catalog.ts'
import type { PaletteEntry } from './emit/manifest.ts'
import { paletteToml } from './own.ts'

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
    backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
    ...partial,
  }
}

function catalogJson(palettes: PaletteEntry[]): string {
  return JSON.stringify({ version: '0.1.0', gate: [], palettes })
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

test('parseCatalog refuses an entry whose name or text would reach a path or a config line', () => {
  assert.throws(() => parseCatalog(catalogJson([entry({ name: '../../x' })])), /lowercase letters/)
  assert.throws(() => parseCatalog(catalogJson([entry({ ansiSource: 'x\ncommand = rm' })])), /control character/)
  assert.throws(() => parseCatalog(catalogJson([entry({ background: 'red' })])), /#rrggbb/)
  assert.equal(parseCatalog(catalogJson([entry({ name: 'dusk@kec', base: 'gojo' })])).palettes[0]?.name, 'dusk@kec')
})

test('gateFailures measures an entry that carries no gate', () => {
  const { gate: _, ...bare } = entry({ foreground: '#20282c' })
  assert.match(gateFailures(bare as PaletteEntry)[0] ?? '', /foreground on background/)
})

test('readCatalog lays each added market after the base its palettes vary, and available adds local markets and kept ones', () => {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-available-'))
  const skeleton = {
    version: '0.1.0',
    gate: [],
    placement: { tall: 1.15, reach: 0.4, widest: 0.95, headroom: 0.04, margin: 0.03, stands: 12 },
  }
  const local = join(home, 'mine')
  mkdirSync(join(home, 'ttheme', 'markets'), { recursive: true })
  mkdirSync(join(local, 'palettes'), { recursive: true })
  writeFileSync(
    join(home, 'ttheme', 'installed.json'),
    JSON.stringify({ terminals: [], palettes: [], markets: ['official', 'ann/ttheme-palettes', local] }),
  )
  writeCatalog(home, { ...skeleton, palettes: [entry({ name: 'gojo' }), entry({ name: 'geto', order: 2 })] })
  writeFileSync(
    join(home, 'ttheme', 'markets', 'ann.json'),
    JSON.stringify({ ...skeleton, owner: 'ann', palettes: [entry({ name: 'old', base: 'gojo' })] }),
  )
  writeFileSync(join(local, 'ttheme-market.json'), JSON.stringify({ ...skeleton, owner: 'kec', palettes: [] }))
  writeFileSync(
    join(local, 'palettes', 'dusk.toml'),
    paletteToml({
      name: 'dusk@kec',
      base: 'gojo',
      signature: ['cursor', 'foreground', 'background'],
      background: '#101010',
      foreground: '#f0f0f0',
      cursor: '#e0c060',
      selection: '#303060',
      ansi: Array.from({ length: 16 }, () => '#808080'),
    }),
  )
  writeKept(home, [entry({ name: 'gone@bob' })])
  const catalog = readCatalog(home)
  assert.deepEqual(
    catalog.palettes.map((p) => p.name),
    ['gojo', 'old@ann', 'geto'],
  )
  assert.deepEqual(
    available(home, catalog).palettes.map((p) => p.name),
    ['gojo', 'old@ann', 'dusk@kec', 'geto', 'gone@bob'],
  )
})

test('a market index names its palettes bare — the owner comes from where it is added', () => {
  const index = (name: string) => JSON.stringify({ ...JSON.parse(catalogJson([entry({ name })])), owner: 'ann' })
  assert.equal(parseIndex(index('dusk')).owner, 'ann')
  assert.throws(() => parseIndex(index('dusk@bob')), /bare palette names/)
  assert.throws(() => parseIndex(catalogJson([entry({ name: 'dusk' })])), /no "owner"/)
})
