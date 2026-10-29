import type { Readable, Writable } from 'node:stream'
import { aboutOf, leadOf, type Work, wordsOf, workOf, worksFor } from '../core/commons.ts'
import { type PaletteEntry, swatch } from '../core/manifest.ts'
import { cells, containsText } from '../core/text.ts'
import { BUILTIN, isBuiltin, publisherOf, slugOf } from '../core/theme.ts'
import { Field } from './field.ts'
import { capped } from './keycaps.ts'
import { type Inbound, lineStep } from './keys.ts'
import { chase } from './motion.ts'
import { moreOf, SEP } from './parts.ts'
import { Inline } from './screen.ts'
import { ansiBar, ansiFg, ansiSquares, FG_RESET, INK_RESET, MARKS, type Paint, painter } from './style.ts'
import { HIDE_CURSOR, PASTES, within } from './terminal.ts'
import { zone } from './zones.ts'

const MIN_ITEMS = 3

type PickerRow =
  | { kind: 'palette'; entry: PaletteEntry; top: string; shelf?: string }
  | {
      kind: 'top'
      name: string
      title: string
      native?: string
      lead?: PaletteEntry
      expanded: boolean
      count: number
      originals?: true
    }
  | {
      kind: 'shelf'
      top: string
      name: string
      title: string
      native?: string
      lead: PaletteEntry
      expanded: boolean
      count: number
    }

export interface Extra {
  key: string
  idle?: boolean
  text(focused: boolean, at: number, held: boolean): string
}

type Row<X extends Extra = Extra> =
  | PickerRow
  | { kind: 'all'; count: number }
  | { kind: 'rule' }
  | { kind: 'extra'; extra: X }

export type PickerScope = 'palette' | 'work'

type PickerLayout = 'world' | 'marketplaces'

type PickerMode = 'tree' | 'cards' | 'inside'

type PickerFocus = 'lit' | 'held' | 'off'

interface Seat {
  top: string
  shelf?: string
  original?: true
}

function seatsOf(entry: PaletteEntry, works: readonly Work[], layout: PickerLayout): Seat[] {
  const about = aboutOf(works, entry.subject)
  const publisher = publisherOf(entry.name)

  if (!about) {
    return [{ top: publisher, original: true }]
  }

  const homes = [...new Set(worksFor(about))]

  return layout === 'world' ? homes.map((top) => ({ top })) : homes.map((shelf) => ({ top: publisher, shelf }))
}

