import type { Readable, Writable } from 'node:stream'
import { Prompt } from '@clack/core'
import { ansiBar, ansiFg, ansiSquares } from './ansi.ts'
import { type PaletteEntry, swatch } from './emit/manifest.ts'
import { marketOf, slugOf } from './theme.ts'

export type PickerRow =
  | { kind: 'palette'; entry: PaletteEntry }
  | { kind: 'group'; name: string; native?: string; lead: PaletteEntry; expanded: boolean; count: number }
  | { kind: 'catalog'; group: string; name: string; lead: PaletteEntry; expanded: boolean; count: number }

type Row = PickerRow | { kind: 'all'; count: number } | { kind: 'rule' }

export type PickerScope = 'palette' | 'series'

export function catalogKey(group: string, catalog: string): string {
  return `${group}/${catalog}`
}

export function shownName(entry: PaletteEntry): string {
  return marketOf(entry.name) ? slugOf(entry.name) : entry.name
}

function shelf(entry: PaletteEntry): string | undefined {
  return entry.catalog !== undefined && isMarket(entry.group) ? catalogKey(entry.group, entry.catalog) : undefined
}

export function rowKey(row: Row | undefined): string {
  if (row?.kind === 'palette') {
    return `palette ${row.entry.name}`
  }
  if (row?.kind === 'group') {
    return `group ${row.name}`
  }
  if (row?.kind === 'catalog') {
    return `catalog ${catalogKey(row.group, row.name)}`
  }
  return row?.kind ?? ''
}

export function matchesPalette(entry: PaletteEntry, search: string): boolean {
  const q = search.toLowerCase()
  return [entry.name, entry.group, entry.native ?? '', entry.catalog ?? ''].some((s) => s.toLowerCase().includes(q))
}

export function pickerRows(entries: PaletteEntry[], expanded: ReadonlySet<string>, filter: string): PickerRow[] {
  const q = filter.trim()
  const rows: PickerRow[] = []
  const seen = new Set<string>()
  const palette = (entry: PaletteEntry): PickerRow => ({ kind: 'palette', entry })
  for (const e of entries) {
    if (e.default || seen.has(e.group)) {
      continue
    }
    seen.add(e.group)
    const members = entries.filter((m) => !m.default && m.group === e.group)
    const matching = q ? members.filter((m) => matchesPalette(m, q)) : members
    if (q && matching.length === 0) {
      continue
    }
    const open = q.length > 0 || expanded.has(e.group)
    rows.push({
      kind: 'group',
      name: e.group,
      native: e.native,
      lead: members.find((m) => m.lead) ?? e,
      expanded: open,
      count: matching.length,
    })
    if (!open) {
      continue
    }
    const shelved = matching.filter((m) => shelf(m) !== undefined)
    for (const name of new Set(shelved.map((m) => m.catalog as string))) {
      const inside = shelved.filter((m) => m.catalog === name)
      const unfolded = q.length > 0 || expanded.has(catalogKey(e.group, name))
      rows.push({
        kind: 'catalog',
        group: e.group,
        name,
        lead: inside[0] as PaletteEntry,
        expanded: unfolded,
        count: inside.length,
      })
      if (unfolded) {
        rows.push(...inside.map(palette))
      }
    }
    rows.push(...matching.filter((m) => shelf(m) === undefined).map(palette))
  }
  return rows
}

export function seriesRows(entries: PaletteEntry[], filter: string): PickerRow[] {
  const q = filter.trim()
  const hit = new Set(entries.filter((e) => !e.default && (q === '' || matchesPalette(e, q))).map((e) => e.group))
  return pickerRows(entries, new Set(), '').filter((r) => r.kind === 'group' && hit.has(r.name))
}

export function isMarket(group: string): boolean {
  return group.includes('@')
}

export function stepRow(at: number, delta: number, count: number, rule: (i: number) => boolean): number {
  const last = count - 1
  if (last < 0) {
    return at
  }
  let next: number
  if (!Number.isFinite(delta)) {
    next = delta > 0 ? last : 0
  } else if (delta > 0) {
    next = at >= last ? 0 : Math.min(last, at + delta)
  } else {
    next = at <= 0 ? last : Math.max(0, at + delta)
  }
  return rule(next) ? next + Math.sign(delta) : next
}

