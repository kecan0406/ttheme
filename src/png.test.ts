import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PNG } from 'pngjs'
import { decodeImage, decodePng } from './png.ts'

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

const TWO_COLORS =
  '/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAEKADAAQAAAABAAAACAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgACAAQAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAQEBAQEBAgEBAgICAgICAwICAgIDBAMDAwMDBAUEBAQEBAQFBQUFBQUFBQYGBgYGBgcHBwcHCAgICAgICAgICP/bAEMBAQEBAgICAwICAwgFBQUICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICP/dAAQAAf/aAAwDAQACEQMRAD8A/L+uPrsK4+v6g/ZVf81R/wByv/uwf2R+2P8A+aQ/7nP/AHVP/9k='

test('a JPEG decodes to its own size and colors, keeps each decode apart, and is refused over the pixel limit', () => {
  const bytes = new Uint8Array(Buffer.from(TWO_COLORS, 'base64'))
  const first = decodeImage(bytes, 1e6)
  const near = (at: number, want: number[]) => want.every((v, i) => Math.abs((first.data[at + i] as number) - v) <= 12)
  assert.deepEqual([first.width, first.height, first.data.length], [16, 8, 16 * 8 * 4])
  assert.ok(near(3 * 4, [200, 40, 40]) && near(12 * 4, [40, 80, 200]))
  assert.equal(first.data[3], 255)
  const kept = Uint8Array.from(first.data)
  decodeImage(bytes, 1e6)
  assert.deepEqual([...first.data], [...kept])
  assert.throws(() => decodeImage(bytes, 100), /16×8 is over 0.0001 megapixels/)
})
