import { cells } from '../core/text.ts'
import { fit, pieces } from './ansi.ts'
import type { Bar, Hint } from './bar.ts'
import { Field } from './field.ts'
import { capped } from './keycaps.ts'
import { lineStep } from './keys.ts'
import { boxEdge, boxed, boxTitle, moreOf } from './parts.ts'
import { MARKS, type Paint } from './style.ts'
import { cover, unzoned, zone } from './zones.ts'

export interface Topic {
  group: string
  keys: string
  does: string
  more?: string
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
const MEASURE = 56
const KEYS_MOST = 24
const GROUP_MOST = 16
const MORE_MOST = 2
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

    return want
      ? this.topics.filter((t) => `${t.group} ${t.keys} ${t.does} ${t.more ?? ''}`.toLowerCase().includes(want))
      : this.topics
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

    const line = lineStep(key)

    if (line !== undefined) {
      this.step(line)

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
      right: this.filter.value ? ['esc', 'clear'] : ['? esc', 'close'],
    }
  }

  box(p: Paint, cols: number, rows: number): string[] {
    const shown = this.shown()
    const keysOf = (t: Topic) => capped(t.keys)
    const gw = Math.min(GROUP_MOST, Math.max(5, ...this.topics.map((t) => cells(t.group))))
    const kw = Math.min(KEYS_MOST, Math.max(4, ...this.topics.map((t) => cells(keysOf(t)))))
    const dw = Math.min(MEASURE, Math.max(12, ...this.topics.map((t) => cells(t.does))))
    const w = Math.max(28, Math.min(cols - 2, gw + kw + dw + 10))
    const inner = w - 4
    const room = Math.max(8, inner - gw - kw - 6)
    const indent = ' '.repeat(gw + 4)
    const side = (text: string) => zone({ kind: 'help' } satisfies HelpSpot, boxed(p, ` ${fit(text, inner)} `, w))
    const edge = (line: string) => zone({ kind: 'help' } satisfies HelpSpot, line)
    const texts = shown.map((t) => wrap(t.does, room))
    const mores = shown.map((t) => (t.more ? clipped(wrap(t.more, inner - gw - 4), inner - gw - 4) : []))

    const tall = (from: number, to: number) => texts.slice(from, to).reduce((sum, wrapped) => sum + wrapped.length, 0)

    const legend = lines(
      this.legend.map(([mark, means]) => `${mark} ${means}`),
      inner - gw - 4,
    )

    const most = Math.max(0, ...mores.map((m) => m.length))
    const listed = tall(0, shown.length)
    let budget = rows - 1 - CHROME
    const more = most > 0 && (listed + most + 1 <= budget || (listed > budget && budget - (most + 1) >= LEAST))

    if (more) {
      budget -= most + 1
    }

    const marks = listed + legend.length + 1 <= budget ? legend : []

    if (marks.length > 0) {
      budget -= marks.length + 1
    }

    const space = Math.max(1, budget)
    const fits = listed <= space
    const span = fits ? space : Math.max(1, space - 2)

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
      const named = end === this.top || shown[end - 1]?.group !== t.group
      const group = named ? p.bold(fit(t.group, gw)) : ' '.repeat(gw)
      const keys = fit(keysOf(t), kw)
      const index = end

      for (const [k, line] of (texts[end] as string[]).entries()) {
        const head =
          k === 0 ? `${lead} ${group}  ${on && t.run ? p.accent(keys) : p.bold(keys)}` : `${indent}${' '.repeat(kw)}`

        body.push(side(zone({ kind: 'topic', index } satisfies TopicSpot, `${head}  ${line}`)))
      }

      end++
    }

    const typed = this.filter.value
    const filter = `${p.dim(MARKS.search)} ${typed ? typed : p.dim('Type to filter')}`
    const told = mores[this.at] ?? []

    const out = [
      edge(boxTitle(w, ' Help ', p.dim, p.bold)),
      side(filter),
      side(''),
      ...(fits ? [] : [side(this.top > 0 ? p.dim(moreOf(-1, this.top)) : '')]),
      ...(shown.length > 0 ? body.slice(0, span) : [side(p.dim(`  No keys match '${typed}'`))]),
      ...(fits ? [] : [side(end < shown.length ? p.dim(moreOf(1, shown.length - end)) : '')]),
      ...(more ? [side(''), ...Array.from({ length: most }, (_, i) => side(`${indent}${p.dim(told[i] ?? '')}`))] : []),
      ...(marks.length > 0
        ? [
            side(''),
            ...marks.map((line, i) => side(`  ${i === 0 ? p.bold('Marks'.padEnd(gw)) : ' '.repeat(gw)}  ${line}`)),
          ]
        : []),
      side(''),
      edge(p.dim(boxEdge(w, 'bottom'))),
    ]

    const tallest = Math.max(2, rows - 1)

    return out.length <= tallest ? out : [...out.slice(0, tallest - 1), out.at(-1) as string]
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

function clipped(wrapped: string[], width: number): string[] {
  return wrapped.length <= MORE_MOST
    ? wrapped
    : [...wrapped.slice(0, MORE_MOST - 1), fit(wrapped.slice(MORE_MOST - 1).join(' '), width, false)]
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

export function wrap(text: string, width: number): string[] {
  const out: string[] = []
  let line = ''

  for (const word of text.match(/\S+\s*/g) ?? []) {
    if (line.trim() && cells(`${line}${word}`.trimEnd()) > width) {
      out.push(line.trimEnd())
      line = ''
    }

    line += word
  }

  if (line.trim()) {
    out.push(line.trimEnd())
  }

  return out.length > 0 ? out : ['']
}

const EDGES = /^[─│╭╮╯╰├┤┬┴┼┌┐└┘]$/u

function edgeAt(line: string, col: number): boolean {
  let at = 0

  for (const ch of pieces(line).flatMap((piece) => (piece.sequence ? [] : [...piece.text]))) {
    if (at === col) {
      return EDGES.test(ch)
    }

    at += cells(ch)

    if (at > col) {
      return false
    }
  }

  return false
}

export function overlay(lines: string[], box: string[], cols: number, rows: number, top = 0): string[] {
  const w = Math.max(0, ...box.map((line) => cells(line)))
  const x = Math.max(0, Math.floor((cols - w) / 2))
  const y = Math.max(0, Math.min(Math.max(top, Math.floor((rows - box.length) / 2)), rows - 1 - box.length))

  return lines.map((line, i) => {
    const part = box[i - y]
    const under = i === lines.length - 1 ? line : unzoned(line)

    if (part === undefined) {
      return under
    }

    const left = x > 0 && edgeAt(under, x - 1) ? ' ' : ''
    const right = x + w < cols && edgeAt(under, x + w) ? ' ' : ''

    return cover(under, x - left.length, `${left}${part}${right}`)
  })
}
