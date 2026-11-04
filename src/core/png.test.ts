import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crc32, deflateSync } from 'node:zlib'
import { PNG } from 'pngjs'
import { jpegSize } from './jpeg.ts'
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

  const shown = {
    1: [3, 2, [0, 1, 2, 3, 4, 5]],
    2: [3, 2, [2, 1, 0, 5, 4, 3]],
    3: [3, 2, [5, 4, 3, 2, 1, 0]],
    4: [3, 2, [3, 4, 5, 0, 1, 2]],
    5: [2, 3, [0, 3, 1, 4, 2, 5]],
    6: [2, 3, [3, 0, 4, 1, 5, 2]],
    7: [2, 3, [5, 2, 4, 1, 3, 0]],
    8: [2, 3, [2, 5, 1, 4, 0, 3]],
  } satisfies Record<number, [number, number, number[]]>

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
      [image.width, image.height, [...image.data].flatMap((red, at) => (at % 4 === 0 ? [red / 40] : []))],
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

function chunked(kind: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(kind, 'latin1'), data])
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), 8 + data.length)

  return out
}

function crafted(width: number, height: number, depth: number, interlace: number, idat: Uint8Array): Uint8Array {
  const head = Buffer.alloc(13)
  head.writeUInt32BE(width, 0)
  head.writeUInt32BE(height, 4)
  head.set([depth, 6, 0, 0, interlace], 8)

  return new Uint8Array(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunked('IHDR', head),
      chunked('IDAT', idat),
      chunked('IEND', new Uint8Array(0)),
    ]),
  )
}

const plainFailure = (error: Error) => error.constructor === Error && !('code' in error)

test('a PNG that inflates to far more than its size says is refused, whichever decoder would read it', () => {
  const bomb = deflateSync(new Uint8Array(32 * 1024 * 1024))

  for (const [depth, interlace] of [
    [8, 0],
    [8, 1],
  ] as const) {
    assert.throws(() => decodeImage(crafted(1, 1, depth, interlace, bomb), 1e6), plainFailure)
  }
})

test('a damaged PNG is a plain failure, and one with no pixels is refused', () => {
  const body = deflateSync(new Uint8Array((4 * 4 + 1) * 4))

  assert.equal(decodeImage(crafted(4, 4, 8, 0, body), 1e6).width, 4)

  const damaged = [
    crafted(4, 4, 8, 0, Uint8Array.of(1, 2, 3, 4)),
    crafted(4, 4, 8, 0, body.subarray(0, body.length - 6)),
    crafted(4, 4, 16, 0, Uint8Array.of(1, 2, 3, 4)),
    crafted(4, 4, 8, 1, Uint8Array.of(1, 2, 3, 4)),
    crafted(4, 4, 7, 0, body),
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 3, 73, 72, 68, 82, 1, 2, 3, 0, 0, 0, 0),
    crafted(0, 4, 8, 0, deflateSync(new Uint8Array(4))),
    crafted(4, 0, 8, 0, deflateSync(new Uint8Array(1))),
  ]

  for (const bytes of damaged) {
    assert.throws(() => decodeImage(bytes, 1e6), plainFailure)
  }
})

function pngOf(width: number, height: number, interlace: number, inflated: number): Uint8Array {
  const head = Buffer.alloc(13)
  head.writeUInt32BE(width, 0)
  head.writeUInt32BE(height, 4)
  head.set([8, 6, 0, 0, interlace], 8)

  const chunk = (kind: string, data: Uint8Array): Buffer => {
    const body = Buffer.concat([Buffer.from(kind, 'latin1'), data])
    const out = Buffer.alloc(12 + data.length)
    out.writeUInt32BE(data.length, 0)
    body.copy(out, 4)
    out.writeUInt32BE(crc32(body), 8 + data.length)

    return out
  }

  return new Uint8Array(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', head),
      chunk('IDAT', deflateSync(Buffer.alloc(inflated))),
      chunk('IEND', new Uint8Array()),
    ]),
  )
}

test('a PNG of no width or no height is refused before it unpacks', () => {
  const inflated = 8 * 1024 * 1024

  for (const interlace of [0, 1]) {
    assert.throws(() => decodeImage(pngOf(0, inflated, interlace, inflated), 1e6), /has no pixels/)
    assert.throws(() => decodeImage(pngOf(inflated, 0, interlace, inflated), 1e6), /has no pixels/)
  }
})

