import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'

import pkg from '../../package.json' with { type: 'json' }
import { loadThemes } from '../theme.ts'
import { manifest, type PaletteEntry } from './manifest.ts'

const {
  version,
  gate: rules,
  palettes: entries,
} = manifest(loadThemes(join(import.meta.dirname, '..', '..', 'themes')))

test('manifest states which build produced it', () => {
  assert.equal(version, pkg.version)
})

test('manifest carries every theme in display order', () => {
  assert.ok(entries.length > 0)
  const groupRuns = entries.filter((e, i) => e.group !== entries[i - 1]?.group).length
  assert.equal(groupRuns, new Set(entries.map((e) => e.group)).size, 'groups must be contiguous')
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

test('every group names one lead palette and one native title', () => {
  const groups = new Map<string, PaletteEntry[]>()
  for (const e of entries) {
    const members = groups.get(e.group)
    if (members) members.push(e)
    else groups.set(e.group, [e])
  }
  for (const [group, members] of groups) {
    assert.equal(members.filter((e) => e.lead).length, 1, `${group}: expected exactly one lead palette`)
    assert.equal(new Set(members.map((e) => e.native)).size, 1, `${group}: native title must match across the group`)
  }
})

test('manifest carries the booru tag find searches, and leaves it off palettes without a character', () => {
  const byName = new Map(entries.map((e) => [e.name, e]))
  assert.equal(byName.get('kagami')?.booru, 'hiiragi_kagami')
  assert.equal(byName.get('neutral')?.booru, undefined)
})
