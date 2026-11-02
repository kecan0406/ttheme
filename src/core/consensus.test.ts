import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readRelated } from './consensus.ts'

test('readRelated names the tag safebooru searched, the current one when the tag asked for was renamed', () => {
  assert.equal(readRelated({ post_count: 2737, related_tags: [], query: 'asuna_(sao) solo' })?.searched, 'asuna_(sao)')
  assert.equal(readRelated({ post_count: 0, related_tags: [] })?.searched, undefined)
})

test('readRelated drops what is not one tag, since a booru wrote it', () => {
  const related = readRelated({
    post_count: 60,
    query: 'orla\x1b[2J solo',
    related_tags: [
      { tag: { name: 'red_\x1b]0;hi\x07_hair' }, frequency: 0.9 },
      { tag: { name: 'blue‮_eyes' }, frequency: 0.9 },
      { tag: { name: 'blue eyes' }, frequency: 0.9 },
      { tag: { name: 'pink_hair' }, frequency: 0.8 },
    ],
  })

  assert.equal(related?.searched, undefined)
  assert.deepEqual(related?.tags, [{ name: 'pink_hair', frequency: 0.8 }])
})
