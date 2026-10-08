import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  archiveId,
  archiveInfo,
  available,
  booruTags,
  gateFailures,
  parseCatalog,
  readCatalog,
  search,
  siteTags,
  untuned,
  updatesOf,
  writeCatalog,
  writeKept,
} from './catalog.ts'
import { type PaletteEntry, SCHEMA } from './manifest.ts'
import { paletteToml } from './own.ts'
import { shelfOf } from './theme.ts'

function entry(partial: Partial<PaletteEntry> = {}): PaletteEntry {
  return {
    name: 'gojo',
    catalog: 'Jujutsu Kaisen',
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
  return JSON.stringify({ schema: SCHEMA, version: '0.1.0', gate: [], palettes })
}

test('parseCatalog rejects a document without palettes', () => {
  assert.throws(() => parseCatalog('{"schema":1,"version":"0.1.0"}'), /no version or palettes/)
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

test('readCatalog can take the bundled official catalog, so an upgrade never parses the cache it is about to replace', () => {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-bundled-'))
  mkdirSync(join(home, 'ttheme'), { recursive: true })
  writeFileSync(join(home, 'ttheme', 'installed.json'), JSON.stringify({ terminals: [], palettes: [] }))
  writeFileSync(join(home, 'ttheme', 'catalog.json'), JSON.stringify({ schema: 1, palettes: 'another shape' }))
  assert.throws(() => readCatalog(home, false), /no version or palettes/)
  const bundled = parseCatalog(catalogJson([entry({ name: 'gojo' })]))
  assert.deepEqual(
    readCatalog(home, false, bundled).palettes.map((p) => p.name),
    ['gojo'],
  )
})

test('an installed palette from a marketplace keeps its colors until its update is taken, while an official one follows the catalog', () => {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-pinned-'))
  mkdirSync(join(home, 'ttheme'), { recursive: true })
  const was = [entry({ name: 'ann@pastel/dusk' }), entry({ name: 'gojo' })]
  writeKept(home, was)
  const moved = { background: '#000000' }
  const catalog = {
    schema: SCHEMA,
    version: '0.1.0',
    gate: [],
    palettes: [
      entry({ name: 'ann@pastel/dusk', ...moved }),
      entry({ name: 'gojo', ...moved }),
      entry({ name: 'ann@pastel/dawn', ...moved }),
    ],
  }
  const view = new Map(untuned(home, catalog, false).palettes.map((e) => [e.name, e.background]))
  assert.equal(view.get('ann@pastel/dusk'), '#11191c')
  assert.equal(view.get('gojo'), '#000000')
  assert.equal(view.get('ann@pastel/dawn'), '#000000')
  assert.deepEqual(
    updatesOf(home, catalog).map((e) => e.name),
    ['ann@pastel/dusk'],
  )
  writeKept(home, [catalog.palettes[0] as PaletteEntry, was[1] as PaletteEntry])
  assert.deepEqual(updatesOf(home, catalog), [])
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
  const palettes = [entry(), entry({ name: 'miku', catalog: 'Vocaloid', ansiSource: 'vauxe Miku' })]
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
  assert.deepEqual(
    search(palettes, 'vauxemiku').map((p) => p.name),
    ['miku'],
  )
})

test('booruTags finds the booru tags that hold what was typed, this palette and its series first', () => {
  const suzuha = entry({ name: 'suzuha', catalog: 'Steins;Gate', booru: 'amane_suzuha' })
  const ruka = entry({ name: 'ruka', catalog: 'Steins;Gate', booru: 'urushibara_ruka' })
  const lulu = entry({ name: 'lulu', catalog: 'Hololive', booru: 'suzuhara_lulu' })
  const none = entry({ name: 'none', catalog: 'Steins;Gate' })
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
  assert.equal(
    parseCatalog(catalogJson([entry({ name: 'kec@dust/rei', base: 'gojo' })])).palettes[0]?.name,
    'kec@dust/rei',
  )
})

test('gateFailures measures an entry that carries no gate', () => {
  const { gate: _, ...bare } = entry({ foreground: '#20282c' })
  assert.match(gateFailures(bare as PaletteEntry)[0] ?? '', /foreground on background/)
})

test('readCatalog puts each added marketplace after the series under its own name, and available adds local marketplaces and kept ones', () => {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-available-'))
  const skeleton = {
    schema: SCHEMA,
    version: '0.1.0',
    gate: [],
  }
  const local = join(home, 'mine')
  mkdirSync(join(home, 'ttheme', 'marketplaces'), { recursive: true })
  mkdirSync(join(local, 'palettes'), { recursive: true })
  writeFileSync(
    join(home, 'ttheme', 'installed.json'),
    JSON.stringify({ terminals: [], palettes: [], marketplaces: ['official', 'ann/ttheme-pastel', local] }),
  )
  writeCatalog(home, { ...skeleton, palettes: [entry({ name: 'gojo' }), entry({ name: 'geto', order: 2 })] })
  writeFileSync(
    join(home, 'ttheme', 'marketplaces', 'ann--ttheme-pastel.json'),
    JSON.stringify({
      files: {
        'ttheme-marketplace.toml': 'name = "pastel"\n\n[owner]\nname = "someone"\n',
        'palettes/old.toml': paletteToml({
          name: 'old',
          base: 'gojo',
          signature: ['cursor', 'foreground', 'background'],
          background: '#101010',
          foreground: '#f0f0f0',
          cursor: '#e0c060',
          selection: '#303060',
          ansi: Array.from({ length: 16 }, () => '#808080'),
        }),
        'palettes/broken.toml': 'not toml at all',
      },
    }),
  )
  writeFileSync(join(local, 'ttheme-marketplace.toml'), 'name = "dust"\n\n[owner]\nname = "kec"\n')
  writeFileSync(
    join(local, 'palettes', 'rei.toml'),
    paletteToml({
      name: 'kec@dust/rei',
      base: 'gojo',
      signature: ['cursor', 'foreground', 'background'],
      background: '#101010',
      foreground: '#f0f0f0',
      cursor: '#e0c060',
      selection: '#303060',
      ansi: Array.from({ length: 16 }, () => '#808080'),
    }),
  )
  writeKept(home, [entry({ name: 'bob@x/gone' })])
  const catalog = readCatalog(home)
  assert.deepEqual(
    catalog.palettes.map((p) => [p.name, shelfOf(p)]),
    [
      ['gojo', 'Jujutsu Kaisen'],
      ['geto', 'Jujutsu Kaisen'],
      ['ann@pastel/old', 'ann@pastel'],
    ],
  )
  const all = available(home, catalog).palettes
  assert.deepEqual(
    all.map((p) => p.name),
    ['gojo', 'geto', 'ann@pastel/old', 'kec@dust/rei', 'bob@x/gone'],
  )
  assert.equal(shelfOf(all.find((p) => p.name === 'kec@dust/rei') ?? { name: '' }), 'kec@dust')
})

test("a marketplace names itself in ttheme-marketplace.toml — the owner of an added one is its repository's", () => {
  const archive = (text: string) => ({ files: { 'ttheme-marketplace.toml': text } })
  const marketplace = (rest: string) =>
    archive(`"$schema" = "https://www.schemastore.org/ttheme-marketplace.json"\n${rest}`)
  assert.equal(archiveId('ann/ttheme-pastel', marketplace('name = "pastel"\n\n[owner]\nname = "bob"\n')), 'ann@pastel')
  assert.deepEqual(
    archiveInfo(
      'ann/ttheme-pastel',
      marketplace(
        'name = "pastel"\ndescription = "Soft colors"\nforce_remove_deleted_palettes = true\n\n[owner]\nname = "ann"\nurl = "https://github.com/ann"\n\n[[catalog]]\nname = "night"\nnative = "夜"\nlead = "dusk"\n\n[renames]\nold = "new"\ngone = false\n\n[metadata]\nmine = 1\n',
      ),
    ),
    {
      owner: 'ann',
      name: 'pastel',
      about: { name: 'ann', url: 'https://github.com/ann' },
      description: 'Soft colors',
      catalogs: [{ name: 'night', native: '夜', lead: 'dusk' }],
      renames: { old: 'new', gone: false },
      forceRemove: true,
    },
  )
  assert.throws(() => archiveId('ann/ttheme-pastel', { files: {} }), /has no ttheme-marketplace\.toml/)
  assert.throws(
    () => archiveId('ann/ttheme-pastel', marketplace('name = "pastel"\nowner = "ann"\n')),
    /owner is a table/,
  )
  assert.throws(() => archiveId('ann/ttheme-pastel', marketplace('name = "pastel"\n')), /owner is a table/)
  assert.throws(
    () =>
      archiveId('ann/ttheme-pastel', marketplace('name = "pastel"\n\n[owner]\nname = "ann"\n\n[renames]\nold = 3\n')),
    /renames\.old/,
  )
})
