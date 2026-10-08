import assert from 'node:assert/strict'
import { test } from 'node:test'
import { qrLines } from './qr.ts'

test('a link too long for a QR code gets none instead of failing', () => {
  assert.ok(qrLines('x'.repeat(2953)))
  assert.equal(qrLines('x'.repeat(2954)), undefined)
})
