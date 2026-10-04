import cells from 'fast-string-width'

function rgb(hex: string): string {
  const h = hex.replace('#', '')
  return [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((c) => Number.parseInt(c, 16)).join(';')
}

export function ansiFg(color: string): string {
  return `\x1b[38;2;${rgb(color)}m`
}

export function ansiBar(bg: string, fg: string): string {
  return `\x1b[48;2;${rgb(bg)};38;2;${rgb(fg)}m`
}

export function ansiSquares(colors: string[], after = '\x1b[39m'): string {
  return `${colors.map((c) => `${ansiFg(c)}■`).join(' ')}${after}`
}

export { cells }

export const RESET = '\x1b[0m'
export const BOLD = '\x1b[1m'
export const DIM = '\x1b[2m'
export const NORMAL = '\x1b[22m'
export const GREEN = '\x1b[32m'
export const YELLOW = '\x1b[33m'
export const CYAN = '\x1b[36m'
export const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export const LINK = '⧉'

export function linked(text: string, url: string | undefined): string {
  return url ? `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\` : text
}

export function sequenceAt(text: string, at: number): number {
  if (text[at] !== '\x1b') {
    return 0
  }
  if (text[at + 1] === ']') {
    const bell = text.indexOf('\x07', at + 2)
    const st = text.indexOf('\x1b\\', at + 2)
    const end = bell !== -1 && (st === -1 || bell < st) ? bell + 1 : st !== -1 ? st + 2 : 0
    return end ? end - at : 0
  }
  if (text[at + 1] !== '[') {
    return 0
  }
  let end = at + 2
  while (end < text.length && !/[@-~]/.test(text[end] as string)) {
    end++
  }
  return end < text.length ? end - at + 1 : 0
}

export const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export interface Piece {
  text: string
  start: number
  end: number
  width: number
  sequence: boolean
}

export function pieces(text: string): Piece[] {
  const out: Piece[] = []
  let i = 0
  while (i < text.length) {
    const sequence = sequenceAt(text, i)
    if (sequence > 0) {
      out.push({ text: text.slice(i, i + sequence), start: i, end: i + sequence, width: 0, sequence: true })
      i += sequence
      continue
    }
    const next = text.indexOf('\x1b', i + 1)
    const stop = next === -1 ? text.length : next
    for (const { segment, index } of graphemes.segment(text.slice(i, stop))) {
      out.push({
        text: segment,
        start: i + index,
        end: i + index + segment.length,
        width: cells(segment),
        sequence: false,
      })
    }
    i = stop
  }
  return out
}

function take(text: string, room: number): { head: string; used: number } {
  let head = ''
  let used = 0
  for (const piece of pieces(text)) {
    if (!piece.sequence) {
      if (used + piece.width > room) {
        break
      }
      used += piece.width
    }
    head += piece.text
  }
  return { head, used }
}

export function fit(text: string, width: number, pad = true): string {
  if (width <= 0) {
    return ''
  }
  const full = cells(text)
  if (full <= width) {
    return pad ? text + ' '.repeat(width - full) : text
  }
  const { head, used } = take(text, width - 1)
  return `${head}${text.includes('\x1b') ? '\x1b[0m' : ''}…${pad ? ' '.repeat(width - 1 - used) : ''}`
}

export function clip(text: string, width: number): string {
  const { head, used } = take(text, width)
  return `${head}${text.includes('\x1b') ? RESET : ''}${' '.repeat(width - used)}`
}

export function spread(left: string, right: string, width: number): string {
  const room = width - cells(right) - 1
  return room <= 0 ? fit(left, width) : `${fit(left, room)} ${right}`
}

export function wrapText(text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (let word of text.split(/\s+/).filter(Boolean)) {
    const joined = line ? `${line} ${word}` : word
    if (cells(joined) <= width) {
      line = joined
      continue
    }
    if (line) {
      lines.push(line)
    }
    while (cells(word) > width) {
      const { head } = take(word, width)
      const cut = Math.max(head.lastIndexOf('/') + 1, head.lastIndexOf('#'))
      const at = cut > 0 ? cut : head.length || (pieces(word)[0] as Piece).end
      lines.push(word.slice(0, at))
      word = word.slice(at)
    }
    line = word
  }
  if (line) {
    lines.push(line)
  }
  return lines
}
