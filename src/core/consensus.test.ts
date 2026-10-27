import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readRelated } from './consensus.ts'

test('readRelated names the tag safebooru searched, the current one when the tag asked for was renamed', () => {
  assert.equal(readRelated({ post_count: 2737, related_tags: [], query: 'asuna_(sao) solo' })?.searched, 'asuna_(sao)')
  assert.equal(readRelated({ post_count: 0, related_tags: [] })?.searched, undefined)
})