export function pageStep(name: string | undefined, size: number): number | undefined {
  const steps: Record<string, number> = {
    home: Number.NEGATIVE_INFINITY,
    end: Number.POSITIVE_INFINITY,
    pageup: -size,
    pagedown: size,
  }
  return name === undefined ? undefined : steps[name]
}

function ruled(rows: Row[]): Row[] {
  const at = rows.findIndex((r) => r.kind === 'group' && isMarket(r.name))
  return at > 0 && rows.slice(0, at).some((r) => r.kind === 'group')
    ? [...rows.slice(0, at), { kind: 'rule' }, ...rows.slice(at)]
    : rows
}

export function firstPalette(rows: PickerRow[]): number {
  const index = rows.findIndex((r) => r.kind === 'palette')
  return index === -1 ? 0 : index
}

export const RESET = '\x1b[0m'
export const DIM = '\x1b[2m'
export const BOLD = '\x1b[1m'
export const NORMAL = '\x1b[22m'
export const CYAN = '\x1b[36m'
export const YELLOW = '\x1b[33m'

export type PromptFx = 'typewriter' | 'decode' | 'glitch'

export function promptFx(value: string | undefined): PromptFx {
  return value === 'decode' || value === 'glitch' ? value : 'typewriter'
}

export type ListRow = Row

export interface PaletteListOptions {
  entries: PaletteEntry[]
  picked: Set<string>
  scope?: PickerScope
  maxItems?: number
  color?: boolean
  onFocus?: (entry: PaletteEntry) => void
}

export class PaletteList {
  readonly picked: Set<string>
  readonly scope: PickerScope
  maxItems: number
  named: PaletteEntry[] = []
  series: string[] = []
  private readonly color: boolean
  private readonly onFocus?: (entry: PaletteEntry) => void
  private entries: PaletteEntry[] = []
  private seriesPad = 0
  private namePad = 0
  private expanded = new Set<string>()
  private rows: Row[] = []
  private cursor = 0
  private top = 0
  private filter = ''
  private lastFocused = ''

