import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SharedPicture } from '../core/theme.ts'
import { followed } from './pictures.ts'

const post = (id: number, framing: Omit<SharedPicture, 'site' | 'id'> = {}): SharedPicture => ({
  site: 'danbooru',
  id,
  ...framing,
})

test('an update takes off and reframes only the pictures whose tuning is still the one the marketplace gave', () => {
  const before = [post(11), post(12), post(13, { size: 60 }), post(14, { position: 'center' }), post(15)]
  const after = [post(13, { size: 80 }), post(14, { position: 'bottom-left' }), post(15, { strength: 1 }), post(16)]
  const retuned = new Set([12, 14])

  const { drop, reframe } = followed(before, after, (was) => !retuned.has(was.id))

  assert.deepEqual(
    drop.map((p) => p.id),
    [11],
  )
  assert.deepEqual(reframe, [post(13, { size: 80 })])
})

test('a picture a palette lists twice is taken off once', () => {
  const { drop } = followed([post(21), post(21, { size: 60 })], [], () => true)

  assert.deepEqual(
    drop.map((p) => p.id),
    [21],
  )
})
