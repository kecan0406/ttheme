import assert from 'node:assert/strict'
import { test } from 'node:test'

import { flatsOf } from './flats.ts'

function picture(runs: [string, number][]) {
  const pixels = runs.flatMap(([hex, n]) => Array.from({ length: n }, () => hex))
  const data = new Uint8Array(pixels.length * 4)

  pixels.forEach((hex, i) => {
    data.set([...[1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)), 255], i * 4)
  })

  return { width: pixels.length, height: 1, data }
}

test('flatsOf pairs a cel with its shadow, and a highlight a tenth its size with neither', () => {
  const { flats } = flatsOf(
    picture([
      ['#e9e5f1', 440],
      ['#c6c2ce', 150],
      ['#fffcff', 10],
    ]),
  )

  const mark = (hex: string) => {
    const f = flats.find((x) => x.hex === hex)

    return f?.shadowOf ? `shadow of ${f.shadowOf}` : f?.lit ? 'lit' : ''
  }

  assert.equal(mark('#e9e5f1'), 'lit')
  assert.equal(mark('#c6c2ce'), 'shadow of #e9e5f1')
  assert.equal(mark('#fffcff'), '')
})
