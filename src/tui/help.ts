import { cells } from '../core/text.ts'
import { fit } from './ansi.ts'
import type { Bar, Hint } from './bar.ts'
import { Field } from './field.ts'
import { boxEdge, boxed, boxTitle, moreOf } from './parts.ts'
import { MARKS, type Paint } from './style.ts'
import { cover, unzoned, zone } from './zones.ts'

export interface Topic {
  label: string
  text: string
  run?: () => void
}

export interface TopicSpot {
  kind: 'topic'
  index: number
}

export type HelpSpot = TopicSpot | { kind: 'help' }

export type Legend = [mark: string, means: string][]

export type Answer = 'stay' | 'close' | 'run'

const CHROME = 5
const MEASURE = 72
const LEAST = 3

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
    const topic = this.shown()[this.at]

    return topic?.run ? topic : undefined
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
    if (index < 0 || index >= this.shown().length) {
      return false
    }

    this.at = index

    return true
  }

  wheel(step: number): void {
    this.step(step, false)
  }

  bar(): Bar {
    const keys: Hint[] = [
      ...(this.shown().length > 1 ? [['↑↓', 'choose'] as Hint] : []),
      ...(this.chosen() ? [['enter', 'run'] as Hint] : []),
    ]

    return {
      badge: 'HELP',
      keys: [...keys, ['type', 'to filter']],
      right: this.filter.value ? ['esc', 'clear filter'] : ['? esc', 'close'],
    }
  }

  box(p: Paint, cols: number, rows: number): string[] {
    const shown = this.shown()
    const pad = Math.max(8, ...this.topics.map((t) => t.label.length)) + 3
    const widest = Math.min(MEASURE, Math.max(0, ...this.topics.map((t) => cells(t.text))))
    const w = Math.max(24, Math.min(cols - 2, 8 + pad + widest))
    const inner = w - 4
    const side = (text: string) => zone({ kind: 'help' } satisfies HelpSpot, boxed(p, ` ${fit(text, inner)} `, w))
    const edge = (line: string) => zone({ kind: 'help' } satisfies HelpSpot, line)
    const texts = shown.map((t) => wrap(t.text, Math.max(8, inner - 2 - pad)))
    const tall = (from: number, to: number) => texts.slice(from, to).reduce((sum, lines) => sum + lines.length, 0)
    const legend = this.legend.map(([mark, means]) => `${mark} ${means}`)
    const listed = lines(legend, inner - 2 - pad)
    const marks = rows - 1 - CHROME - (listed.length + 1) >= LEAST ? listed : []
    const room = Math.max(1, rows - 1 - CHROME - (marks.length > 0 ? marks.length + 1 : 0))
    const fits = tall(0, shown.length) <= room
    const span = fits ? room : Math.max(1, room - 2)

    if (fits) {
      this.top = 0
    } else {
      this.place(tall, span, shown.length)
    }

    const body: string[] = []
    let end = this.top

    while (end < shown.length && (end === this.top || body.length + (texts[end] as string[]).length <= span)) {
      const t = shown[end] as Topic
      const on = end === this.at
      const lead = on ? (t.run ? p.accent(MARKS.focus) : p.dim(MARKS.focus)) : ' '
      const named = t.label.padEnd(pad)
      const label = t.label ? p.bold(on && t.run ? p.accent(named) : named) : ' '.repeat(pad)
      const index = end

      for (const [k, line] of (texts[end] as string[]).entries()) {
        const text = k === 0 ? `${lead} ${label}${line}` : `  ${' '.repeat(pad)}${line}`
        body.push(side(zone({ kind: 'topic', index } satisfies TopicSpot, text)))
      }

      end++
    }

    const typed = this.filter.value
    const filter = `${p.dim(MARKS.search)} ${typed ? typed : p.dim('Type to filter')}`

    const out = [
      edge(boxTitle(w, ' Help ', p.dim, p.bold)),
      side(filter),
      side(''),
      ...(fits ? [] : [side(this.top > 0 ? p.dim(moreOf(-1, this.top)) : '')]),
      ...(shown.length > 0 ? body.slice(0, span) : [side(p.dim(`  Nothing matches '${typed}'`))]),
      ...(fits ? [] : [side(end < shown.length ? p.dim(moreOf(1, shown.length - end)) : '')]),
      ...(marks.length > 0
        ? [
            side(''),
            ...marks.map((line, i) => side(`  ${i === 0 ? p.bold('Marks'.padEnd(pad)) : ' '.repeat(pad)}${line}`)),
          ]
        : []),
      side(''),
      edge(p.dim(boxEdge(w, 'bottom'))),
    ]

    const most = Math.max(2, rows - 1)

    return out.length <= most ? out : [...out.slice(0, most - 1), out.at(-1) as string]
  }

  private place(tall: (from: number, to: number) => number, span: number, count: number): void {
    if (this.at < this.top) {
      this.top = this.at
    }

    while (this.top < this.at && tall(this.top, this.at + 1) > span) {
      this.top++
    }

    while (this.top > 0 && tall(this.top - 1, count) <= span) {
      this.top--
    }
  }

  private step(step: number, wrap = true): void {
    const count = this.shown().length

    if (count === 0) {
      return
    }

    this.at = wrap ? (this.at + step + count) % count : Math.max(0, Math.min(count - 1, this.at + step))
  }

  private settle(): void {
    const first = this.shown().findIndex((t) => t.run)
    this.at = Math.max(0, first)
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

const SEP = `  ${MARKS.sep}  `
const TRAILING_SEP = new RegExp(`\\s+${MARKS.sep}$`)

function wrap(text: string, width: number): string[] {
  const out: string[] = []
  const push = (line: string) => out.push(line.trimEnd().replace(TRAILING_SEP, ''))
  let line = ''

  for (const part of text.split(SEP)) {
    const joined = line ? `${line}${SEP}${part}` : part

    if (cells(joined) <= width) {
      line = joined
    } else if (line && cells(part) <= width) {
      push(line)
      line = part
    } else {
      line = line ? `${line}${SEP}` : ''

      for (const word of part.match(/\S+\s*/g) ?? []) {
        if (line.trim() && cells(`${line}${word}`.trimEnd()) > width) {
          push(line)
          line = ''
        }

        line += word
      }

      line = line.trimEnd()
    }
  }

  if (line) {
    push(line)
  }

  return out.length > 0 ? out : ['']
}

export function overlay(lines: string[], box: string[], cols: number, rows: number, top = 0): string[] {
  const w = Math.max(0, ...box.map((line) => cells(line)))
  const x = Math.max(0, Math.floor((cols - w) / 2))
  const y = Math.max(0, Math.min(Math.max(top, Math.floor((rows - box.length) / 2)), rows - 1 - box.length))
  const left = x > 0 ? ' ' : ''
  const right = x + w < cols ? ' ' : ''

  return lines.map((line, i) => {
    const part = box[i - y]
    const under = i === lines.length - 1 ? line : unzoned(line)

    return part === undefined ? under : cover(under, x - left.length, `${left}${part}${right}`)
  })
}
