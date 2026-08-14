import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'

import pkg from '../../package.json' with { type: 'json' }
import { loadThemes } from '../theme.ts'
import { manifest } from './manifest.ts'

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
