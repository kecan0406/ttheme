import assert from 'node:assert/strict'
import { test } from 'node:test'

import { keepable, matte } from './cutout.ts'

test('a cut-out is kept only when it removed something and left something', () => {
  assert.equal(keepable(0), false, 'nothing removed')
  assert.equal(keepable(2), false)
  assert.equal(keepable(3), true)
  assert.equal(keepable(60), true)
  assert.equal(keepable(97), true)
  assert.equal(keepable(98), false, 'almost nothing left')
  assert.equal(keepable(100), false)
})

test("a cut-out's soft edge narrows, and what stays partly clear takes the color of the solid pixels beside it", () => {
  const row = (alphas: number[], colors: number[]) => ({
    width: alphas.length,
    height: 1,
    data: Uint8Array.from(alphas.flatMap((a, i) => [colors[i] ?? 0, 0, 0, a])),
  })
  const edge = matte(row([255, 230, 153, 100, 20], [10, 90, 160, 220, 250]))
  assert.deepEqual(
    [...edge.data].filter((_, at) => at % 4 === 3),
    [255, 255, 127, 0, 0],
  )
  assert.deepEqual(
    [...edge.data].filter((_, at) => at % 4 === 0),
    [10, 90, 50, 220, 250],
    'the partly clear pixel takes the mean of the two solid ones beside it; the solid and the clear keep theirs',
  )
  const thin = matte(row([153, 0, 0, 0, 0], [160, 0, 0, 0, 0]))
  assert.equal(thin.data[0], 160, 'with no solid pixel near, a pixel keeps its own color')
})
