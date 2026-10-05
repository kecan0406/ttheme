import assert from 'node:assert/strict'
import { test } from 'node:test'

import { cells, clip, fit, wrapText } from './ansi.ts'

test('fit closes only what the cut text opened, so a painted row keeps its background', () => {
  assert.equal(fit('\x1b[1mabcdef\x1b[22m', 4), '\x1b[1mabc\x1b[22m…')
  assert.equal(fit('\x1b[38;2;1;2;3mabcdef', 4, false), '\x1b[38;2;1;2;3mabc\x1b[39m…')
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
