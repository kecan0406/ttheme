import assert from 'node:assert/strict'
import { test } from 'node:test'
import pkg from '../../package.json' with { type: 'json' }
import { aboutOf, leadOf, parseCommons } from '../core/commons.ts'
import { parseBuiltin, swatch } from '../core/manifest.ts'
import { BUILTIN_DIR, COMMONS_DIR, loadBuiltin, loadCommons } from './build.ts'
import { bundleJson, bundleOf, commonsJson } from './emit-manifest.ts'

const commons = loadCommons(COMMONS_DIR)
const { themes, fallback } = loadBuiltin(BUILTIN_DIR, commons)
const bundle = bundleOf(themes, fallback)
const { version, gate: rules, palettes: entries } = bundle

test('the built-in palettes state which build produced them', () => {
  assert.equal(version, pkg.version)
})

test('the built-in palettes and the commons the build writes are ones every reader accepts', () => {
  assert.equal(parseBuiltin(bundleJson(bundle)).palettes.length, entries.length)
  assert.deepEqual(parseCommons(commonsJson(commons)), commons)
})

test('the built-in palettes mark exactly one fallback palette, and it is of no work', () => {
  assert.deepEqual(
    entries.filter((e) => e.default).map((e) => [e.name, e.subject]),
    [['ttheme/neutral', undefined]],
  )
})

test('every built-in palette is of a work or a character the commons holds', () => {
  for (const e of entries) {
    if (e.subject !== undefined) {
      assert.equal(aboutOf(commons.works, e.subject)?.known, true, `${e.name}: ${e.subject}`)
    }
  }
})

test('every work that holds a built-in palette has its original-language title and a lead the commons holds', () => {
  const held = new Set(entries.flatMap((e) => (e.subject ? [aboutOf(commons.works, e.subject)?.work.id] : [])))

  for (const work of commons.works.filter((w) => held.has(w.id))) {
    assert.ok(work.native, `${work.id}: no native title`)
    assert.equal(aboutOf(commons.works, leadOf(work))?.known, true, `${work.id}: lead ${leadOf(work)}`)
  }
})

test('the commons carries the danbooru tag find searches, and a palette of a place or a thing, or of no work, has none', () => {
  const byName = new Map(entries.map((e) => [e.name, e]))
  const tag = (name: string) => aboutOf(commons.works, byName.get(name)?.subject)?.character?.danbooru
  assert.equal(tag('ttheme/kagami'), 'hiiragi_kagami')
  assert.equal(tag('ttheme/magi'), undefined)
  assert.equal(tag('ttheme/neutral'), undefined)
})

test('the built-in palettes carry the full palette the picker renders and paints', () => {
  for (const e of entries) {
    assert.equal(e.ansi.length, 16, `${e.name}: expected 16 ansi colors`)

    for (const hex of [e.background, e.foreground, e.cursor, e.selection, ...e.ansi]) {
      assert.match(hex, /^#[0-9a-fA-F]{6}$/, `${e.name}: bad color ${hex}`)
    }

    assert.ok(e.ansiSource.length > 0, `${e.name}: missing ansiSource`)
  }
})

test('the built-in palettes carry a signature drawn from each palette', () => {
  for (const e of entries) {
    assert.equal(e.signature.length, 3, `${e.name}: expected 3 signature colors`)
    assert.equal(new Set(e.signature).size, 3, `${e.name}: signature colors must differ`)
    const palette = new Set([e.background, e.foreground, e.cursor, e.selection, ...e.ansi])

    for (const hex of e.signature) {
      assert.ok(palette.has(hex), `${e.name}: signature color ${hex} is not a slot of its own palette`)
    }
  }
})

test('the built-in palettes carry the signature slots each signature color was drawn from', () => {
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

test('the built-in palettes publish the gate every palette was measured against', () => {
  assert.ok(rules.length > 0)

  for (const rule of rules) {
    assert.ok(rule.min !== undefined || rule.max !== undefined, `${rule.rule}: needs a threshold`)
  }

  for (const e of entries) {
    assert.equal(e.gate.length, rules.length, `${e.name}: expected one measurement per gate rule`)

    for (const [i, rule] of rules.entries()) {
      const value = e.gate[i] as number

      if (e.waived?.includes(rule.rule) || Number.isNaN(value)) continue

      if (rule.min !== undefined) {
        assert.ok(value >= rule.min, `${e.name}: ${rule.rule} measured ${value}, needs ${rule.min}`)
      }

      if (rule.max !== undefined) {
        assert.ok(value <= rule.max, `${e.name}: ${rule.rule} measured ${value}, needs at most ${rule.max}`)
      }
    }
  }
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
