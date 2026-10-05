import type { Theme } from '@/lib/themes'
import { rgb } from '../../src/color.ts'
import { encodeRgb } from '../../src/png.ts'

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

const MARGIN = 72
const SIGNATURE = 96
const LINE = 40
const BAR = 18
const SWATCH = 52
const GAP = 8

type Ink = [number, number, number]

const BARS: [slot: number | 'fg', width: number][][] = [
  [
    [2, 96],
    ['fg', 232],
    [4, 128],
  ],
  [
    [5, 64],
    [6, 184],
    ['fg', 148],
    [3, 92],
  ],
  [
    ['fg', 40],
    [1, 156],
    ['fg', 264],
  ],
  [
    [4, 112],
    [2, 208],
  ],
]

function rect(data: Uint8Array, x: number, y: number, w: number, h: number, r: number, ink: Ink) {
  for (let py = Math.floor(y); py < Math.ceil(y + h); py++) {
    for (let px = Math.floor(x); px < Math.ceil(x + w); px++) {
      const dx = Math.max(x + r - (px + 0.5), px + 0.5 - (x + w - r), 0)
      const dy = Math.max(y + r - (py + 0.5), py + 0.5 - (y + h - r), 0)
      const cover = Math.min(1, Math.max(0, r + 0.5 - Math.hypot(dx, dy)))
      if (cover === 0) continue
      const at = (py * CARD_WIDTH + px) * 3
      for (let c = 0; c < 3; c++) {
        const was = data[at + c] as number
        data[at + c] = Math.round(was + ((ink[c] as number) - was) * cover)
      }
    }
  }
}

export function cardPng(theme: Theme): Buffer {
  const data = new Uint8Array(CARD_WIDTH * CARD_HEIGHT * 3)
  rect(data, 0, 0, CARD_WIDTH, CARD_HEIGHT, 0, rgb(theme.background))
  theme.signature.forEach((color, i) => {
    rect(data, MARGIN + i * (SIGNATURE + 20), MARGIN, SIGNATURE, SIGNATURE, 24, rgb(color))
  })
  const top = MARGIN + SIGNATURE + 56
  BARS.forEach((runs, row) => {
    const y = top + row * LINE
    let x = MARGIN
    if (row === 2) rect(data, x - 8, y - 8, 40 + 12 + 156 + 16, BAR + 16, 8, rgb(theme.selectionBackground))
    for (const [slot, width] of runs) {
      rect(data, x, y, width, BAR, BAR / 2, rgb(slot === 'fg' ? theme.foreground : (theme.ansi[slot] as string)))
      x += width + 12
    }
  })
  rect(data, MARGIN, top + BARS.length * LINE - 4, 14, 28, 2, rgb(theme.cursor))
  const width = (CARD_WIDTH - MARGIN * 2 - GAP * 7) / 8
  const bottom = CARD_HEIGHT - MARGIN + 16 - SWATCH * 2 - GAP
  theme.ansi.forEach((color, i) => {
    rect(
      data,
      MARGIN + (i % 8) * (width + GAP),
      bottom + Math.floor(i / 8) * (SWATCH + GAP),
      width,
      SWATCH,
      10,
      rgb(color),
    )
  })
  return encodeRgb({ width: CARD_WIDTH, height: CARD_HEIGHT, data })
}
