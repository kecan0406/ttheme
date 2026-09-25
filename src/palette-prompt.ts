import type { Readable, Writable } from 'node:stream'
import { Prompt } from '@clack/core'
import { ansiBar, ansiFg, ansiSquares } from './ansi.ts'
import { type PaletteEntry, swatch } from './emit/manifest.ts'

export type PickerRow =
  | { kind: 'palette'; entry: PaletteEntry }
  | { kind: 'group'; name: string; native?: string; lead: PaletteEntry; expanded: boolean; count: number }

type Row = PickerRow | { kind: 'all'; count: number } | { kind: 'rule' }

export type PickerScope = 'palette' | 'series'

export function matchesPalette(entry: PaletteEntry, search: string): boolean {
  const q = search.toLowerCase()
  return [entry.name, entry.group, entry.native ?? ''].some((s) => s.toLowerCase().includes(q))
}

export function pickerRows(entries: PaletteEntry[], expanded: ReadonlySet<string>, filter: string): PickerRow[] {
  const q = filter.trim()
  const rows: PickerRow[] = []
  const seen = new Set<string>()
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
    if (open) {
      rows.push(...matching.map((m) => ({ kind: 'palette' as const, entry: m })))
    }
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

const RESET = '\x1b[0m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const NORMAL = '\x1b[22m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'

export type PromptFx = 'typewriter' | 'decode' | 'glitch'

export function promptFx(value: string | undefined): PromptFx {
  return value === 'decode' || value === 'glitch' ? value : 'typewriter'
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
  private scope: PickerScope
  private entries: PaletteEntry[]
  private named: PaletteEntry[]
  private series: string[]
  private seriesPad: number
  private namePad: number
  private expanded = new Set<string>()
  private rows: Row[] = []
  private cursor = 0
  private top = 0
  private maxItems: number
  private color: boolean
  private lastInput = ''
  private lastFocused = ''
  private onFocus?: (entry: PaletteEntry) => void
  private example = ''
  private fx: PromptFx
  private fxStep = 0
  private fxSeed = 0
  private fxTimer?: ReturnType<typeof setTimeout>

  constructor(opts: PalettePromptOptions) {
    super(
      {
        render: () => this.draw(),
        input: opts.input,
        output: opts.output,
        validate: opts.required
          ? () => (this.picked.size === 0 ? `pick at least one ${this.scope}` : undefined)
          : undefined,
      },
      true,
    )
    this.entries = opts.entries
    this.scope = opts.scope ?? 'palette'
    this.picked = new Set(opts.installed ?? [])
    this.named = opts.entries.filter((e) => !e.default)
    this.series = [...new Set(this.named.map((e) => e.group))]
    this.seriesPad = Math.max(0, ...this.series.map((g) => g.length))
    this.namePad = Math.max(0, ...this.named.map((e) => e.name.length))
    this.maxItems = opts.maxItems ?? 12
    this.color = opts.color ?? true
    this.fx = opts.fx ?? 'typewriter'
    this.onFocus = opts.onFocus
    this.rollExample()
    const roller = setInterval(() => {
      this.rollExample()
      this.fxStep = 8
      this.output.emit('resize')
    }, 3000)
    roller.unref?.()
    this.once('finalize', () => {
      clearInterval(roller)
      clearTimeout(this.fxTimer)
    })
    this.rebuild('first')
    this.on('cursor', (action) => {
      if (action === 'up') {
        this.move(-1)
      } else if (action === 'down') {
        this.move(1)
      } else if (action === 'left') {
        this.fold(false)
      } else if (action === 'right') {
        this.fold(true)
      }
    })
    this.on('userInput', (value) => {
      if (value !== this.lastInput) {
        this.lastInput = value
        this.rebuild('keep')
      }
    })
    this.on('key', (_char, key) => {
      if (key?.name === 'space') {
        this.pick(this.rows[this.cursor])
      }
    })
  }

  protected override _isActionKey(char: string | undefined): boolean {
    return char === '\t' || char === ' '
  }

  private members(group: string): PaletteEntry[] {
    const filter = this.scope === 'palette' ? this.userInput.trim() : ''
    return this.named.filter((e) => e.group === group && (filter === '' || matchesPalette(e, filter)))
  }

  private everyone(rows: Row[]): PaletteEntry[] {
    return rows.flatMap((r) => (r.kind === 'group' ? this.members(r.name) : []))
  }

  private pick(row: Row | undefined): void {
    const names =
      row?.kind === 'palette'
        ? [row.entry.name]
        : row?.kind === 'group'
          ? this.members(row.name).map((e) => e.name)
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

  private pickedIn(group: string): number {
    return this.members(group).filter((e) => this.picked.has(e.name)).length
  }

  private pickedCount(): number {
    if (this.scope === 'palette') {
      return this.picked.size
    }
    return this.series.filter((g) => this.members(g).every((e) => this.picked.has(e.name))).length
  }

  private rollExample(): void {
    const pal = this.named[Math.floor(Math.random() * this.named.length)]
    const grp = this.series[Math.floor(Math.random() * this.series.length)]
    if (!pal || !grp) {
      this.example = ''
      return
    }
    const ex = `${pal.name} | ${grp}`
    this.example = ex.length > 30 ? `${ex.slice(0, 29)}…` : ex
    this.fxSeed = Math.floor(Math.random() * 997)
  }

  private animatedExample(): string {
    if (this.fxStep === 0) {
      return this.example
    }
    if (!this.fxTimer) {
      this.fxTimer = setTimeout(() => {
        this.fxTimer = undefined
        this.fxStep -= 1
        this.output.emit('resize')
      }, 60)
      this.fxTimer.unref?.()
    }
    const keep = Math.floor((this.example.length * (8 - this.fxStep)) / 8)
    if (this.fx === 'typewriter') {
      return `${this.example.slice(0, keep)}▏`
    }
    const pool = this.fx === 'decode' ? 'abcdefghijklmnopqrstuvwxyz' : '▓▒░#*+=<>?/-_'
    const still = this.fx === 'decode' ? (ch: string) => !/[a-z0-9]/i.test(ch) : (ch: string) => ch === ' '
    return [...this.example]
      .map((ch, i) =>
        i + ((i * 7 + this.fxSeed) % 3) < keep || still(ch)
          ? ch
          : (pool[Math.floor(Math.random() * pool.length)] ?? ch),
      )
      .join('')
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

  private rebuild(snap: 'first' | 'keep' | 'clamp'): void {
    const focused = this.rows[this.cursor]
    const body =
      this.scope === 'series'
        ? seriesRows(this.entries, this.userInput)
        : pickerRows(this.entries, this.expanded, this.userInput)
    this.rows = body.length > 0 ? ruled([{ kind: 'all', count: this.allCount(body) }, ...body]) : []
    const start = body.length > 0 ? this.rows.indexOf(body[firstPalette(body)] as Row) : 0
    if (snap === 'first') {
      this.cursor = start
    } else if (snap === 'keep') {
      const name = focused?.kind === 'palette' ? focused.entry.name : ''
      const kept = name ? this.rows.findIndex((r) => r.kind === 'palette' && r.entry.name === name) : -1
      this.cursor = kept === -1 ? start : kept
    } else if (this.cursor >= this.rows.length) {
      this.cursor = Math.max(0, this.rows.length - 1)
    }
    this.sync()
  }

  private allCount(body: PickerRow[]): number {
    return this.scope === 'series' ? body.length : this.everyone(body).length
  }

  private move(delta: number): void {
    let next = this.cursor + delta
    if (this.rows[next]?.kind === 'rule') {
      next += delta
    }
    if (next >= 0 && next < this.rows.length) {
      this.cursor = next
    }
    this.sync()
  }

  private toggle(group: string): void {
    if (this.expanded.has(group)) {
      this.expanded.delete(group)
    } else {
      this.expanded.add(group)
    }
    this.rebuild('clamp')
  }

  private fold(open: boolean): void {
    if (this.userInput || this.scope === 'series') {
      return
    }
    const row = this.rows[this.cursor]
    if (row?.kind === 'group') {
      if (open !== row.expanded) {
        this.toggle(row.name)
      }
    } else if (row?.kind === 'palette' && !open && !row.entry.default) {
      const group = row.entry.group
      this.expanded.delete(group)
      this.rebuild('clamp')
      this.cursor = this.rows.findIndex((r) => r.kind === 'group' && r.name === group)
      if (this.cursor === -1) {
        this.cursor = 0
      }
      this.sync()
    }
  }

  private renderRow(row: Row, focused: boolean): string {
    if (row.kind === 'rule') {
      const line = '── markets ──────────'
      return `   ${this.color ? `${DIM}${line}${RESET}` : line}`
    }
    const entry = row.kind === 'palette' ? row.entry : row.kind === 'group' ? row.lead : undefined
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
      return bar(`${box} select all ${dim(`(${row.count})`)}`)
    }
    if (row.kind === 'group' && this.scope === 'series') {
      const box = this.pickedIn(row.name) === row.count ? '●' : '○'
      const tail = `(${row.count})${row.native ? ` ${row.native}` : ''}`
      return bar(
        `${box} ${bold(row.name.padEnd(this.seriesPad))}${squares(row.lead)}${this.color ? '  ' : ' '}${dim(tail)}`,
      )
    }
    if (row.kind === 'group') {
      const at = this.rows[this.cursor]
      const held = at?.kind === 'palette' && at.entry.group === row.name ? at.entry : undefined
      const name = this.color && held ? `${BOLD}${ansiFg(held.cursor)}${row.name}${NORMAL}\x1b[39m` : bold(row.name)
      const native = row.native ? ` ${dim(row.native)}` : ''
      return bar(`${row.expanded ? '▾' : '▸'} ${name} ${dim(`(${this.pickedIn(row.name)}/${row.count})`)}${native}`)
    }
    const e = row.entry
    const box = this.picked.has(e.name) ? '●' : '○'
    const padded = this.color ? e.name.padEnd(this.namePad) : e.name
    const name = focused ? bold(padded) : padded
    return bar(`  ${box} ${name}${squares(e)}`)
  }

  private draw(): string {
    const dim = (s: string) => (this.color ? `${DIM}${s}${RESET}` : s)
    const bar = (s: string) => (this.color ? `${CYAN}${s}${RESET}` : s)
    const title = this.scope === 'series' ? 'series' : 'catalog'
    if (this.state === 'submit') {
      return `${dim('◇')} ${title} ${dim(`· ${this.pickedCount()} picked`)}`
    }
    if (this.state === 'cancel') {
      return `${dim(`◇ ${title} · cancelled`)}`
    }
    const filter = this.userInput.trim()
    const total = this.scope === 'series' ? this.series.length : this.named.length
    const matched =
      this.scope === 'series'
        ? this.rows.filter((r) => r.kind === 'group').length
        : filter
          ? this.named.filter((e) => matchesPalette(e, filter)).length
          : total
    const head = `${bar('◆')} ${title} ${dim(`(${matched}/${total} · ${this.pickedCount()} picked)`)}`
    const search = `${bar('│')}    ${this.userInput ? `${this.userInput}_` : dim(`search…${this.example ? ` e.g. ${this.animatedExample()}` : ''}`)}`
    if (this.cursor < this.top) {
      this.top = this.cursor
    }
    if (this.cursor >= this.top + this.maxItems) {
      this.top = this.cursor - this.maxItems + 1
    }
    this.top = Math.min(this.top, Math.max(0, this.rows.length - this.maxItems))
    const window = this.rows.slice(this.top, this.top + this.maxItems)
    const body =
      window.length > 0
        ? window.map((row, i) => `${bar('│')} ${this.renderRow(row, this.top + i === this.cursor)}`)
        : [`${bar('│')} ${dim(`no ${this.scope === 'series' ? 'series' : 'palettes'} match '${this.userInput}'`)}`]
    while (body.length < this.maxItems) {
      body.push(bar('│'))
    }
    const below = this.rows.length - this.top - window.length
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