function shelfKey(top: string, shelf: string): string {
  return `${top}/${shelf}`
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function byWorkName(works: readonly Work[]): (a: string, b: string) => number {
  const name = (id: string) => (workOf(works, id)?.name ?? id).toLowerCase()

  return (a, b) => cmp(name(a), name(b)) || cmp(a, b)
}

function byPublisher(a: string, b: string): number {
  return Number(b === BUILTIN) - Number(a === BUILTIN) || cmp(a, b)
}

function rowKey(row: Row | undefined): string {
  if (row?.kind === 'palette') {
    return `palette ${row.top} ${row.shelf ?? ''} ${row.entry.name}`
  }

  if (row?.kind === 'top') {
    return `top ${row.name}`
  }

  if (row?.kind === 'shelf') {
    return `shelf ${shelfKey(row.top, row.name)}`
  }

  if (row?.kind === 'extra') {
    return `extra ${row.extra.key}`
  }

  return row?.kind ?? ''
}

function passed(row: Row | undefined): boolean {
  return row?.kind === 'rule'
}

export function matchesPalette(entry: PaletteEntry, works: readonly Work[], search: string): boolean {
  const about = aboutOf(works, entry.subject)

  return containsText([entry.name, ...wordsOf(about)], search)
}

function leadIn(members: readonly PaletteEntry[], work: Work | undefined): PaletteEntry | undefined {
  const subject = work ? leadOf(work) : undefined

  return members.find((m) => subject !== undefined && m.subject === subject) ?? members[0]
}

function distinct(entries: readonly PaletteEntry[]): PaletteEntry[] {
  return [...new Map(entries.map((e) => [e.name, e])).values()]
}

export function pickerRows(
  entries: PaletteEntry[],
  works: readonly Work[],
  expanded: ReadonlySet<string>,
  filter: string,
  layout: PickerLayout = 'world',
  tops: readonly string[] = [],
  mode: PickerMode = 'tree',
): PickerRow[] {
  const q = filter.trim()
  const hit = new Set(q ? entries.filter((e) => matchesPalette(e, works, q)) : entries)
  const rows: PickerRow[] = []

  const groups = Map.groupBy(
    entries.flatMap((entry) => seatsOf(entry, works, layout).map((seat) => ({ entry, ...seat }))),
    (seated) => seated.top,
  )

  const originals = new Set(
    layout === 'world' ? [...groups.keys()].filter((top) => groups.get(top)?.some((s) => s.original)) : [],
  )

  const order =
    layout === 'world'
      ? [
          ...[...groups.keys()].filter((top) => !originals.has(top)).sort(byWorkName(works)),
          ...[...originals].sort(byPublisher),
        ]
      : [...new Set([...tops, ...groups.keys()])]

  for (const top of order) {
    const seated = groups.get(top)

    if (!seated) {
      if (q === '' || containsText([top], q)) {
        rows.push({ kind: 'top', name: top, title: top, expanded: expanded.has(top), count: 0 })
      }

      continue
    }

    const members = distinct(seated.map((s) => s.entry))
    const matching = members.filter((m) => hit.has(m))

    if (q && matching.length === 0) {
      continue
    }

    const open = mode === 'inside' || (mode === 'tree' && (q.length > 0 || expanded.has(top)))
    const work = layout === 'world' && !originals.has(top) ? workOf(works, top) : undefined
    const lead = leadIn(members, work)

    if (mode !== 'inside') {
      rows.push({
        kind: 'top',
        name: top,
        title: work?.name ?? top,
        ...(work?.native ? { native: work.native } : {}),
        ...(lead ? { lead } : {}),
        expanded: open,
        count: matching.length,
        ...(originals.has(top) ? { originals: true as const } : {}),
      })
    }

    if (!open) {
      continue
    }

    const shown = seated.filter((s) => hit.has(s.entry))

    const shelved = Map.groupBy(
      shown.filter((s) => s.shelf !== undefined),
      (s) => s.shelf as string,
    )

    for (const name of [...shelved.keys()].sort(byWorkName(works))) {
      const inside = distinct((shelved.get(name) ?? []).map((s) => s.entry))
      const shelf = workOf(works, name)
      const unfolded = q.length > 0 || expanded.has(shelfKey(top, name))

      rows.push({
        kind: 'shelf',
        top,
        name,
        title: shelf?.name ?? name,
        ...(shelf?.native ? { native: shelf.native } : {}),
        lead: leadIn(inside, shelf) as PaletteEntry,
        expanded: unfolded,
        count: inside.length,
      })

      if (unfolded) {
        rows.push(...inside.map((entry): PickerRow => ({ kind: 'palette', entry, top, shelf: name })))
      }
    }

    rows.push(
      ...shown.filter((s) => s.shelf === undefined).map((s): PickerRow => ({ kind: 'palette', entry: s.entry, top })),
    )
  }

  return rows
}

export function workRows(entries: PaletteEntry[], works: readonly Work[], filter: string): PickerRow[] {
  const q = filter.trim()

  const hit = new Set(
    entries
      .filter((e) => q === '' || matchesPalette(e, works, q))
      .flatMap((e) => seatsOf(e, works, 'world').map((seat) => seat.top)),
  )

  return pickerRows(entries, works, new Set(), '').filter((r) => r.kind === 'top' && hit.has(r.name))
}

export function stepRow(at: number, delta: number, count: number, rule: (i: number) => boolean, wrap = true): number {
  const last = count - 1

  if (last < 0) {
    return at
  }

  let next: number

  if (!Number.isFinite(delta)) {
    next = delta > 0 ? last : 0
  } else if (delta > 0) {
    next = at >= last ? (wrap ? 0 : last) : Math.min(last, at + delta)
  } else {
    next = at <= 0 ? (wrap ? last : 0) : Math.max(0, at + delta)
  }

  if (!rule(next)) {
    return next
  }

  const step = Math.sign(delta)
  const over = next + step

  if (over >= 0 && over <= last) {
    return over
  }

  return wrap && Math.abs(delta) === 1 ? (over < 0 ? last : 0) : next - step
}

export function pageStep(name: string | undefined, size: number): number | undefined {
  const steps = new Map([
    ['home', Number.NEGATIVE_INFINITY],
    ['end', Number.POSITIVE_INFINITY],
    ['pgup', -size],
    ['pgdn', size],
  ])

  return name === undefined ? undefined : steps.get(name)
}

function ruled<X extends Extra>(rows: Row<X>[]): Row<X>[] {
  const at = rows.findIndex((r) => r.kind === 'top' && r.originals)

  return at > 0 && rows.slice(0, at).some((r) => r.kind === 'top') ? rows.toSpliced(at, 0, { kind: 'rule' }) : rows
}

export function firstPalette(rows: PickerRow[]): number {
  const index = rows.findIndex((r) => r.kind === 'palette')

  return index === -1 ? 0 : index
}

export type PromptFx = 'typewriter' | 'decode' | 'glitch'

export function promptFx(value: string | undefined): PromptFx {
  return value === 'decode' || value === 'glitch' ? value : 'typewriter'
}

export interface RowSpot {
  kind: 'row'
  at: number
  part: 'row' | 'box' | 'fold'
  pane?: string
}

export function rowSpot(at: number, part: RowSpot['part'], text: string, pane?: string): string {
  return zone({ kind: 'row', at, part, ...(pane ? { pane } : {}) } satisfies RowSpot, text)
}

export interface Card {
  added: boolean
  lines: string[]
}

interface PaletteListOptions<X extends Extra = Extra> {
  entries: PaletteEntry[]
  works: readonly Work[]
  picked: Set<string>
  scope?: PickerScope
  layout?: PickerLayout
  mode?: PickerMode
  pane?: string
  maxItems?: number
  color?: boolean
  note?: (entry: PaletteEntry) => string
  badge?: (top: string) => string
  about?: (top: string, members: PaletteEntry[], matching?: number) => Card
  tops?: () => readonly string[]
  heads?: () => X[]
  extras?: () => X[]
  pinned?: () => X[]
  onFocus?: (entry: PaletteEntry) => void
}

export class PaletteList<X extends Extra = Extra> {
  readonly picked: Set<string>
  readonly scope: PickerScope
  maxItems: number
  focus: PickerFocus = 'lit'
  glide = false
  entries: PaletteEntry[] = []
  workTitles: string[] = []
  private readonly layout: PickerLayout
  private readonly mode: PickerMode
  private readonly pane: string | undefined
  private readonly color: boolean
  private readonly p: Paint
  private readonly onFocus?: (entry: PaletteEntry) => void
  private readonly note?: (entry: PaletteEntry) => string
  private readonly badge?: (top: string) => string
  private readonly about?: (top: string, members: PaletteEntry[], matching?: number) => Card
  private readonly tops?: () => readonly string[]
  private readonly heads?: () => X[]
  private readonly extras?: () => X[]
  private readonly pinned?: () => X[]
  private works: readonly Work[] = []
  private seats = new Map<string, Seat[]>()
  private topNames: string[] = []
  private titlePad = 0
  private namePad = 0
  private expanded = new Set<string>()
  private rows: Row<X>[] = []
  private fixed = 0
  private cursor = 0
  private top = 0
  private shown = 0
  private placed = false
  private span = 1
  private filter = ''
  private lastFocused = ''

  constructor(opts: PaletteListOptions<X>) {
    this.picked = opts.picked
    this.scope = opts.scope ?? 'palette'
    this.layout = opts.layout ?? 'world'
    this.mode = opts.mode ?? 'tree'
    this.pane = opts.pane
    this.maxItems = opts.maxItems ?? 12
    this.color = opts.color ?? true
    this.p = painter(this.color)
    this.onFocus = opts.onFocus
    this.note = opts.note
    this.badge = opts.badge
    this.about = opts.about
    this.tops = opts.tops
    this.heads = opts.heads
    this.extras = opts.extras
    this.pinned = opts.pinned
    this.load(opts.entries, opts.works)
    this.rebuild('first')
  }

  private load(entries: PaletteEntry[], works: readonly Work[]): void {
    this.entries = entries
    this.works = works
    this.seats = new Map(this.entries.map((e) => [e.name, seatsOf(e, works, this.layout)]))
    this.topNames = [...new Set(this.entries.flatMap((e) => this.seatsOf(e).map((seat) => seat.top)))]
    this.titlePad = Math.max(0, ...this.topNames.map((top) => cells(workOf(works, top)?.name ?? top)))
    this.workTitles = [...new Set(this.entries.flatMap((e) => aboutOf(works, e.subject)?.work.name ?? []))]
    this.namePad = Math.max(0, ...this.entries.map((e) => this.indent(e).length + this.labelWidth(e)))
  }

  private seatsOf(entry: PaletteEntry): Seat[] {
    return this.seats.get(entry.name) ?? []
  }

  private lead(): string {
    return this.mode === 'inside' ? '' : '  '
  }

  private indent(entry: PaletteEntry): string {
    return this.seatsOf(entry).some((seat) => seat.shelf !== undefined) ? `${this.lead()}  ` : this.lead()
  }

  private byline(entry: PaletteEntry): string | undefined {
    return this.layout === 'world' && entry.subject !== undefined && !isBuiltin(entry.name)
      ? publisherOf(entry.name)
      : undefined
  }

  private labelWidth(entry: PaletteEntry): number {
    const by = this.byline(entry)

    return slugOf(entry.name).length + (by ? by.length + 2 : 0)
  }

  setEntries(entries: PaletteEntry[], works: readonly Work[] = this.works): void {
    this.load(entries, works)
    this.rebuild('stay')
  }

  setFilter(filter: string): void {
    if (filter !== this.filter) {
      this.filter = filter
      this.placed = false
      this.rebuild('keep')
    }
  }

  clear(): void {
    const row = this.rows[this.cursor]

    if (row?.kind === 'palette') {
      this.expanded.add(row.top)

      if (row.shelf !== undefined) {
        this.expanded.add(shelfKey(row.top, row.shelf))
      }
    }

    this.setFilter('')
  }

  focusedRow(): Row<X> | undefined {
    return this.rows[this.cursor]
  }

  refocus(): void {
    this.lastFocused = ''
    this.sync()
  }

  refresh(): void {
    this.rebuild('stay')
  }

  select(key: string): boolean {
    const at = this.rows.findIndex((r) => rowKey(r) === key)

    if (at === -1) {
      return false
    }

    this.cursor = at
    this.sync()

    return true
  }

  private members(top: string, shelf?: string): PaletteEntry[] {
    const filter = this.scope === 'palette' ? this.filter.trim() : ''

    return this.under(top, shelf).filter((e) => filter === '' || matchesPalette(e, this.works, filter))
  }

  private under(top: string, shelf?: string): PaletteEntry[] {
    return this.entries.filter((e) =>
      this.seatsOf(e).some((seat) => seat.top === top && (shelf === undefined || seat.shelf === shelf)),
    )
  }

  inside(row: Row<X>): PaletteEntry[] {
    return row.kind === 'palette'
      ? [row.entry]
      : row.kind === 'top'
        ? this.under(row.name)
        : row.kind === 'shelf'
          ? this.under(row.top, row.name)
          : []
  }

  private everyone(rows: Row<X>[]): PaletteEntry[] {
    return distinct(rows.flatMap((r) => (r.kind === 'top' ? this.members(r.name) : [])))
  }

  pick(): void {
    const row = this.rows[this.cursor]

    const names =
      row?.kind === 'palette'
        ? [row.entry.name]
        : row?.kind === 'top'
          ? this.members(row.name).map((e) => e.name)
          : row?.kind === 'shelf'
            ? this.members(row.top, row.name).map((e) => e.name)
            : row?.kind === 'all'
              ? this.everyone(this.rows).map((e) => e.name)
              : []

    if (names.length === 0) {
      return
    }

    const add = names.some((n) => !this.picked.has(n))

    for (const n of names) {
      if (add) {
        this.picked.add(n)
      } else {
        this.picked.delete(n)
      }
    }
  }

  pickedIn(top: string, shelf?: string): number {
    return this.members(top, shelf).filter((e) => this.picked.has(e.name)).length
  }

  pickedCount(): number {
    if (this.scope === 'palette') {
      return this.entries.filter((e) => this.picked.has(e.name)).length
    }

    return this.topNames.filter((top) => this.members(top).every((e) => this.picked.has(e.name))).length
  }

  total(): number {
    return this.scope === 'work' ? this.topNames.length : this.entries.length
  }

  matched(): number {
    const filter = this.filter.trim()

    if (this.scope === 'work') {
      return this.rows.filter((r) => r.kind === 'top').length
    }

    return filter ? this.entries.filter((e) => matchesPalette(e, this.works, filter)).length : this.entries.length
  }

  private sync(): void {
    const row = this.rows[this.cursor]

    const entry =
      row?.kind === 'palette' ? row.entry : row?.kind === 'top' && this.scope === 'work' ? row.lead : undefined

    if (entry && entry.name !== this.lastFocused) {
      this.lastFocused = entry.name
      this.onFocus?.(entry)
    }
  }

  private rebuild(snap: 'first' | 'keep' | 'clamp' | 'stay'): void {
    const focused = this.rows[this.cursor]

    const body =
      this.scope === 'work'
        ? workRows(this.entries, this.works, this.filter)
        : pickerRows(this.entries, this.works, this.expanded, this.filter, this.layout, this.tops?.() ?? [], this.mode)

    const tree: Row<X>[] =
      this.layout === 'marketplaces' || body.length === 0
        ? body
        : ruled([{ kind: 'all', count: this.allCount(body) }, ...body])

    const extra = (rows: X[] | undefined) => (rows ?? []).map((x) => ({ kind: 'extra' as const, extra: x }))
    const pinned = extra(this.pinned?.())
    this.fixed = pinned.length
    this.rows = [...extra(this.heads?.()), ...tree, ...extra(this.extras?.()), ...pinned]

    const start =
      body.length > 0
        ? this.rows.indexOf(body[this.mode === 'inside' && !this.filter.trim() ? 0 : firstPalette(body)] as Row<X>)
        : Math.max(
            0,
            this.rows.findIndex((r) => !passed(r) && !(r.kind === 'extra' && r.extra.idle)),
          )

    if (snap === 'first') {
      this.cursor = start
    } else if (snap === 'keep' || snap === 'stay') {
      const key = rowKey(focused)
      const kept = focused?.kind === 'palette' || snap === 'stay' ? this.rows.findIndex((r) => rowKey(r) === key) : -1
      const near = focused?.kind === 'extra' && snap === 'stay'
      this.cursor = kept !== -1 ? kept : near ? Math.min(this.cursor, this.rows.length - 1) : start
    } else if (this.cursor >= this.rows.length) {
      this.cursor = Math.max(0, this.rows.length - 1)
    }

    this.settle()
    this.sync()
  }

  private settle(): void {
    if (!passed(this.rows[this.cursor])) {
      return
    }

    const after = this.rows.findIndex((r, i) => i > this.cursor && !passed(r))
    const before = this.rows.findLastIndex((r, i) => i < this.cursor && !passed(r))
    this.cursor = after !== -1 ? after : before !== -1 ? before : this.cursor
  }

  private allCount(body: PickerRow[]): number {
    return this.scope === 'work' ? body.length : this.everyone(body).length
  }

  move(delta: number, wrap = true): void {
    const scrolling = this.rows.length - this.fixed
    const jump = this.fixed > 0 && scrolling > 0 && Math.abs(delta) !== 1
    this.cursor = jump
      ? stepRow(Math.min(this.cursor, scrolling - 1), delta, scrolling, (i) => passed(this.rows[i]), wrap)
      : stepRow(this.cursor, delta, this.rows.length, (i) => passed(this.rows[i]), wrap)
    this.sync()
  }

  point(at: number): boolean {
    const row = this.rows[at]

    if (!row || passed(row)) {
      return false
    }

    this.cursor = at
    this.sync()

    return true
  }

  size(): number {
    return this.rows.length
  }

  outer(): boolean {
    const row = this.rows[this.cursor]

    return (
      this.mode === 'inside' &&
      (this.filter.trim() !== '' ||
        row === undefined ||
        row.kind === 'extra' ||
        (row.kind === 'shelf' && !row.expanded) ||
        (row.kind === 'palette' && row.shelf === undefined))
    )
  }

  flip(): void {
    const row = this.rows[this.cursor]

    if (row?.kind === 'top' || row?.kind === 'shelf') {
      this.fold(!row.expanded)
    }
  }

  foldable(): boolean {
    const row = this.rows[this.cursor]

    return (
      (row?.kind === 'shelf' || (row?.kind === 'top' && this.mode === 'tree')) &&
      this.scope === 'palette' &&
      !this.filter
    )
  }

  open(): void {
    if (this.foldable()) {
      this.flip()
    } else {
      this.pick()
    }
  }

  private toggle(key: string): void {
    if (this.expanded.has(key)) {
      this.expanded.delete(key)
    } else {
      this.expanded.add(key)
    }

    this.rebuild('clamp')
  }

  private climb(key: string, row: string): void {
    this.expanded.delete(key)
    this.rebuild('clamp')
    this.reach(row)
  }

  private reach(row: string): void {
    this.cursor = Math.max(
      0,
      this.rows.findIndex((r) => rowKey(r) === row),
    )
    this.sync()
  }

  fold(open: boolean): void {
    if (this.filter || this.scope === 'work') {
      return
    }

    const row = this.rows[this.cursor]

    if (row?.kind === 'top') {
      if (open !== row.expanded) {
        this.toggle(row.name)
      }
    } else if (row?.kind === 'shelf') {
      if (open !== row.expanded) {
        this.toggle(shelfKey(row.top, row.name))
      } else if (!open && this.mode === 'tree') {
        this.reach(`top ${row.top}`)
      }
    } else if (row?.kind === 'palette' && !open) {
      if (row.shelf !== undefined) {
        const parent = shelfKey(row.top, row.shelf)
        this.climb(parent, `shelf ${parent}`)
      } else if (this.mode === 'tree') {
        this.climb(row.top, `top ${row.top}`)
      }
    }
  }

  page(): number {
    return this.span
  }

  pins(): string[] {
    const scrolling = this.rows.length - this.fixed

    return this.rows.slice(scrolling).flatMap((row, i) => this.renderRow(row, scrolling + i))
  }

  window() {
    const scrolling = this.rows.length - this.fixed
    const blocks = this.rows.slice(0, scrolling).map((row, i) => this.renderRow(row, i))
    const height = (i: number) => blocks[i]?.length ?? 0
    const room = Math.max(1, this.maxItems)
    const at = Math.max(0, Math.min(this.cursor, scrolling - 1))
    this.top = Math.min(this.top, at)
    let used = 0

    for (let i = this.top; i <= at; i++) {
      used += height(i)
    }

    while (this.top < at && used > room) {
      used -= height(this.top)
      this.top += 1
    }

    let tail = 0

    for (let i = this.top; i < blocks.length; i++) {
      tail += height(i)
    }

    while (this.top > 0 && tail + height(this.top - 1) <= room) {
      this.top -= 1
      tail += height(this.top)
    }

    if (!this.placed) {
      this.shown = this.top
      this.placed = true
    }

    const from = this.glide ? Math.max(0, Math.min(this.shown, blocks.length - 1)) : this.top
    const lines: string[] = []
    let end = from

    while (end < blocks.length && (end === from || lines.length + height(end) <= room)) {
      lines.push(...(blocks[end] ?? []))
      end += 1
    }

    this.span = Math.max(1, end - from)
    lines.push(...(blocks[end] ?? []))

    return { lines: lines.slice(0, room), above: from, below: blocks.length - end }
  }

  moving(): boolean {
    return this.glide && this.placed && this.shown !== this.top
  }

  step(): boolean {
    if (!this.moving()) {
      return false
    }

    this.shown = chase(this.shown, this.top, { span: this.span })

    return this.shown !== this.top
  }

  private renderRow(row: Row<X>, index: number): string[] {
    if (row.kind === 'rule') {
      const line = '── Originals ─────────────'

      return [`   ${this.p.dim(line)}`]
    }

    const text =
      row.kind === 'extra'
        ? row.extra.text(
            index === this.cursor && this.focus === 'lit',
            index,
            index === this.cursor && this.focus === 'held',
          )
        : this.rowText(row, index)

    return text.split('\n').map((l) => (l ? rowSpot(index, 'row', l, this.pane) : l))
  }

  private rowText(row: PickerRow | { kind: 'all'; count: number }, index: number): string {
    const focused = index === this.cursor && this.focus !== 'off'
    const entry = row.kind === 'palette' ? row.entry : row.kind === 'all' ? undefined : row.lead
    const lit = this.color && focused && this.focus === 'lit' && entry !== undefined
    const { dim, bold } = this.p

    const squares = (e: PaletteEntry) =>
      this.color ? `  ${ansiSquares(swatch(e), lit ? ansiFg(e.foreground) : FG_RESET)}` : ''

    const gutter = !focused
      ? '  '
      : lit
        ? `${ansiFg(entry.cursor)}${MARKS.gutter}${FG_RESET} `
        : this.focus === 'held'
          ? this.color
            ? `${this.p.dim(MARKS.gutter)} `
            : '  '
          : `${MARKS.gutter} `

    const bar = (text: string) =>
      lit ? `${gutter}${ansiBar(entry.selection, entry.foreground)} ${text} ${INK_RESET}` : `${gutter} ${text}`

    const box = (on: boolean) => rowSpot(index, 'box', `${on ? MARKS.on : MARKS.off} `, this.pane)
    const arrow = (open: boolean) => rowSpot(index, 'fold', `${open ? MARKS.opened : MARKS.closed} `, this.pane)

    if (row.kind === 'all') {
      return bar(
        `${box(this.everyone(this.rows).every((e) => this.picked.has(e.name)))}Select all ${dim(`(${row.count})`)}`,
      )
    }

    if (row.kind === 'top' && this.scope === 'work') {
      const tail = `(${row.count})${row.native ? ` ${row.native}` : ''}`
      const title = `${row.title}${' '.repeat(Math.max(0, this.titlePad - cells(row.title)))}`

      return bar(
        `${box(this.pickedIn(row.name) === row.count)}${bold(title)}${row.lead ? squares(row.lead) : ''}${this.color ? '  ' : ' '}${dim(tail)}`,
      )
    }

    const at = this.rows[this.cursor]

    const heldBy = (inside: boolean, label: string) =>
      this.color && at?.kind === 'palette' && inside ? this.p.accent(bold(label)) : bold(label)

    if (row.kind === 'top') {
      const name = heldBy(at?.kind === 'palette' && at.top === row.name, row.title)
      const native = row.native ? ` ${dim(row.native)}` : ''
      const badge = this.badge?.(row.name) ?? ''

      if (this.about) {
        const card = this.about(row.name, this.under(row.name), this.filter.trim() ? row.count : undefined)

        return [
          ...(index > 0 ? [''] : []),
          bar(`${rowSpot(index, 'fold', `${card.added ? MARKS.on : MARKS.off} `, this.pane)}${name}${native}${badge}`),
          ...card.lines.map((line) => bar(`  ${line}`)),
        ].join('\n')
      }

      return bar(`${arrow(row.expanded)}${name} ${dim(`(${this.pickedIn(row.name)}/${row.count})`)}${native}${badge}`)
    }

    if (row.kind === 'shelf') {
      const inside = at?.kind === 'palette' && at.top === row.top && at.shelf === row.name
      const counts = dim(`(${this.pickedIn(row.top, row.name)}/${row.count})`)
      const native = row.native ? ` ${dim(row.native)}` : ''

      return bar(`${this.lead()}${arrow(row.expanded)}${heldBy(inside, row.title)} ${counts}${native}`)
    }

    const e = row.entry
    const indent = row.shelf === undefined ? this.lead() : `${this.lead()}  `
    const slug = slugOf(e.name)
    const by = this.byline(e)
    const gap = this.color ? ' '.repeat(Math.max(0, this.namePad - indent.length - this.labelWidth(e))) : ''
    const name = `${focused ? bold(slug) : slug}${by ? `  ${dim(by)}` : ''}${gap}`

    return bar(`${indent}${box(this.picked.has(e.name))}${name}${squares(e)}${this.note?.(e) ?? ''}`)
  }
}

export function paletteExample<X extends Extra>(list: PaletteList<X>): string {
  const pal = list.entries[Math.floor(Math.random() * list.entries.length)]
  const work = list.workTitles[Math.floor(Math.random() * list.workTitles.length)]

  if (!pal) {
    return ''
  }

  return work ? `${slugOf(pal.name)} | ${work}` : slugOf(pal.name)
}

export class SearchHint {
  private readonly fx: PromptFx
  private readonly make: () => string
  private readonly redraw: () => void
  private readonly roller: ReturnType<typeof setInterval>
  private example = ''
  private step = 0
  private seed = 0
  private timer?: ReturnType<typeof setTimeout>

  constructor(fx: PromptFx, make: () => string, redraw: () => void) {
    this.fx = fx
    this.make = make
    this.redraw = redraw
    this.roll()
    this.roller = setInterval(() => {
      this.roll()
      this.step = 8
      this.redraw()
    }, 3000)
    this.roller.unref?.()
  }

  stop(): void {
    clearInterval(this.roller)
    clearTimeout(this.timer)
  }

  private roll(): void {
    const ex = this.make()
    this.example = ex.length > 30 ? `${ex.slice(0, 29)}…` : ex
    this.seed = Math.floor(Math.random() * 997)
  }

  text(): string {
    if (this.step === 0) {
      return this.example
    }

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = undefined
        this.step -= 1
        this.redraw()
      }, 60)
      this.timer.unref?.()
    }

    const keep = Math.floor((this.example.length * (8 - this.step)) / 8)

    if (this.fx === 'typewriter') {
      return `${this.example.slice(0, keep)}▏`
    }

    const pool = this.fx === 'decode' ? 'abcdefghijklmnopqrstuvwxyz' : '▓▒░#*+=<>?/-_'
    const still = this.fx === 'decode' ? (ch: string) => !/[a-z0-9]/i.test(ch) : (ch: string) => ch === ' '

    return [...this.example]
      .map((ch, i) =>
        i + ((i * 7 + this.seed) % 3) < keep || still(ch) ? ch : (pool[Math.floor(Math.random() * pool.length)] ?? ch),
      )
      .join('')
  }
}

