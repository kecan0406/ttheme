import { cells } from '../core/text.ts'
import { clip, fit } from './ansi.ts'
import type { Bar, Hint } from './bar.ts'
import { Field } from './field.ts'
import { moreOf } from './parts.ts'
import { MARKS, type Paint } from './style.ts'
import { zone } from './zones.ts'

export interface Topic {
  label: string
  text: string
  run?: () => void
}

export interface TopicSpot {
  kind: 'topic'
  index: number
}

export type Legend = [mark: string, means: string][]

export type Answer = 'stay' | 'close' | 'run'

const CHROME = 5

export class Help {
  readonly filter = new Field()
  private at = 0
  private top = 0
  private readonly topics: Topic[]
  private readonly legend: Legend

  constructor(topics: Topic[], legend: Legend = []) {
    this.topics = topics
    this.legend = legend
    this.settle()
  }

  shown(): Topic[] {
    const want = this.filter.value.toLowerCase()

    return want ? this.topics.filter((t) => `${t.label} ${t.text}`.toLowerCase().includes(want)) : this.topics
  }

  chosen(): Topic | undefined {
    return this.shown()[this.at]?.run ? this.shown()[this.at] : undefined
  }

  key(key: string): Answer {
    if (key === '?') {
      return 'close'
    }

    if (key === 'esc') {
      if (!this.filter.value) {
        return 'close'
      }

      this.filter.value = ''
      this.settle()

      return 'stay'
    }

    if (key === 'up' || key === 'down') {
      this.step(key === 'up' ? -1 : 1)

      return 'stay'
    }

    if (key === 'enter') {
      return this.chosen() ? 'run' : 'stay'
    }

    if (this.filter.key(key)) {
      this.settle()
    }

    return 'stay'
  }

  paste(text: string): void {
    this.filter.paste(text)
    this.settle()
  }

  point(index: number): boolean {
    if (!this.shown()[index]?.run) {
      return false
    }

    this.at = index

    return true
  }

  wheel(step: number): void {
    this.step(step, false)
  }

  bar(): Bar {
    const runs = this.shown().some((t) => t.run)

    const keys: Hint[] = runs
      ? [
          ['↑↓', 'choose'],
          ['enter', 'run'],
        ]
      : []

    return {
      badge: 'HELP',
      keys: [...keys, ['type', 'to filter']],
      right: this.filter.value ? ['esc', 'clear filter'] : ['? esc', 'close'],
    }
  }

  box(p: Paint, cols: number, rows: number): string[] {
    const shown = this.shown()
    const pad = Math.max(8, ...this.topics.map((t) => t.label.length)) + 3
    const legend = this.legend.map(([mark, means]) => `${mark} ${means}`)
    const widest = Math.max(0, ...this.topics.map((t) => cells(t.text)))
    const w = Math.max(24, Math.min(cols - 2, 8 + pad + widest))
    const inner = w - 4
    const side = (text: string) => `│ ${fit(text, inner)} │`
    const marks = lines(legend, inner - pad)
    const room = Math.max(1, rows - 1 - CHROME - (marks.length > 0 ? marks.length + 1 : 0))
    const most = Math.max(0, shown.length - room)
    const fits = shown.length <= room
    const span = fits ? shown.length : Math.max(1, room - 2)

    if (this.at < this.top) {
      this.top = this.at
    } else if (this.at >= this.top + span) {
      this.top = this.at - span + 1
    }

    this.top = Math.max(0, Math.min(this.top, fits ? 0 : shown.length - span, most))
    const window = shown.slice(this.top, this.top + span)
    const above = this.top
    const below = shown.length - this.top - window.length

    const rowOf = (t: Topic, i: number) => {
      const index = this.top + i
      const on = index === this.at && t.run !== undefined
      const lead = on ? p.accent(MARKS.focus) : ' '
      const label = t.label ? p.bold(on ? p.accent(t.label.padEnd(pad)) : t.label.padEnd(pad)) : ' '.repeat(pad)
      const text = `${lead} ${label}${t.text}`

      return side(t.run ? zone({ kind: 'topic', index } satisfies TopicSpot, text) : text)
    }

    const typed = this.filter.value
    const filter = `${p.dim(MARKS.search)} ${typed ? typed : p.dim('Type to filter')}`

    return [
      `╭─ Help ${'─'.repeat(Math.max(0, w - 9))}╮`,
      side(filter),
      side(''),
      ...(fits ? [] : [side(above > 0 ? p.dim(moreOf(-1, above)) : '')]),
      ...(window.length > 0 ? window.map(rowOf) : [side(p.dim(`  Nothing matches '${typed}'`))]),
      ...(fits ? [] : [side(below > 0 ? p.dim(moreOf(1, below)) : '')]),
      ...(marks.length > 0
        ? [
            side(''),
            ...marks.map((line, i) => side(`  ${i === 0 ? p.bold('Marks'.padEnd(pad)) : ' '.repeat(pad)}${line}`)),
          ]
        : []),
      side(''),
      `╰${'─'.repeat(Math.max(0, w - 2))}╯`,
    ]
  }

  private step(step: number, wrap = true): void {
    const runs = this.shown().flatMap((t, i) => (t.run ? [i] : []))

    if (runs.length === 0) {
      return
    }

    const at = runs.indexOf(this.at)

    const next =
      at < 0 ? 0 : wrap ? (at + step + runs.length) % runs.length : Math.max(0, Math.min(runs.length - 1, at + step))

    this.at = runs[next] as number
  }

  private settle(): void {
    const runs = this.shown().flatMap((t, i) => (t.run ? [i] : []))
    this.at = runs[0] ?? 0
    this.top = 0
  }
}

function lines(items: string[], width: number): string[] {
  const out: string[] = []
  let line = ''

  for (const item of items) {
    const joined = line ? `${line}   ${item}` : item

    if (line && cells(joined) > width) {
      out.push(line)
      line = item
    } else {
      line = joined
    }
  }

  return line ? [...out, line] : out
}

export function overlay(lines: string[], box: string[], cols: number, rows: number, top = 0): string[] {
  const w = Math.max(0, ...box.map((line) => cells(line)))
  const x = Math.max(0, Math.floor((cols - w) / 2))
  const y = Math.max(0, Math.min(Math.max(top, Math.floor((rows - box.length) / 2)), rows - 1 - box.length))

  return lines.map((line, i) => {
    const part = box[i - y]

    return part === undefined ? line : `${clip(line, x)}${part}`
  })
}
