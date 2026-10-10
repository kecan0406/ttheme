import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crc32 } from 'node:zlib'
import { PNG } from 'pngjs'
import { decodeImage, decodePng, encodeMask, pngHead, toneOf } from './png.ts'

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
  for (const [width, height] of [
    [1, 1],
    [7, 5],
    [64, 33],
  ] as const) {
    const ramp = encodeMask(
      { width, height, data: Uint8Array.from({ length: width * height }, (_, i) => (i * 37 + width) & 255) },
      '#a1b2c3',
    )
    for (const bytes of [ramp, without(ramp, 'tRNS')]) {
      assert.deepEqual(
        [...decodePng(bytes).data],
        [...PNG.sync.read(Buffer.from(bytes)).data],
        `${width}×${height} indexed`,
      )
    }
    assert.equal(toneOf(ramp), '#a1b2c3')
  }
  assert.equal(toneOf(new Uint8Array(deep)), undefined)
})

test('a PNG is read the way its eXIf orientation shows it, as the JPEG decoder turns a JPEG', () => {
  const png = new PNG({ width: 3, height: 2 })
  for (let i = 0; i < 6; i++) {
    png.data.set([i * 40, 0, 0, 255], i * 4)
  }
  const plain = new Uint8Array(PNG.sync.write(png))
  const shown: Record<number, [number, number, number[]]> = {
    1: [3, 2, [0, 1, 2, 3, 4, 5]],
    2: [3, 2, [2, 1, 0, 5, 4, 3]],
    3: [3, 2, [5, 4, 3, 2, 1, 0]],
    4: [3, 2, [3, 4, 5, 0, 1, 2]],
    5: [2, 3, [0, 3, 1, 4, 2, 5]],
    6: [2, 3, [3, 0, 4, 1, 5, 2]],
    7: [2, 3, [5, 2, 4, 1, 3, 0]],
    8: [2, 3, [2, 5, 1, 4, 0, 3]],
  }
  for (const [turn, [width, height, order]] of Object.entries(shown)) {
    const exif = Buffer.from([
      0x4d,
      0x4d,
      0,
      0x2a,
      0,
      0,
      0,
      8,
      0,
      1,
      1,
      0x12,
      0,
      3,
      0,
      0,
      0,
      1,
      0,
      Number(turn),
      0,
      0,
      0,
      0,
      0,
      0,
    ])
    const body = Buffer.concat([Buffer.from('eXIf', 'latin1'), exif])
    const chunk = Buffer.alloc(12 + exif.length)
    chunk.writeUInt32BE(exif.length, 0)
    body.copy(chunk, 4)
    chunk.writeUInt32BE(crc32(body), 8 + exif.length)
    const bytes = new Uint8Array(Buffer.concat([plain.subarray(0, 33), chunk, plain.subarray(33)]))
    const image = decodePng(bytes)
    assert.deepEqual(
      [image.width, image.height, [...image.data].filter((_, at) => at % 4 === 0).map((red) => red / 40)],
      [width, height, order],
      `orientation ${turn}`,
    )
    assert.deepEqual([pngHead(bytes)?.width, pngHead(bytes)?.height], [width, height])
  }
})

function without(png: Uint8Array, kind: string): Uint8Array {
  const bytes = Buffer.from(png)
  const kept: Buffer[] = [bytes.subarray(0, 8)]
  for (let at = 8; at + 12 <= bytes.length; ) {
    const end = at + 12 + bytes.readUInt32BE(at)
    if (bytes.toString('latin1', at + 4, at + 8) !== kind) {
      kept.push(bytes.subarray(at, end))
    }
    at = end
  }
  return new Uint8Array(Buffer.concat(kept))
}

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
