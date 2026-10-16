import { encode } from 'uqr'
import { indexed, RESET } from './style.ts'

const INK = indexed(16, 231)
const HALVES = [' ', '▀', '▄', '█']

const MOST = 2953

interface Qr {
  lines: string[]
  cols: number
  rows: number
}

export function qrCode(text: string): Qr | undefined {
  if (Buffer.byteLength(text) > MOST) {
    return undefined
  }

  const { data } = encode(text, { border: 2, boostEcc: true })
  const lines: string[] = []

  for (let y = 0; y < data.length; y += 2) {
    const top = data[y] ?? []
    const bottom = data[y + 1] ?? []
    lines.push(`${INK}${top.map((dark, x) => HALVES[(dark ? 1 : 0) + (bottom[x] ? 2 : 0)]).join('')}${RESET}`)
  }

  return { lines, cols: data.length, rows: lines.length }
}