interface PalettePromptOptions {
  entries: PaletteEntry[]
  works: readonly Work[]
  scope?: PickerScope
  installed?: Iterable<string>
  required?: boolean
  go?: string
  maxItems?: number
  color?: boolean
  fx?: PromptFx
  input?: Readable
  output?: Writable
  onFocus?: (entry: PaletteEntry) => void
}

type PromptState = 'active' | 'error' | 'submit' | 'cancel'

const FRAME_ROWS = 5

export class PalettePrompt {
  readonly picked: Set<string>
  private readonly list: PaletteList
  private readonly scope: PickerScope
  private readonly color: boolean
  private readonly required: boolean
  private readonly go: string | undefined
  private readonly most: number
  private readonly hint: SearchHint
  private readonly field = new Field()
  private readonly input: Readable | undefined
  private readonly output: Writable | undefined
  private state: PromptState = 'active'
  private error = ''
  private redraw: () => void = () => {}

  constructor(opts: PalettePromptOptions) {
    this.scope = opts.scope ?? 'palette'
    this.picked = new Set(opts.installed ?? [])
    this.color = opts.color ?? true
    this.required = opts.required ?? false
    this.go = opts.go
    this.most = opts.maxItems ?? 12
    this.input = opts.input
    this.output = opts.output
    this.list = new PaletteList({
      entries: opts.entries,
      works: opts.works,
      picked: this.picked,
      scope: this.scope,
      maxItems: this.most,
      color: this.color,
      ...(opts.onFocus ? { onFocus: opts.onFocus } : {}),
    })
    this.hint = new SearchHint(
      opts.fx ?? 'typewriter',
      () => paletteExample(this.list),
      () => this.redraw(),
    )
  }

