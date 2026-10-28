import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PaletteEntry } from '../core/manifest.ts'
import { chase } from './motion.ts'
import { PaletteList } from './palette-prompt.ts'

function entry(name: string): PaletteEntry {
  return {
    name,
    ansiSource: 'Test',
    background: '#000000',
    foreground: '#eeeeee',
    cursor: '#ffffff',
    selection: '#222222',
    signature: ['#ffffff', '#eeeeee', '#000000'],
    signatureSlots: ['foreground', 'cursor', 'background'],
    ansi: Array.from({ length: 16 }, () => '#808080'),
    gate: [16.1, 4.6, 0, 16.1, 3.9],
    backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
  }
}

test('a chase covers 40% of what is left, always at least one step, and starts close when the target is far', () => {
  assert.equal(chase(0, 20), 8)
  assert.equal(chase(8, 20), 13)
  assert.equal(chase(19, 20), 20)
  assert.equal(chase(20, 20), 20)
  assert.equal(chase(20, 0), 12)
  assert.equal(chase(0, 100, { span: 10 }), 94)
  assert.equal(chase(0, 15, { span: 10 }), 6)
})

test('a list that glides shows the window it left until stepped, and one that does not shows the cursor at once', () => {
  const names = Array.from({ length: 40 }, (_, i) => `kai@shop/palette${String(i).padStart(2, '0')}`)

  const make = () =>
    new PaletteList({
      entries: names.map(entry),
      works: [],
      picked: new Set(),
      layout: 'marketplaces',
      mode: 'inside',
      maxItems: 4,
      color: false,
    })

  const plain = make()
  plain.window()
  plain.move(-1)
  assert.equal(plain.window().above, 36)
  assert.equal(plain.moving(), false)

  const gliding = make()
  gliding.glide = true
  gliding.window()
  gliding.move(-1)
  assert.equal(gliding.window().above, 0)
  assert.equal(gliding.moving(), true)
  const seen = [0]

  while (gliding.step()) {
    seen.push(gliding.window().above)
  }

  seen.push(gliding.window().above)
  assert.equal(seen.at(-1), 36)
  assert.ok(seen.length > 3 && seen.length < 12, `${seen}`)
  assert.deepEqual(
    seen,
    seen.toSorted((a, b) => a - b),
  )
  assert.equal(gliding.moving(), false)

  gliding.setFilter('palette1')
  assert.equal(gliding.moving(), false)
})
