import { cells } from '../core/text.ts'
import { fit, spread } from './ansi.ts'
import type { ReleaseLine } from './notice.ts'
import { hintOf, pillOf } from './parts.ts'
import type { Paint } from './style.ts'
import { keyZone } from './zones.ts'

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

export const UPDATE_KEY: Hint = ['alt+u', 'update']

function releaseOf(p: Paint, standing: ReleaseLine): string {
  if (standing.standing !== 'newer') {
    return (standing.standing === 'failed' ? p.warn : p.dim)(standing.line)
  }

  const cut = standing.line.indexOf('  ')
  const news = standing.line.slice(cut + 2)

  return `${hintOf(p, ...UPDATE_KEY)}   ${p.dim(standing.line.slice(0, cut))}  ${keyZone(UPDATE_KEY[0], p.color ? p.alert(` ${news} `) : news)}`
}

export type Tone = 'ok' | 'warn' | 'error' | 'info'

export function toned(p: Paint, tone: Tone, text: string): string {
  return tone === 'info' ? text : p[tone](text)
}

export function barLine(p: Paint, bar: Bar, width: number): string {
  const badge = `${pillOf(p, bar.badge)}${p.color ? '  ' : ' '}`
  const hint = ([key, label]: Hint) => hintOf(p, key, label)
  const kept = new Set([...KEPT, ...(bar.keep ?? [])])
  let { note, keys, right, standing } = bar

  const drawn = (shown: Hint[]) => {
    const line = `${badge}${[bar.lead ?? '', note ? p.dim(note) : '', ...shown.map(hint)].filter(Boolean).join('   ')}`

    const mark = standing ? releaseOf(p, standing) : ''

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
    } else if (right) {
      right = undefined
    } else if (standing) {
      standing = undefined
    } else {
      return fit(line, width, false)
    }
  }
}
