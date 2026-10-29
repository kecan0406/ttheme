import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { shelfOf, type Work } from '../core/commons.ts'
import { paletteToml } from '../core/draft.ts'
import { type PaletteEntry, parseBuiltin } from '../core/manifest.ts'
import { grow, SEEDS } from '../core/seeds.ts'
import { setText } from '../core/sets.ts'
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
    name: 'ttheme/tamsin',
    subject: 'tidewater/tamsin',
    background: '#11191c',
    foreground: '#e3e2e7',
    cursor: '#7cc1d6',
    selection: '#383b5b',
    ansi: Array.from({ length: 16 }, () => '#808080'),
    gate: [13.8, 6.8, 0.02, 10.4, 4.0],
    backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
    ...partial,
  }
}

const TIDEWATER: Work = {
  id: 'tidewater',
  name: 'Tidewater',
  native: '潮汐',
  characters: [{ id: 'tamsin', native: ['白砂環'], danbooru: 'tamsin_(tidewater)' }, { id: 'bram' }],
}

const STARFALL: Work = { id: 'starfall', name: 'Starfall', characters: [{ id: 'orla', danbooru: 'orla_(starfall)' }] }

function builtinJson(palettes: PaletteEntry[]): string {
  return JSON.stringify({ version: '0.1.0', gate: [], palettes })
}

test('parseBuiltin rejects a document without its version, gate or palettes, and text that is not JSON', () => {
  assert.throws(() => parseBuiltin('{"version":"0.1.0","gate":[]}'), /no version, gate or palettes/)
  assert.throws(() => parseBuiltin('<html>'), /not valid JSON/)
  assert.throws(() => parseBuiltin(builtinJson([entry({ ansi: ['#808080'] })])), /16 ANSI colors/)
  assert.equal(parseBuiltin(builtinJson([entry()])).palettes[0]?.name, 'ttheme/tamsin')
})

test('parseBuiltin refuses an entry whose name or subject would reach a path or a config line', () => {
  assert.throws(() => parseBuiltin(builtinJson([entry({ name: '../../x' })])), /lowercase letters/)
  assert.throws(() => parseBuiltin(builtinJson([entry({ name: 'tamsin' })])), /lowercase letters/)
  assert.throws(() => parseBuiltin(builtinJson([entry({ subject: '../x' })])), /names the subject/)
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
  writeFileSync(join(at, 'ttheme', 'commons.json'), JSON.stringify({ works: [] }))
  assert.throws(() => readMarketplaces(at, false), /no version, gate or palettes/)
  const bundled = { builtin: parseBuiltin(builtinJson([entry()])), commons: { works: [TIDEWATER] } }
  const read = readMarketplaces(at, false, bundled)
  assert.deepEqual(
    read.palettes.map((p) => p.name),
    ['ttheme/tamsin'],
  )
  assert.deepEqual(
    read.works.map((w) => w.id),
    ['tidewater'],
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
  assert.equal(view.get('ttheme/tamsin')?.background, '#000000')
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
    ...partial,
  })
}

test('gateFailures is empty when every rule is met', () => {
  assert.deepEqual(gateFailures(gated()), [])
})

test('gateFailures reports a value above its maximum', () => {
  const ansi = seeded.ansi.map((hex, i) => (i === 0 ? '#9aa0aa' : hex))
  assert.match(gateFailures(gated({ ansi })).join('\n'), /ansi0 luminance \d+\.\d+ ≤ 0\.15/)
})

test('gateFailures measures the colors, never a gate stored before the rules it holds now', () => {
  const stale = gated({ foreground: '#3a4150', gate: [13.8, 6.8, 0.02, 10.4, 4.0] })
  assert.match(gateFailures(stale)[0] ?? '', /^foreground on background \d+\.\d+ ≥ 7$/)
})

test('search matches the palette, its work and its character’s names', () => {
  const works = [TIDEWATER, STARFALL]
  const palettes = [entry(), entry({ name: 'ttheme/orla', subject: 'starfall/orla' })]
  const found = (query: string) => search(palettes, works, query).map((p) => p.name)
  assert.deepEqual(found('tidewater'), ['ttheme/tamsin'])
  assert.deepEqual(found('潮'), ['ttheme/tamsin'])
  assert.deepEqual(found('白砂'), ['ttheme/tamsin'])
  assert.deepEqual(found('starfall'), ['ttheme/orla'])
})

test('booruTags finds the characters whose danbooru tag holds what was typed, this palette and its work first', () => {
  const works: Work[] = [
    {
      id: 'moon-tide',
      name: 'Moon;Tide',
      characters: [
        { id: 'quill', danbooru: 'quill_(moon_tide)' },
        { id: 'juno', danbooru: 'juno_(moon_tide)' },
        { id: 'none' },
      ],
    },
    { id: 'lantern-row', name: 'Lantern Row!', characters: [{ id: 'pip', danbooru: 'pip_quill' }] },
  ]

  const at = (slug: string, work: string) => entry({ name: `ttheme/${slug}`, subject: `${work}/${slug}` })
  const quill = at('quill', 'moon-tide')
  const juno = at('juno', 'moon-tide')
  const pip = at('pip', 'lantern-row')
  const none = at('none', 'moon-tide')
  assert.deepEqual(
    booruTags([pip, juno, none, quill], works, quill, 'QUIL').map((p) => p.name),
    ['ttheme/quill', 'ttheme/pip'],
  )
  assert.deepEqual(
    booruTags([pip, juno, quill], works, juno, 'u').map((p) => p.name),
    ['ttheme/juno', 'ttheme/quill', 'ttheme/pip'],
  )
})

