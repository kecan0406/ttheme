import { slotsOfRole } from '../../src/core/builder-layout.ts'
import { sceneParts } from '../../src/core/scenes.ts'
import { cells, graphemes, printable } from '../../src/core/text.ts'

type Live = 'use' | 'name' | 'work'

export interface Run {
  text: string
  t: number
  g: number
  bold?: boolean
  faint?: boolean
  cursor?: boolean
  live?: Live
  ink?: string
  ground?: string
}

export type Line = Run[]

interface Piece {
  text: string
  cells: number
  fill: boolean
}

const BLOCKS = /^[▀-▟]+$/

export function runOf(text: string, role: string): Run {
  const { text: t, ground: g } = slotsOfRole(role)

  return {
    text,
    t,
    g,
    ...(role === 'b' || /^B\d+$/.test(role) ? { bold: true } : {}),
    ...(role === 'd' ? { faint: true } : {}),
    ...(role === 'c' ? { cursor: true } : {}),
  }
}

export function plain(text: string): Run {
  return { text, t: 1, g: 0 }
}

export function linesOf(markup: readonly string[], width = Number.POSITIVE_INFINITY): Line[] {
  return markup.flatMap((line) => {
    const parts = sceneParts(line, width)

    return parts ? [parts.map(([text, role]) => runOf(text, role))] : []
  })
}

export function textLines(text: string): Line[] {
  return text.split('\n').map((line) => (line ? [plain(line)] : []))
}

export function isPlain(run: Run): boolean {
  return (
    run.t === 1 &&
    run.g === 0 &&
    !run.bold &&
    !run.faint &&
    !run.cursor &&
    run.live === undefined &&
    run.ink === undefined &&
    run.ground === undefined
  )
}

export function widthOf(line: Line): number {
  return line.reduce((sum, run) => sum + cells(run.text), 0)
}

export function piecesOf(text: string): Piece[] {
  if (printable(text)) return [{ text, cells: 0, fill: false }]
  const pieces: Piece[] = []
  let kind = ''

  for (const { segment } of graphemes(text)) {
    const width = printable(segment) ? 0 : cells(segment)
    const fill = width > 0 && BLOCKS.test(segment)
    const next = width === 0 ? 'loose' : fill ? 'fill' : width > 1 ? 'wide' : 'narrow'
    const last = pieces.at(-1)

    if (last && next === kind && next !== 'wide') {
      last.text += segment
      last.cells += width
    } else {
      pieces.push({ text: segment, cells: width, fill })
      kind = next
    }
  }

  return pieces
}