  constructor(opts: PaletteListOptions) {
    this.picked = opts.picked
    this.scope = opts.scope ?? 'palette'
    this.maxItems = opts.maxItems ?? 12
    this.color = opts.color ?? true
    this.onFocus = opts.onFocus
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
    return shelf(entry) === undefined ? '  ' : '    '
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

  focusedRow(): Row | undefined {
    return this.rows[this.cursor]
  }

  refocus(): void {
    this.lastFocused = ''
    this.sync()
  }

  private members(group: string, catalog?: string): PaletteEntry[] {
    const filter = this.scope === 'palette' ? this.filter.trim() : ''
    return this.named.filter(
      (e) =>
        e.group === group &&
        (catalog === undefined || e.catalog === catalog) &&
        (filter === '' || matchesPalette(e, filter)),
    )
  }

  private everyone(rows: Row[]): PaletteEntry[] {
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
        : pickerRows(this.entries, this.expanded, this.filter)
    this.rows = body.length > 0 ? ruled([{ kind: 'all', count: this.allCount(body) }, ...body]) : []
    const start = body.length > 0 ? this.rows.indexOf(body[firstPalette(body)] as Row) : 0
    if (snap === 'first') {
      this.cursor = start
    } else if (snap === 'keep' || snap === 'stay') {
      const key = rowKey(focused)
      const kept = focused?.kind === 'palette' || snap === 'stay' ? this.rows.findIndex((r) => rowKey(r) === key) : -1
      this.cursor = kept === -1 ? start : kept
    } else if (this.cursor >= this.rows.length) {
      this.cursor = Math.max(0, this.rows.length - 1)
    }
    this.sync()
  }

  private allCount(body: PickerRow[]): number {
    return this.scope === 'series' ? body.length : this.everyone(body).length
  }

  move(delta: number): void {
    this.cursor = stepRow(this.cursor, delta, this.rows.length, (i) => this.rows[i]?.kind === 'rule')
    this.sync()
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
        this.climb(row.group, `group ${row.group}`)
      }
    } else if (row?.kind === 'palette' && !open && !row.entry.default) {
      const parent = shelf(row.entry)
      if (parent === undefined) {
        this.climb(row.entry.group, `group ${row.entry.group}`)
      } else {
        this.climb(parent, `catalog ${parent}`)
      }
    }
  }

  window(): { lines: string[]; below: number } {
    if (this.cursor < this.top) {
      this.top = this.cursor
    }
    if (this.cursor >= this.top + this.maxItems) {
      this.top = this.cursor - this.maxItems + 1
    }
    this.top = Math.min(this.top, Math.max(0, this.rows.length - this.maxItems))
    const shown = this.rows.slice(this.top, this.top + this.maxItems)
    return {
      lines: shown.map((row, i) => this.renderRow(row, this.top + i === this.cursor)),
      below: this.rows.length - this.top - shown.length,
    }
  }

  private renderRow(row: Row, focused: boolean): string {
    if (row.kind === 'rule') {
      const line = '── Markets ──────────'
      return `   ${this.color ? `${DIM}${line}${RESET}` : line}`
    }
    const entry = row.kind === 'palette' ? row.entry : row.kind === 'all' ? undefined : row.lead
    const lit = this.color && focused && entry !== undefined
    const dim = (s: string) => (this.color ? `${DIM}${s}${NORMAL}` : s)
    const bold = (s: string) => (this.color ? `${BOLD}${s}${NORMAL}` : s)
    const squares = (e: PaletteEntry) =>
      this.color ? `  ${ansiSquares(swatch(e), lit ? ansiFg(e.foreground) : '\x1b[39m')}` : ''
    const gutter = focused ? (lit ? `${ansiFg(entry.cursor)}▌\x1b[39m ` : '▌ ') : '  '
    const bar = (text: string) =>
      lit ? `${gutter}${ansiBar(entry.selection, entry.foreground)} ${text} ${RESET}` : `${gutter} ${text}`
    if (row.kind === 'all') {
      const box = this.everyone(this.rows).every((e) => this.picked.has(e.name)) ? '●' : '○'
      return bar(`${box} Select all ${dim(`(${row.count})`)}`)
    }
    if (row.kind === 'group' && this.scope === 'series') {
      const box = this.pickedIn(row.name) === row.count ? '●' : '○'
      const tail = `(${row.count})${row.native ? ` ${row.native}` : ''}`
      return bar(
        `${box} ${bold(row.name.padEnd(this.seriesPad))}${squares(row.lead)}${this.color ? '  ' : ' '}${dim(tail)}`,
      )
    }
    const at = this.rows[this.cursor]
    const heldBy = (inside: boolean, label: string) =>
      this.color && at?.kind === 'palette' && inside
        ? `${BOLD}${ansiFg(at.entry.cursor)}${label}${NORMAL}\x1b[39m`
        : bold(label)
    if (row.kind === 'group') {
      const name = heldBy(at?.kind === 'palette' && at.entry.group === row.name, row.name)
      const native = row.native ? ` ${dim(row.native)}` : ''
      return bar(`${row.expanded ? '▾' : '▸'} ${name} ${dim(`(${this.pickedIn(row.name)}/${row.count})`)}${native}`)
    }
    if (row.kind === 'catalog') {
      const inside = at?.kind === 'palette' && shelf(at.entry) === catalogKey(row.group, row.name)
      const counts = dim(`(${this.pickedIn(row.group, row.name)}/${row.count})`)
      return bar(`  ${row.expanded ? '▾' : '▸'} ${heldBy(inside, row.name)} ${counts}`)
    }
    const e = row.entry
    const box = this.picked.has(e.name) ? '●' : '○'
    const indent = this.indent(e)
    const label = shownName(e)
    const padded = this.color ? label.padEnd(this.namePad - indent.length) : label
    const name = focused ? bold(padded) : padded
    return bar(`${indent}${box} ${name}${squares(e)}`)
  }
}

