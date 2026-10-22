import { MARKS } from './style.ts'

export type Caps = 'mac' | 'text'

export const MODIFIERS: [string, string][] = [
  ['ctrl', '⌃'],
  ['alt', '⌥'],
  ['shift', '⇧'],
]

export const KEYCAPS: [string, string][] = [
  ['esc', '⎋'],
  ['enter', '↩'],
  ['tab', '⇥'],
  ['bksp', '⌫'],
  ['backspace', '⌫'],
  ['delete', '⌦'],
  ['pgup', '⇞'],
  ['pgdn', '⇟'],
  ['home', '↖'],
  ['end', '↘'],
]

const NAMED = new Map(KEYCAPS)
const MODIFIER = new Map(MODIFIERS)

let caps: Caps = 'text'

export function capsFor(env: Record<string, string | undefined>, platform: string): Caps {
  const setting = env.TTHEME_KEYS

  if (setting === 'mac' || setting === 'text') {
    return setting
  }

  return platform === 'darwin' && !env.SSH_CONNECTION && !env.SSH_CLIENT && !env.SSH_TTY ? 'mac' : 'text'
}

export function useCaps(chosen: Caps): void {
  caps = chosen
}

function chord(token: string): string | undefined {
  const named = NAMED.get(token.slice(1))

  if (token.startsWith('⇧') && named) {
    return `⇧${named}`
  }

  const parts = token.split('+')
  const last = parts.pop() ?? ''

  if (parts.length === 0 || !last || !parts.every((part) => MODIFIER.has(part))) {
    return undefined
  }

  const held = MODIFIERS.flatMap(([name, glyph]) => (parts.includes(name) ? [glyph] : []))

  return `${held.join('')}${NAMED.get(last) ?? ([...last].length === 1 ? last.toUpperCase() : last)}`
}

export function cap(key: string): string {
  if (caps !== 'mac') {
    return key
  }

  return key
    .split(' ')
    .map((token) => NAMED.get(token) ?? chord(token) ?? token)
    .join(' ')
}

export function capped(text: string): string {
  if (caps !== 'mac') {
    return text
  }

  let start = true

  return text
    .split(/(\s+)/)
    .map((piece) => {
      if (/^\s*$/.test(piece)) {
        start ||= piece.length >= 2

        return piece
      }

      const shown = (start ? NAMED.get(piece) : undefined) ?? chord(piece) ?? piece
      start = piece === MARKS.sep || piece === '—' || /[,:.?!]$/.test(piece)

      return shown
    })
    .join('')
}
