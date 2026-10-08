import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'

import pkg from '../../package.json' with { type: 'json' }
import { parseManifest } from '../available.ts'
import { type Manifest, type PaletteEntry, SCHEMA, swatch } from '../manifest.ts'
import { loadThemes } from '../theme.ts'
import { manifest, type SchemaOneEntry, schemaOne } from './manifest.ts'

const published = manifest(loadThemes(join(import.meta.dirname, '..', '..', 'themes')))
const { schema, version, gate: rules, palettes: entries } = published
const pages = schemaOne(published)

test('manifest states which build produced it', () => {
  assert.equal(version, pkg.version)
})

test('manifest states the schema it is written in', () => {
  assert.equal(schema, SCHEMA)
})

type RequiredKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T]

const SCHEMA_1_FIELDS = {
  name: 1,
  group: 1,
  order: 1,
  ansiSource: 1,
  background: 1,
  foreground: 1,
  cursor: 1,
  selection: 1,
  signature: 1,
  signatureSlots: 1,
  ansi: 1,
  gate: 1,
  backdrop: 1,
} satisfies Record<RequiredKeys<SchemaOneEntry>, 1>

const SCHEMA_1_DOCUMENT = {
  schema: 1,
  version: 1,
  gate: 1,
  palettes: 1,
} satisfies Record<RequiredKeys<Manifest>, 1>

const SCHEMA_1_GATE = [
  'foreground',
  'accents',
  'ansi0-dark',
  'light-ansi',
  'ansi8-visible',
  'selection',
  'ansi-role',
  'bright-follows',
  'distinct',
]

test('every entry Pages serves keeps the fields a schema 1 reader needs — dropping or renaming one is a new SCHEMA', () => {
  for (const e of pages.palettes) {
    for (const field of Object.keys(SCHEMA_1_FIELDS)) {
      assert.ok(field in e, `${e.name}: ${field} is gone, so older ttheme would misread it — raise SCHEMA`)
    }
  }
})

test('the manifest Pages serves keeps the top-level fields a schema 1 reader needs — dropping or renaming one is a new SCHEMA', () => {
  for (const field of Object.keys(SCHEMA_1_DOCUMENT)) {
    assert.ok(field in pages, `${field} is gone, so older ttheme would misread the manifest — raise SCHEMA`)
  }
})

test('gate measurements keep the order schema 1 readers index them by — a new rule goes on the end', () => {
  assert.deepEqual(
    rules.slice(0, SCHEMA_1_GATE.length).map((rule) => rule.rule),
    SCHEMA_1_GATE,
  )
})

test('the manifest the build writes is one every reader accepts', () => {
  const read = parseManifest(JSON.stringify(published))
  assert.equal(read.schema, SCHEMA)
  assert.equal(read.palettes.length, entries.length)
})

test('manifest carries every theme in display order', () => {
  assert.ok(entries.length > 0)
  const runs = entries.filter((e, i) => e.catalog !== entries[i - 1]?.catalog).length
  assert.equal(runs, new Set(entries.map((e) => e.catalog)).size, 'catalogs must be contiguous')
})

test('manifest marks exactly one default palette', () => {
  assert.deepEqual(
    entries.filter((e) => e.default).map((e) => e.name),
    ['neutral'],
  )
})

test('manifest entries carry the full palette the picker renders and paints', () => {
  for (const e of entries) {
    assert.equal(e.ansi.length, 16, `${e.name}: expected 16 ansi colors`)
    for (const hex of [e.background, e.foreground, e.cursor, e.selection, ...e.ansi]) {
      assert.match(hex, /^#[0-9a-fA-F]{6}$/, `${e.name}: bad color ${hex}`)
    }
    assert.ok(e.ansiSource.length > 0, `${e.name}: missing ansiSource`)
  }
})

test('manifest carries a signature drawn from each palette', () => {
  for (const e of entries) {
    assert.equal(e.signature.length, 3, `${e.name}: expected 3 signature colors`)
    assert.equal(new Set(e.signature).size, 3, `${e.name}: signature colors must differ`)
    const palette = new Set([e.background, e.foreground, e.cursor, e.selection, ...e.ansi])
    for (const hex of e.signature) {
      assert.ok(palette.has(hex), `${e.name}: signature color ${hex} is not a slot of its own palette`)
    }
  }
})

test('manifest carries the signature slots each signature color was drawn from', () => {
  for (const e of entries) {
    assert.equal(e.signatureSlots.length, e.signature.length, `${e.name}: signature slots must match colors`)
    const slots = new Map<string, string>([
      ['background', e.background],
      ['foreground', e.foreground],
      ['cursor', e.cursor],
      ['selection', e.selection],
      ...e.ansi.map((hex, i): [string, string] => [`ansi${i}`, hex]),
    ])
    for (const [i, slot] of e.signatureSlots.entries()) {
      assert.equal(slots.get(slot), e.signature[i], `${e.name}: signature slot ${slot} does not hold its color`)
    }
  }
})

test('manifest publishes the gate every palette was measured against', () => {
  assert.ok(rules.length > 0)
  for (const rule of rules) {
    assert.ok(rule.min !== undefined || rule.max !== undefined, `${rule.rule}: needs a threshold`)
  }
  for (const e of entries) {
    assert.equal(e.gate.length, rules.length, `${e.name}: expected one measurement per gate rule`)
    for (const [i, rule] of rules.entries()) {
      if (e.waived?.includes(rule.rule)) continue
      const value = e.gate[i] as number
      if (rule.min !== undefined) {
        assert.ok(value >= rule.min, `${e.name}: ${rule.rule} measured ${value}, needs ${rule.min}`)
      }
      if (rule.max !== undefined) {
        assert.ok(value <= rule.max, `${e.name}: ${rule.rule} measured ${value}, needs at most ${rule.max}`)
      }
    }
  }
})

test('every catalog names one lead palette and one native title', () => {
  const catalogs = new Map<string | undefined, PaletteEntry[]>()
  for (const e of entries) {
    const members = catalogs.get(e.catalog)
    if (members) members.push(e)
    else catalogs.set(e.catalog, [e])
  }
  assert.ok(!catalogs.has(undefined), 'every official palette sits in a catalog')
  for (const [catalog, members] of catalogs) {
    assert.equal(members.filter((e) => e.lead).length, 1, `${catalog}: expected exactly one lead palette`)
    assert.equal(new Set(members.map((e) => e.native)).size, 1, `${catalog}: native title must match across it`)
  }
})

test('manifest carries the booru tag find searches, and leaves it off palettes without a character', () => {
  const byName = new Map(entries.map((e) => [e.name, e]))
  assert.equal(byName.get('kagami')?.booru, 'hiiragi_kagami')
  assert.equal(byName.get('neutral')?.booru, undefined)
})

test('a swatch shows six different colors: the foreground, the signature, then red and green', () => {
  for (const e of entries) {
    const colors = swatch(e)
    assert.equal(new Set(colors).size, 6, `${e.name}: ${colors.join(' ')}`)
    assert.equal(colors[0], e.foreground)
  }
  const ansi = Array.from({ length: 16 }, (_, i) => `#0000${i.toString(16).padStart(2, '0')}`)
  const twin = swatch({
    foreground: '#eeeeee',
    cursor: '#ff00ff',
    selection: '#333333',
    ansi,
    signatureSlots: ['cursor', 'foreground', 'ansi9'],
  })
  assert.deepEqual(twin, ['#eeeeee', '#ff00ff', ansi[9], ansi[2], ansi[4], ansi[3]])
})
