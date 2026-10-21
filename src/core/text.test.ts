import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inertLines, quoted } from './text.ts'

const STEERS = /[\p{Cc}\p{Bidi_Control}]/u
const RLO = String.fromCodePoint(0x202e)

test('a value someone else wrote is echoed in a message with no character that steers the terminal', () => {
  const shown = quoted(`lead\x1b]52;c;aGk=\x07\u009b2J${RLO}evil`)
  assert.ok(!STEERS.test(shown))
  assert.equal(shown, '"lead\\u001b]52;c;aGk=\\u0007\\u009b2J\\u202eevil"')
  assert.ok(!STEERS.test(inertLines(`a\x1b[2Jb${RLO}\u0085c`)))
  assert.equal(inertLines('one\ntwo\tthree\x1b'), 'one\ntwo three')
})
