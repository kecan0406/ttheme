import measure from 'fast-string-width'

const PRINTABLE = /^[\x20-\x7e]*$/

const WIDTHS = new Map<string, number>()

const WIDTHS_MOST = 8192

const WIDTH_LONGEST = 512

export function printable(text: string): boolean {
  return PRINTABLE.test(text)
}

const STEERING = /[\p{Cc}\p{Bidi_Control}]/gu

export function inert(text: string): string {
  return text
    .replace(/\p{Bidi_Control}/gu, '')
    .replace(/[\p{Cc}\s]+/gu, ' ')
    .trim()
}

export function inertLines(text: string): string {
  return text.replace(STEERING, (ch) => (ch === '\n' ? ch : ch === '\t' ? ' ' : ''))
}

export function escaped(text: string): string {
  return text.replace(STEERING, (ch) => `\\u${(ch.codePointAt(0) ?? 0).toString(16).padStart(4, '0')}`)
}

export function quoted(text: string): string {
  return escaped(JSON.stringify(text))
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

const KATAKANA = /[ァ-ヶ]/g

const SPACE = /[\s\p{P}\p{S}]+/gu

function searchKey(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(KATAKANA, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(SPACE, '')
}

export function containsText(fields: readonly string[], query: string): boolean {
  const key = searchKey(query)

  if (key === '') {
    const raw = query.toLowerCase()

    return fields.some((field) => field.toLowerCase().includes(raw))
  }

  return fields.some((field) => searchKey(field).includes(key))
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
