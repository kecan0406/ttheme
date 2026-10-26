import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { shelfOf, type Work } from '../core/commons.ts'
import { paletteToml } from '../core/draft.ts'
import { type PaletteEntry, parseBuiltin } from '../core/manifest.ts'
import { grow, SEEDS } from '../core/seeds.ts'
import {
  archiveId,
  archiveInfo,
  available,
  booruTags,
  find,
  gateFailures,
  readKept,
  readMarketplaces,
  search,
  untuned,
  updatesOf,
  writeBundled,
  writeKept,
} from './available.ts'

function entry(partial: Partial<PaletteEntry> = {}): PaletteEntry {
  return {
    name: 'ttheme/gojo',
    subject: 'jujutsu-kaisen/gojo',
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

const JJK: Work = {
  id: 'jujutsu-kaisen',
  name: 'Jujutsu Kaisen',
  native: '呪術廻戦',
  characters: [{ id: 'gojo', native: ['五条悟'], danbooru: 'gojou_satoru' }, { id: 'geto' }],
}

const VOCALOID: Work = { id: 'vocaloid', name: 'Vocaloid', characters: [{ id: 'miku', danbooru: 'hatsune_miku' }] }

function builtinJson(palettes: PaletteEntry[]): string {
  return JSON.stringify({ version: '0.1.0', gate: [], palettes })
}

test('parseBuiltin rejects a document without its version, gate or palettes, and text that is not JSON', () => {
  assert.throws(() => parseBuiltin('{"version":"0.1.0","gate":[]}'), /no version, gate or palettes/)
  assert.throws(() => parseBuiltin('<html>'), /not valid JSON/)
  assert.throws(() => parseBuiltin(builtinJson([entry({ ansi: ['#808080'] })])), /16 ANSI colors/)
  assert.equal(parseBuiltin(builtinJson([entry()])).palettes[0]?.name, 'ttheme/gojo')
})

test('parseBuiltin refuses an entry whose name, subject or text would reach a path or a config line', () => {
  assert.throws(() => parseBuiltin(builtinJson([entry({ name: '../../x' })])), /lowercase letters/)
  assert.throws(() => parseBuiltin(builtinJson([entry({ name: 'gojo' })])), /lowercase letters/)
  assert.throws(() => parseBuiltin(builtinJson([entry({ subject: '../x' })])), /names the subject/)
  assert.throws(() => parseBuiltin(builtinJson([entry({ ansiSource: 'x\ncommand = rm' })])), /control character/)
  assert.throws(() => parseBuiltin(builtinJson([entry({ background: 'red' })])), /#rrggbb/)
})

function home(sources: string[] = ['ttheme']): string {
  const at = mkdtempSync(join(tmpdir(), 'ttheme-available-'))
  mkdirSync(join(at, 'ttheme', 'marketplaces'), { recursive: true })
  writeFileSync(
    join(at, 'ttheme', 'installed.json'),
    JSON.stringify({ terminals: [], palettes: [], marketplaces: sources }),
  )

  return at
}

test('readMarketplaces can take the bundled palettes and works, so an upgrade never parses the copies it is about to replace', () => {
  const at = home()
  writeFileSync(join(at, 'ttheme', 'builtin.json'), JSON.stringify({ palettes: 'another shape' }))
  writeFileSync(join(at, 'ttheme', 'commons.json'), JSON.stringify({ works: [], renames: {} }))
  assert.throws(() => readMarketplaces(at, false), /no version, gate or palettes/)
  const bundled = { builtin: parseBuiltin(builtinJson([entry()])), commons: { works: [JJK], renames: {} } }
  const read = readMarketplaces(at, false, bundled)
  assert.deepEqual(
    read.palettes.map((p) => p.name),
    ['ttheme/gojo'],
  )
  assert.deepEqual(
    read.works.map((w) => w.id),
    ['jujutsu-kaisen'],
  )
})

test('an installed palette from a marketplace keeps its colors until its update is taken but takes its marketplace’s subject, while a built-in one follows the bundle', () => {
  const at = home()
  const was = [entry({ name: 'ann@pastel/dusk', subject: 'pastel/dusk' }), entry()]
  writeKept(at, was)
  const moved = { background: '#000000' }

  const manifest = {
    version: '0.1.0',
    gate: [],
    works: [],
    palettes: [
      entry({ name: 'ann@pastel/dusk', subject: 'pastel/dawn', ...moved }),
      entry(moved),
      entry({ name: 'ann@pastel/dawn', ...moved }),
    ],
  }

  const view = new Map(untuned(at, manifest, false).palettes.map((e) => [e.name, e]))
  assert.equal(view.get('ann@pastel/dusk')?.background, '#11191c')
  assert.equal(view.get('ann@pastel/dusk')?.subject, 'pastel/dawn')
  assert.equal(view.get('ttheme/gojo')?.background, '#000000')
  assert.equal(view.get('ann@pastel/dawn')?.background, '#000000')
  assert.deepEqual(
    updatesOf(at, manifest).map((e) => e.name),
    ['ann@pastel/dusk'],
  )
  writeKept(at, [manifest.palettes[0] as PaletteEntry, was[1] as PaletteEntry])
  assert.deepEqual(updatesOf(at, manifest), [])
})

const seeded = grow(SEEDS)

function gated(partial: Partial<PaletteEntry> = {}): PaletteEntry {
  return entry({
    background: seeded.background,
    foreground: seeded.foreground,
    cursor: seeded.cursor,
    selection: seeded.selection,
    ansi: seeded.ansi,
    signature: [seeded.background, seeded.foreground, seeded.cursor],
    signatureSlots: ['background', 'foreground', 'cursor'],
    ...partial,
  })
}

test('gateFailures is empty when every rule is met', () => {
  assert.deepEqual(gateFailures(gated()), [])
})

test('gateFailures reports a ratio below its minimum', () => {
  assert.match(gateFailures(gated({ foreground: '#3a4150' }))[0] ?? '', /^foreground on background \d+\.\d+ ≥ 7$/)
})

test('gateFailures reports a value above its maximum', () => {
  const ansi = seeded.ansi.map((hex, i) => (i === 0 ? '#9aa0aa' : hex))
  assert.match(gateFailures(gated({ ansi })).join('\n'), /ansi0 luminance \d+\.\d+ ≤ 0\.15/)
})

test('gateFailures honours a waiver by rule name', () => {
  const failures = gateFailures(gated({ foreground: '#3a4150', waived: ['foreground'] }))
  assert.ok(!failures.some((line) => line.startsWith('foreground on background')))
})

test('gateFailures measures the colors, never a gate stored before the rules it holds now', () => {
  const stale = gated({ foreground: '#3a4150', gate: [13.8, 6.8, 0.02, 10.4, 4.0] })
  assert.match(gateFailures(stale)[0] ?? '', /^foreground on background/)
})

test('gateFailures measures an entry that carries no gate', () => {
  const { gate: _, ...bare } = entry({ foreground: '#20282c' })
  assert.match(gateFailures(bare as PaletteEntry)[0] ?? '', /foreground on background/)
})

test('search matches the palette, its work, its character’s names and the ANSI source', () => {
  const works = [JJK, VOCALOID]
  const palettes = [entry(), entry({ name: 'ttheme/miku', subject: 'vocaloid/miku', ansiSource: 'vauxe Miku' })]
  const found = (query: string) => search(palettes, works, query).map((p) => p.name)
  assert.deepEqual(found('jujutsu'), ['ttheme/gojo'])
  assert.deepEqual(found('呪術'), ['ttheme/gojo'])
  assert.deepEqual(found('五条'), ['ttheme/gojo'])
  assert.deepEqual(found('vocaloid'), ['ttheme/miku'])
  assert.deepEqual(found('vauxemiku'), ['ttheme/miku'])
})

test('booruTags finds the characters whose danbooru tag holds what was typed, this palette and its work first', () => {
  const works: Work[] = [
    {
      id: 'steins-gate',
      name: 'Steins;Gate',
      characters: [
        { id: 'suzuha', danbooru: 'amane_suzuha' },
        { id: 'ruka', danbooru: 'urushibara_ruka' },
        { id: 'none' },
      ],
    },
    { id: 'hololive', name: 'Hololive', characters: [{ id: 'lulu', danbooru: 'suzuhara_lulu' }] },
  ]

  const at = (slug: string, work: string) => entry({ name: `ttheme/${slug}`, subject: `${work}/${slug}` })
  const suzuha = at('suzuha', 'steins-gate')
  const ruka = at('ruka', 'steins-gate')
  const lulu = at('lulu', 'hololive')
  const none = at('none', 'steins-gate')
  assert.deepEqual(
    booruTags([lulu, ruka, none, suzuha], works, suzuha, 'SUZU').map((p) => p.name),
    ['ttheme/suzuha', 'ttheme/lulu'],
  )
  assert.deepEqual(
    booruTags([lulu, ruka, suzuha], works, ruka, 'u').map((p) => p.name),
    ['ttheme/ruka', 'ttheme/suzuha', 'ttheme/lulu'],
  )
})

test('a palette typed without its marketplace is the one palette of that name, the installed one when there are several', () => {
  const palettes = [entry({ name: 'ttheme/rei' }), entry({ name: 'kec@dust/rei' }), entry({ name: 'ttheme/miku' })]
  assert.equal(find(palettes, 'kec@dust/rei').name, 'kec@dust/rei')
  assert.equal(find(palettes, 'miku').name, 'ttheme/miku')
  assert.equal(find(palettes, 'rei', ['kec@dust/rei']).name, 'kec@dust/rei')
  assert.throws(() => find(palettes, 'rei'), /rei is ttheme\/rei, kec@dust\/rei — name the one you mean/)
  assert.throws(() => find(palettes, 'rei', ['ttheme/rei', 'kec@dust/rei']), /name the one you mean/)
  assert.throws(() => find(palettes, 'asuka'), /no palette named asuka/)
})

test('readMarketplaces lays the built-in palettes, each added marketplace and the works together, and available adds local marketplaces, their works and kept palettes', () => {
  const local = mkdtempSync(join(tmpdir(), 'ttheme-mine-'))
  const at = home(['ttheme', 'ann/ttheme-pastel', local])

  const own = (name: string, subject?: string) =>
    paletteToml({
      name,
      subject,
      signature: ['cursor', 'foreground', 'background'],
      background: '#101010',
      foreground: '#f0f0f0',
      cursor: '#e0c060',
      selection: '#303060',
      ansi: Array.from({ length: 16 }, () => '#808080'),
    })

  writeBundled(at, {
    builtin: {
      version: '0.1.0',
      gate: [],
      palettes: [entry(), entry({ name: 'ttheme/geto', subject: 'jujutsu-kaisen/geto' })],
    },
    commons: { works: [JJK], renames: { 'jjk/gojo': 'jujutsu-kaisen/gojo' } },
  })

  writeFileSync(
    join(at, 'ttheme', 'marketplaces', 'ann--ttheme-pastel.json'),
    JSON.stringify({
      files: {
        'ttheme-marketplace.toml': 'name = "pastel"\n\n[owner]\nname = "someone"\n',
        'palettes/old.toml': own('ann@pastel/old', 'pastel/old'),
        'palettes/fan.toml': own('ann@pastel/fan', 'jjk/gojo'),
        'palettes/night/deep.toml': own('ann@pastel/deep'),
        'palettes/broken.toml': 'not toml at all',
        'works/pastel.toml': 'name = "Pastel"\n[[character]]\nid = "old"\n',
        'works/jujutsu-kaisen.toml': 'name = "JJK"\n[[character]]\nid = "yuji"\n',
      },
    }),
  )

  mkdirSync(join(local, 'palettes'))
  mkdirSync(join(local, 'works'))
  writeFileSync(join(local, 'ttheme-marketplace.toml'), 'name = "dust"\n\n[owner]\nname = "kec"\n')
  writeFileSync(join(local, 'palettes', 'rei.toml'), own('kec@dust/rei', 'evangelion/rei'))
  writeFileSync(join(local, 'works', 'evangelion.toml'), 'name = "Evangelion"\n[[character]]\nid = "rei"\n')
  writeKept(at, [entry({ name: 'bob@x/gone', subject: undefined })])
  const manifest = readMarketplaces(at)
  assert.deepEqual(
    manifest.palettes.map((p) => [p.name, shelfOf(p, manifest.works)]),
    [
      ['ttheme/gojo', 'ttheme / Jujutsu Kaisen'],
      ['ttheme/geto', 'ttheme / Jujutsu Kaisen'],
      ['ann@pastel/fan', 'ann@pastel / Jujutsu Kaisen'],
      ['ann@pastel/old', 'ann@pastel / Pastel'],
    ],
  )
  assert.equal(manifest.works.find((w) => w.id === 'jujutsu-kaisen')?.name, 'Jujutsu Kaisen')
  assert.deepEqual(
    manifest.works.find((w) => w.id === 'jujutsu-kaisen')?.characters.map((c) => c.id),
    ['gojo', 'geto', 'yuji'],
  )
  const all = available(at, manifest)
  assert.deepEqual(
    all.palettes.map((p) => p.name),
    ['ttheme/gojo', 'ttheme/geto', 'ann@pastel/fan', 'ann@pastel/old', 'kec@dust/rei', 'bob@x/gone'],
  )
  assert.equal(
    shelfOf(all.palettes.find((p) => p.name === 'kec@dust/rei') ?? { name: '' }, all.works),
    'kec@dust / Evangelion',
  )
  assert.equal(shelfOf(all.palettes.find((p) => p.name === 'bob@x/gone') ?? { name: '' }, all.works), 'bob@x')
})

test('without the built-in marketplace among the sources its palettes are gone but the works stay', () => {
  const at = home(['ann/ttheme-pastel'])
  writeBundled(at, {
    builtin: { version: '0.1.0', gate: [], palettes: [entry()] },
    commons: { works: [JJK], renames: {} },
  })
  const manifest = readMarketplaces(at, false)
  assert.deepEqual(manifest.palettes, [])
  assert.deepEqual(
    manifest.works.map((w) => w.id),
    ['jujutsu-kaisen'],
  )
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
        'name = "pastel"\ndescription = "Soft colors"\nforce_remove_deleted_palettes = true\n\n[owner]\nname = "ann"\nurl = "https://github.com/ann"\n\n[renames]\nold = "new"\ngone = false\n\n[metadata]\nmine = 1\n',
      ),
    ),
    {
      owner: 'ann',
      name: 'pastel',
      about: { name: 'ann', url: 'https://github.com/ann' },
      description: 'Soft colors',
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

test('a kept palette whose name or subject could not be one is left out, so share never copies it outside its marketplace', () => {
  const at = home()
  writeKept(at, [
    entry({ name: 'bob@x/alacritty', subject: '../../../../alacritty' }),
    entry({ name: 'gone' }),
    entry({ name: 'bob@x/kept' }),
  ])
  assert.deepEqual(
    readKept(at).map((p) => p.name),
    ['bob@x/kept'],
  )
})
