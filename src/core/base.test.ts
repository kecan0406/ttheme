import assert from 'node:assert/strict'
import { test } from 'node:test'

import { finished, gateOf, rankBases, seeded } from './base.ts'
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

test('rankBases keeps a base the role fixer brings through the gate and hands back the fixed colors', () => {
  assert.ok(gateOf(theme, harmonized(seeded(theme, scheme))).length > 0)

  const [best] = rankBases(theme, [['probe', scheme]]).ranked

  assert.ok(best)
  assert.deepEqual(check({ ...best.shade, name: theme.name, signatureSlots: theme.signatureSlots, waive: [] }), [])
  assert.ok(best.moves.length > 0)
  assert.deepEqual(best.shade, finished(theme, harmonized(seeded(theme, scheme))).shade)
})

test('rankBases drops a scheme it cannot read and one with a light background', () => {
  const { ranked, dropped, dark } = rankBases(theme, [
    ['short', undefined],
    ['light', { ...scheme, background: '#fafafa' }],
  ])

  assert.equal(ranked.length, 0)
  assert.equal(dark, 0)
  assert.deepEqual(
    [...dropped],
    [
      ['short', 'fewer than 16 palette entries'],
      ['light', 'light background'],
    ],
  )
})
