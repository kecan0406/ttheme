import { fit } from '../ansi.ts'
import { MARKS, type Paint } from './style.ts'
import { keyZone } from './zones.ts'

export function tabOf(p: Paint, label: string, on: boolean, mark: (text: string) => string = (text) => text): string {
  if (!p.color) {
    return mark(on ? `[${label}]` : ` ${label} `)
  }
  return on ? p.pill(mark(` ${label} `)) : p.dim(mark(` ${label} `))
}

export function buttonOf(p: Paint, label: string, state: 'idle' | 'focus' | 'off', danger = false): string {
  if (!p.color) {
    return state === 'focus' ? `[${label}]` : ` ${label} `
  }
  if (state === 'off') {
    return p.dim(` ${label} `)
  }
  if (state === 'focus') {
    return danger ? p.danger(` ${label} `) : p.pill(` ${label} `)
  }
  return p.chip(` ${label} `)
}

export function pillOf(p: Paint, label: string): string {
  return p.color ? p.pill(` ${label} `) : `[${label}]`
}

export function hintOf(p: Paint, key: string, label: string): string {
  return keyZone(key.split(' ')[0] ?? '', `${p.bold(key)} ${p.dim(label)}`)
}

export function checkOf(p: Paint, ok: boolean | undefined): string {
  return ok === undefined ? p.dim(MARKS.sep) : ok ? p.dim(MARKS.ok) : p.bold(MARKS.miss)
}

const CORNERS = { top: '╭╮', mid: '├┤', bottom: '╰╯' }

export function boxEdge(width: number, at: keyof typeof CORNERS, labels: [number, string][] = []): string {
  const [left, right] = [...CORNERS[at]]
  const line = [...`${left}${'─'.repeat(Math.max(0, width - 2))}${right}`]
  for (const [col, text] of labels) {
    ;[...text].forEach((ch, i) => {
      if (col + i > 0 && col + i < width - 1) {
        line[col + i] = ch
      }
    })
  }
  return line.join('')
}

export function boxed(p: Paint, content: string, width: number): string {
  return `${p.dim('│')}${fit(content, width - 2)}${p.dim('│')}`
}
