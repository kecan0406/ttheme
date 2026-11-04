import assert from 'node:assert/strict'
import { test } from 'node:test'
import { alphaBox, type Rgba } from './png.ts'
import { CLOSED, paperOf, type Sides, sidesOf, stickered } from './sticker.ts'

const FIGURE = [200, 40, 90, 255]

function canvas(width: number, height: number, paint: (x: number, y: number) => boolean): Rgba {
  const data = new Uint8Array(width * height * 4)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (paint(x, y)) {
        data.set(FIGURE, (y * width + x) * 4)
      }
    }
  }

  return { width, height, data }
}

const disc = (cx: number, cy: number, r: number) => (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r

const LOOK = { paper: 250, erase: true }

function drawn(image: Rgba, wide: number, open: Sides = CLOSED, look = LOOK): Rgba {
  const box = alphaBox(image)

  assert.ok(box)

  const out = stickered(image, box, wide, open, look)

  assert.ok(out)

  return out
}

function pixel(image: Rgba, x: number, y: number): number[] {
  return [...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)]
}

function reachOf(image: Rgba, y: number): number {
  let x = 0

  while (x < image.width && pixel(image, x, y)[3] === 0) {
    x++
  }

  return x
}

test('a figure keeps its own pixels and gets paper around it, with a thin dark edge outside the paper', () => {
  const image = drawn(canvas(200, 200, disc(100, 100, 60)), 12)
  const middle = Math.floor(image.height / 2)
  const center = Math.floor(image.width / 2)
  assert.deepEqual(pixel(image, center, middle), FIGURE)

  const start = reachOf(image, middle)
  const figureAt = (image.width - 120) / 2
  assert.ok(figureAt - start >= 10 && figureAt - start <= 15, `band of ${figureAt - start}`)

  const paper = pixel(image, Math.round((start + figureAt) / 2), middle)
  assert.ok((paper[0] ?? 0) > 200 && (paper[3] ?? 0) === 255, `paper is ${paper}`)

  const rim = Array.from({ length: 4 }, (_, i) => pixel(image, start + i, middle)).find(
    (seen) => (seen[3] ?? 0) > 60 && (seen[0] ?? 255) < 120,
  )

  assert.ok(rim, 'no dark rim outside the paper')
})

test('a side the picture cut off gets no band and no room, and the other sides still do', () => {
  const image = canvas(200, 200, (x, y) => x >= 50 && x < 150 && y < 120)
  const box = alphaBox(image)
  assert.ok(box)
  const open = sidesOf(image, box)
  assert.deepEqual(open, { top: true, right: false, bottom: false })

  const out = drawn(image, 10, open)
  const center = Math.floor(out.width / 2)
  assert.deepEqual(pixel(out, center, 0), FIGURE)

  const rows = out.height - 120
  assert.ok(rows >= 10, `${rows} rows of room below`)
  assert.ok(reachOf(out, 60) <= (out.width - 100) / 2 - 8)
})

test('a sliver that touches the edge does not count as cut off', () => {
  const image = canvas(300, 300, (x, y) => disc(150, 150, 100)(x, y) || (x >= 148 && x < 152 && y < 60))
  const box = alphaBox(image)
  assert.ok(box)
  assert.deepEqual(sidesOf(image, box), CLOSED)
})

test('a figure that reaches the bottom counts as cut off there, unless the top is cut too', () => {
  const bottom = canvas(200, 200, (x, y) => x >= 50 && x < 150 && y >= 80)
  const boxB = alphaBox(bottom)
  assert.ok(boxB)
  assert.deepEqual(sidesOf(bottom, boxB), { top: false, right: false, bottom: true })

  const both = canvas(200, 200, (x) => x >= 50 && x < 150)
  const boxT = alphaBox(both)
  assert.ok(boxT)
  assert.deepEqual(sidesOf(both, boxT), { top: true, right: false, bottom: false })
})

test('a thin end gets a thinner band than the body it grows from', () => {
  const body = disc(150, 150, 70)
  const image = canvas(400, 300, (x, y) => body(x, y) || (x >= 215 && x < 380 && y >= 148 && y < 152))
  const out = drawn(image, 12)

  const column = (x: number) => {
    let top = 0

    while (top < out.height && pixel(out, x, top)[3] === 0) {
      top++
    }

    let bottom = out.height - 1

    while (bottom > top && pixel(out, x, bottom)[3] === 0) {
      bottom--
    }

    return bottom - top + 1
  }

  const end = column(out.width - 30)
  assert.ok(end > 4 && end <= 16, `the thin end is ${end} tall`)
  assert.ok(column(Math.round(out.width * 0.6)) > end)
})