export function paletteExample(list: PaletteList): string {
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

export interface PalettePromptOptions {
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

export class PalettePrompt extends Prompt<string> {
  readonly picked: Set<string>
  private readonly list: PaletteList
  private readonly scope: PickerScope
  private readonly color: boolean
  private readonly hint: SearchHint
  private lastInput = ''

  constructor(opts: PalettePromptOptions) {
    super(
      {
        render: () => this.draw(),
        input: opts.input,
        output: opts.output,
        validate: opts.required
          ? () => (this.picked.size === 0 ? `Pick at least one ${this.scope}` : undefined)
          : undefined,
      },
      true,
    )
    this.scope = opts.scope ?? 'palette'
    this.picked = new Set(opts.installed ?? [])
    this.color = opts.color ?? true
    this.list = new PaletteList({
      entries: opts.entries,
      picked: this.picked,
      scope: this.scope,
      ...(opts.maxItems === undefined ? {} : { maxItems: opts.maxItems }),
      color: this.color,
      ...(opts.onFocus ? { onFocus: opts.onFocus } : {}),
    })
    this.hint = new SearchHint(
      opts.fx ?? 'typewriter',
      () => paletteExample(this.list),
      () => this.output.emit('resize'),
    )
    this.once('finalize', () => this.hint.stop())
    this.on('cursor', (action) => {
      if (action === 'up') {
        this.list.move(-1)
      } else if (action === 'down') {
        this.list.move(1)
      } else if (action === 'left') {
        this.list.fold(false)
      } else if (action === 'right') {
        this.list.fold(true)
      }
    })
    this.on('userInput', (value) => {
      if (value !== this.lastInput) {
        this.lastInput = value
        this.list.setFilter(value)
      }
    })
    this.on('key', (_char, key) => {
      const page = pageStep(key?.name, this.list.maxItems)
      if (page !== undefined) {
        this.list.move(page)
      } else if (key?.name === 'space') {
        this.list.pick()
      }
    })
  }

  protected override _isActionKey(char: string | undefined): boolean {
    return char === '\t' || char === ' '
  }

  private draw(): string {
    const dim = (s: string) => (this.color ? `${DIM}${s}${RESET}` : s)
    const bar = (s: string) => (this.color ? `${CYAN}${s}${RESET}` : s)
    const title = this.scope === 'series' ? 'Series' : 'Catalog'
    if (this.state === 'submit') {
      return `${dim('◇')} ${title} ${dim(`· ${this.list.pickedCount()} picked`)}`
    }
    if (this.state === 'cancel') {
      return `${dim(`◇ ${title} · cancelled`)}`
    }
    const head = `${bar('◆')} ${title} ${dim(`(${this.list.matched()}/${this.list.total()} · ${this.list.pickedCount()} picked)`)}`
    const example = this.hint.text()
    const search = `${bar('│')}    ${this.userInput ? `${this.userInput}_` : dim(`Search…${example ? ` e.g. ${example}` : ''}`)}`
    const { lines, below } = this.list.window()
    const body =
      lines.length > 0
        ? lines.map((line) => `${bar('│')} ${line}`)
        : [`${bar('│')} ${dim(`No ${this.scope === 'series' ? 'series' : 'palettes'} match '${this.userInput}'`)}`]
    while (body.length < this.list.maxItems) {
      body.push(bar('│'))
    }
    const more = below > 0 ? `${bar('│')} ${dim(`↓ ${below} more`)}` : bar('│')
    const fold = this.scope === 'series' ? '' : ' · ←→ fold'
    const go = this.scope === 'series' ? 'continue' : 'install'
    const hint =
      this.state === 'error'
        ? `${bar('└')} ${this.color ? `${YELLOW}${this.error}${RESET}` : this.error}`
        : `${bar('└')} ${dim(`↑↓ move${fold} · space pick · type to filter · enter ${go} · esc cancel`)}`
    return [head, search, ...body, more, hint].join('\n')
  }
}
