import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ansiBar, ansiFg, ansiSquares } from './ansi.ts'

test('ansiFg opens a truecolor foreground without resetting', () => {
  assert.equal(ansiFg('#ff0080'), '\x1b[38;2;255;0;128m')
})

test('ansiBar opens a background and a foreground without resetting', () => {
  assert.equal(ansiBar('#102030', '#ffffff'), '\x1b[48;2;16;32;48;38;2;255;255;255m')
})

test('ansiSquares spaces one square per color and hands the foreground back', () => {
  assert.equal(ansiSquares(['#ff0000', '#00ff00']), '\x1b[38;2;255;0;0m■ \x1b[38;2;0;255;0m■\x1b[39m')
})
