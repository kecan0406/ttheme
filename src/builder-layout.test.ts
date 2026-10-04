import assert from 'node:assert/strict'
import { test } from 'node:test'
import { firstSpot, layoutOf, linesOf, moveSpot, STRIP_ID, slotsAt, usesSlot } from './builder-layout.ts'

test('the layout takes every pane at 130×38, one scene at 96×28, and nothing below', () => {
  assert.equal(layoutOf(140, 40, 0)?.tier, 'full')
  assert.deepEqual(
    layoutOf(140, 40, 0)?.tiles.map((t) => t.id),
    [STRIP_ID, 'shell', 'code', 'diff', 'logs', 'monitor'],
  )
  assert.equal(layoutOf(100, 30, 0)?.tier, 'tabs')
  assert.equal(layoutOf(100, 30, 3)?.tiles[0]?.id, 'logs')
  assert.equal(layoutOf(95, 30, 0), undefined)
  assert.equal(layoutOf(120, 24, 0), undefined)
})

test('the panes stay inside the window and the last one ends above the footer', () => {
  for (const [cols, rows] of [
    [130, 38],
    [140, 40],
    [200, 60],
  ] as const) {
    const layout = layoutOf(cols, rows, 0)
    for (const tile of layout?.tiles ?? []) {
      assert.ok(tile.col + tile.width <= cols)
      assert.ok(tile.row + tile.rows <= rows - 1)
    }
  }
})

test('a role names the slots it draws with, and underlines only the slot it is', () => {
  assert.equal(usesSlot('1', 5), true)
  assert.equal(usesSlot('B1', 5), true)
  assert.equal(usesSlot('K1', 5), true)
  assert.equal(usesSlot('K1', 4), false)
  assert.equal(usesSlot('s', 3), true)
  assert.equal(usesSlot('c', 2), true)
  assert.equal(usesSlot('d', 1), false)
})

test('firstSpot finds a use of the slot outside the ANSI strip, and moveSpot walks the runs', () => {
  const layout = layoutOf(140, 40, 0)
  assert.ok(layout)
  const red = firstSpot(layout, 5)
  assert.ok(red && red.pane !== STRIP_ID)
  const here = slotsAt(layout, red)
  assert.equal(here?.text, 5)
  const next = moveSpot(layout, red, 'right')
  assert.notDeepEqual(next, red)
  const down = moveSpot(layout, red, 'down')
  assert.ok(down && (down.pane !== red.pane || down.line > red.line))
  const lines = linesOf('shell', 'full', 46)
  assert.ok(lines.length > 0)
})
