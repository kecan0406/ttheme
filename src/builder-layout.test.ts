import assert from 'node:assert/strict'
import { test } from 'node:test'
import { firstSpot, layoutOf, moveSpot, paneLines, slotsAt, usesSlot } from './builder-layout.ts'

test('the window shows one tab from 96×28, its side wider from 130×38, and nothing below', () => {
  assert.equal(layoutOf(140, 40, 0)?.tier, 'full')
  assert.deepEqual(
    layoutOf(140, 40, 0)?.tiles.map((t) => t.id),
    ['shell'],
  )
  assert.equal(layoutOf(100, 30, 0)?.tier, 'tabs')
  assert.equal(layoutOf(100, 30, 2)?.tiles[0]?.id, 'monitor')
  assert.equal(layoutOf(95, 30, 0), undefined)
  assert.equal(layoutOf(120, 24, 0), undefined)
})

test('the pane stays inside the window, which ends above the footer', () => {
  for (const [cols, rows] of [
    [130, 38],
    [140, 40],
    [200, 60],
  ] as const) {
    const layout = layoutOf(cols, rows, 0)
    assert.ok(layout)
    const inner = layout.inner
    for (const tile of layout.tiles) {
      assert.ok(tile.col >= inner.col && tile.col + tile.width <= inner.col + inner.cols)
      assert.ok(tile.row + tile.rows <= inner.row + inner.rows)
      assert.ok(paneLines(tile).length <= tile.rows)
    }
    assert.ok(inner.row + inner.rows < rows - 1)
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

test('firstSpot finds a use of the slot in a pane, and moveSpot walks the runs', () => {
  const layout = layoutOf(140, 40, 0)
  assert.ok(layout)
  const red = firstSpot(layout, 5)
  assert.ok(red && red.pane === 'shell')
  const here = slotsAt(layout, red)
  assert.equal(here?.text, 5)
  const next = moveSpot(layout, red, 'right')
  assert.notDeepEqual(next, red)
  const down = moveSpot(layout, red, 'down')
  assert.ok(down && (down.pane !== red.pane || down.line > red.line))
})

test('every ANSI color, the selection and the cursor show somewhere in the window', () => {
  for (const [cols, rows] of [
    [130, 38],
    [100, 30],
  ] as const) {
    const layout = layoutOf(cols, rows, 0)
    assert.ok(layout)
    for (let slot = 2; slot < 20; slot++) {
      const spot = firstSpot(layout, slot)
      assert.ok(spot && slotsAt(layout, spot) !== undefined)
      const shown = layout.tiles.flatMap((tile) => paneLines(tile).flat())
      assert.ok(
        shown.some((part) => usesSlot(part.role, slot)),
        `slot ${slot} at ${cols}×${rows}`,
      )
    }
  }
})

test('a pane hands out only the runs it has room to show, so the inspector never lands on one cut away', () => {
  for (const [cols, rows, scene] of [
    [96, 28, 1],
    [96, 28, 2],
    [118, 28, 2],
  ] as const) {
    const layout = layoutOf(cols, rows, scene)
    assert.ok(layout)
    for (const tile of layout.tiles) {
      for (const part of paneLines(tile).flat()) {
        assert.ok(part.col < tile.width - 2, `${tile.id} at ${cols}×${rows}: ${part.text} starts at ${part.col}`)
      }
    }
  }
})
