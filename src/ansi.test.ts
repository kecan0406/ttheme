import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ansiBar, ansiFg, ansiSquares, cells, clip, fit, wrapText } from './ansi.ts'

test('ansiFg opens a truecolor foreground without resetting', () => {
  assert.equal(ansiFg('#ff0080'), '\x1b[38;2;255;0;128m')
})

test('ansiBar opens a background and a foreground without resetting', () => {
  assert.equal(ansiBar('#102030', '#ffffff'), '\x1b[48;2;16;32;48;38;2;255;255;255m')
})

test('ansiSquares spaces one square per color and hands the foreground back', () => {
  assert.equal(ansiSquares(['#ff0000', '#00ff00']), '\x1b[38;2;255;0;0m■ \x1b[38;2;0;255;0m■\x1b[39m')
})

test('a word too long for its line breaks after a slash or before a #, and mid-word only when it has neither', () => {
  assert.deepEqual(wrapText('github.com/kecan0406/ttheme-showcase', 34), ['github.com/kecan0406/', 'ttheme-showcase'])
  assert.deepEqual(wrapText('github.com/kecan0406/ttheme-neon#v1', 34), ['github.com/kecan0406/ttheme-neon', '#v1'])
  assert.deepEqual(wrapText('Update failed: cannot reach it', 12), ['Update', 'failed:', 'cannot reach', 'it'])
  assert.deepEqual(wrapText('abcdefghij', 4), ['abcd', 'efgh', 'ij'])
})

test('fit, clip and wrapText count an emoji sequence as the cells it takes, and wrapText always moves on', () => {
  assert.equal(fit('ab❤️cd', 4), 'ab… ')
  assert.equal(fit('👩‍💻xyz', 4), '👩‍💻x…')
  assert.equal(cells(clip(' ❤️▌-', 8)), 8)
  assert.deepEqual(wrapText('mikumiku❤️■', 5), ['mikum', 'iku❤️', '■'])
  assert.deepEqual(wrapText('日本', 1), ['日', '本'])
  assert.deepEqual(wrapText('ab', 0), ['a', 'b'])
})
