import { encode } from 'uqr'
import { indexed, RESET } from './tui/style.ts'

const INK = indexed(16, 231)
const HALVES = [' ', '▀', '▄', '█']

export function qrLines(text: string): string[] {
  const { data } = encode(text, { border: 2, boostEcc: true })
  const lines: string[] = []
  for (let y = 0; y < data.length; y += 2) {
    const top = data[y] ?? []
    const bottom = data[y + 1] ?? []
    lines.push(`${INK}${top.map((dark, x) => HALVES[(dark ? 1 : 0) + (bottom[x] ? 2 : 0)]).join('')}${RESET}`)
  }
  return lines
}
