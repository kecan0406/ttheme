import assert from 'node:assert/strict'
import { test } from 'node:test'
import { check } from './contrast.ts'
import { type Colors, grow, nudge, SEED_FIELDS, SEEDS } from './seeds.ts'

function failing(c: Colors): string[] {
  return check({
    name: 'seeds',
    background: c.background,
    foreground: c.foreground,
    selectionBackground: c.selection,
    ansi: c.ansi,
    signatureSlots: ['background', 'foreground', 'cursor'],
  }).map((v) => v.detail)
}

test('the seeds grow twenty colors that pass the gate, whatever the hue, tint and accent chroma', () => {
  assert.deepEqual(failing(grow(SEEDS)), [])

  for (const hue of [0, 90, 180, 265]) {
    for (const tint of [0, 0.05]) {
      for (const chroma of [0.04, 0.2]) {
        assert.deepEqual(failing(grow({ ...SEEDS, hue, tint, chroma })), [], `hue ${hue} tint ${tint} chroma ${chroma}`)
      }
    }
  }
})

test('a seed stays inside its range, and the hue wraps around', () => {
  const hue = SEED_FIELDS.find((f) => f.key === 'hue')
  const tint = SEED_FIELDS.find((f) => f.key === 'tint')
  assert.ok(hue && tint)
  assert.equal(nudge({ ...SEEDS, hue: 355 }, hue, 10).hue, 5)
  assert.equal(nudge({ ...SEEDS, tint: 0 }, tint, -3).tint, 0)
})
