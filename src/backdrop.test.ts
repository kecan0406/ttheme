import assert from 'node:assert/strict'
import { test } from 'node:test'

import { backdropTone, type Colors, coverBox, fillBox, headAnchor, toneFor } from './backdrop.ts'

const KAGAMI: Colors = {
  name: 'kagami',
  background: '#19161e',
  foreground: '#e8dff1',
  cursor: '#9b86c8',
  ansi: [
    '#25222a',
    '#d58c98',
    '#76b4c9',
    '#f7a895',
    '#9099f2',
    '#b49cd1',
    '#70b8e8',
    '#cbc4cf',
    '#7a757f',
    '#ffa3e6',
    '#97d5eb',
    '#ffd3c8',
    '#b0bff9',
    '#d4bbfe',
    '#a2d8ff',
    '#f4eafd',
  ],
}

test('kagami at 0.2 is the brightness every other palette is matched to', () => {
  assert.equal(toneFor(KAGAMI, 'cursor').opacity, 0.2)
})

test('the tint stays on the cursor while it leaves a visible opacity', () => {
  assert.equal(backdropTone(KAGAMI, ['cursor', 'ansi4', 'ansi1']).slot, 'cursor')
})

test('a cursor too faint to show moves the tint to the signature slot that shows most, not the darkest', () => {
  const tight = { ...KAGAMI, name: 'tight', foreground: '#b4b0b8', cursor: '#ffffff' }
  assert.ok(toneFor(tight, 'cursor').opacity < 0.1)
  assert.equal(toneFor(tight, 'ansi0').opacity, 1)
  assert.equal(backdropTone(tight, ['cursor', 'ansi0', 'ansi4']).slot, 'ansi4')
})

test('a tall figure keeps its head: the fill starts a little below the top of the figure', () => {
  const tall = { x: 10, y: 20, w: 1000, h: 3000 }
  const crop = fillBox(tall, 2560, 1550, headAnchor(tall))
  assert.equal(crop.w, tall.w)
  assert.ok(Math.abs(crop.h - (1000 * 1550) / 2560) < 1e-9)
  assert.ok(Math.abs(crop.y - (tall.y + 0.15 * crop.h)) < 1e-9)
})

test('the anchor lands where kagami was measured by hand on a bust-up', () => {
  assert.equal(Math.round(headAnchor({ x: 49, y: 10, w: 2045, h: 1994 }) * 100), 40)
})

test('a figure wider than the fill keeps its full height and centers horizontally', () => {
  const wide = { x: 0, y: 0, w: 4000, h: 1000 }
  const crop = fillBox(wide, 2560, 1550, headAnchor(wide))
  assert.equal(crop.h, 1000)
  assert.ok(Math.abs(crop.x + crop.w / 2 - 2000) < 1e-9)
})

test('the try-on crops the fill the way ghostty covers a window of another shape', () => {
  const fill = { x: 0, y: 0, w: 2560, h: 1550 }
  const tall = coverBox(fill, 1000, 1000)
  assert.deepEqual([tall.w, tall.h, tall.x], [1550, 1550, 505])
  const wide = coverBox(fill, 3000, 1000)
  assert.ok(Math.abs(wide.h - 2560 / 3) < 1e-9)
  assert.ok(Math.abs(wide.y - (1550 - 2560 / 3) / 2) < 1e-9)
})
