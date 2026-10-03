import type { Key } from 'node:readline'
import type { Readable, Writable } from 'node:stream'
import { Prompt } from '@clack/core'
import { ansiBar, ansiFg, fit, spread, wrapText } from './ansi.ts'
import { gateFailures } from './catalog.ts'
import { GATE_RULES } from './contrast.ts'
import { type HubTab, hubBar, hubGoto } from './hub.ts'
import type { PaletteEntry } from './manifest.ts'
import { type Repository, repositorySource } from './markets.ts'
import {
  BOLD,
  CYAN,
  DIM,
  type ListRow,
  NORMAL,
  PaletteList,
  type PromptFx,
  pageStep,
  paletteExample,
  RESET,
  SearchHint,
  stepRow,
  YELLOW,
} from './palette-prompt.ts'
import { counted, type Refreshed } from './refresh.ts'
import { isLocal, OFFICIAL, parseSource, sameMarket, shownSource, TOPIC } from './sources.ts'
import { marketOf, slugOf } from './theme.ts'

export type Tab = 'catalog' | 'installed' | 'markets' | 'errors'

export interface Market {
  source: string
  id: string
  shown: string
  entries: PaletteEntry[]
  auto: boolean
  status: string
}

export interface Problem {
  where: string
  message: string
  source?: string
  update?: true
}

export interface Report {
  say(line: string): void
  status(text: string): void
}

export interface BrowseIo {
  refresh(source: string): Promise<{ market: Market; refreshed: Refreshed }>
  fetch(source: string): Promise<Market>
  search(query: string | undefined): Promise<Repository[]>
  apply(result: BrowseResult, report: Report): Promise<void>
}

export interface BrowseOptions {
  markets: Market[]
  kept: PaletteEntry[]
  installed: string[]
  startup?: string
  problems: Problem[]
  due: string[]
  io: BrowseIo
  order?: (entries: PaletteEntry[]) => PaletteEntry[]
  hub?: HubTab
  lookups?: boolean
  color?: boolean
  fx?: PromptFx
  input?: Readable
  output?: Writable
  onFocus?: (entry: PaletteEntry) => void
}

export interface BrowseResult {
  picked: Set<string>
  adds: Market[]
  removes: string[]
  auto: Record<string, boolean>
  refreshed: Refreshed[]
}

type Phase = 'browse' | 'review' | 'applying' | 'done'

type MarketRow =
  | { kind: 'market'; market: Market }
  | { kind: 'add'; source: string }
  | { kind: 'find' }
  | { kind: 'rule' }
  | { kind: 'repo'; repo: Repository; source: string }

interface Detail {
  title: string
  lines: string[]
  brief: string
}

type Scoped = 'catalog' | 'installed'

interface Chip {
  source: string | undefined
  label: string
  count: number
}

const TABS: { tab: Tab; title: string; heading: string }[] = [
  { tab: 'catalog', title: 'Catalog', heading: 'Discover palettes' },
  { tab: 'installed', title: 'Installed', heading: 'Installed palettes' },
  { tab: 'markets', title: 'Markets', heading: 'Manage markets' },
  { tab: 'errors', title: 'Errors', heading: 'Problems' },
]
const RIGHT = 34
const LEFT_MAX = 72
const WIDE = 94
const ROOMY = 22
const MIN_COLS = 40
const MIN_ROWS = 10
const MIN_ITEMS = 3
const SEARCH_AFTER = 600
const TYPED_AFTER = 500
const FOCUS_AFTER = 300
const NAMES_SHOWN = 12
const BEAT = 80
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const PILL = '\x1b[7;1m'
const EMPTY: Detail = { title: '', lines: [], brief: '' }

function typedSource(text: string): string | undefined {
  const typed = text.trim()
  if (typed !== OFFICIAL && !typed.includes('/') && !typed.startsWith('~')) {
    return undefined
  }
  try {
    return parseSource(typed)
  } catch {
    return undefined
  }
}

