import type { Readable, Writable } from 'node:stream'
import { type PaletteEntry, swatch } from './manifest.ts'
import { aliasesFor, containsText } from './names.ts'
import { OFFICIAL } from './sources.ts'
import { marketOf, slugOf } from './theme.ts'
import { Field } from './tui/field.ts'
import type { Inbound } from './tui/keys.ts'
import { Inline } from './tui/screen.ts'
import { ansiBar, ansiFg, ansiSquares, FG_RESET, INK_RESET, MARKS, type Paint, painter } from './tui/style.ts'
import { HIDE_CURSOR, PASTES, within } from './tui/terminal.ts'
import { zone } from './tui/zones.ts'

const MIN_ITEMS = 3

type PickerRow =
  | { kind: 'palette'; entry: PaletteEntry }
  | { kind: 'group'; name: string; native?: string; lead?: PaletteEntry; expanded: boolean; count: number }
  | {
      kind: 'catalog'
      group: string
      name: string
      native?: string
      lead: PaletteEntry
      expanded: boolean
      count: number
    }

export interface Extra {
  key: string
  rule?: boolean
  text(focused: boolean, at: number): string
}

type Row<X extends Extra = Extra> =
  | PickerRow
  | { kind: 'all'; count: number }
  | { kind: 'rule' }
  | { kind: 'extra'; extra: X }

export type PickerScope = 'palette' | 'series'

type PickerLayout = 'series' | 'markets'

interface Place {
  top(entry: PaletteEntry): string
  shelf(entry: PaletteEntry): string | undefined
}

const PLACES: Record<PickerLayout, Place> = {
  series: {
    top: (e) => e.group,
    shelf: (e) => (isMarket(e.group) ? e.catalog : undefined),
  },
  markets: {
    top: (e) => (isMarket(e.group) ? e.group : OFFICIAL),
    shelf: (e) => (isMarket(e.group) ? e.catalog : e.group),
  },
}

function catalogKey(group: string, catalog: string): string {
  return `${group}/${catalog}`
}

function shownName(entry: PaletteEntry): string {
  return marketOf(entry.name) ? slugOf(entry.name) : entry.name
}

function shelfKey(entry: PaletteEntry, place: Place): string | undefined {
  const name = place.shelf(entry)
  return name === undefined ? undefined : catalogKey(place.top(entry), name)
}

function rowKey(row: Row | undefined): string {
  if (row?.kind === 'palette') {
    return `palette ${row.entry.name}`
  }
  if (row?.kind === 'group') {
    return `group ${row.name}`
  }
  if (row?.kind === 'catalog') {
    return `catalog ${catalogKey(row.group, row.name)}`
  }
  if (row?.kind === 'extra') {
    return `extra ${row.extra.key}`
  }
  return row?.kind ?? ''
}

function passed(row: Row | undefined): boolean {
  return row?.kind === 'rule' || (row?.kind === 'extra' && row.extra.rule === true)
}

export function matchesPalette(entry: PaletteEntry, search: string): boolean {
  return containsText(
    [
      entry.name,
      entry.group,
      entry.native ?? '',
      entry.catalog ?? '',
      ...(entry.nativeNames ?? []),
      ...aliasesFor(entry.booru),
    ],
    search,
  )
}