  prompt(): Promise<'submit' | 'cancel'> {
    return within({ input: this.input, output: this.output, modes: [HIDE_CURSOR, PASTES] }, async (terminal) => {
      const inline = new Inline(
        (text) => terminal.write(text),
        () => terminal.cols,
      )

      const view = () => {
        this.list.maxItems = Math.max(MIN_ITEMS, Math.min(this.most, terminal.rows - FRAME_ROWS))

        return this.draw()
      }

      this.redraw = () => inline.draw(view())
      terminal.onResize(() => inline.redraw(view()))
      this.redraw()

      try {
        const state = await terminal.loop(
          (event) => {
            this.take(event)

            return this.state === 'submit' || this.state === 'cancel' ? this.state : undefined
          },
          () => this.redraw(),
        )

        this.redraw = () => {}

        inline.end(this.draw())

        return state
      } finally {
        this.hint.stop()
      }
    })
  }

  private take(event: Inbound): void {
    if (event.kind === 'paste') {
      this.field.paste(event.text)
      this.list.setFilter(this.field.value)

      return
    }

    if (event.kind !== 'key') {
      return
    }

    const key = event.key

    if (this.state === 'error') {
      this.state = 'active'
    }

    const page = pageStep(key, this.list.maxItems)
    const line = lineStep(key)

    if (key === 'esc' || key === 'ctrl-c') {
      this.state = 'cancel'
    } else if (key === 'enter') {
      if (this.required && this.picked.size === 0) {
        this.error = `Pick at least one ${this.scope}`
        this.state = 'error'
      } else {
        this.state = 'submit'
      }
    } else if (line !== undefined) {
      this.list.move(line)
    } else if (key === 'left' || key === 'right') {
      this.list.fold(key === 'right')
    } else if (page !== undefined) {
      this.list.move(page)
    } else if (key === ' ') {
      this.list.pick()
    } else if (this.field.key(key)) {
      this.list.setFilter(this.field.value)
    }
  }

