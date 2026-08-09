import type { Readable, Writable } from 'node:stream'
import { Prompt } from '@clack/core'
import type { PaletteEntry } from './build.ts'
import { ansiChip, ansiDot, ansiFg, ansiSwatch } from './wiring.ts'

export type PickerRow =
  | { kind: 'palette'; entry: PaletteEntry }
  | { kind: 'group'; name: string; native?: string; selection: string; expanded: boolean; count: number }

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
      selection: e.selection,
      expanded: open,
      count: matching.length,
    })
    if (open) {
      rows.push(...matching.map((m) => ({ kind: 'palette' as const, entry: m })))
    }
  }
  return rows
}

export function firstPalette(rows: PickerRow[]): number {
  const index = rows.findIndex((r) => r.kind === 'palette')
  return index === -1 ? 0 : index
}

const RESET = '\x1b[0m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const BOLD_INVERSE = '\x1b[1;7m'
const CYAN = '\x1b[36m'

export type PromptFx = 'typewriter' | 'decode' | 'glitch'

export function promptFx(value: string | undefined): PromptFx {
  return value === 'decode' || value === 'glitch' ? value : 'typewriter'
}

export interface PalettePromptOptions {
  entries: PaletteEntry[]
  maxItems?: number
  color?: boolean
  fx?: PromptFx
  input?: Readable
  output?: Writable
  onFocus?: (entry: PaletteEntry) => void
}

export class PalettePrompt extends Prompt<string> {
  private entries: PaletteEntry[]
  private expanded = new Set<string>()
  private rows: PickerRow[] = []
  private cursor = 0
  private top = 0
  private maxItems: number
  private color: boolean
  private lastInput = ''
  private lastFocused = ''
  private onFocus?: (entry: PaletteEntry) => void
  private paletteTotal: number
  private example = ''
  private fx: PromptFx
  private fxStep = 0
  private fxSeed = 0
  private fxTimer?: ReturnType<typeof setTimeout>

  constructor(opts: PalettePromptOptions) {
    super({ render: () => this.draw(), input: opts.input, output: opts.output }, true)
    this.entries = opts.entries
    const named = opts.entries.filter((e) => !e.default)
    this.paletteTotal = named.length
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
      const row = this.rows[this.cursor]
      if (key?.name === 'return' && row?.kind === 'group') {
        this.toggle(row.name)
      }
    })
  }

  protected override _shouldSubmit(): boolean {
    return this.rows[this.cursor]?.kind === 'palette'
  }

  private rollExample(): void {
    const named = this.entries.filter((e) => !e.default)
    const groups = [...new Set(named.map((e) => e.group))]
    const pal = named[Math.floor(Math.random() * named.length)]
    const grp = groups[Math.floor(Math.random() * groups.length)]
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
    this.value = row?.kind === 'palette' ? row.entry.name : undefined
    if (row?.kind === 'palette' && row.entry.name !== this.lastFocused) {
      this.lastFocused = row.entry.name
      this.onFocus?.(row.entry)
    }
  }

  private rebuild(snap: 'first' | 'keep' | 'clamp'): void {
    const focused = this.rows[this.cursor]
    this.rows = pickerRows(this.entries, this.expanded, this.userInput)
    if (snap === 'first') {
      this.cursor = firstPalette(this.rows)
    } else if (snap === 'keep') {
      const name = focused?.kind === 'palette' ? focused.entry.name : ''
      const kept = name ? this.rows.findIndex((r) => r.kind === 'palette' && r.entry.name === name) : -1
      this.cursor = kept === -1 ? firstPalette(this.rows) : kept
    } else if (this.cursor >= this.rows.length) {
      this.cursor = Math.max(0, this.rows.length - 1)
    }
    this.sync()
  }

  private move(delta: number): void {
    const next = this.cursor + delta
    if (next >= 0 && next < this.rows.length) {
      this.cursor = next
    }
    this.sync()
  }

  private toggle(group: string): void {
    if (this.userInput) {
      return
    }
    if (this.expanded.has(group)) {
      this.expanded.delete(group)
    } else {
      this.expanded.add(group)
    }
    this.rebuild('clamp')
  }

  private fold(open: boolean): void {
    if (this.userInput) {
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

  private renderRow(row: PickerRow, focused: boolean): string {
    if (row.kind === 'group') {
      const arrow = row.expanded ? '▾' : '▸'
      const at = this.rows[this.cursor]
      const held = at?.kind === 'palette' && at.entry.group === row.name ? at.entry : undefined
      const name = this.color
        ? focused
          ? `${BOLD_INVERSE} ${row.name} ${RESET}`
          : held
            ? `${BOLD_INVERSE}${ansiFg(held.cursor)} ${row.name} ${RESET}`
            : ` ${BOLD}${row.name}${RESET} `
        : focused
          ? `[${row.name}]`
          : ` ${row.name}`
      const chip = this.color ? ansiChip('●', row.selection) : ''
      const count = this.color ? ` ${DIM}(${row.count})${RESET}` : ` (${row.count})`
      const native = row.native ? (this.color ? ` ${DIM}${row.native}${RESET}` : ` ${row.native}`) : ''
      return `${arrow}${name}${chip}${count}${native}`
    }
    const e = row.entry
    const marker = focused ? '▶ ' : '  '
    if (!this.color) {
      return `  ${marker}${e.name.padEnd(13)} ● · ${e.ansiSource}`
    }
    return `  ${marker}${e.name.padEnd(13)} ${ansiDot(e.background, e.cursor)}${ansiSwatch(e.ansi.slice(1, 7), e.background)}  ${DIM}${e.ansiSource}${RESET}`
  }

  private draw(): string {
    const dim = (s: string) => (this.color ? `${DIM}${s}${RESET}` : s)
    const bar = (s: string) => (this.color ? `${CYAN}${s}${RESET}` : s)
    if (this.state === 'submit') {
      return `${dim('◇')} startup palette ${dim(`· ${this.value ?? ''}`)}`
    }
    if (this.state === 'cancel') {
      return `${dim('◇ startup palette · cancelled')}`
    }
    const matched = this.userInput ? this.rows.filter((r) => r.kind === 'palette').length : this.paletteTotal
    const head = `${bar('◆')} startup palette ${dim(`(${matched}/${this.paletteTotal})`)}`
    const search = `${bar('│')} ${this.userInput ? `⌕ ${this.userInput}_` : dim(`⌕ search…${this.example ? ` e.g. ${this.animatedExample()}` : ''}`)}`
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
        : [`${bar('│')} ${dim(`no palettes match '${this.userInput}'`)}`]
    while (body.length < this.maxItems) {
      body.push(bar('│'))
    }
    const below = this.rows.length - this.top - window.length
    const more = below > 0 ? `${bar('│')} ${dim(`↓ ${below} more`)}` : bar('│')
    const hint = `${bar('└')} ${dim('↑↓ move · ←→ fold · type to filter · enter pick · esc cancel')}`
    return [head, search, ...body, more, hint].join('\n')
  }
}
