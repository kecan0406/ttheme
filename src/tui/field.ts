import { graphemes } from '../ansi.ts'

function printable(key: string): boolean {
  return [...key].length === 1 && key >= ' ' && key !== '\x7f'
}

function plain(text: string): string {
  return [...text.replace(/[\r\n\t]+/g, ' ')].filter(printable).join('')
}

export function edit(value: string, key: string, accept: (ch: string) => boolean = () => true): string | undefined {
  if (key === 'backspace') {
    return [...graphemes.segment(value)]
      .slice(0, -1)
      .map((part) => part.segment)
      .join('')
  }
  if (key === 'ctrl-u') {
    return ''
  }
  if (key === 'ctrl-w' || key === 'alt-backspace') {
    return value.replace(/\S*\s*$/, '')
  }
  return printable(key) && accept(key) ? value + key : undefined
}

export class Field {
  value: string

  constructor(value = '') {
    this.value = value
  }

  key(key: string): boolean {
    const next = edit(this.value, key)
    if (next === undefined) {
      return false
    }
    this.value = next
    return true
  }

  paste(text: string): void {
    this.value += plain(text)
  }
}
