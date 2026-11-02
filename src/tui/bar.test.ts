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

test('a question gives up its long lead, its other keys and then its badge before an answer is cut', () => {
  const bar = {
    badge: 'BROWSE',
    lead: 'Apply 12 changes before you leave?',
    short: 'Apply 12?',
    keys: [
      ['y', 'apply'],
      ['n', 'discard'],
    ] as [string, string][],
    right: ['esc', 'stay'] as [string, string],
    keep: ['y', 'n'],
  }

  const line = (width: number) => barLine(painter(false), bar, width)
  assert.match(line(80), /^\[BROWSE\] Apply 12 changes before you leave\? {3}y apply {3}n discard +esc stay$/)
  assert.match(line(60), /^\[BROWSE\] Apply 12\? {3}y apply {3}n discard +esc stay$/)
  assert.equal(line(42), '[BROWSE] Apply 12?   y apply   n discard')
  assert.equal(line(39), 'Apply 12?   y apply   n discard')
})