export function pickerRows(
  entries: PaletteEntry[],
  expanded: ReadonlySet<string>,
  filter: string,
  layout: PickerLayout = 'series',
  tops: readonly string[] = [],
): PickerRow[] {
  const place = PLACES[layout]
  const q = filter.trim()
  const rows: PickerRow[] = []
  const seen = new Set<string>()
  const palette = (entry: PaletteEntry): PickerRow => ({ kind: 'palette', entry })
  for (const e of entries) {
    const top = place.top(e)
    if (e.default || seen.has(top)) {
      continue
    }
    seen.add(top)
    const members = entries.filter((m) => !m.default && place.top(m) === top)
    const matching = q ? members.filter((m) => matchesPalette(m, q)) : members
    if (q && matching.length === 0) {
      continue
    }
    const open = q.length > 0 || expanded.has(top)
    rows.push({
      kind: 'group',
      name: top,
      ...(top === e.group && e.native ? { native: e.native } : {}),
      lead: members.find((m) => m.lead) ?? e,
      expanded: open,
      count: matching.length,
    })
    if (!open) {
      continue
    }
    const shelved = matching.filter((m) => place.shelf(m) !== undefined)
    for (const name of new Set(shelved.map((m) => place.shelf(m) as string))) {
      const inside = shelved.filter((m) => place.shelf(m) === name)
      const lead = inside.find((m) => m.lead) ?? (inside[0] as PaletteEntry)
      const unfolded = q.length > 0 || expanded.has(catalogKey(top, name))
      rows.push({
        kind: 'catalog',
        group: top,
        name,
        ...(!isMarket(lead.group) && lead.native ? { native: lead.native } : {}),
        lead,
        expanded: unfolded,
        count: inside.length,
      })
      if (unfolded) {
        rows.push(...inside.map(palette))
      }
    }
    rows.push(...matching.filter((m) => place.shelf(m) === undefined).map(palette))
  }
  for (const top of tops) {
    if (!seen.has(top) && (q === '' || containsText([top], q))) {
      rows.push({ kind: 'group', name: top, expanded: expanded.has(top), count: 0 })
    }
  }
  return rows
}

export function seriesRows(entries: PaletteEntry[], filter: string): PickerRow[] {
  const q = filter.trim()
  const hit = new Set(entries.filter((e) => !e.default && (q === '' || matchesPalette(e, q))).map((e) => e.group))
  return pickerRows(entries, new Set(), '').filter((r) => r.kind === 'group' && hit.has(r.name))
}

function isMarket(group: string): boolean {
  return group.includes('@')
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
  const steps: Record<string, number> = {
    home: Number.NEGATIVE_INFINITY,
    end: Number.POSITIVE_INFINITY,
    pgup: -size,
    pgdn: size,
  }
  return name === undefined ? undefined : steps[name]
}

function ruled<X extends Extra>(rows: Row<X>[]): Row<X>[] {
  const at = rows.findIndex((r) => r.kind === 'group' && isMarket(r.name))
  return at > 0 && rows.slice(0, at).some((r) => r.kind === 'group')
    ? [...rows.slice(0, at), { kind: 'rule' }, ...rows.slice(at)]
    : rows
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
}

export function rowSpot(at: number, part: RowSpot['part'], text: string): string {
  return zone({ kind: 'row', at, part } satisfies RowSpot, text)
}

interface PaletteListOptions<X extends Extra = Extra> {
  entries: PaletteEntry[]
  picked: Set<string>
  scope?: PickerScope
  layout?: PickerLayout
  maxItems?: number
  color?: boolean
  note?: (entry: PaletteEntry) => string
  badge?: (group: string) => string
  tops?: () => readonly string[]
  extras?: () => X[]
  onFocus?: (entry: PaletteEntry) => void
}

export class PaletteList<X extends Extra = Extra> {
  readonly picked: Set<string>
  readonly scope: PickerScope
  maxItems: number
  named: PaletteEntry[] = []
  series: string[] = []
  private readonly layout: PickerLayout
  private readonly place: Place
  private readonly color: boolean
  private readonly p: Paint
  private readonly onFocus?: (entry: PaletteEntry) => void
  private readonly note?: (entry: PaletteEntry) => string
  private readonly badge?: (group: string) => string
  private readonly tops?: () => readonly string[]
  private readonly extras?: () => X[]
  private entries: PaletteEntry[] = []
  private seriesPad = 0
  private namePad = 0
  private expanded = new Set<string>()
  private rows: Row<X>[] = []
  private cursor = 0
  private top = 0
  private filter = ''
  private lastFocused = ''

  constructor(opts: PaletteListOptions<X>) {
    this.picked = opts.picked
    this.scope = opts.scope ?? 'palette'
    this.layout = opts.layout ?? 'series'
    this.place = PLACES[this.layout]
    this.maxItems = opts.maxItems ?? 12
    this.color = opts.color ?? true
    this.p = painter(this.color)
    this.onFocus = opts.onFocus
    this.note = opts.note
    this.badge = opts.badge
    this.tops = opts.tops
    this.extras = opts.extras
    this.load(opts.entries)
    this.rebuild('first')
  }