test('a palette typed without its marketplace is the one palette of that name, the installed one when there are several', () => {
  const palettes = [entry({ name: 'ttheme/wren' }), entry({ name: 'kai@dust/wren' }), entry({ name: 'ttheme/pip' })]
  assert.equal(find(palettes, 'kai@dust/wren').name, 'kai@dust/wren')
  assert.equal(find(palettes, 'pip').name, 'ttheme/pip')
  assert.equal(find(palettes, 'wren', ['kai@dust/wren']).name, 'kai@dust/wren')
  assert.throws(() => find(palettes, 'wren'), /wren is ttheme\/wren, kai@dust\/wren — name the one you mean/)
  assert.throws(() => find(palettes, 'wren', ['ttheme/wren', 'kai@dust/wren']), /name the one you mean/)
  assert.throws(() => find(palettes, 'orla'), /no palette named orla/)
})

test('readMarketplaces lays the built-in palettes, each added marketplace and the works together, and available adds local marketplaces, their works and kept palettes', () => {
  const local = mkdtempSync(join(tmpdir(), 'ttheme-mine-'))
  const at = home(['ttheme', 'ann/ttheme-pastel', local])

  const own = (name: string, subject?: string) =>
    paletteToml({
      name,
      subject,
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
      palettes: [entry(), entry({ name: 'ttheme/bram', subject: 'tidewater/bram' })],
    },
    commons: { works: [TIDEWATER] },
  })

  writeFileSync(
    join(at, 'ttheme', 'marketplaces', 'ann--ttheme-pastel.json'),
    JSON.stringify({
      files: {
        'ttheme-marketplace.toml': 'name = "pastel"\n\n[owner]\nname = "someone"\n',
        'sets/pastel.toml': setText([{ slug: 'old', text: own('ann@pastel/old', 'pastel/old') }]),
        'sets/ebb.toml': setText([{ slug: 'fan', text: own('ann@pastel/fan', 'tidewater/tamsin') }]),
        'sets/night/deep.toml': setText([{ slug: 'deep', text: own('ann@pastel/deep') }]),
        'sets/broken.toml': 'not toml at all',
        'works/pastel.toml': 'name = "Pastel"\n[[character]]\nid = "old"\n',
        'works/tidewater.toml': 'name = "Tide"\n[[character]]\nid = "quill"\n',
      },
    }),
  )

  mkdirSync(join(local, 'sets'))
  mkdirSync(join(local, 'works'))
  writeFileSync(join(local, 'ttheme-marketplace.toml'), 'name = "dust"\n\n[owner]\nname = "kai"\n')
  writeFileSync(
    join(local, 'sets', 'starfall.toml'),
    setText([{ slug: 'wren', text: own('kai@dust/wren', 'starfall/wren') }]),
  )
  writeFileSync(join(local, 'works', 'starfall.toml'), 'name = "Starfall"\n[[character]]\nid = "wren"\n')
  writeKept(at, [entry({ name: 'bob@x/gone', subject: undefined })])
  const manifest = readMarketplaces(at)
  assert.deepEqual(
    manifest.palettes.map((p) => [p.name, shelfOf(p, manifest.works)]),
    [
      ['ttheme/tamsin', 'ttheme / Tidewater'],
      ['ttheme/bram', 'ttheme / Tidewater'],
      ['ann@pastel/fan', 'ann@pastel / Tidewater'],
      ['ann@pastel/old', 'ann@pastel / Pastel'],
    ],
  )
  assert.equal(manifest.works.find((w) => w.id === 'tidewater')?.name, 'Tidewater')
  assert.deepEqual(
    manifest.works.find((w) => w.id === 'tidewater')?.characters.map((c) => c.id),
    ['tamsin', 'bram', 'quill'],
  )
  const all = available(at, manifest)
  assert.deepEqual(
    all.palettes.map((p) => p.name),
    ['ttheme/tamsin', 'ttheme/bram', 'ann@pastel/fan', 'ann@pastel/old', 'kai@dust/wren', 'bob@x/gone'],
  )
  assert.equal(
    shelfOf(all.palettes.find((p) => p.name === 'kai@dust/wren') ?? { name: '' }, all.works),
    'kai@dust / Starfall',
  )
  assert.equal(shelfOf(all.palettes.find((p) => p.name === 'bob@x/gone') ?? { name: '' }, all.works), 'bob@x')
})

test('without the built-in marketplace among the sources its palettes are gone but the works stay', () => {
  const at = home(['ann/ttheme-pastel'])
  writeBundled(at, {
    builtin: { version: '0.1.0', gate: [], palettes: [entry()] },
    commons: { works: [TIDEWATER] },
  })
  const manifest = readMarketplaces(at, false)
  assert.deepEqual(manifest.palettes, [])
  assert.deepEqual(
    manifest.works.map((w) => w.id),
    ['tidewater'],
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
      marketplace('name = "pastel"\ndescription = "Soft colors"\n\n[owner]\nname = "ann"\n'),
    ),
    {
      owner: 'ann',
      name: 'pastel',
      description: 'Soft colors',
    },
  )
  assert.throws(() => archiveId('ann/ttheme-pastel', { files: {} }), /has no ttheme-marketplace\.toml/)
  assert.throws(
    () => archiveId('ann/ttheme-pastel', marketplace('name = "pastel"\nowner = "ann"\n')),
    /owner is a table/,
  )
  assert.throws(() => archiveId('ann/ttheme-pastel', marketplace('name = "pastel"\n')), /owner is a table/)
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
