import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paletteToml, readOwnText } from '../core/draft.ts'
import { paletteEntry } from '../core/manifest.ts'
import { modeOf } from '../core/mode.ts'
import type { Colors } from '../core/seeds.ts'
import { following, sidesOf } from '../core/upstream.ts'
import { clashOf, settled } from './upstreams.ts'

const ansi = Array.from({ length: 16 }, (_, i) => `#${(0x40 + i * 8).toString(16).repeat(3)}`)
const base: Colors = { background: '#6a6a6a', foreground: '#6e6e6e', cursor: '#ff8800', selection: '#303030', ansi }

test('settling a conflict on the background leaves the base in its mode, though its foreground has not moved', () => {
  const name = 'ann@pastel/wren'
  const mine = { ...base, background: '#020d12' }
  const theirs = { ...base, background: '#939393', foreground: '#f0f0f0' }
  const text = paletteToml({ name, upstream: { palette: 'ttheme/orla', colors: base }, ...mine })
  const entry = paletteEntry(readOwnText(name, text))
  const done = following(sidesOf(entry), { palette: 'ttheme/orla', colors: base }, { colors: theirs })

  assert.ok(done)
  assert.deepEqual(done.conflicts, [{ mode: 'dark', slots: [0] }])

  const clash = clashOf({ entry, theirs: { colors: theirs }, done }, mine)

  assert.ok(clash)
  assert.equal(modeOf(clash.base), 'dark')
  assert.equal(readOwnText(name, settled(text, clash)).upstream?.colors?.background, '#939393')
})
