import type { Theme } from '@/lib/themes'
import { rgb } from '../../src/core/color.ts'
import { APP, CENTER, marksOf, PIXELS, type Point, pointsOf, STROKES, TILE } from '../../src/core/mark.ts'
import { encodeRgb } from '../../src/core/png.ts'

const TOUCH = 180

const FAVICONS = [16, 32, 48]

const LINES = STROKES.map((stroke) => ({ stroke, points: pointsOf(stroke) }))

type Canvas = { data: Uint8Array; width: number }

function blend({ data, width }: Canvas, x: number, y: number, ink: number[], cover: number) {
  const at = (y * width + x) * 3

  for (let c = 0; c < 3; c++) {
    const was = data[at + c] as number
    data[at + c] = Math.round(was + ((ink[c] as number) - was) * cover)
  }
}

function ground(theme: Theme, size: number): Canvas {
  const data = new Uint8Array(size * size * 3)
  const color = rgb(theme.background)

  for (let at = 0; at < data.length; at += 3) data.set(color, at)

  return { data, width: size }
}

function reach(x: number, y: number, points: Point[]): number {
  let nearest = Number.POSITIVE_INFINITY

  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1] as Point
    const [bx, by] = points[i] as Point
    const dx = bx - ax
    const dy = by - ay
    const along = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)))

    nearest = Math.min(nearest, Math.hypot(x - ax - dx * along, y - ay - dy * along))
  }

  return nearest
}

function drawn(theme: Theme, size: number, scale: number): Buffer {
  const canvas = ground(theme, size)
  const inks = marksOf(theme.background, theme.foreground, theme.cursor, theme.selectionBackground).map(rgb)
  const unit = (size / 64) * scale

  for (const { stroke, points } of LINES) {
    const placed = points.map(([x, y]): Point => [(x - CENTER[0]) * unit + size / 2, (y - CENTER[1]) * unit + size / 2])
    const half = (stroke.width / 2) * unit
    const xs = placed.map(([x]) => x)
    const ys = placed.map(([, y]) => y)
    const left = Math.max(0, Math.floor(Math.min(...xs) - half - 1))
    const right = Math.min(size, Math.ceil(Math.max(...xs) + half + 1))
    const top = Math.max(0, Math.floor(Math.min(...ys) - half - 1))
    const bottom = Math.min(size, Math.ceil(Math.max(...ys) + half + 1))
    const ink = inks[stroke.tone] as number[]

    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const cover = Math.min(1, Math.max(0, half + 0.5 - reach(x + 0.5, y + 0.5, placed)))

        if (cover > 0) blend(canvas, x, y, ink, cover)
      }
    }
  }

  return encodeRgb({ width: size, height: size, data: canvas.data })
}

function pixels(theme: Theme): Buffer {
  const canvas = ground(theme, 16)
  const inks = marksOf(theme.background, theme.foreground, theme.cursor, theme.selectionBackground).map(rgb)

  for (const [x, y, tone, alpha] of PIXELS) blend(canvas, x, y, inks[tone] as number[], alpha)

  return encodeRgb({ width: 16, height: 16, data: canvas.data })
}

export function touchIconPng(theme: Theme): Buffer {
  return drawn(theme, TOUCH, APP)
}

export function faviconIco(theme: Theme): Buffer {
  const images = FAVICONS.map((size) => (size === 16 ? pixels(theme) : drawn(theme, size, TILE)))
  const head = Buffer.alloc(6 + images.length * 16)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(images.length, 4)
  let offset = head.length

  images.forEach((image, index) => {
    const entry = 6 + index * 16
    head.writeUInt8(FAVICONS[index] as number, entry)
    head.writeUInt8(FAVICONS[index] as number, entry + 1)
    head.writeUInt16LE(1, entry + 4)
    head.writeUInt16LE(32, entry + 6)
    head.writeUInt32LE(image.length, entry + 8)
    head.writeUInt32LE(offset, entry + 12)
    offset += image.length
  })

  return Buffer.concat([head, ...images])
}
