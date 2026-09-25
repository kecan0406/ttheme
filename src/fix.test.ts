import assert from 'node:assert/strict'
import { test } from 'node:test'

import { check } from './contrast.ts'
import { fixGate } from './fix.ts'

const failing = {
  name: 'dim@kec',
  background: '#1b170c',
  foreground: '#6a6458',
  selectionBackground: '#10409c',
  ansi: [
    '#9a9484',
    '#6a3020',
    '#9ab566',
    '#e3b53a',
    '#799dfe',
    '#a79af4',
    '#71c189',
    '#8a8474',
    '#2a2418',
    '#ffad92',
    '#bdd594',
    '#f9da8b',
    '#8bc3f7',
    '#dbbaf6',
    '#9be1ae',
    '#f9edd0',
  ],
  signatureSlots: ['foreground', 'ansi5', 'selection'],
  waive: [],
}

test('fixGate lifts every color that reads too faint until the palette passes', () => {
  assert.ok(check(failing).length > 0)
  const { theme, moves, left } = fixGate(failing)
  assert.deepEqual(left, [])
  assert.deepEqual(check(theme), [])
  assert.deepEqual(
    moves.map((m) => m.slot).sort(),
    ['ansi0', 'ansi1', 'ansi7', 'ansi8', 'foreground', 'selection'].sort(),
  )
  assert.equal(theme.ansi[2], failing.ansi[2])
})

test('fixGate leaves a waived rule alone', () => {
  const { moves } = fixGate({ ...failing, waive: ['foreground', 'selection'] })
  assert.equal(
    moves.some((m) => m.slot === 'foreground'),
    false,
  )
})
