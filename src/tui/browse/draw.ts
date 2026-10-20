import { cells } from '../../core/text.ts'
import { isRemote, OFFICIAL, parseSource, shownSource } from '../../store/sources.ts'
import { fit } from '../ansi.ts'
import { rowSpot } from '../palette-prompt.ts'
import { boxEdge, buttonOf } from '../parts.ts'
import { MARKS, type Paint } from '../style.ts'
import type { Detail } from './types.ts'

export const EMPTY: Detail = { title: '', lines: [], brief: '' }

export function typedSource(text: string): string | undefined {
  const typed = text.trim()

  if (typed !== OFFICIAL && !typed.includes('/') && !typed.startsWith('~')) {
    return undefined
  }

  try {
    return parseSource(typed)
  } catch {
    return undefined
  }
}

export function whereOf(source: string): string {
  return source === OFFICIAL ? 'Built in' : isRemote(source) ? source : shownSource(source)
}

export function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function button(
  p: Paint,
  at: number,
  focused: boolean,
  mark: string,
  label: string,
  note: string,
  how: { pane?: string; off?: boolean; danger?: boolean } = {},
): string {
  const chip = buttonOf(p, `${mark} ${label}`, how.off ? 'off' : focused ? 'focus' : 'idle', how.danger)

  return `${focused ? `${MARKS.gutter} ` : '  '}${rowSpot(at, 'box', `${chip}${note}`, how.pane)}`
}

export function lit(focused: boolean, text: string): string {
  return `${focused ? `${MARKS.gutter} ` : '  '} ${text}`
}

export function framed(p: Paint, width: number, text: string): string[] {
  const edge = (left: string, right: string) => p.dim(`${left}${'─'.repeat(width - 2)}${right}`)
  const side = p.dim('│')

  return [edge('╭', '╮'), `${side} ${fit(text, width - 4)} ${side}`, edge('╰', '╯')]
}

export function edge(
  p: Paint,
  width: number,
  at: 'top' | 'mid' | 'bottom',
  head: string,
  tail: string,
  lit: boolean,
): string {
  const frame = (text: string) => (lit ? p.accent(text) : p.dim(text))
  const [left = '', right = ''] = [...boxEdge(2, at)]
  const title = head ? ` ${fit(head, width - 8, false)} ` : ''
  const end = tail ? ` ${tail} ` : ''
  const fill = Math.max(0, width - 3 - cells(title) - cells(end) - (tail ? 1 : 0))

  return `${frame(`${left}─`)}${title}${frame('─'.repeat(fill))}${end}${frame(`${tail ? '─' : ''}${right}`)}`
}
