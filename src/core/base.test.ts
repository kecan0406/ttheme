import assert from 'node:assert/strict'
import { test } from 'node:test'

import { bestBase, gateOf, seeded } from './base.ts'
import { check } from './contrast.ts'
import { harmonized } from './harmonize.ts'
import { withSlot } from './mirror.ts'
import type { Shade } from './theme.ts'

const scheme: Shade = {
  background: '#1d1f21',
  foreground: '#c5c8c6',
  cursor: '#c5c8c6',
  selectionBackground: '#373b41',
  ansi: [
    '#1d1f21',
    '#cc6666',
    '#c8c800',
    '#f0c674',
    '#81a2be',
    '#b294bb',
    '#8abeb7',
    '#c5c8c6',
    '#666666',
    '#d54e53',
    '#e0e040',
    '#e7c547',
    '#7aa6da',
    '#c397d8',
    '#70c0b1',
    '#eaeaea',
  ],
}

const anchors: [string, string][] = [
  ['cursor', '#ffa040'],
  ['ansi5', '#c080ff'],
  ['selection', '#402a20'],
]

const theme = {
  name: 'probe',
  signatureSlots: anchors.map(([slot]) => slot),
  ...anchors.reduce((shade, [slot, hex]) => withSlot(shade, slot, hex), scheme),
}

test('bestBase keeps a base the role fixer brings through the gate and hands back the fixed colors', () => {
  assert.ok(gateOf(theme, harmonized(seeded(theme, scheme))).length > 0)

  const { best } = bestBase(theme, [['probe', scheme]])

  assert.ok(best)
  assert.deepEqual(check({ ...best.shade, name: theme.name, signatureSlots: theme.signatureSlots }), [])
  assert.ok(best.moves.length > 0)
})

test('bestBase drops a scheme it cannot read and one with a light background', () => {
  const choice = bestBase(theme, [
    ['short', undefined],
    ['light', { ...scheme, background: '#fafafa' }],
  ])

  assert.ok(choice.best === undefined)
  assert.deepEqual(
    [...choice.dropped],
    [
      ['short', 'fewer than 16 palette entries'],
      ['light', 'light background'],
    ],
  )
})