  private draw(): string[] {
    const { dim, accent: bar, warn } = painter(this.color)
    const title = this.scope === 'work' ? 'Works' : 'Palettes'

    if (this.state === 'submit') {
      return [`${dim('◇')} ${title} ${dim(`${MARKS.sep} ${this.list.pickedCount()} picked`)}`]
    }

    if (this.state === 'cancel') {
      return [`${dim(`◇ ${title}${SEP}cancelled`)}`]
    }

    const typed = this.field.value
    const head = `${bar(MARKS.current)} ${title} ${dim(`(${this.list.matched()}/${this.list.total()}${SEP}${this.list.pickedCount()} picked)`)}`
    const example = this.hint.text()
    const search = `${bar('│')}    ${typed ? `${typed}_` : dim(`Search…${example ? ` e.g. ${example}` : ''}`)}`
    const { lines, above, below } = this.list.window()

    const body =
      lines.length > 0
        ? lines.map((line) => `${bar('│')} ${line}`)
        : [`${bar('│')} ${dim(`No ${this.scope === 'work' ? 'works' : 'palettes'} match '${typed}'`)}`]

    while (body.length < this.list.maxItems) {
      body.push(bar('│'))
    }

    const out = [above > 0 ? moreOf(-1, above) : '', below > 0 ? moreOf(1, below) : ''].filter(Boolean).join('  ')
    const more = out ? `${bar('│')} ${dim(out)}` : bar('│')
    const fold = this.scope === 'work' ? '' : '   ←→ fold'
    const go = this.go ?? (this.scope === 'work' ? 'continue' : 'install')

    const hint =
      this.state === 'error'
        ? `${bar('└')} ${warn(this.error)}`
        : `${bar('└')} ${dim(capped(`↑↓ move${fold}   space pick   type to filter   enter ${go}   esc cancel`))}`

    return [head, search, ...body, more, hint]
  }
}