test('a PNG that unpacks far past the size its header gives is refused', () => {
  const inflated = 8 * 1024 * 1024

  for (const interlace of [0, 1]) {
    assert.throws(() => decodeImage(pngOf(1, 1, interlace, inflated), 1e6), /far more than its size says/)
  }

  assert.deepEqual(
    [...decodeImage(pngOf(1, 1, 0, 5 + 1024), 1e6).data],
    [0, 0, 0, 0],
    'a little spare data after the last row still reads',
  )
})

function jpegWithSize(width: number, height: number, ahead: number[]): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    ...ahead,
    0xff,
    0xc0,
    0,
    11,
    8,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    1,
    1,
    0x11,
    0,
  ])
}

test('a JPEG is measured marker by marker as its decoder reads it', () => {
  const claim = [0xff, 0xc0, 0, 11, 8, 0, 16, 0, 16, 1, 1, 0x11, 0]
  const payload = [0, 0, ...claim, 0, 0]
  const held = [0xff, 0xe0, 0, payload.length + 2, ...payload]

  for (const lone of [0xd0, 0xd7, 0x01, 0x00]) {
    const bytes = jpegWithSize(8000, 8000, [0xff, lone, 0, 4, ...held])
    assert.deepEqual(jpegSize(bytes), { width: 8000, height: 8000 }, `marker ${lone}`)
    assert.throws(() => decodeImage(bytes, 25_000_000), /8000×8000 is over 25 megapixels/)
  }

  assert.throws(() => decodeImage(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 25_000_000), /not a JPEG picture/)
})

test('a JPEG with more scans than any encoder writes is refused before it decodes', () => {
  const scan = [0xff, 0xda, 0, 8, 1, 1, 0, 1, 63, 0, 0]
  const scans = (count: number) => Array.from({ length: count }, () => scan).flat()
  const frame = [0xff, 0xc2, 0, 11, 8, 0, 16, 0, 16, 1, 1, 0x11, 0]

  assert.throws(
    () => decodeImage(new Uint8Array([0xff, 0xd8, ...frame, ...scans(257)]), 1e6),
    /has more scans than a picture needs/,
  )
  assert.throws(
    () => decodeImage(new Uint8Array([0xff, 0xd8, ...frame, ...scans(256)]), 1e6),
    /not a JPEG picture this decoder can read/,
  )
})

test('a JPEG that fails leaves nothing behind for the next one to run out of', () => {
  const segment = (marker: number, body: number[]) => [0xff, marker, 0, body.length + 2, ...body]

  const tables = [
    ...segment(0xdb, [0, ...new Array<number>(64).fill(1)]),
    ...segment(0xc4, [0x00, 0, 1, ...new Array<number>(14).fill(0), 0]),
    ...segment(0xc4, [0x10, 0, 1, ...new Array<number>(14).fill(0), 0]),
  ]

  const wide = [8, 4000 >> 8, 4000 & 255, 4000 >> 8, 4000 & 255, 1, 1, 0x11, 0]

  const failing = new Uint8Array([
    0xff,
    0xd8,
    ...tables,
    ...segment(0xc2, wide),
    ...segment(0xda, [1, 1, 0, 0, 0, 0]),
    0xff,
    0x02,
    0,
    0,
  ])

  for (let run = 0; run < 100; run++) {
    assert.throws(() => decodeImage(failing, 25e6), /not a JPEG picture this decoder can read/)
  }

  assert.equal(decodeImage(new Uint8Array(Buffer.from(TWO_COLORS, 'base64')), 1e6).width, 16)
})

test('the JPEGs the decoder chokes on leave it working for the next one, however many there are', () => {
  const bytes = new Uint8Array(Buffer.from(TWO_COLORS, 'base64'))
  const damaged = Uint8Array.from(bytes)
  damaged[157] = 0xff

  for (let round = 0; round < 80; round++) {
    assert.throws(() => decodeImage(damaged, 1e6), /not a JPEG picture this decoder can read/)
    assert.equal(decodeImage(bytes, 1e6).width, 16)
  }
})
