import { cells } from '../core/text.ts'
import { fit, spread } from './ansi.ts'
import type { ReleaseLine } from './notice.ts'
import { hintOf, pillOf } from './parts.ts'
import { type Paint, SPINNER } from './style.ts'
import { keyZone } from './zones.ts'

export type Hint = [string, string]

export interface Bar {
  badge: string
  lead?: string
  short?: string
  note?: string
  keys: Hint[]
  right?: Hint
  standing?: ReleaseLine
  beat?: number
  keep?: string[]
}

const KEPT = ['?', 'enter']

const UPDATE_KEY: Hint = ['alt+u', 'update']

function releaseOf(p: Paint, standing: ReleaseLine, beat: number): string {
  const badge = (look: (text: string) => string, label: string) => (p.color ? look(` ${label} `) : label)

  if (standing.standing === 'newer') {
    return `${hintOf(p, ...UPDATE_KEY)}   ${keyZone(UPDATE_KEY[0], badge(p.alert, standing.line))}`
  }

  if (standing.standing === 'checking') {
    return badge(p.chip, `${SPINNER[beat % SPINNER.length]} ${standing.line}`)
  }

  return badge(
    standing.standing === 'failed' ? p.danger : standing.standing === 'current' ? p.good : p.chip,
    standing.line,
  )
}

export type Tone = 'ok' | 'warn' | 'error' | 'info'

export function toned(p: Paint, tone: Tone, text: string): string {
  return tone === 'info' ? text : p[tone](text)
}

export function barLine(p: Paint, bar: Bar, width: number): string {
  const hint = ([key, label]: Hint) => hintOf(p, key, label)
  const kept = new Set([...KEPT, ...(bar.keep ?? [])])
  let badge = `${pillOf(p, bar.badge)}${p.color ? '  ' : ' '}`
  let { lead, note, keys, right, standing } = bar

  const drawn = (shown: Hint[]) => {
    const line = `${badge}${[lead ?? '', note ? p.dim(note) : '', ...shown.map(hint)].filter(Boolean).join('   ')}`

    const mark = standing ? releaseOf(p, standing, bar.beat ?? 0) : ''

    const tail = [right ? hint(right) : '', mark].filter(Boolean).join('   ')

    return { line, tail, fits: cells(line) + (tail ? 3 + cells(tail) : 0) <= width }
  }

  for (;;) {
    const { line, fits } = drawn(keys)

    if (fits) {
      const back = bar.keys.reduce((held, key) => {
        const tried = held.includes(key) ? held : bar.keys.filter((each) => held.includes(each) || each === key)

        return drawn(tried).fits ? tried : held
      }, keys)

      const best = drawn(back)

      return best.tail ? spread(best.line, best.tail, width) : fit(best.line, width, false)
    }

    const drop = keys.findLastIndex(([key], i) => i > 0 && !kept.has(key))

    if (standing && standing.standing !== 'newer') {
      standing = undefined
    } else if (note) {
      note = undefined
    } else if (drop >= 0) {
      keys = keys.toSpliced(drop, 1)
    } else if (bar.short && lead !== bar.short) {
      lead = bar.short
    } else if (right) {
      right = undefined
    } else if (standing) {
      standing = undefined
    } else if (bar.short && badge) {
      badge = ''
    } else {
      return fit(line, width, false)
    }
  }
}