function printable(text: string): string {
  return [...text].filter((c) => c >= ' ' && c !== '\x7f').join('')
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export class BrowsePanel extends Prompt<string> {
  readonly picked: Set<string>
  private tab: Tab = 'catalog'
  private readonly filters: Record<Tab, string> = { catalog: '', installed: '', markets: '', errors: '' }
  private readonly cursor = { markets: 0, errors: 0 }
  private readonly top = { markets: 0, errors: 0 }
  private readonly adds = new Map<string, Market>()
  private readonly removes = new Set<string>()
  private readonly want = new Map<string, boolean>()
  private readonly scope: Record<Scoped, string | undefined> = { catalog: undefined, installed: undefined }
  private readonly busy = new Map<string, string>()
  private readonly failed = new Map<string, string>()
  private readonly peeked = new Map<string, Market>()
  private readonly peekFailed = new Map<string, string>()
  private readonly staging = new Set<string>()
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly refreshed: Refreshed[] = []
  private readonly inflight = new Set<Promise<unknown>>()
  private markets: Market[]
  private problems: Problem[]
  private readonly kept: PaletteEntry[]
  private readonly installed: ReadonlySet<string>
  private readonly startup: string | undefined
  private readonly io: BrowseIo
  private readonly order: (entries: PaletteEntry[]) => PaletteEntry[]
  private readonly color: boolean
  private readonly hub: HubTab | undefined
  private maxItems = 12
  private readonly paint: ((entry: PaletteEntry) => void) | undefined
  private readonly catalog: PaletteList
  private readonly mine: PaletteList
  private readonly hint: SearchHint
  private phase: Phase = 'browse'
  private offset = 0
  private started = false
  private log: string[] = []
  private working = ''
  private stopped: Error | undefined
  private beat = 0
  private beating: ReturnType<typeof setInterval> | undefined
  private asking: Market | undefined
  private leaving: number | undefined
  private shifted = false
  private goto: number | undefined
  private repos: Repository[] | undefined
  private searching = false
  private searchError: string | undefined
  private searched: string | undefined
  private asked = 0
  private readonly live: boolean
  private lastInput = ''

  constructor(opts: BrowseOptions) {
    super({ render: () => this.draw(), input: opts.input, output: opts.output }, true)
    Object.assign(this, { render: () => this.screen() })
    this.markets = opts.markets
    this.problems = opts.problems
    this.kept = opts.kept
    this.installed = new Set(opts.installed)
    this.startup = opts.startup
    this.io = opts.io
    this.order = opts.order ?? ((entries) => entries)
    this.color = opts.color ?? true
    this.hub = opts.hub
    this.live = opts.lookups ?? true
    this.paint = opts.onFocus
    this.picked = new Set(opts.installed)
    const entries = this.entries()
    this.catalog = new PaletteList({
      entries,
      picked: this.picked,
      color: this.color,
      maxItems: this.maxItems,
      onFocus: (entry) => this.focus('catalog', entry),
    })
    this.mine = new PaletteList({
      entries: this.mineOf(entries),
      picked: this.picked,
      color: this.color,
      maxItems: this.maxItems,
      onFocus: (entry) => this.focus('installed', entry),
    })
    this.hint = new SearchHint(
      opts.fx ?? 'typewriter',
      () => paletteExample(this.tab === 'installed' ? this.mine : this.catalog),
      () => this.redraw(),
    )
    const shift = (_char: string | undefined, key: Key | undefined) => {
      this.shifted = key?.shift === true
    }
    this.input.on('keypress', shift)
    this.once('finalize', () => {
      this.hint.stop()
      this.input.off('keypress', shift)
      for (const timer of this.timers.values()) {
        clearTimeout(timer)
      }
      this.timers.clear()
      clearInterval(this.beating)
    })
    this.on('cursor', (action) => {
      if (this.phase !== 'browse') {
        if (action === 'up' || action === 'down') {
          this.scroll(action === 'up' ? -1 : 1)
        }
        return
      }
      if (this.asking || this.leaving !== undefined || this.shifted) {
        return
      }
      if (action === 'up' || action === 'down') {
        this.move(action === 'up' ? -1 : 1)
      } else if (action === 'left' || action === 'right') {
        this.side(action === 'right')
      }
    })
    this.on('userInput', (typed) => {
      const value = this.phase === 'browse' ? printable(typed) : this.filters[this.tab]
      if (value !== typed) {
        this.scrub(value)
      }
      if (value !== this.lastInput) {
        this.lastInput = value
        this.filters[this.tab] = value
        this.list()?.setFilter(value)
        if (this.tab === 'markets') {
          this.later('search', SEARCH_AFTER, () => this.lookup())
          this.watch()
        }
      }
    })
    this.on('key', (char, key) => this.key(char, key))
    for (const source of opts.due) {
      this.update(source)
    }
  }

  protected override _isActionKey(char: string | undefined): boolean {
    return (
      char === '\t' || char === ' ' || ((this.asking !== undefined || this.leaving !== undefined) && char !== undefined)
    )
  }

  protected override _shouldSubmit(): boolean {
    if (this.asking !== undefined || this.leaving !== undefined) {
      return false
    }
    return this.phase === 'done' || (this.phase === 'browse' && !this.dirty())
  }

  applied(): boolean {
    return this.started
  }

  lines(): string[] {
    return this.log
  }

  failure(): Error | undefined {
    return this.stopped
  }

  next(): number | undefined {
    return this.goto
  }

  async idle(): Promise<void> {
    await Promise.allSettled([...this.inflight])
  }

  result(): BrowseResult {
    const names = new Set(this.entries().map((e) => e.name))
    return {
      picked: new Set([...this.picked].filter((name) => names.has(name))),
      adds: [...this.adds.values()],
      removes: [...this.removes],
      auto: Object.fromEntries(this.want),
      refreshed: this.refreshed,
    }
  }

  private key(char: string | undefined, key: Key | undefined): void {
    if (this.leaving !== undefined) {
      if (key?.name === 'escape') {
        this.leaving = undefined
        Object.assign(key, { name: 'answered', sequence: '' })
      } else if (char && /^[yn]$/i.test(char)) {
        if (char.toLowerCase() === 'y') {
          this.begin()
        } else {
          this.goto = this.leaving
          this.state = 'cancel'
        }
        this.leaving = undefined
      }
      return
    }
    if (this.asking) {
      if (key?.name === 'escape') {
        this.asking = undefined
        Object.assign(key, { name: 'answered', sequence: '' })
      } else if (char && /^[yn]$/i.test(char)) {
        this.answer(char.toLowerCase() === 'y')
      }
      return
    }
    if (this.phase !== 'browse') {
      this.steer(key)
      return
    }
    const page = pageStep(key?.name, this.maxItems)
    if (key?.name === 'return') {
      if (this.dirty()) {
        this.phase = 'review'
        this.offset = 0
      }
    } else if (page !== undefined) {
      this.move(page)
    } else if (key?.name === 'tab') {
      if (this.hub) {
        this.leave(hubGoto(this.hub, key.shift ? -1 : 1))
      }
    } else if (key?.shift && (key.name === 'left' || key.name === 'right')) {
      this.switchTab(key.name === 'right' ? 1 : -1)
    } else if (key?.name === 'space') {
      this.activate()
    } else if (key?.ctrl && key.name === 'r') {
      const row = this.tab === 'markets' ? this.marketRow() : undefined
      if (row?.kind === 'market' && !this.adds.has(row.market.source)) {
        this.update(row.market.source)
      } else if (row?.kind === 'find') {
        this.search()
      }
    } else if (key?.ctrl && key.name === 's') {
      this.cycle()
    }
  }

  private scrub(text: string): void {
    const rl = (this as unknown as { rl?: { line: string; cursor: number } }).rl
    if (rl) {
      rl.line = text
      rl.cursor = text.length
    }
    this.userInput = text
    this._cursor = text.length
  }

  private redraw(): void {
    if (this.state === 'active' || this.state === 'error') {
      this.output.emit('resize')
    }
  }

  private focus(tab: Tab, entry: PaletteEntry): void {
    if (this.tab === tab && this.state !== 'submit' && this.state !== 'cancel') {
      this.paint?.(entry)
    }
  }

  private track<T>(work: Promise<T>): Promise<T> {
    this.inflight.add(work)
    const done = () => this.inflight.delete(work)
    work.then(done, done)
    return work
  }

  private list(): PaletteList | undefined {
    return this.tab === 'catalog' ? this.catalog : this.tab === 'installed' ? this.mine : undefined
  }

  private active(): Market[] {
    return [...this.markets.filter((m) => !this.removes.has(m.source)), ...this.adds.values()]
  }

  private entries(): PaletteEntry[] {
    const listed = this.active().flatMap((m) => m.entries)
    const names = new Set(listed.map((e) => e.name))
    const orphans = new Map<string, PaletteEntry>()
    const dropped = this.markets.filter((m) => this.removes.has(m.source)).flatMap((m) => m.entries)
    for (const entry of [...this.kept, ...dropped]) {
      if (this.installed.has(entry.name) && !names.has(entry.name)) {
        orphans.set(entry.name, entry)
      }
    }
    return this.order([...listed, ...orphans.values()])
  }

  private mineOf(entries: PaletteEntry[]): PaletteEntry[] {
    return entries.filter((e) => this.installed.has(e.name))
  }

  private scoped(entries: PaletteEntry[], tab: Scoped): PaletteEntry[] {
    const source = this.scope[tab]
    const market = source === undefined ? undefined : this.active().find((m) => m.source === source)
    if (!market) {
      this.scope[tab] = undefined
      return entries
    }
    const names = new Set(market.entries.map((e) => e.name))
    return entries.filter((e) => names.has(e.name))
  }

  private reload(): void {
    const entries = this.entries()
    this.catalog.setEntries(this.scoped(entries, 'catalog'))
    this.mine.setEntries(this.scoped(this.mineOf(entries), 'installed'))
  }

  private chips(tab: Scoped): Chip[] {
    const entries = tab === 'catalog' ? this.entries() : this.mineOf(this.entries())
    const markets = this.active()
      .map((m) => ({
        source: m.source as string | undefined,
        label: m.id,
        count: m.entries.filter((e) => !e.default && (tab === 'catalog' || this.installed.has(e.name))).length,
      }))
      .filter((c) => tab === 'catalog' || c.count > 0 || c.source === this.scope[tab])
    return [{ source: undefined, label: 'All', count: entries.filter((e) => !e.default).length }, ...markets]
  }

  private cycle(): void {
    const tab = this.tab
    if ((tab !== 'catalog' && tab !== 'installed') || this.active().length < 2) {
      return
    }
    const chips = this.chips(tab)
    const at = Math.max(
      0,
      chips.findIndex((c) => c.source === this.scope[tab]),
    )
    this.scope[tab] = chips[(at + 1) % chips.length]?.source
    this.reload()
    this.list()?.refocus()
  }

  private switchTab(step: number): void {
    const at = TABS.findIndex((t) => t.tab === this.tab)
    const next = TABS[(at + step + TABS.length) % TABS.length]?.tab ?? 'catalog'
    const saved = this.filters[next]
    this.tab = next
    this._clearUserInput()
    this._setUserInput(saved, true)
    this.lastInput = saved
    this.list()?.refocus()
    if (next === 'markets') {
      this.lookup()
      this.watch()
    }
  }

  private move(delta: number): void {
    const list = this.list()
    if (list) {
      list.move(delta)
      return
    }
    const key = this.tab === 'markets' ? 'markets' : 'errors'
    const rules =
      key === 'markets' ? this.marketRows().map((r) => r.kind === 'rule') : this.problemRows().map(() => false)
    this.cursor[key] = stepRow(this.cursor[key], delta, rules.length, (i) => rules[i] === true)
    this.watch()
  }

  private side(right: boolean): void {
    const list = this.list()
    if (list) {
      list.fold(right)
      return
    }
    const row = this.tab === 'markets' ? this.marketRow() : undefined
    if (row?.kind === 'market' && !isLocal(row.market.source)) {
      if (right === row.market.auto) {
        this.want.delete(row.market.source)
      } else {
        this.want.set(row.market.source, right)
      }
    }
  }

  private activate(): void {
    const list = this.list()
    if (list) {
      list.pick()
      return
    }
    const row = this.tab === 'markets' ? this.marketRow() : undefined
    if (row?.kind === 'market') {
      this.toggleMarket(row.market)
    } else if (row?.kind === 'add') {
      this.load(row.source, true)
    } else if (row?.kind === 'repo') {
      const known = this.known(row.source)
      const at = this.marketRows().findIndex((r) => r.kind === 'market' && r.market === known)
      if (known && at >= 0) {
        this.cursor.markets = at
      } else if (!known) {
        this.load(row.source, true)
      }
    } else if (row?.kind === 'find') {
      this.search()
    }
  }

  private toggleMarket(market: Market): void {
    if (this.adds.has(market.source)) {
      this.adds.delete(market.source)
      this.want.delete(market.source)
    } else if (this.removes.has(market.source)) {
      this.removes.delete(market.source)
    } else {
      this.removes.add(market.source)
    }
    this.reload()
  }

  private known(source: string): Market | undefined {
    return [...this.markets, ...this.adds.values()].find((m) => sameMarket(m.source, source))
  }

  private load(source: string, stage: boolean): void {
    const got = this.peeked.get(source)
    if (got) {
      if (stage) {
        this.arrive(source, got)
      }
      return
    }
    if (stage) {
      this.staging.add(source)
    }
    if (this.busy.has(source)) {
      return
    }
    this.failed.delete(source)
    this.peekFailed.delete(source)
    this.busy.set(source, 'Fetching…')
    this.track(this.io.fetch(source)).then(
      (market) => {
        this.busy.delete(source)
        this.peeked.set(source, market)
        if (this.staging.delete(source)) {
          this.arrive(source, market)
        }
        this.redraw()
      },
      (error: Error) => {
        this.busy.delete(source)
        if (this.staging.delete(source)) {
          this.failed.set(source, error.message)
        } else {
          this.peekFailed.set(source, error.message)
        }
        this.redraw()
      },
    )
  }

  private arrive(source: string, market: Market): void {
    const clash = this.active().find((m) => m.id === market.id)
    if (clash) {
      this.failed.set(source, `${market.id} already names the market at ${clash.shown}`)
    } else if (isLocal(source) || source === OFFICIAL) {
      this.stage(market, market.auto)
    } else {
      this.asking = market
    }
    this.redraw()
  }

  private later(key: string, ms: number, run: () => void): void {
    this.cancel(key)
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key)
        if (this.state !== 'submit' && this.state !== 'cancel') {
          run()
        }
      }, ms),
    )
  }

  private cancel(key: string): void {
    clearTimeout(this.timers.get(key))
    this.timers.delete(key)
  }

  private wants(source: string): boolean {
    return !this.known(source) && !this.peeked.has(source) && !this.busy.has(source) && !this.peekFailed.has(source)
  }

  private watch(): void {
    if (!this.live || this.tab !== 'markets') {
      return
    }
    const typed = typedSource(this.filters.markets)
    if (typed && this.wants(typed)) {
      this.later('typed', TYPED_AFTER, () => this.load(typed, false))
    } else {
      this.cancel('typed')
    }
    const row = this.marketRow()
    if (row?.kind === 'repo' && this.wants(row.source)) {
      const source = row.source
      this.later('focus', FOCUS_AFTER, () => {
        const now = this.marketRow()
        if (this.tab === 'markets' && now?.kind === 'repo' && now.source === source) {
          this.load(source, false)
        }
      })
    } else {
      this.cancel('focus')
    }
  }

  private answer(yes: boolean): void {
    const market = this.asking
    this.asking = undefined
    if (market) {
      this.stage(market, yes)
    }
  }

  private stage(market: Market, auto: boolean): void {
    this.adds.set(market.source, market)
    if (auto === market.auto) {
      this.want.delete(market.source)
    } else {
      this.want.set(market.source, auto)
    }
    this.reload()
    this.cursor.markets = Math.max(
      0,
      this.marketRows().findIndex((r) => r.kind === 'market' && r.market.source === market.source),
    )
  }

  private update(source: string): void {
    if (this.busy.has(source)) {
      return
    }
    this.failed.delete(source)
    this.busy.set(source, 'Updating…')
    this.track(this.io.refresh(source)).then(
      ({ market, refreshed }) => {
        this.busy.delete(source)
        this.markets = this.markets.map((m) => (m.source === source ? market : m))
        this.problems = this.problems.filter((p) => p.source !== source)
        this.refreshed.push(refreshed)
        this.reload()
        this.redraw()
      },
      (error: Error) => {
        this.busy.delete(source)
        this.failed.set(source, `Update failed: ${error.message}`)
        this.redraw()
      },
    )
  }

  private wanted(): string {
    const query = this.filters.markets.trim()
    return query && !typedSource(query) ? query : ''
  }

  private lookup(): void {
    if (this.live && this.searched !== this.wanted()) {
      this.search()
    }
  }

  private search(): void {
    const query = this.wanted()
    const seq = ++this.asked
    this.searched = query
    this.searching = true
    this.searchError = undefined
    this.track(this.io.search(query || undefined)).then(
      (repos) => {
        if (seq === this.asked) {
          this.searching = false
          this.repos = repos
          this.watch()
          this.redraw()
        }
      },
      (error: Error) => {
        if (seq === this.asked) {
          this.searching = false
          this.searchError = error.message
          this.redraw()
        }
      },
    )
  }

  private marketRows(): MarketRow[] {
    const query = this.filters.markets.trim().toLowerCase()
    const hit = (...fields: string[]) => query === '' || fields.some((f) => f.toLowerCase().includes(query))
    const known = [...this.markets, ...this.adds.values()]
    const rows: MarketRow[] = known
      .filter((m) => hit(m.id, m.shown, m.source))
      .map((market) => ({ kind: 'market', market }))
    const typed = typedSource(this.filters.markets)
    if (typed && !known.some((m) => sameMarket(m.source, typed))) {
      rows.push({ kind: 'add', source: typed })
    }
    const found = (this.repos ?? [])
      .map((repo) => ({ repo, source: repositorySource(repo) }))
      .filter(({ repo, source }) => hit(source, repo.description ?? ''))
    rows.push(
      { kind: 'rule' },
      ...(found.length > 0
        ? found.map(({ repo, source }) => ({ kind: 'repo' as const, repo, source }))
        : [{ kind: 'find' as const }]),
    )
    return rows
  }

  private marketRow(): MarketRow | undefined {
    const rows = this.marketRows()
    return rows[this.at(rows, 'markets', (r) => r?.kind === 'rule')]
  }

  private problemList(): Problem[] {
    const names = new Map([...this.markets, ...this.adds.values()].map((m) => [m.source, m.id]))
    return [
      ...this.problems.filter((p) => !(p.update && p.source && this.failed.has(p.source))),
      ...[...this.failed].map(([source, message]) => ({ where: names.get(source) ?? source, message, source })),
    ]
  }

  private problemRows(): Problem[] {
    const query = this.filters.errors.trim().toLowerCase()
    return this.problemList().filter((p) => query === '' || `${p.where} ${p.message}`.toLowerCase().includes(query))
  }

  private at<T>(rows: T[], key: 'markets' | 'errors', rule: (row: T | undefined) => boolean = () => false): number {
    const cursor = Math.min(this.cursor[key], Math.max(0, rows.length - 1))
    if (!rule(rows[cursor])) {
      return cursor
    }
    return cursor > 0 ? cursor - 1 : cursor + 1
  }

  private windowOf<T>(
    rows: T[],
    key: 'markets' | 'errors',
    render: (row: T, focused: boolean) => string[],
    rule: (row: T | undefined) => boolean = () => false,
  ): { lines: string[]; above: number; below: number } {
    const cursor = this.at(rows, key, rule)
    this.cursor[key] = cursor
    const height = (i: number) => (rule(rows[i]) ? 1 : 2)
    const span = (from: number, to: number) => {
      let lines = 0
      for (let i = from; i <= to; i++) {
        lines += height(i)
      }
      return lines
    }
    let top = Math.min(this.top[key], cursor)
    while (top < cursor && span(top, cursor) > this.maxItems) {
      top += 1
    }
    while (top > 0 && span(top - 1, rows.length - 1) <= this.maxItems) {
      top -= 1
    }
    this.top[key] = top
    const shown: number[] = []
    let used = 0
    for (let i = top; i < rows.length && used + height(i) <= this.maxItems; i++) {
      shown.push(i)
      used += height(i)
    }
    return {
      lines: shown.flatMap((i) => render(rows[i] as T, i === cursor)),
      above: top,
      below: rows.length - top - shown.length,
    }
  }

  private dim(text: string): string {
    return this.color ? `${DIM}${text}${NORMAL}` : text
  }

  private bold(text: string): string {
    return this.color ? `${BOLD}${text}${NORMAL}` : text
  }

  private warn(text: string): string {
    return this.color ? `${YELLOW}${text}\x1b[39m` : text
  }

  private lit(lead: PaletteEntry | undefined, focused: boolean, text: string): string {
    if (focused && this.color && lead) {
      return `${ansiFg(lead.cursor)}▌\x1b[39m ${ansiBar(lead.selection, lead.foreground)} ${text} ${RESET}`
    }
    return `${focused ? '▌ ' : '  '} ${text}`
  }

  private status(market: Market): string {
    return this.adds.has(market.source)
      ? 'Will add'
      : this.removes.has(market.source)
        ? 'Will remove'
        : (this.busy.get(market.source) ??
          (this.failed.has(market.source) || market.status.startsWith('update failed') ? 'Update failed' : ''))
  }

  private note(text: string): string {
    return `     ${this.dim(text)}`
  }

  private peeking(source: string): string {
    const peeked = this.peeked.get(source)
    return peeked ? counted(peeked.entries.filter((e) => !e.default).length) : ''
  }

  private marketLine(row: MarketRow, focused: boolean): string[] {
    if (row.kind === 'rule') {
      return [`   ${this.dim(`── On GitHub${this.searching ? ' · searching…' : ''} ──────────`)}`]
    }
    if (row.kind === 'market') {
      const m = row.market
      const status = this.status(m)
      const box = this.removes.has(m.source) ? '○' : '●'
      const name = focused ? this.bold(m.id) : m.id
      const listed = m.entries.filter((e) => !e.default)
      const auto = !isLocal(m.source) && (this.want.get(m.source) ?? m.auto) ? `  ${this.dim('↻ auto-update')}` : ''
      return [
        this.lit(
          m.entries.find((e) => !e.default),
          focused,
          `${box} ${name}${auto}${status ? `  ${this.dim(status)}` : ''}`,
        ),
        this.note(
          [
            m.source === OFFICIAL ? 'The ttheme catalog' : isLocal(m.source) ? m.shown : m.source,
            counted(listed.length),
            `${listed.filter((e) => this.installed.has(e.name)).length} installed`,
            m.status,
          ].join(' · '),
        ),
      ]
    }
    if (row.kind === 'add') {
      const busy = this.busy.get(row.source)
      const failure = this.failed.get(row.source) ?? this.peekFailed.get(row.source)
      const peeked = this.peeked.get(row.source)
      return [
        this.lit(undefined, focused, `+ Add ${shownSource(row.source)}${busy ? `  ${this.dim(busy)}` : ''}`),
        failure
          ? `     ${this.warn(failure)}`
          : this.note(
              peeked
                ? `${peeked.id} · ${this.peeking(row.source)}`
                : this.live
                  ? 'Fetching its index…'
                  : 'space fetches its index',
            ),
      ]
    }
    if (row.kind === 'find') {
      const query = this.filters.markets.trim()
      const named = query && !typedSource(query)
      const idle = !this.searching && !this.searchError && this.repos === undefined
      const text = this.searching
        ? 'Searching GitHub…'
        : this.searchError
          ? 'GitHub search failed'
          : idle
            ? named
              ? `Find "${query}" on GitHub`
              : 'Find markets on GitHub'
            : named
              ? `No market on GitHub matches "${query}"`
              : 'No market on GitHub yet'
      return [
        this.lit(undefined, focused, `⌕ ${text}`),
        this.note(this.searchError ?? (this.searching ? '' : idle ? 'space searches GitHub' : 'space searches again')),
      ]
    }
    const busy = this.busy.get(row.source)
    const box = this.known(row.source) ? '●' : '○'
    return [
      this.lit(
        undefined,
        focused,
        `${box} ${row.source}  ${this.dim(`★${row.repo.stargazers_count}`)}${busy ? `  ${this.dim(busy)}` : ''}`,
      ),
      this.note([this.peeking(row.source), row.repo.description ?? ''].filter(Boolean).join(' · ')),
    ]
  }

  private problemLine(problem: Problem, focused: boolean): string[] {
    return [this.lit(undefined, focused, `${this.warn('✗')} ${problem.where}`), this.note(problem.message)]
  }

  private body(): { lines: string[]; above: number; below: number; empty: string } {
    const list = this.list()
    if (list) {
      const filter = this.filters[this.tab]
      return {
        ...list.window(),
        empty: filter
          ? `No palettes match '${filter}'`
          : this.tab === 'installed'
            ? 'Nothing installed yet'
            : 'No palettes',
      }
    }
    if (this.tab === 'markets') {
      return {
        ...this.windowOf(
          this.marketRows(),
          'markets',
          (r, f) => this.marketLine(r, f),
          (r) => r?.kind === 'rule',
        ),
        empty: '',
      }
    }
    const filter = this.filters.errors
    return {
      ...this.windowOf(this.problemRows(), 'errors', (p, f) => this.problemLine(p, f)),
      empty: filter ? `No problems match '${filter}'` : 'No problems',
    }
  }

  private changes(): number {
    return this.adds.size + this.removes.size + this.want.size
  }

  private dirty(): boolean {
    const { picked } = this.result()
    return this.changes() > 0 || picked.size !== this.installed.size || [...picked].some((n) => !this.installed.has(n))
  }

  private leave(code: number): void {
    if (this.dirty()) {
      this.leaving = code
      return
    }
    this.goto = code
    this.state = 'cancel'
  }

  private steer(key: Key | undefined): void {
    const name = key?.name
    const quiet = () => Object.assign(key ?? {}, { name: 'answered', sequence: '' })
    if (this.phase === 'review') {
      if (name === 'return') {
        this.begin()
      } else if (name === 'escape') {
        quiet()
        this.phase = 'browse'
      }
    } else if (name === 'escape') {
      quiet()
      if (this.phase === 'done') {
        this.state = 'submit'
      }
    }
    const page = pageStep(name, this.span())
    if (page !== undefined) {
      this.scroll(page)
    }
  }

  private scroll(delta: number): void {
    this.offset = Number.isFinite(delta) ? Math.max(0, this.offset + delta) : delta > 0 ? Number.MAX_SAFE_INTEGER : 0
    this.redraw()
  }

  private span(): number {
    return Math.max(MIN_ITEMS, this.rows() - (this.hub ? 1 : 0) - 4)
  }

  private begin(): void {
    this.phase = 'applying'
    this.started = true
    this.offset = 0
    this.log = []
    this.working = ''
    this.beating = setInterval(() => {
      this.beat += 1
      this.redraw()
    }, BEAT)
    const report: Report = {
      say: (line) => {
        this.log.push(...line.split('\n'))
        this.redraw()
      },
      status: (text) => {
        this.working = text
        this.redraw()
      },
    }
    this.track(this.io.apply(this.result(), report)).then(
      () => this.ended(),
      (error: Error) => this.ended(error),
    )
  }

  private ended(error?: Error): void {
    clearInterval(this.beating)
    this.beating = undefined
    this.working = ''
    this.stopped = error
    this.phase = 'done'
    this.offset = 0
    this.redraw()
  }

  private pending(): { names: PaletteEntry[]; dropped: PaletteEntry[] } {
    const entries = this.entries().filter((e) => !e.default)
    return {
      names: entries.filter((e) => this.picked.has(e.name) && !this.installed.has(e.name)),
      dropped: entries.filter((e) => this.installed.has(e.name) && !this.picked.has(e.name)),
    }
  }

  private marketChanges(): string[] {
    const rows: string[] = []
    for (const m of this.adds.values()) {
      const auto = m.source !== OFFICIAL && (this.want.get(m.source) ?? m.auto) ? 'updates on its own' : ''
      rows.push(
        `+ ${m.id}  ${this.dim([m.source === OFFICIAL ? 'The ttheme catalog' : m.shown, counted(m.entries.filter((e) => !e.default).length), auto].filter(Boolean).join(' · '))}`,
      )
    }
    for (const source of this.removes) {
      const m = this.markets.find((x) => x.source === source)
      const stay = (m?.entries ?? []).filter((e) => !e.default && this.installed.has(e.name) && this.picked.has(e.name))
      rows.push(
        `- ${m?.id ?? source}  ${this.dim([m?.shown ?? shownSource(source), stay.length > 0 ? `its ${counted(stay.length)} installed keep working` : ''].filter(Boolean).join(' · '))}`,
      )
    }
    for (const [source, on] of this.want) {
      const m = this.markets.find((x) => x.source === source)
      if (m && !this.removes.has(source)) {
        rows.push(`↻ ${m.id}  ${this.dim(on ? 'updates on its own from now' : 'stops updating on its own')}`)
      }
    }
    return rows
  }

  private reviewLines(): string[] {
    const markets = this.marketChanges()
    const { names, dropped } = this.pending()
    const width = Math.max(0, ...[...names, ...dropped].map((e) => e.name.length))
    const palette = (sign: string, e: PaletteEntry) =>
      `   ${sign} ${e.name.padEnd(width)}  ${this.dim(marketOf(e.name) ? (e.catalog ?? '') : e.group)}`
    const counts = [
      names.length > 0 ? `${names.length} to install` : '',
      dropped.length > 0 ? `${dropped.length} to remove` : '',
    ].filter(Boolean)
    return [
      ...(markets.length > 0
        ? [` ${this.bold('Markets')} ${this.dim(`(${markets.length})`)}`, ...markets.map((r) => `   ${r}`), '']
        : []),
      ...(counts.length > 0
        ? [
            ` ${this.bold('Palettes')} ${this.dim(`(${counts.join(' · ')})`)}`,
            ...names.map((e) => palette('+', e)),
            ...dropped.map((e) => palette('-', e)),
          ]
        : []),
    ]
  }

  private summary(): string {
    const { names, dropped } = this.pending()
    const added = this.adds.size
    return [
      added > 0 ? `${added} market${added === 1 ? '' : 's'} added` : '',
      this.removes.size > 0 ? `${this.removes.size} removed` : '',
      names.length > 0 ? `${names.length} installed` : '',
      dropped.length > 0 ? `${dropped.length} removed` : '',
    ]
      .filter(Boolean)
      .join(' · ')
  }

  private progressLines(): string[] {
    const lines = this.log.map((line) => ` ${line}`)
    if (this.phase === 'applying') {
      const frame = SPINNER[this.beat % SPINNER.length]
      lines.push(` ${this.dim(`${frame} ${this.working || 'Working…'}`)}`)
    } else if (this.stopped) {
      lines.push(
        '',
        ...wrapText(this.stopped.message, Math.max(20, this.columns() - 6)).map(
          (l, i) => ` ${i === 0 ? this.warn('✗') : ' '} ${l}`,
        ),
      )
    }
    return lines
  }

  private frame(cols: number, rows: number): string {
    const width = cols - 1
    const review = this.phase === 'review'
    const lines = review ? this.reviewLines() : this.progressLines()
    const title =
      this.phase === 'review'
        ? `${this.bold('Review changes')}`
        : this.phase === 'applying'
          ? this.bold('Applying changes')
          : this.stopped
            ? `${this.warn('✗')} ${this.bold('Stopped')}`
            : `${this.bold('✓ Applied')} ${this.dim(this.summary() ? `(${this.summary()})` : '')}`
    const room = this.span()
    const most = Math.max(0, lines.length - room)
    const top = this.phase === 'applying' ? most : Math.min(this.offset, most)
    this.offset = top
    const shown = lines.slice(top, top + room)
    const below = lines.length - top - shown.length
    const body = [top > 0 ? ` ${this.dim(`↑ ${top} more`)}` : '', ...shown]
    while (body.length < room + 1) {
      body.push('')
    }
    body.push(below > 0 ? ` ${this.dim(`↓ ${below} more`)}` : '')
    const keys = review
      ? [...(most > 0 ? ['↑↓ scroll'] : []), 'enter apply', 'esc back']
      : this.phase === 'applying'
        ? ['keys wait until it ends']
        : [...(most > 0 ? ['↑↓ scroll'] : []), 'enter close']
    return [
      ...(this.hub ? [fit(hubBar(this.hub, this.color), width, false)] : []),
      fit(` ${title}`, width, false),
      ...body.map((line) => fit(line, width, false)),
      fit(` ${this.dim(keys.join(' · '))}`, width, false),
    ]
      .slice(0, rows)
      .join('\n')
  }

  private counts(): string {
    const updating = [...this.busy.values()].includes('Updating…') ? 'Updating… · ' : ''
    const list = this.list()
    if (list) {
      return `${updating}${list.matched()}/${list.total()} · ${list.pickedCount()} picked`
    }
    if (this.tab === 'markets') {
      const all = this.markets.length + this.adds.size
      const shown = this.marketRows().filter((r) => r.kind === 'market').length
      const changes = this.changes()
      return `${updating}${shown}/${all}${changes > 0 ? ` · ${changes} to apply` : ''}`
    }
    return `${this.problemRows().length}/${this.problemList().length}`
  }

  private searchText(): string {
    if (this.userInput) {
      return `${this.userInput}_`
    }
    if (this.tab === 'markets') {
      return this.dim('Search… or add one: owner/repo')
    }
    const example = this.tab === 'errors' ? '' : this.hint.text()
    return this.dim(`Search…${example ? ` e.g. ${example}` : ''}`)
  }

  private tabBar(): string {
    return TABS.map(({ tab, title }) => {
      const count = tab === 'errors' ? this.problemList().length : 0
      const label = count > 0 ? `${title} ${count}` : title
      if (!this.color) {
        return tab === this.tab ? `[${label}]` : ` ${label} `
      }
      return tab === this.tab ? `${PILL} ${label} ${RESET}` : `${DIM} ${label} ${RESET}`
    }).join(' ')
  }

  private heading(): string {
    const title = TABS.find((t) => t.tab === this.tab)?.heading ?? ''
    return `${this.bold(title)} ${this.dim(`(${this.counts()})`)}`
  }

  private searchBox(width: number): string[] {
    const edge = (left: string, right: string) => this.dim(`${left}${'─'.repeat(width - 2)}${right}`)
    const side = this.dim('│')
    return [
      edge('╭', '╮'),
      `${side} ${fit(`${this.dim('⌕')} ${this.searchText()}`, width - 4)} ${side}`,
      edge('╰', '╯'),
    ]
  }

  private strip(width: number): string | undefined {
    const tab = this.tab
    if ((tab !== 'catalog' && tab !== 'installed') || this.active().length < 2) {
      return undefined
    }
    const chips = this.chips(tab)
    const sel = Math.max(
      0,
      chips.findIndex((c) => c.source === this.scope[tab]),
    )
    const labels = chips.map((c, i) => (i === sel && !this.color ? `[${c.label} ${c.count}]` : `${c.label} ${c.count}`))
    const sep = ' · '
    const tail = (more: number) => (more > 0 ? `${sep}+${more} more`.length : 0)
    const shownFrom = (start: number): number => {
      let used = start > 0 ? 2 : 0
      let n = 0
      for (let i = start; i < labels.length; i++) {
        const grown = used + (n > 0 ? sep.length : 0) + (labels[i] as string).length
        if (grown + tail(labels.length - i - 1) > width) {
          break
        }
        used = grown
        n += 1
      }
      return n
    }
    let start = 0
    while (start < sel && start + shownFrom(start) <= sel) {
      start += 1
    }
    const count = Math.max(1, shownFrom(start))
    const shown = labels.slice(start, start + count)
    const left = labels.length - start - count
    const parts = shown.map((label, i) => {
      if (start + i === sel) {
        return this.color ? `${BOLD}${CYAN}${label}${RESET}` : label
      }
      return this.dim(label)
    })
    const text = `${start > 0 ? `${this.dim('…')} ` : ''}${parts.join(this.dim(sep))}${left > 0 ? this.dim(`${sep}+${left} more`) : ''}`
    const plain = (start > 0 ? 2 : 0) + shown.join(sep).length + tail(left)
    const hint = 'ctrl+s market'
    return plain + 2 + hint.length <= width ? `${text}  ${this.dim(hint)}` : text
  }

  private sourceOf(entry: PaletteEntry): string {
    const market = this.active().find((m) => m.entries.some((e) => e.name === entry.name))
    if (!market) {
      return 'In no market you added'
    }
    return market.source === OFFICIAL ? 'The ttheme catalog' : market.shown
  }

  private paletteState(entry: PaletteEntry): string {
    const now = this.picked.has(entry.name)
    const was = this.installed.has(entry.name)
    const state = now && was ? 'Installed' : now ? 'Will install' : was ? 'Will remove' : 'Not installed'
    return this.startup === entry.name ? `${state} · Default` : state
  }

  private paletteDetail(row: ListRow | undefined, width: number): Detail {
    if (!row || row.kind === 'rule') {
      return EMPTY
    }
    if (row.kind === 'all') {
      return { title: this.bold('Select all'), lines: ['space picks every palette shown'], brief: '' }
    }
    if (row.kind === 'group') {
      const members = this.entries().filter((e) => e.group === row.name && !e.default)
      const source = this.sourceOf(row.lead)
      const counts = `${counted(members.length)} · ${members.filter((e) => this.installed.has(e.name)).length} installed`
      return {
        title: this.bold(row.name),
        lines: [
          ...(row.native ? wrapText(row.native, width).map((l) => this.dim(l)) : []),
          ...wrapText(source, width),
          counts,
        ],
        brief: `${source} · ${counts}`,
      }
    }
    if (row.kind === 'catalog') {
      const members = this.entries().filter((e) => e.group === row.group && e.catalog === row.name)
      const source = this.sourceOf(row.lead)
      const counts = `${counted(members.length)} · ${members.filter((e) => this.installed.has(e.name)).length} installed`
      return {
        title: this.bold(row.name),
        lines: [row.group, ...wrapText(source, width), counts],
        brief: `${row.group} · ${counts}`,
      }
    }
    const e = row.entry
    const source = this.sourceOf(e)
    const fails = gateFailures(e)
    const gate = `Gate ${GATE_RULES.length - fails.length}/${GATE_RULES.length}`
    const pictures = e.pictures?.length ?? 0
    const extras = [
      ...(pictures > 0 ? [`${pictures} picture${pictures === 1 ? '' : 's'}`] : []),
      ...(e.base ? [`Base ${e.base}`] : []),
    ].join(' · ')
    const series = marketOf(e.name)
      ? e.catalog
        ? [e.catalog]
        : []
      : [e.group, ...(e.native ? [this.dim(e.native)] : [])]
    return {
      title: this.color ? `${BOLD}${ansiFg(e.cursor)}${e.name}${NORMAL}\x1b[39m` : e.name,
      lines: [
        ...wrapText(source, width),
        ...series,
        this.paletteState(e),
        '',
        fails.length === 0 ? `${gate} · passes` : gate,
        ...fails.flatMap((f) => wrapText(f, width - 2).map((l, i) => `${i === 0 ? this.warn('✗') : ' '} ${l}`)),
        ...(extras ? ['', extras] : []),
      ],
      brief: [source, gate, ...(extras ? [extras] : []), this.paletteState(e)].join(' · '),
    }
  }

  private marketDetail(row: MarketRow | undefined, width: number): Detail {
    if (!row || row.kind === 'rule') {
      return EMPTY
    }
    if (row.kind === 'market') {
      const m = row.market
      const source = m.source === OFFICIAL ? 'The ttheme catalog' : m.shown
      const listed = m.entries.filter((e) => !e.default)
      const installed = listed.filter((e) => this.installed.has(e.name)).map((e) => e.name)
      const counts = `${counted(listed.length)} · ${installed.length} installed`
      const auto = isLocal(m.source)
        ? 'Read in place'
        : `Auto-update ${(this.want.get(m.source) ?? m.auto) ? 'on' : 'off'}`
      const when = this.busy.get(m.source) ?? cap(m.status)
      const failure = this.failed.get(m.source)
      const staged = this.adds.has(m.source)
        ? ['Will add']
        : this.removes.has(m.source)
          ? [
              installed.length > 0
                ? `Will remove — ${installed.join(', ')} stay${installed.length === 1 ? 's' : ''} installed`
                : 'Will remove',
            ]
          : this.want.has(m.source)
            ? [`Auto-update turns ${this.want.get(m.source) ? 'on' : 'off'}`]
            : []
      return {
        title: this.bold(m.id),
        lines: [
          ...wrapText(source, width),
          counts,
          '',
          isLocal(m.source) ? auto : `${auto}  ${this.dim('←→')}`,
          ...(isLocal(m.source) ? [] : [when]),
          ...(failure ? wrapText(failure, width).map((l) => this.warn(l)) : []),
          ...(staged.length > 0 ? ['', ...staged.flatMap((s) => wrapText(s, width))] : []),
        ],
        brief: [source, auto, ...staged, ...(isLocal(m.source) ? [] : [when])].join(' · '),
      }
    }
    if (row.kind === 'add') {
      const note =
        this.busy.get(row.source) ??
        this.failed.get(row.source) ??
        this.peekFailed.get(row.source) ??
        (this.peeked.has(row.source) ? 'space adds it' : this.live ? 'Fetching its index…' : 'space fetches its index')
      return {
        title: this.bold(shownSource(row.source)),
        lines: ['Not added', ...this.peekLines(row.source, width), '', ...wrapText(note, width)],
        brief: [this.peeking(row.source), note].filter(Boolean).join(' · '),
      }
    }
    if (row.kind === 'find') {
      const query = this.filters.markets.trim()
      const note =
        this.searchError ??
        (this.searching
          ? 'Searching…'
          : this.repos
            ? `${this.repos.length} found · space searches again`
            : 'space searches GitHub')
      return {
        title: this.bold('GitHub'),
        lines: [
          ...wrapText(`Repositories with the ${TOPIC} topic`, width),
          ...(query && !typedSource(query) ? [`Matching "${query}"`] : []),
          '',
          ...wrapText(note, width),
        ],
        brief: note,
      }
    }
    const known = this.known(row.source)
    const note = known
      ? 'Added'
      : (this.busy.get(row.source) ?? this.failed.get(row.source) ?? this.peekFailed.get(row.source) ?? 'space adds it')
    return {
      title: this.bold(row.source),
      lines: [
        `★ ${row.repo.stargazers_count}`,
        ...wrapText(row.repo.description ?? '', width),
        ...this.peekLines(row.source, width),
        '',
        ...wrapText(note, width),
      ],
      brief: [this.peeking(row.source), note].filter(Boolean).join(' · '),
    }
  }

  private peekLines(source: string, width: number): string[] {
    const peeked = this.peeked.get(source)
    if (!peeked) {
      return []
    }
    const listed = peeked.entries.filter((e) => !e.default)
    const names = `${listed
      .slice(0, NAMES_SHOWN)
      .map((e) => slugOf(e.name))
      .join(', ')}${listed.length > NAMES_SHOWN ? ', …' : ''}`
    return ['', peeked.id, counted(listed.length), ...wrapText(names, width).map((l) => this.dim(l))]
  }

  private detail(width: number): Detail {
    const list = this.list()
    if (list) {
      return this.paletteDetail(list.focusedRow(), width)
    }
    if (this.tab === 'markets') {
      return this.marketDetail(this.marketRow(), width)
    }
    const rows = this.problemRows()
    const problem = rows[Math.min(this.cursor.errors, rows.length - 1)]
    return problem
      ? { title: this.bold(problem.where), lines: wrapText(problem.message, width), brief: problem.message }
      : EMPTY
  }

  private footer(wide: boolean): string {
    if (this.leaving !== undefined) {
      return ` Apply your changes before you leave? ${this.dim('y apply · n discard · esc stay')}`
    }
    if (this.asking) {
      return ` Update ${this.asking.id} on its own when its author changes it? ${this.dim('y yes · n no · esc back')}`
    }
    const scoped = this.active().length >= 2 ? ['ctrl+s market'] : []
    const row = this.tab === 'markets' ? this.marketRow() : undefined
    const marketKeys =
      row?.kind === 'market'
        ? ['space add/remove', '←→ auto-update', wide ? 'ctrl+r update' : '']
        : row?.kind === 'find'
          ? ['space search']
          : ['space add']
    const keys = {
      catalog: ['⇧←→ switch', '↑↓ move', '←→ fold', 'space pick', ...scoped, wide ? 'type to filter' : ''],
      installed: ['⇧←→ switch', '↑↓ move', '←→ fold', 'space pick', ...scoped, wide ? 'type to filter' : ''],
      markets: ['⇧←→ switch', '↑↓ move', ...marketKeys],
      errors: ['⇧←→ switch', '↑↓ move', 'type to filter'],
    }[this.tab]
    return ` ${this.dim([...keys.filter(Boolean), 'enter apply', 'esc cancel'].join(' · '))}`
  }

  private columns(): number {
    return (this.output as { columns?: number }).columns ?? 100
  }

  private rows(): number {
    return (this.output as { rows?: number }).rows ?? 24
  }

  private fitItems(used: number): void {
    const items = Math.max(MIN_ITEMS, this.rows() - used)
    this.maxItems = items
    this.catalog.maxItems = items
    this.mine.maxItems = items
  }

  private screen(): void {
    if (this.state === 'submit' || this.state === 'cancel') {
      return
    }
    const rows = this.rows()
    const lines = this.draw().split('\n')
    const hide = this.state === 'initial' ? '\x1b[?25l' : ''
    let out = `\x1b[?2026h${hide}`
    for (let row = 0; row < rows; row++) {
      out += `\x1b[${row + 1};1H${lines[row] ?? ''}\x1b[K`
    }
    this.output.write(`${out}\x1b[H\x1b[?2026l`)
    if (this.state === 'initial') {
      this.state = 'active'
    }
  }

  private draw(): string {
    const cols = this.columns()
    const rows = this.rows()
    if (cols < MIN_COLS || rows < MIN_ROWS) {
      return `Needs ${MIN_COLS}×${MIN_ROWS} — now ${cols}×${rows}\n${this.dim('esc cancels')}`
    }
    if (this.phase !== 'browse') {
      return this.frame(cols, rows)
    }
    const wide = cols >= WIDE
    const width = cols - 1
    const left = wide ? Math.min(cols - RIGHT - 4, LEFT_MAX) : width
    const strip = this.strip(width - 1)
    const head = [
      ` ${this.tabBar()}`,
      ...(rows >= ROOMY
        ? [` ${this.heading()}`, ...this.searchBox(cols - 3).map((line) => ` ${line}`)]
        : [spread(` ${this.dim('⌕')} ${this.searchText()}`, this.dim(this.counts()), width)]),
      ...(strip ? [` ${strip}`] : []),
    ]
    this.fitItems(head.length + 3 + (wide ? 0 : 1) + (this.hub ? 1 : 0))
    const { lines, above, below, empty } = this.body()
    const body = lines.length > 0 ? lines.map((line) => ` ${line}`) : [` ${this.dim(empty)}`]
    while (body.length < this.maxItems) {
      body.push('')
    }
    const list = [
      above > 0 ? ` ${this.dim(`↑ ${above} more`)}` : '',
      ...body,
      below > 0 ? ` ${this.dim(`↓ ${below} more`)}` : '',
    ]
    const detail = this.detail(wide ? RIGHT : left - 2)
    const main = wide
      ? list.map(
          (row, i) =>
            `${fit(row, left)} ${this.dim('│')} ${fit(i === 0 ? detail.title : (detail.lines[i - 1] ?? ''), RIGHT, false)}`,
        )
      : [...list.map((row) => fit(row, left, false)), fit(` ${this.dim(detail.brief)}`, left, false)]
    return [
      ...(this.hub ? [fit(hubBar(this.hub, this.color), width, false)] : []),
      ...head.map((line) => fit(line, width, false)),
      ...main,
      fit(this.footer(wide), width, false),
    ].join('\n')
  }
}
