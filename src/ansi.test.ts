import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ansiChip, ansiDot, ansiFg, ansiSwatch } from './ansi.ts'

test('ansiDot paints a truecolor palette dot', () => {
  assert.equal(ansiDot('#000000', '#ffffff'), '\x1b[48;2;0;0;0;38;2;255;255;255m ● \x1b[0m')
})

test('ansiChip sets only the background behind the text', () => {
  assert.equal(ansiChip('●', '#102030'), '\x1b[48;2;16;32;48m ● \x1b[0m')
})

test('ansiFg opens a truecolor foreground without resetting', () => {
  assert.equal(ansiFg('#ff0080'), '\x1b[38;2;255;0;128m')
})

test('ansiSwatch stacks half-block cells on one background', () => {
  assert.equal(
    ansiSwatch(['#ff0000', '#00ff00'], '#000000'),
    '\x1b[48;2;0;0;0m\x1b[38;2;255;0;0m▄\x1b[38;2;0;255;0m▄ \x1b[0m',
  )
})
