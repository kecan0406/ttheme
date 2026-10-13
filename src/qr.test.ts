import assert from 'node:assert/strict'
import { test } from 'node:test'
import { qrCode } from './qr.ts'

test('a link too long for a QR code gets none instead of failing', () => {
  assert.ok(qrCode('x'.repeat(2953)))
  assert.equal(qrCode('x'.repeat(2954)), undefined)
})
