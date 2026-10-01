import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PNG } from 'pngjs'
import { decodePng } from './png.ts'

function sample(width: number, height: number, alpha: boolean, smooth: boolean): PNG {
  const png = new PNG({ width, height })
  let seed = width * 31 + height
  for (let i = 0; i < width * height; i++) {
    const x = i % width
    const y = Math.floor(i / width)
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const noise = seed >> 8
    png.data[i * 4] = smooth ? (x * 3 + y) & 255 : noise & 255
    png.data[i * 4 + 1] = smooth ? (x + y * 5) & 255 : (noise >> 3) & 255
    png.data[i * 4 + 2] = smooth ? (x * y) & 255 : (noise >> 5) & 255
    png.data[i * 4 + 3] = alpha ? (smooth ? 200 : (noise >> 7) & 255) : 255
  }
  return png
}

test('the native decode reads every filter and color layout the way pngjs does, and pngjs reads the rest', () => {
  for (const [width, height] of [
    [1, 1],
    [7, 5],
    [64, 33],
  ] as const) {
    for (const colorType of [0, 2, 4, 6] as const) {
      for (const filterType of [0, 1, 2, 3, 4, -1]) {
        for (const smooth of [false, true]) {
          const bytes = PNG.sync.write(sample(width, height, colorType === 4 || colorType === 6, smooth), {
            colorType,
            inputColorType: 6,
            filterType,
          })
          const ours = decodePng(new Uint8Array(bytes))
          const theirs = PNG.sync.read(bytes)
          assert.deepEqual(
            [ours.width, ours.height, [...ours.data]],
            [theirs.width, theirs.height, [...theirs.data]],
            `${width}×${height} color type ${colorType} filter ${filterType} smooth ${smooth}`,
          )
        }
      }
    }
  }
  const deep = PNG.sync.write(sample(4, 4, true, true), { bitDepth: 16, colorType: 6, inputColorType: 6 })
  assert.deepEqual([...decodePng(new Uint8Array(deep)).data], [...PNG.sync.read(deep).data])
})
