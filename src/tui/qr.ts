import { encode } from 'uqr'
import { encodeGray } from '../core/png.ts'
import { graphic } from '../terminals/graphics.ts'
import { indexed, RESET } from './style.ts'

const INK = indexed(16, 231)
const HALVES = [' ', '▀', '▄', '█']

const MOST = 2953
const BORDER = 2
const QUIET = 4

interface Cell {
  w: number
  h: number
}

interface Room {
  cols: number
  rows: number
}

export interface Qr {
  cols: number
  rows: number
  out: string
}

export function qrModules(text: string): boolean[][] | undefined {
  return Buffer.byteLength(text) > MOST ? undefined : encode(text, { border: 0, boostEcc: true }).data
}

function darkAt(modules: boolean[][], margin: number): (x: number, y: number) => boolean {
  return (x, y) => modules[y - margin]?.[x - margin] === true
}

export function qrText(modules: boolean[][]): Qr {
  const size = modules.length + 2 * BORDER
  const dark = darkAt(modules, BORDER)
  const lines: string[] = []

  for (let y = 0; y < size; y += 2) {
    let line = ''

    for (let x = 0; x < size; x++) {
      line += HALVES[(dark(x, y) ? 1 : 0) + (dark(x, y + 1) ? 2 : 0)]
    }

    lines.push(`${INK}${line}${RESET}`)
  }

  return { cols: size, rows: lines.length, out: `${lines.join('\n')}\n` }
}

export function qrScale(count: number, cell: Cell, room: Room): number {
  const unit = Math.min(cell.w, cell.h / 2)
  const least = Math.max(2, Math.ceil(unit / 4))
  const most = Math.max(least, Math.round(unit / 2))
  const fit = Math.floor(Math.min(room.cols * cell.w, room.rows * cell.h) / count)

  return Math.min(most, Math.max(least, fit))
}

export function qrPicture(modules: boolean[][], cell: Cell, room: Room, id: number): Qr {
  const count = modules.length + 2 * QUIET
  const scale = qrScale(count, cell, room)
  const side = count * scale
  const cols = Math.ceil(side / cell.w)
  const rows = Math.ceil(side / cell.h)

  if (cols > room.cols || rows > room.rows) {
    return { cols, rows, out: '' }
  }

  const width = cols * cell.w
  const height = rows * cell.h
  const data = new Uint8Array(width * height).fill(255)
  const left = Math.floor((width - side) / 2) + QUIET * scale
  const top = Math.floor((height - side) / 2) + QUIET * scale

  for (let y = 0; y < modules.length; y++) {
    const row = modules[y] as boolean[]

    for (let x = 0; x < row.length; x++) {
      if (!row[x]) {
        continue
      }

      for (let dy = 0; dy < scale; dy++) {
        const at = (top + y * scale + dy) * width + left + x * scale
        data.fill(0, at, at + scale)
      }
    }
  }

  const png = encodeGray({ width, height, data }).toString('base64')
  const image = graphic(`a=T,f=100,i=${id},p=${id},c=${cols},r=${rows},C=1`, png)

  return { cols, rows, out: `${'\n'.repeat(rows)}\x1b[${rows}A\x1b7${image}\x1b8\x1b[${rows}B` }
}
