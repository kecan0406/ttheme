import assert from 'node:assert/strict'
import { test } from 'node:test'

import { keepable } from './cutout.ts'

test('a cut-out is kept only when it removed something and left something', () => {
  assert.equal(keepable(0), false, 'nothing removed')
  assert.equal(keepable(2), false)
  assert.equal(keepable(3), true)
  assert.equal(keepable(60), true)
  assert.equal(keepable(97), true)
  assert.equal(keepable(98), false, 'almost nothing left')
  assert.equal(keepable(100), false)
})
