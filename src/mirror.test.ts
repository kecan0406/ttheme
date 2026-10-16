import assert from 'node:assert/strict'
import { test } from 'node:test'

import { argbFromHex, Hct } from '@material/material-color-utilities'
import { CHROMA_LIFT, mirror, OLIVE_EXIT, olive } from './mirror.ts'

const mami = {
  name: 'mami',
  background: '#1b170c',
  foreground: '#e3e2e2',
  cursor: '#e5c55c',
  selectionBackground: '#453e1f',
  ansi: [
    '#272318',
    '#f16e41',
    '#b8cb29',
    '#deb832',
    '#00a6ab',
    '#ff8caa',
    '#70bc79',
    '#dcd4c2',
    '#7d7767',
    '#f3a287',
    '#d3e846',
    '#ffd96c',
    '#00bec3',
    '#ffc0ce',
    '#8ad992',
    '#f9edd0',
  ],
  signatureSlots: ['cursor', 'foreground', 'ansi11'],
  waive: [],
}

const hct = (hex: string) => Hct.fromInt(argbFromHex(hex))

const light = mirror(mami)

test('the light mirror carries an accent as its share of the sRGB edge, never past 1.3 times its own chroma', () => {
  const made = hct(mami.ansi[5] as string)
  const worn = hct(light.ansi[5] as string)

  assert.ok(worn.chroma > made.chroma + 10)
  assert.ok(worn.chroma <= made.chroma * CHROMA_LIFT + 0.5)
  assert.ok(Math.abs(worn.hue - made.hue) < 1)

  for (const i of [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14]) {
    const own = hct(mami.ansi[i] as string).chroma

    assert.ok(hct(light.ansi[i] as string).chroma <= own * CHROMA_LIFT + 0.5, `ansi${i}`)
  }
})

test('the light mirror turns a green its tones leave olive to green and keeps a signature yellow and its twin as they are', () => {
  assert.ok(olive(light.ansi[11] as string))
  assert.ok(Math.abs(hct(light.ansi[11] as string).hue - hct(mami.ansi[11] as string).hue) < 1)
  assert.ok(Math.abs(hct(light.ansi[3] as string).hue - hct(mami.ansi[3] as string).hue) < 1)

  for (const i of [2, 10]) {
    assert.equal(olive(light.ansi[i] as string), false, `ansi${i}`)
    assert.ok(Math.abs(hct(light.ansi[i] as string).hue - OLIVE_EXIT.green) < 1, `ansi${i}`)
  }
})
