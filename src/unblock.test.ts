import assert from 'node:assert/strict'
import { test } from 'node:test'

import { reframe } from './unblock.ts'

function record(body: number[]): Uint8Array {
  return Uint8Array.from([0x16, 0x03, 0x01, body.length >> 8, body.length & 0xff, ...body])
}

test('a handshake record comes back as two records whose bodies still join to the original', () => {
  const body = Array.from({ length: 300 }, (_, i) => i % 256)
  const [first, second] = reframe(record(body), 20)
  assert.equal(first?.[0], 0x16)
  assert.equal(second?.[0], 0x16)
  assert.deepEqual([first?.[3], first?.[4]], [0, 20])
  assert.deepEqual([second?.[3], second?.[4]], [(300 - 20) >> 8, (300 - 20) & 0xff])
  assert.deepEqual([...(first as Uint8Array).subarray(5), ...(second as Uint8Array).subarray(5)], body)
})

test('the split never falls outside the body, and anything that is not a handshake is left alone', () => {
  const [only] = reframe(record([1, 2, 3]), 99)
  assert.equal(only?.length, 5 + 2)
  const data = Uint8Array.from([0x17, 0x03, 0x03, 0, 2, 9, 9])
  assert.deepEqual(reframe(data), [data])
  assert.deepEqual(reframe(record([1])), [record([1])])
})
