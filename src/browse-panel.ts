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
import { marketOf } from './theme.ts'

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

export interface BrowseIo {
  refresh(source: string): Promise<{ market: Market; refreshed: Refreshed }>
  fetch(source: string): Promise<Market>
  search(query: string | undefined): Promise<Repository[]>
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

const TABS: { tab: Tab; title: string }[] = [
  { tab: 'catalog', title: 'Catalog' },
  { tab: 'installed', title: 'Installed' },
  { tab: 'markets', title: 'Markets' },
  { tab: 'errors', title: 'Errors' },
]
const RIGHT = 34
const LEFT_MAX = 72
const WIDE = 94
const MIN_COLS = 40
const MIN_ROWS = 10
const MIN_ITEMS = 3
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
  private readonly busy = new Map<string, string>()
  private readonly failed = new Map<string, string>()
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
  private asking: Market | undefined
  private leaving: number | undefined
  private shifted = false
  private goto: number | undefined
  private repos: Repository[] | undefined
  private searching = false
  private searchError: string | undefined
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
    })
    this.on('cursor', (action) => {
      if (this.asking || this.leaving !== undefined || this.shifted) {
        return
      }
      if (action === 'up' || action === 'down') {
        this.move(action === 'up' ? -1 : 1)
      } else if (action === 'left' || action === 'right') {
        this.side(action === 'right')
      }
    })
    this.on('userInput', (value) => {
      if (value !== this.lastInput) {
        this.lastInput = value
        this.filters[this.tab] = value
        this.list()?.setFilter(value)
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
    return this.asking === undefined && this.leaving === undefined
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
          this.state = 'submit'
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
    const page = pageStep(key?.name, this.maxItems)
    if (page !== undefined) {
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
      }
    }
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

  private reload(): void {
    const entries = this.entries()
    this.catalog.setEntries(entries)
    this.mine.setEntries(this.mineOf(entries))
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
      this.fetch(row.source)
    } else if (row?.kind === 'repo') {
      const known = this.known(row.source)
      const at = this.marketRows().findIndex((r) => r.kind === 'market' && r.market === known)
      if (known && at >= 0) {
        this.cursor.markets = at
      } else if (!known) {
        this.fetch(row.source)
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

  private fetch(source: string): void {
    if (this.busy.has(source)) {
      return
    }
    this.failed.delete(source)
    this.busy.set(source, 'Fetching…')
    this.track(this.io.fetch(source)).then(
      (market) => {
        this.busy.delete(source)
        const clash = this.active().find((m) => m.id === market.id)
        if (clash) {
          this.failed.set(source, `${market.id} already names the market at ${clash.shown}`)
        } else if (isLocal(source) || source === OFFICIAL) {
          this.stage(market, market.auto)
        } else {
          this.asking = market
        }
        this.redraw()
      },
      (error: Error) => {
        this.busy.delete(source)
        this.failed.set(source, error.message)
        this.redraw()
      },
    )
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

  private search(): void {
    if (this.searching) {
      return
    }
    this.searching = true
    this.searchError = undefined
    const query = this.filters.markets.trim()
    this.track(this.io.search(query && !typedSource(query) ? query : undefined)).then(
      (repos) => {
        this.searching = false
        this.repos = repos
        this.redraw()
      },
      (error: Error) => {
        this.searching = false
        this.searchError = error.message
        this.redraw()
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
    rows.push({ kind: 'find' })
    const found = (this.repos ?? [])
      .map((repo) => ({ repo, source: repositorySource(repo) }))
      .filter(({ repo, source }) => hit(source, repo.description ?? ''))
    if (found.length > 0) {
      rows.push({ kind: 'rule' }, ...found.map(({ repo, source }) => ({ kind: 'repo' as const, repo, source })))
    }
    return rows
  }

  private marketRow(): MarketRow | undefined {
    const rows = this.marketRows()
    return rows[Math.min(this.cursor.markets, rows.length - 1)]
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

  private windowOf<T>(
    rows: T[],
    key: 'markets' | 'errors',
    render: (row: T, focused: boolean) => string,
    rule: (row: T | undefined) => boolean = () => false,
  ): { lines: string[]; below: number } {
    let cursor = Math.min(this.cursor[key], Math.max(0, rows.length - 1))
    if (rule(rows[cursor])) {
      cursor -= 1
    }
    this.cursor[key] = cursor
    let top = Math.min(this.top[key], cursor)
    if (cursor >= top + this.maxItems) {
      top = cursor - this.maxItems + 1
    }
    top = Math.max(0, Math.min(top, rows.length - this.maxItems))
    this.top[key] = top
    const shown = rows.slice(top, top + this.maxItems)
    return {
      lines: shown.map((row, i) => render(row, top + i === cursor)),
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

  private marketLine(row: MarketRow, focused: boolean): string {
    if (row.kind === 'rule') {
      return `   ${this.dim('── On GitHub ──────────')}`
    }
    if (row.kind === 'market') {
      const m = row.market
      const status = this.status(m)
      const box = this.removes.has(m.source) ? '○' : '●'
      const name = focused ? this.bold(m.id) : m.id
      return this.lit(
        m.entries.find((e) => !e.default),
        focused,
        `${box} ${name}${status ? `  ${this.dim(status)}` : ''}`,
      )
    }
    if (row.kind === 'add') {
      const busy = this.busy.get(row.source)
      return this.lit(undefined, focused, `+ Add ${shownSource(row.source)}${busy ? `  ${this.dim(busy)}` : ''}`)
    }
    if (row.kind === 'find') {
      const query = this.filters.markets.trim()
      const text = this.searching
        ? 'Searching GitHub…'
        : query && !typedSource(query)
          ? `Find "${query}" on GitHub`
          : 'Find markets on GitHub'
      return this.lit(undefined, focused, `⌕ ${text}`)
    }
    const busy = this.busy.get(row.source)
    const box = this.known(row.source) ? '●' : '○'
    return this.lit(
      undefined,
      focused,
      `${box} ${row.source}  ${this.dim(`★${row.repo.stargazers_count}`)}${busy ? `  ${this.dim(busy)}` : ''}`,
    )
  }

  private problemLine(problem: Problem, focused: boolean): string {
    return this.lit(undefined, focused, `${this.warn('✗')} ${problem.where}  ${this.dim(problem.message)}`)
  }

  private body(): { lines: string[]; below: number; empty: string } {
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
      return `${updating}${shown}/${all} markets${changes > 0 ? ` · ${changes} to apply` : ''}`
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
      return tab === this.tab ? this.bold(label) : this.dim(label)
    }).join(this.color ? '  ' : ' ')
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
      const note = this.busy.get(row.source) ?? this.failed.get(row.source) ?? 'space fetches its index'
      return {
        title: this.bold(shownSource(row.source)),
        lines: ['Not added', '', ...wrapText(note, width)],
        brief: note,
      }
    }
    if (row.kind === 'find') {
      const query = this.filters.markets.trim()
      const note =
        this.searchError ??
        (this.searching ? 'Searching…' : this.repos ? `${this.repos.length} found` : 'space searches GitHub')
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
    const note = known ? 'Added' : (this.busy.get(row.source) ?? this.failed.get(row.source) ?? 'space adds it')
    return {
      title: this.bold(row.source),
      lines: [
        `★ ${row.repo.stargazers_count}`,
        ...wrapText(row.repo.description ?? '', width),
        '',
        ...wrapText(note, width),
      ],
      brief: note,
    }
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

  private footer(bar: (s: string) => string, wide: boolean): string {
    if (this.leaving !== undefined) {
      return `${bar('└')} Apply your changes before you leave? ${this.dim('y apply · n discard · esc stay')}`
    }
    if (this.asking) {
      return `${bar('└')} Update ${this.asking.id} on its own when its author changes it? ${this.dim('y yes · n no · esc back')}`
    }
    const keys = {
      catalog: ['⇧←→ switch', '↑↓ move', '←→ fold', 'space pick', wide ? 'type to filter' : ''],
      installed: ['⇧←→ switch', '↑↓ move', '←→ fold', 'space pick', wide ? 'type to filter' : ''],
      markets: ['⇧←→ switch', 'space add/remove', '←→ auto-update', wide ? 'ctrl+r update' : ''],
      errors: ['⇧←→ switch', '↑↓ move', 'type to filter'],
    }[this.tab]
    return `${bar('└')} ${this.dim([...keys.filter(Boolean), 'enter apply', 'esc cancel'].join(' · '))}`
  }

  private columns(): number {
    return (this.output as { columns?: number }).columns ?? 100
  }

  private rows(): number {
    return (this.output as { rows?: number }).rows ?? 24
  }

  private fitItems(cols: number): void {
    const items = Math.max(MIN_ITEMS, this.rows() - 4 - (cols >= WIDE ? 0 : 1) - (this.hub ? 1 : 0))
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
    if (cols < MIN_COLS || this.rows() < MIN_ROWS) {
      return `Needs ${MIN_COLS}×${MIN_ROWS} — now ${cols}×${this.rows()}\n${this.dim('esc cancels')}`
    }
    const bar = (s: string) => (this.color ? `${CYAN}${s}${RESET}` : s)
    const wide = cols >= WIDE
    const left = wide ? Math.min(cols - RIGHT - 4, LEFT_MAX) : cols - 1
    this.fitItems(cols)
    const { lines, below, empty } = this.body()
    const body = lines.length > 0 ? lines.map((line) => `${bar('│')} ${line}`) : [`${bar('│')} ${this.dim(empty)}`]
    while (body.length < this.maxItems) {
      body.push(bar('│'))
    }
    const rows = [
      `${bar('◆')} ${this.tabBar()}`,
      spread(`${bar('│')}    ${this.searchText()}`, this.dim(this.counts()), left),
      ...body,
      below > 0 ? `${bar('│')} ${this.dim(`↓ ${below} more`)}` : bar('│'),
    ]
    const detail = this.detail(wide ? RIGHT : left - 2)
    const frame = wide
      ? rows.map(
          (row, i) =>
            `${fit(row, left)} ${this.dim('│')} ${fit(i === 0 ? detail.title : (detail.lines[i - 1] ?? ''), RIGHT, false)}`,
        )
      : [...rows.map((row) => fit(row, left, false)), fit(`${bar('│')} ${this.dim(detail.brief)}`, left, false)]
    return [
      ...(this.hub ? [fit(hubBar(this.hub, this.color), cols - 1, false)] : []),
      ...frame,
      fit(this.footer(bar, wide), cols - 1, false),
    ].join('\n')
  }
}
