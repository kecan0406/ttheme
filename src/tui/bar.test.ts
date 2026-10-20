import assert from 'node:assert/strict'
import { test } from 'node:test'
import { barLine } from './bar.ts'
import { painter } from './style.ts'

test('a key dropped for room comes back in its place once a later drop leaves room for it', () => {
  const bar = {
    badge: 'EDIT',
    keys: [
      ['↑↓', 'slot'],
      ['enter', 'tune'],
      ['←→', 'normal or bright'],
      ['l', 'link'],
      ['s', 'save'],
    ] as [string, string][],
    right: ['esc', 'cancel'] as [string, string],
    keep: ['s'],
  }

  const line = barLine(painter(false), bar, 60)
  assert.match(line, /↑↓ slot {3}enter tune {3}l link {3}s save/)
  assert.doesNotMatch(line, /normal or bright/)
  assert.match(line, /esc cancel$/)
})
