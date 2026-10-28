import assert from 'node:assert/strict'
import { test } from 'node:test'
import { problems } from './agents.ts'

test('the instruction files keep to their budgets', () => {
  assert.deepEqual(problems(), [])
})
