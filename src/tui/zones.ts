import { cells } from '../core/text.ts'
import { type Piece, pieces, sequenceAt } from './ansi.ts'
import { LOOKS, type Look, RESET } from './style.ts'

export interface Zone<T = unknown> {
  row: number
  col: number
  width: number
  height: number
  target: T
  mark?: number
  hot?: boolean
  family?: string
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

interface Lifted {
  text: string
  zones: Zone[]
}

const MOST = 9999

export interface Marked {
  target: unknown
  look?: Look
  family?: string
}

let marks: Marked[] | undefined

export type Target = { readonly kind: string } | string

export function zone<T extends Target>(target: T, text: string, look?: Look, family?: string): string {
  if (!marks || text === '' || marks.length >= MOST) {
    return text
  }

  const marked = { target, ...(look ? { look } : {}), ...(family ? { family } : {}) }

  return `\x1b[?${marks.push(marked)}y${text}\x1b[?0y`
}

export function marking<T>(draw: () => T) {
  const outer = marks
  const targets: Marked[] = []
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

export function unzoned(line: string): string {
  return pieces(line)
    .filter((piece) => !piece.sequence || markOf(piece.text) === undefined)
    .map((piece) => piece.text)
    .join('')
}

function columnOf(sequence: string): number | undefined {
  const digits = sequence.slice(2, -1)

  return sequence.startsWith('\x1b[') && sequence.endsWith('G') && /^\d*$/.test(digits)
    ? Math.max(1, Number(digits || 1)) - 1
    : undefined
}

export function lift(line: string, row: number, targets: readonly Marked[]): Lifted {
  if (!line.includes('\x1b[?')) {
    return { text: line, zones: [] }
  }

  const zones: Zone[] = []
  const open: { id: number; col: number }[] = []
  let text = ''
  let col = 0
  let run = ''

  const close = () => {
    const opened = open.pop()

    const marked = opened && targets[opened.id - 1]

    if (opened && marked && col > opened.col) {
      zones.push({
        row,
        col: opened.col,
        width: col - opened.col,
        height: 1,
        target: marked.target,
        mark: opened.id,
        ...(marked.look ? { hot: true } : {}),
        ...(marked.family ? { family: marked.family } : {}),
      })
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
      open.push({ id: mark, col })
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

  const rest = k < all.length ? line.slice((all[k] as Piece).start) : ''

  if (rest === '' && x <= end) {
    return `${head}${closing}${over}${reset}`
  }

  const resume = `${styles.join('')}${link}${open.join('')}${' '.repeat(Math.max(0, x - end))}`

  return `${head}${closing}${over}${reset}${resume}${rest}`
}

export function lifted(lines: readonly string[], targets: readonly Marked[]) {
  const each = lines.map((line, row) => lift(line, row, targets))

  return { lines: each.map((one) => one.text), zones: each.flatMap((one) => one.zones) }
}

export function relit(line: string, shown: Lit, targets: readonly Marked[]): string {
  const open: { id: number; at: number }[] = []
  const done = new Set<number>()
  let out = ''
  let at = 0

  const close = () => {
    const opened = open.pop()
    const look = opened && shown.marks.has(opened.id) ? targets[opened.id - 1]?.look : undefined

    if (opened && look && !done.has(opened.id)) {
      done.add(opened.id)
      const closer = out.endsWith('\x1b[?0y') ? '\x1b[?0y' : ''
      const inner = out.slice(opened.at, out.length - closer.length)
      out = `${out.slice(0, opened.at)}${look(inner, shown.pressed)}${closer}`
    }
  }

  while (at < line.length) {
    const next = line.indexOf('\x1b[?', at)

    if (next === -1) {
      out += line.slice(at)
      break
    }

    out += line.slice(at, next)
    const length = sequenceAt(line, next) || 1
    const sequence = line.slice(next, next + length)
    const mark = markOf(sequence)
    at = next + length
    out += sequence

    if (mark === 0) {
      close()
    } else if (mark !== undefined) {
      open.push({ id: mark, at: out.length })
    }
  }

  while (open.length > 0) {
    close()
  }

  return out
}

function relative<T>(zone: Zone<T>, row: number, col: number, fx = 0.5, fy = 0.5): Hit<T> {
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

const WORDS = new Map([
  ['space', ' '],
  ['enter', 'enter'],
  ['esc', 'esc'],
  ['tab', 'tab'],
  ['bksp', 'backspace'],
  ['del', 'delete'],
  ['←', 'left'],
  ['→', 'right'],
])

export function hintKey(word: string): string | undefined {
  const modified = /^(ctrl|alt)\+([a-z])$/.exec(word)

  if (modified) {
    return `${modified[1]}-${modified[2]}`
  }

  return WORDS.get(word) ?? ([...word].length === 1 && word !== ' ' ? word : undefined)
}

export function keyZone(word: string, text: string): string {
  const key = hintKey(word)

  return key ? zone({ kind: 'key', key } satisfies KeySpot, text, LOOKS.flat) : text
}

interface Pointed {
  action: 'press' | 'release' | 'drag' | 'move' | 'wheel'
  button: string | undefined
  row: number
  col: number
  fx?: number
  fy?: number
}

export interface Lit {
  marks: ReadonlySet<number>
  pressed: boolean
  hot: boolean
}

const UNLIT: Lit = { marks: new Set(), pressed: false, hot: false }

function same(one: Zone, other: Zone): boolean {
  return one.target === other.target || JSON.stringify(one.target) === JSON.stringify(other.target)
}

function holds(zone: Zone, row: number, col: number): boolean {
  return row >= zone.row && row < zone.row + zone.height && col >= zone.col && col < zone.col + zone.width
}

export class Pointer {
  zones: Zone[] = []
  private held: Zone | undefined
  private at: { row: number; col: number } | undefined
  private moving = false
  private under: readonly Zone[] = []

  moved(event: { row: number; col: number } | undefined): boolean {
    this.moving ||= event !== undefined
    this.at = event && { row: event.row, col: event.col }
    const under = this.hovered()
    const changed = under.length !== this.under.length || under.some((one, i) => one !== this.under[i])
    this.under = under

    return changed
  }

  lit(allowed: (target: Target) => boolean = () => true): Lit {
    this.under = this.hovered()
    const held = this.held
    const hot = this.under.filter((one) => one.hot && allowed(one.target as Target))
    const shown = held ? hot.filter((one) => same(one, held)) : hot

    if (shown.length === 0) {
      return UNLIT
    }

    const lighted = this.zones.filter(
      (one) =>
        one.hot &&
        one.mark !== undefined &&
        shown.some((each) => same(each, one) || (each.family && each.family === one.family)),
    )

    return {
      marks: new Set(lighted.map((one) => one.mark as number)),
      pressed: held !== undefined,
      hot: true,
    }
  }

  private hovered(): readonly Zone[] {
    const at = this.at

    return (this.moving || this.held) && at ? this.zones.filter((one) => holds(one, at.row, at.col)) : []
  }

  point(event: Pointed): Hit | undefined {
    this.at = { row: event.row, col: event.col }

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