test('a speck far from a cut-out is dropped, with no band of its own', () => {
  const figure = disc(150, 150, 80)
  const image = canvas(300, 300, (x, y) => figure(x, y) || (x >= 10 && x < 13 && y >= 10 && y < 13))
  const out = drawn(image, 10)
  const seen = alphaBox(out)
  assert.ok(seen)
  assert.ok(seen.w <= 160 + 2 * 14, `${seen.w} wide with the speck gone`)
  assert.equal(pixel(out, 0, 0)[3], 0)
})

test('a small hole takes the paper and a wide one stays open', () => {
  const figure = disc(200, 200, 150)
  const small = canvas(400, 400, (x, y) => figure(x, y) && !disc(200, 120, 8)(x, y))
  const out = drawn(small, 10)
  const room = 25
  const hole = pixel(out, 150 + room, 70 + room)
  assert.equal(hole[3], 255)
  assert.ok((hole[0] ?? 0) > 180, `the hole shows ${hole}`)

  const wide = canvas(600, 600, (x, y) => disc(300, 300, 280)(x, y) && !disc(300, 300, 160)(x, y))
  const ring = drawn(wide, 8)
  assert.equal(pixel(ring, Math.floor(ring.width / 2), Math.floor(ring.height / 2))[3], 0)
})

test('a picture larger than a drawing can show is drawn at the largest size, and its band keeps its share', () => {
  const image = canvas(3200, 800, (x, y) => x >= 100 && x < 3100 && y >= 100 && y < 700)
  const out = drawn(image, 30)
  const seen = alphaBox(out)
  assert.ok(seen)
  assert.ok(seen.w <= 2560 + 2 * 30, `${seen.w} wide`)
})

test('a small gap at a side the picture cut off takes the paper, and a wide one stays open', () => {
  const body = (x: number, y: number) => y < 300 && x >= 20
  const gap = (from: number, to: number) => (x: number, y: number) => body(x, y) && !(y >= 240 && x >= from && x < to)
  const open = { top: false, right: false, bottom: true }

  const narrow = canvas(400, 300, gap(200, 212))
  const narrowBox = alphaBox(narrow)
  assert.ok(narrowBox)
  const filled = drawn(narrow, 10, open)
  assert.equal(pixel(filled, 206 - narrowBox.x + 25, filled.height - 2)[3], 255)

  const wide = canvas(400, 300, gap(100, 260))
  const wideBox = alphaBox(wide)
  assert.ok(wideBox)
  const kept = drawn(wide, 10, open)
  assert.equal(pixel(kept, 180 - wideBox.x + 25, kept.height - 2)[3], 0)
})

function veiled(paint: (x: number, y: number) => number): Rgba {
  const data = new Uint8Array(300 * 300 * 4)

  for (let y = 0; y < 300; y++) {
    for (let x = 0; x < 300; x++) {
      data.set([200, 40, 90, paint(x, y)], (y * 300 + x) * 4)
    }
  }

  return { width: 300, height: 300, data }
}

test('a figure that is translucent all over takes no sticker, so nothing of it is lost', () => {
  const image = veiled((x, y) => (disc(150, 150, 90)(x, y) ? 80 : 0))
  const box = alphaBox(image)
  assert.ok(box)
  assert.equal(stickered(image, box, 10, CLOSED, LOOK), undefined)
})

test('a translucent part of a solid figure stays, drawn over the paper', () => {
  const image = veiled((x, y) => (disc(150, 150, 60)(x, y) ? 255 : disc(150, 150, 70)(x, y) ? 70 : 0))
  const out = drawn(image, 12)
  const room = (out.width - 141) / 2
  const seen = pixel(out, Math.round(room + 70 - 66), Math.round(out.height / 2))
  assert.equal(seen[3], 255)
  assert.ok((seen[1] ?? 255) < 230, `the veil is gone: ${seen}`)
})

test('a speck is erased from a cut-out but stays in a picture that came transparent, with no band', () => {
  const figure = disc(150, 150, 80)
  const image = canvas(300, 300, (x, y) => figure(x, y) || (x >= 10 && x < 14 && y >= 10 && y < 14))
  const box = alphaBox(image)
  assert.ok(box)
  const kept = stickered(image, box, 10, CLOSED, { paper: 250, erase: false })
  assert.ok(kept)
  const room = 25
  assert.deepEqual(pixel(kept, room + 1, room + 1), FIGURE)
  assert.equal(pixel(kept, 2, 2)[3], 0)
})

test('the paper is as bright as the brightest of the picture, and white at most', () => {
  assert.equal(paperOf('#ffffff'), 250)
  assert.ok(paperOf('#3c1e5a') < 60, `${paperOf('#3c1e5a')}`)
  assert.equal(paperOf('#808080'), 128)
})
