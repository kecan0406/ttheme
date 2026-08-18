import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'

import pkg from '../../package.json' with { type: 'json' }
import { loadThemes } from '../theme.ts'
import { manifest, type PaletteEntry } from './manifest.ts'

const { version, palettes: entries } = manifest(loadThemes(join(import.meta.dirname, '..', '..', 'themes')))

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