  private load(entries: PaletteEntry[]): void {
    this.entries = entries
    this.named = entries.filter((e) => !e.default)
    this.series = [...new Set(this.named.map((e) => e.group))]
    this.seriesPad = Math.max(0, ...this.series.map((g) => g.length))
    this.namePad = Math.max(0, ...this.named.map((e) => this.indent(e).length + shownName(e).length))
  }

  private indent(entry: PaletteEntry): string {
    return this.place.shelf(entry) === undefined ? '  ' : '    '
  }

  setEntries(entries: PaletteEntry[]): void {
    this.load(entries)
    this.rebuild('stay')
  }

  setFilter(filter: string): void {
    if (filter !== this.filter) {
      this.filter = filter
      this.rebuild('keep')
    }
  }

  clear(): void {
    const row = this.rows[this.cursor]
    if (row?.kind === 'palette' && !row.entry.default) {
      this.expanded.add(this.place.top(row.entry))
      const parent = shelfKey(row.entry, this.place)
      if (parent !== undefined) {
        this.expanded.add(parent)
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

  private members(group: string, catalog?: string): PaletteEntry[] {
    const filter = this.scope === 'palette' ? this.filter.trim() : ''
    return this.under(group, catalog).filter((e) => filter === '' || matchesPalette(e, filter))
  }

  private under(group: string, catalog?: string): PaletteEntry[] {
    return this.named.filter(
      (e) => this.place.top(e) === group && (catalog === undefined || this.place.shelf(e) === catalog),
    )
  }

  inside(row: Row<X>): PaletteEntry[] {
    return row.kind === 'palette'
      ? [row.entry]
      : row.kind === 'group'
        ? this.under(row.name)
        : row.kind === 'catalog'
          ? this.under(row.group, row.name)
          : []
  }

  private everyone(rows: Row<X>[]): PaletteEntry[] {
    return rows.flatMap((r) => (r.kind === 'group' ? this.members(r.name) : []))
  }

  pick(): void {
    const row = this.rows[this.cursor]
    const names =
      row?.kind === 'palette'
        ? [row.entry.name]
        : row?.kind === 'group'
          ? this.members(row.name).map((e) => e.name)
          : row?.kind === 'catalog'
            ? this.members(row.group, row.name).map((e) => e.name)
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

  pickedIn(group: string, catalog?: string): number {
    return this.members(group, catalog).filter((e) => this.picked.has(e.name)).length
  }

  pickedCount(): number {
    if (this.scope === 'palette') {
      return this.named.filter((e) => this.picked.has(e.name)).length
    }
    return this.series.filter((g) => this.members(g).every((e) => this.picked.has(e.name))).length
  }

  total(): number {
    return this.scope === 'series' ? this.series.length : this.named.length
  }

  matched(): number {
    const filter = this.filter.trim()
    if (this.scope === 'series') {
      return this.rows.filter((r) => r.kind === 'group').length
    }
    return filter ? this.named.filter((e) => matchesPalette(e, filter)).length : this.named.length
  }

  private sync(): void {
    const row = this.rows[this.cursor]
    const entry =
      row?.kind === 'palette' ? row.entry : row?.kind === 'group' && this.scope === 'series' ? row.lead : undefined
    if (entry && entry.name !== this.lastFocused) {
      this.lastFocused = entry.name
      this.onFocus?.(entry)
    }
  }

  private rebuild(snap: 'first' | 'keep' | 'clamp' | 'stay'): void {
    const focused = this.rows[this.cursor]
    const body =
      this.scope === 'series'
        ? seriesRows(this.entries, this.filter)
        : pickerRows(this.entries, this.expanded, this.filter, this.layout, this.tops?.() ?? [])
    const tree: Row<X>[] =
      this.layout === 'markets' || body.length === 0
        ? body
        : ruled([{ kind: 'all', count: this.allCount(body) }, ...body])
    this.rows = [...tree, ...(this.extras?.() ?? []).map((extra) => ({ kind: 'extra' as const, extra }))]
    const start = body.length > 0 ? this.rows.indexOf(body[firstPalette(body)] as Row<X>) : 0
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
    return this.scope === 'series' ? body.length : this.everyone(body).length
  }

  move(delta: number, wrap = true): void {
    this.cursor = stepRow(this.cursor, delta, this.rows.length, (i) => passed(this.rows[i]), wrap)
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

  flip(): void {
    const row = this.rows[this.cursor]
    if (row?.kind === 'group' || row?.kind === 'catalog') {
      this.fold(!row.expanded)
    }
  }

  foldable(): boolean {
    const row = this.rows[this.cursor]
    return (row?.kind === 'group' || row?.kind === 'catalog') && this.scope === 'palette' && !this.filter
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
    if (this.filter || this.scope === 'series') {
      return
    }
    const row = this.rows[this.cursor]
    if (row?.kind === 'group') {
      if (open !== row.expanded) {
        this.toggle(row.name)
      }
    } else if (row?.kind === 'catalog') {
      if (open !== row.expanded) {
        this.toggle(catalogKey(row.group, row.name))
      } else if (!open) {
        this.reach(`group ${row.group}`)
      }
    } else if (row?.kind === 'palette' && !open && !row.entry.default) {
      const parent = shelfKey(row.entry, this.place)
      if (parent === undefined) {
        const top = this.place.top(row.entry)
        this.climb(top, `group ${top}`)
      } else {
        this.climb(parent, `catalog ${parent}`)
      }
    }
  }

  window(): { lines: string[]; above: number; below: number } {
    if (this.cursor < this.top) {
      this.top = this.cursor
    }
    if (this.cursor >= this.top + this.maxItems) {
      this.top = this.cursor - this.maxItems + 1
    }
    this.top = Math.min(this.top, Math.max(0, this.rows.length - this.maxItems))
    const shown = this.rows.slice(this.top, this.top + this.maxItems)
    return {
      lines: shown.map((row, i) => this.renderRow(row, this.top + i)),
      above: this.top,
      below: this.rows.length - this.top - shown.length,
    }
  }

  private renderRow(row: Row<X>, index: number): string {
    if (row.kind === 'rule') {
      const line = '── Markets ──────────'
      return `   ${this.p.dim(line)}`
    }
    if (row.kind === 'extra') {
      const text = row.extra.text(index === this.cursor, index)
      return row.extra.rule ? text : rowSpot(index, 'row', text)
    }
    return rowSpot(index, 'row', this.rowText(row, index))
  }

  private rowText(row: PickerRow | { kind: 'all'; count: number }, index: number): string {
    const focused = index === this.cursor
    const entry = row.kind === 'palette' ? row.entry : row.kind === 'all' ? undefined : row.lead
    const lit = this.color && focused && entry !== undefined
    const { dim, bold } = this.p
    const squares = (e: PaletteEntry) =>
      this.color ? `  ${ansiSquares(swatch(e), lit ? ansiFg(e.foreground) : FG_RESET)}` : ''
    const gutter = focused ? (lit ? `${ansiFg(entry.cursor)}${MARKS.gutter}${FG_RESET} ` : `${MARKS.gutter} `) : '  '
    const bar = (text: string) =>
      lit ? `${gutter}${ansiBar(entry.selection, entry.foreground)} ${text} ${INK_RESET}` : `${gutter} ${text}`
    const box = (on: boolean) => rowSpot(index, 'box', `${on ? MARKS.on : MARKS.off} `)
    const arrow = (open: boolean) => rowSpot(index, 'fold', `${open ? MARKS.opened : MARKS.closed} `)
    if (row.kind === 'all') {
      return bar(
        `${box(this.everyone(this.rows).every((e) => this.picked.has(e.name)))}Select all ${dim(`(${row.count})`)}`,
      )
    }
    if (row.kind === 'group' && this.scope === 'series') {
      const tail = `(${row.count})${row.native ? ` ${row.native}` : ''}`
      return bar(
        `${box(this.pickedIn(row.name) === row.count)}${bold(row.name.padEnd(this.seriesPad))}${row.lead ? squares(row.lead) : ''}${this.color ? '  ' : ' '}${dim(tail)}`,
      )
    }
    const at = this.rows[this.cursor]
    const heldBy = (inside: boolean, label: string) =>
      this.color && at?.kind === 'palette' && inside ? this.p.accent(bold(label)) : bold(label)
    if (row.kind === 'group') {
      const name = heldBy(at?.kind === 'palette' && this.place.top(at.entry) === row.name, row.name)
      const native = row.native ? ` ${dim(row.native)}` : ''
      const badge = this.badge?.(row.name) ?? ''
      return bar(`${arrow(row.expanded)}${name} ${dim(`(${this.pickedIn(row.name)}/${row.count})`)}${native}${badge}`)
    }
    if (row.kind === 'catalog') {
      const inside = at?.kind === 'palette' && shelfKey(at.entry, this.place) === catalogKey(row.group, row.name)
      const counts = dim(`(${this.pickedIn(row.group, row.name)}/${row.count})`)
      const native = row.native ? ` ${dim(row.native)}` : ''
      return bar(`  ${arrow(row.expanded)}${heldBy(inside, row.name)} ${counts}${native}`)
    }
    const e = row.entry
    const indent = this.indent(e)
    const label = shownName(e)
    const padded = this.color ? label.padEnd(this.namePad - indent.length) : label
    const name = focused ? bold(padded) : padded
    return bar(`${indent}${box(this.picked.has(e.name))}${name}${squares(e)}${this.note?.(e) ?? ''}`)
  }
}

export function paletteExample<X extends Extra>(list: PaletteList<X>): string {
  const pal = list.named[Math.floor(Math.random() * list.named.length)]
  const grp = list.series[Math.floor(Math.random() * list.series.length)]
  return pal && grp ? `${pal.name} | ${grp}` : ''
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
  scope?: PickerScope
  installed?: Iterable<string>
  required?: boolean
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
    this.most = opts.maxItems ?? 12
    this.input = opts.input
    this.output = opts.output
    this.list = new PaletteList({
      entries: opts.entries,
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
    if (key === 'esc' || key === 'ctrl-c') {
      this.state = 'cancel'
    } else if (key === 'enter') {
      if (this.required && this.picked.size === 0) {
        this.error = `Pick at least one ${this.scope}`
        this.state = 'error'
      } else {
        this.state = 'submit'
      }
    } else if (key === 'up' || key === 'down') {
      this.list.move(key === 'up' ? -1 : 1)
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
    const title = this.scope === 'series' ? 'Series' : 'Catalog'
    if (this.state === 'submit') {
      return [`${dim('◇')} ${title} ${dim(`· ${this.list.pickedCount()} picked`)}`]
    }
    if (this.state === 'cancel') {
      return [`${dim(`◇ ${title} · cancelled`)}`]
    }
    const typed = this.field.value
    const head = `${bar('◆')} ${title} ${dim(`(${this.list.matched()}/${this.list.total()} · ${this.list.pickedCount()} picked)`)}`
    const example = this.hint.text()
    const search = `${bar('│')}    ${typed ? `${typed}_` : dim(`Search…${example ? ` e.g. ${example}` : ''}`)}`
    const { lines, below } = this.list.window()
    const body =
      lines.length > 0
        ? lines.map((line) => `${bar('│')} ${line}`)
        : [`${bar('│')} ${dim(`No ${this.scope === 'series' ? 'series' : 'palettes'} match '${typed}'`)}`]
    while (body.length < this.list.maxItems) {
      body.push(bar('│'))
    }
    const more = below > 0 ? `${bar('│')} ${dim(`↓ ${below} more`)}` : bar('│')
    const fold = this.scope === 'series' ? '' : ' · ←→ fold'
    const go = this.scope === 'series' ? 'continue' : 'install'
    const hint =
      this.state === 'error'
        ? `${bar('└')} ${warn(this.error)}`
        : `${bar('└')} ${dim(`↑↓ move${fold} · space pick · type to filter · enter ${go} · esc cancel`)}`
    return [head, search, ...body, more, hint]
  }
}
