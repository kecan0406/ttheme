import { cells } from '../core/text.ts'
import { fit, spread } from './ansi.ts'
import type { ReleaseLine } from './notice.ts'
import { hintOf, pillOf } from './parts.ts'
import type { Paint } from './style.ts'

export type Hint = [string, string]

export interface Bar {
  badge: string
  lead?: string
  note?: string
  keys: Hint[]
  right?: Hint
  standing?: ReleaseLine
  keep?: string[]
}

export const KEPT = ['?', 'enter']

export type Tone = 'ok' | 'warn' | 'error' | 'info'

export function toned(p: Paint, tone: Tone, text: string): string {
  return tone === 'info' ? text : p[tone](text)
}

export function barLine(p: Paint, bar: Bar, width: number): string {
  const badge = `${pillOf(p, bar.badge)}${p.color ? '  ' : ' '}`
  const hint = ([key, label]: Hint) => hintOf(p, key, label)
  const kept = new Set([...KEPT, ...(bar.keep ?? [])])
  let { note, keys, right, standing } = bar

  for (;;) {
    const line = `${badge}${[bar.lead ?? '', note ? p.dim(note) : '', ...keys.map(hint)].filter(Boolean).join('   ')}`

    const mark = standing
      ? (standing.standing === 'newer' || standing.standing === 'failed' ? p.warn : p.dim)(standing.line)
      : ''

    const tail = [right ? hint(right) : '', mark].filter(Boolean).join('   ')

    if (cells(line) + (tail ? 3 + cells(tail) : 0) <= width) {
      return tail ? spread(line, tail, width) : fit(line, width, false)
    }

    const drop = keys.findLastIndex(([key], i) => i > 0 && !kept.has(key))

    if (standing) {
      standing = undefined
    } else if (note) {
      note = undefined
    } else if (drop >= 0) {
      keys = keys.toSpliced(drop, 1)
    } else if (right) {
      right = undefined
    } else {
      return fit(line, width, false)
    }
  }
}
