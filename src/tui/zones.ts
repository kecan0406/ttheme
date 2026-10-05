import { cells, type Piece, pieces, sequenceAt } from '../ansi.ts'
import { RESET } from './style.ts'

export interface Zone<T = unknown> {
  row: number
  col: number
  width: number
  height: number
  target: T
}

export interface Hit<T = unknown> {
  target: T
  x: number
  y: number
  exact: { x: number; y: number }
  width: number
  height: number
  inside: boolean
}

export interface Lifted {
  text: string
  zones: Zone[]
}

const MOST = 9999

let marks: unknown[] | undefined

export function zone(target: unknown, text: string): string {
  if (!marks || text === '' || marks.length >= MOST) {
    return text
  }
  return `\x1b[?${marks.push(target)}y${text}\x1b[?0y`
}

export function marking<T>(draw: () => T): { drawn: T; targets: unknown[] } {
  const outer = marks
  const targets: unknown[] = []
  marks = targets
  try {
    return { drawn: draw(), targets }
  } finally {
    marks = outer
  }
}

function markOf(sequence: string): number | undefined {
  const digits = sequence.slice(3, -1)
  return sequence.startsWith('\x1b[?') && sequence.endsWith('y') && /^\d{1,4}$/.test(digits)
    ? Number(digits)
    : undefined
}

function columnOf(sequence: string): number | undefined {
  const digits = sequence.slice(2, -1)
  return sequence.startsWith('\x1b[') && sequence.endsWith('G') && /^\d*$/.test(digits)
    ? Math.max(1, Number(digits || 1)) - 1
    : undefined
}

export function lift(line: string, row: number, targets: readonly unknown[]): Lifted {
  if (!line.includes('\x1b[?')) {
    return { text: line, zones: [] }
  }
  const zones: Zone[] = []
  const open: { target: unknown; col: number }[] = []
  let text = ''
  let col = 0
  let run = ''
  const close = () => {
    const opened = open.pop()
    if (opened && col > opened.col) {
      zones.push({ row, col: opened.col, width: col - opened.col, height: 1, target: opened.target })
    }
  }
  let at = 0
  while (at < line.length) {
    const next = line.indexOf('\x1b', at)
    if (next !== at) {
      const end = next === -1 ? line.length : next
      run += line.slice(at, end)
      text += line.slice(at, end)
      at = end
      continue
    }
    const sequence = line.slice(at, at + (sequenceAt(line, at) || 1))
    at += sequence.length
    const mark = markOf(sequence)
    const moved = mark === undefined ? columnOf(sequence) : undefined
    if (mark === undefined && moved === undefined) {
      text += sequence
      continue
    }
    col += cells(run)
    run = ''
    if (moved !== undefined) {
      col = moved
      text += sequence
    } else if (mark === 0) {
      close()
    } else if (mark !== undefined) {
      open.push({ target: targets[mark - 1], col })
    }
  }
  col += cells(run)
  while (open.length > 0) {
    close()
  }
  return { text, zones }
}

export function cover(line: string, col: number, over: string): string {
  const open: string[] = []
  const styles: string[] = []
  let link = ''
  const track = (sequence: string) => {
    const mark = markOf(sequence)
    if (mark === 0) {
      open.pop()
    } else if (mark !== undefined) {
      open.push(sequence)
    } else if (sequence.startsWith('\x1b]8;')) {
      const uri = sequence
        .slice(sequence.indexOf(';', 4) + 1)
        .replace('\x07', '')
        .replace('\x1b\\', '')
      link = uri === '' ? '' : sequence
    } else if (sequence.startsWith('\x1b[') && sequence.endsWith('m')) {
      styles.push(sequence)
    }
  }
  const reset = line.includes('\x1b') || over.includes('\x1b') ? RESET : ''
  const all = pieces(line)
  let head = ''
  let x = 0
  let k = 0
  while (k < all.length && x < col) {
    const piece = all[k] as Piece
    if (piece.sequence) {
      track(piece.text)
    } else if (x + piece.width > col) {
      break
    } else {
      x += piece.width
    }
    head += piece.text
    k++
  }
  head += ' '.repeat(col - Math.min(col, x))
  const closing = `${'\x1b[?0y'.repeat(open.length)}${link ? '\x1b]8;;\x1b\\' : ''}${reset}`
  const end = col + cells(over)
  while (k < all.length && x < end) {
    const piece = all[k] as Piece
    if (piece.sequence) {
      track(piece.text)
    } else {
      x += piece.width
    }
    k++
  }
  if (k >= all.length) {
    return `${head}${closing}${over}${reset}`
  }
  const resume = `${styles.join('')}${link}${open.join('')}${' '.repeat(Math.max(0, x - end))}`
  return `${head}${closing}${over}${reset}${resume}${line.slice((all[k] as Piece).start)}`
}

export function lifted(lines: readonly string[], targets: readonly unknown[]): { lines: string[]; zones: Zone[] } {
  const zones: Zone[] = []
  const texts = lines.map((line, row) => {
    const one = lift(line, row, targets)
    zones.push(...one.zones)
    return one.text
  })
  return { lines: texts, zones }
}

export function relative<T>(zone: Zone<T>, row: number, col: number, fx = 0.5, fy = 0.5): Hit<T> {
  const x = col - zone.col
  const y = row - zone.row
  return {
    target: zone.target,
    x,
    y,
    exact: { x: x + fx, y: y + fy },
    width: zone.width,
    height: zone.height,
    inside: x >= 0 && x < zone.width && y >= 0 && y < zone.height,
  }
}

export function zoneAt<T>(zones: readonly Zone<T>[], row: number, col: number): Zone<T> | undefined {
  let best: Zone<T> | undefined
  for (const zone of zones) {
    const inside = row >= zone.row && row < zone.row + zone.height && col >= zone.col && col < zone.col + zone.width
    if (inside && (!best || zone.width * zone.height <= best.width * best.height)) {
      best = zone
    }
  }
  return best
}

export interface KeySpot {
  kind: 'key'
  key: string
}

const WORDS: Record<string, string> = {
  space: ' ',
  enter: 'enter',
  esc: 'esc',
  tab: 'tab',
  bksp: 'backspace',
  '←': 'left',
  '→': 'right',
}

export function hintKey(word: string): string | undefined {
  const modified = /^(ctrl|alt)\+([a-z])$/.exec(word)
  if (modified) {
    return `${modified[1]}-${modified[2]}`
  }
  return WORDS[word] ?? ([...word].length === 1 && word !== ' ' ? word : undefined)
}

export function keyZone(word: string, text: string): string {
  const key = hintKey(word)
  return key ? zone({ kind: 'key', key } satisfies KeySpot, text) : text
}

export interface Pointed {
  action: 'press' | 'release' | 'drag' | 'move' | 'wheel'
  button: string | undefined
  row: number
  col: number
  fx?: number
  fy?: number
}

export class Pointer {
  zones: Zone[] = []
  private held: Zone | undefined

  point(event: Pointed): Hit | undefined {
    if (event.action === 'drag' || event.action === 'release') {
      const held = this.held
      if (event.action === 'release') {
        this.held = undefined
      }
      return held && relative(held, event.row, event.col, event.fx, event.fy)
    }
    const found = zoneAt(this.zones, event.row, event.col)
    if (event.action === 'press') {
      this.held = event.button === 'left' ? found : undefined
    }
    return found && relative(found, event.row, event.col, event.fx, event.fy)
  }

  drop(): void {
    this.held = undefined
  }
}
