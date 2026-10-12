import type { Theme } from '@/lib/themes'
import { rgb } from '../../src/color.ts'
import { encodeRgb } from '../../src/png.ts'

const ICON = 180
const DOTS = [49.5, 90, 130.5]
const DOT = 21.375
const FAVICON = 48

type Canvas = { data: Uint8Array; width: number }

function rect({ data, width }: Canvas, x: number, y: number, w: number, h: number, r: number, ink: number[]) {
  for (let py = Math.floor(y); py < Math.ceil(y + h); py++) {
    for (let px = Math.floor(x); px < Math.ceil(x + w); px++) {
      const dx = Math.max(x + r - (px + 0.5), px + 0.5 - (x + w - r), 0)
      const dy = Math.max(y + r - (py + 0.5), py + 0.5 - (y + h - r), 0)
      const cover = r === 0 ? 1 : Math.min(1, Math.max(0, r + 0.5 - Math.hypot(dx, dy)))
      if (cover === 0) continue
      const at = (py * width + px) * 3
      for (let c = 0; c < 3; c++) {
        const was = data[at + c] as number
        data[at + c] = Math.round(was + ((ink[c] as number) - was) * cover)
      }
    }
  }
}

function iconPng(theme: Theme, size: number): Buffer {
  const scale = size / ICON
  const dot = DOT * scale
  const data = new Uint8Array(size * size * 3)
  const icon = { data, width: size }
  rect(icon, 0, 0, size, size, 0, rgb(theme.background))
  theme.signature.forEach((color, i) => {
    rect(icon, (DOTS[i] as number) * scale - dot, size / 2 - dot, dot * 2, dot * 2, dot, rgb(color))
  })
  return encodeRgb({ width: size, height: size, data })
}

export function touchIconPng(theme: Theme): Buffer {
  return iconPng(theme, ICON)
}

export function faviconIco(theme: Theme): Buffer {
  const image = iconPng(theme, FAVICON)
  const head = Buffer.alloc(22)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(1, 4)
  head.writeUInt8(FAVICON, 6)
  head.writeUInt8(FAVICON, 7)
  head.writeUInt16LE(1, 10)
  head.writeUInt16LE(32, 12)
  head.writeUInt32LE(image.length, 14)
  head.writeUInt32LE(head.length, 18)
  return Buffer.concat([head, image])
}
