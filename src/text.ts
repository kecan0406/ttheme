import measure from 'fast-string-width'

const PRINTABLE = /^[\x20-\x7e]*$/

const WIDTHS = new Map<string, number>()

const WIDTHS_MOST = 8192

const WIDTH_LONGEST = 512

export function printable(text: string): boolean {
  return PRINTABLE.test(text)
}

export function cells(text: string): number {
  if (text.length === 1) {
    const code = text.charCodeAt(0)

    if (code >= 0x20 && code <= 0x7e) {
      return 1
    }
  }

  if (text.length > WIDTH_LONGEST) {
    return PRINTABLE.test(text) ? text.length : measure(text)
  }

  let width = WIDTHS.get(text)

  if (width === undefined) {
    if (WIDTHS.size >= WIDTHS_MOST) {
      WIDTHS.clear()
    }

    width = PRINTABLE.test(text) ? text.length : measure(text)
    WIDTHS.set(text, width)
  }

  return width
}

let segmenter: Intl.Segmenter | undefined

export function graphemes(text: string): Intl.Segments {
  segmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' })

  return segmenter.segment(text)
}

export function counted(n: number): string {
  return `${n} palette${n === 1 ? '' : 's'}`
}

export function ago(at: number, now = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - at) / 60_000)

  if (minutes < 1) {
    return 'just now'
  }

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)

  return hours < 48 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`
}
