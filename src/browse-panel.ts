import type { Readable, Writable } from 'node:stream'
import { cells, clip, fit, spread, wrapText } from './ansi.ts'
import { gateFailures } from './catalog.ts'
import { GATE_RULES } from './contrast.ts'
import { type HubSpot, type HubTab, hubBar, hubGoto, hubTo } from './hub.ts'
import type { PaletteEntry } from './manifest.ts'
import { type Repository, repositorySource } from './markets.ts'
import { containsText } from './names.ts'
import {
  type Extra,
  PaletteList,
  type PromptFx,
  pageStep,
  paletteExample,
  type RowSpot,
  rowSpot,
  SearchHint,
} from './palette-prompt.ts'
import { counted, type Refreshed } from './refresh.ts'
import { isLocal, isRemote, OFFICIAL, parseSource, sameMarket, shownSource, TOPIC } from './sources.ts'
import { marketOf, slugOf } from './theme.ts'
import { Field } from './tui/field.ts'
import type { Mouse } from './tui/keys.ts'
import { hintOf, pillOf } from './tui/parts.ts'
import { Screen } from './tui/screen.ts'
import { ansiFg, FG_RESET, MARKS, type Paint, painter, SPINNER } from './tui/style.ts'
import { ALT_SCREEN, HIDE_CURSOR, NO_WRAP, PASTES, pointing, within } from './tui/terminal.ts'
import { type KeySpot, keyZone, zone } from './tui/zones.ts'

export interface Market {
  source: string
  id: string
  description?: string
  shown: string
  entries: PaletteEntry[]
  auto: boolean
  status: string
}

export interface Report {
  say(line: string): void
  status(text: string): void
}

export interface BrowseIo {
  refresh(source: string): Promise<{ market: Market; refreshed: Refreshed; updates: string[] }>
  fetch(source: string): Promise<Market>
  search(query: string | undefined): Promise<Repository[]>
  apply(result: BrowseResult, report: Report): Promise<void>
}

interface BrowseOptions {
  markets: Market[]
  kept: PaletteEntry[]
  installed: string[]
  updates?: string[]
  tuned?: string[]
  startup?: string
  due: string[]
  io: BrowseIo
  order?: (entries: PaletteEntry[]) => PaletteEntry[]
  hub?: HubTab
  lookups?: boolean
  color?: boolean
  fx?: PromptFx
  owns?: boolean
  input?: Readable
  output?: Writable
  onFocus?: (entry: PaletteEntry) => void
}

export interface BrowseResult {
  picked: Set<string>
  adds: Market[]
  removes: string[]
  auto: Record<string, boolean>
  renew: string[]
  refreshed: Refreshed[]
}

type Phase = 'browse' | 'review' | 'applying' | 'done'

type Found = { kind: 'add'; source: string } | { kind: 'find' } | { kind: 'repo'; repo: Repository; source: string }

interface Row extends Extra {
  found?: Found
}

interface Detail {
  title: string
  lines: string[]
  brief: string
}

type Spot = RowSpot | KeySpot | HubSpot | { kind: 'chip'; source: string | undefined } | { kind: 'page'; step: number }

interface Chip {
  source: string | undefined
  label: string
  count: number
}

type Hint = [string, string]

interface Bar {
  badge: string
  lead?: string
  note?: string
  keys: Hint[]
  right?: Hint
}

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

type State = 'active' | 'submit' | 'cancel'

export class BrowsePanel {
  readonly picked: Set<string>
  private readonly field = new Field()
  private readonly adds = new Map<string, Market>()
  private readonly removes = new Set<string>()
  private readonly want = new Map<string, boolean>()
  private readonly renew = new Set<string>()
  private updates: Set<string>
  private readonly tuned: Set<string>
  private scope: string | undefined
  private readonly busy = new Map<string, string>()
  private readonly failed = new Map<string, string>()
  private readonly peeked = new Map<string, Market>()
  private readonly peekFailed = new Map<string, string>()
  private readonly staging = new Set<string>()
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly refreshed: Refreshed[] = []
  private readonly inflight = new Set<Promise<unknown>>()
  private markets: Market[]
  private readonly kept: PaletteEntry[]
  private readonly installed: ReadonlySet<string>
  private readonly startup: string | undefined
  private readonly io: BrowseIo
  private readonly order: (entries: PaletteEntry[]) => PaletteEntry[]
  private readonly color: boolean
  private readonly p: Paint
  private readonly hub: HubTab | undefined
  private readonly owns: boolean
  private readonly input: Readable | undefined
  private readonly output: (Writable & { columns?: number; rows?: number }) | undefined
  private maxItems = 12
  private readonly paint: ((entry: PaletteEntry) => void) | undefined
  private readonly catalog: PaletteList<Row>
  private readonly hint: SearchHint
  private screen: Screen | undefined
  private state: State = 'active'
  private phase: Phase = 'browse'
  private offset = 0
  private started = false
  private log: string[] = []
  private working = ''
  private stopped: Error | undefined
  private beat = 0
  private asking: Market | undefined
  private leaving: number | undefined
  private goto: number | undefined
  private repos: Repository[] | undefined
  private searching = false
  private searchError: string | undefined
  private searched: string | undefined
  private asked = 0
  private help = false
  private readonly live: boolean

  constructor(opts: BrowseOptions) {
    this.markets = opts.markets
    this.kept = opts.kept
    this.installed = new Set(opts.installed)
    this.updates = new Set(opts.updates ?? [])
    this.tuned = new Set(opts.tuned ?? [])
    this.startup = opts.startup
    this.io = opts.io
    this.order = opts.order ?? ((entries) => entries)
    this.color = opts.color ?? true
    this.p = painter(this.color)
    this.hub = opts.hub
    this.owns = opts.owns ?? false
    this.input = opts.input
    this.output = opts.output
    this.live = opts.lookups ?? true
    this.paint = opts.onFocus
    this.picked = new Set(opts.installed)
    this.catalog = new PaletteList<Row>({
      entries: this.entries(),
      picked: this.picked,
      layout: 'markets',
      color: this.color,
      maxItems: this.maxItems,
      note: (entry) => this.mark(entry),
      badge: (id) => this.badge(id),
      tops: () => this.tops(),
      extras: () => this.found(),
      onFocus: (entry) => this.focus(entry),
    })
    this.hint = new SearchHint(
      opts.fx ?? 'typewriter',
      () => paletteExample(this.catalog),
      () => this.redraw(),
    )
    for (const source of opts.due) {
      this.update(source)
    }
    this.lookup()
  }

  run(): Promise<'submit' | 'cancel'> {
    const modes = [...(this.owns ? [ALT_SCREEN, HIDE_CURSOR, NO_WRAP] : []), PASTES, ...pointing()]
    const assume = this.owns ? [] : [HIDE_CURSOR, NO_WRAP]
    return within({ input: this.input, output: this.output, modes, assume }, async (terminal) => {
      const screen = new Screen({
        write: (text) => terminal.write(text),
        view: () => (this.state === 'active' ? { lines: this.view(), ticking: this.phase === 'applying' } : undefined),
        beat: () => {
          this.beat += 1
        },
      })
      this.screen = screen
      terminal.onResize(() => {
        screen.reset()
        screen.request()
      })
      screen.now()
      try {
        return await terminal.loop(
          (event) => {
            if (event.kind === 'key') {
              this.key(event.key)
            } else if (event.kind === 'paste') {
              this.pasted(event.text)
            } else if (event.kind === 'mouse') {
              this.mouse(event, screen)
            }
            return this.state === 'active' ? undefined : this.state
          },
          () => screen.soon(),
        )
      } finally {
        screen.stop()
        this.screen = undefined
        this.hint.stop()
        for (const timer of this.timers.values()) {
          clearTimeout(timer)
        }
        this.timers.clear()
      }
    })
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
      renew: [...this.renew].filter((name) => this.updates.has(name) && this.picked.has(name) && names.has(name)),
      refreshed: this.refreshed,
    }
  }

  private key(key: string): void {
    if (key === 'ctrl-c') {
      this.state = 'cancel'
      return
    }
    if (this.help) {
      if (key === '?' || key === 'esc') {
        this.help = false
      }
      return
    }
    if (this.leaving !== undefined) {
      if (key === 'esc') {
        this.leaving = undefined
      } else if (/^[yn]$/i.test(key)) {
        if (key.toLowerCase() === 'y') {
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
      if (key === 'esc') {
        this.asking = undefined
      } else if (/^[yn]$/i.test(key)) {
        this.answer(key.toLowerCase() === 'y')
      }
      return
    }
    if (this.phase !== 'browse') {
      this.steer(key)
      return
    }
    const page = pageStep(key, this.maxItems)
    const list = this.catalog
    if (key === 'enter') {
      if (list.foldable()) {
        list.flip()
      } else if (this.dirty()) {
        this.phase = 'review'
        this.offset = 0
      } else {
        this.state = 'submit'
      }
    } else if ((key === 'esc' || key === 'ctrl-u') && this.field.value) {
      this.clear()
    } else if (key === 'esc') {
      this.state = 'cancel'
    } else if (key === '?') {
      this.help = true
    } else if (page !== undefined) {
      this.move(page)
    } else if (key === 'up' || key === 'down') {
      this.move(key === 'up' ? -1 : 1)
    } else if (key === 'left' || key === 'right') {
      list.fold(key === 'right')
    } else if (key === 'tab' || key === 'shift-tab') {
      if (this.hub) {
        this.leave(hubGoto(this.hub, key === 'tab' ? 1 : -1))
      }
    } else if (key === 'shift-left' || key === 'shift-right') {
      this.autoUpdate(key === 'shift-right')
    } else if (key === ' ') {
      this.activate()
    } else if (key === 'delete') {
      const market = this.focusedMarket()
      if (market) {
        this.toggleMarket(market)
      }
    } else if (key === 'ctrl-r') {
      this.refresh()
    } else if (key === 'ctrl-s') {
      this.cycle()
    } else if (this.field.key(key)) {
      this.typed()
    }
  }

  private refresh(): void {
    const row = this.catalog.focusedRow()
    const market = this.focusedMarket()
    if (market) {
      if (isRemote(market.source) && !this.adds.has(market.source)) {
        this.update(market.source)
      }
    } else if (row?.kind === 'extra') {
      if (row.extra.found?.kind === 'find') {
        this.search()
      }
    } else if (row?.kind !== 'group') {
      this.toggleRenew()
    }
  }

  private pasted(text: string): void {
    if (this.phase === 'browse' && !this.help && !this.asking && this.leaving === undefined) {
      this.field.paste(text)
      this.typed()
    }
  }

  private mouse(event: Mouse, screen: Screen): void {
    if (this.help) {
      if (event.action === 'release') {
        this.help = false
      }
      return
    }
    const hit = screen.point(event)
    const spot = hit?.target as Spot | undefined
    const free = this.phase === 'browse' && this.leaving === undefined && !this.asking
    if (event.action === 'wheel') {
      if (!event.sideways && (free || this.phase !== 'browse')) {
        this.wheel(event.wheel)
      }
      return
    }
    if (!spot) {
      return
    }
    if (event.action === 'press' && event.button === 'left') {
      if (!free) {
        return
      }
      if (spot.kind === 'chip') {
        this.scopeTo(spot.source)
      } else if (spot.kind === 'row') {
        this.catalog.point(spot.at)
        this.watch()
      }
    } else if (event.action === 'release' && hit?.inside) {
      if (spot.kind === 'key') {
        this.key(spot.key)
      } else if (spot.kind === 'page') {
        if (this.phase !== 'browse') {
          this.scroll(spot.step * this.span())
        } else if (free) {
          this.move(spot.step * this.maxItems)
        }
      } else if (spot.kind === 'hub') {
        if (free && this.hub && spot.tab !== this.hub) {
          this.leave(hubTo(spot.tab))
        }
      } else if (spot.kind === 'row' && free) {
        this.openRow(spot, event.count)
      }
    }
  }

  private wheel(step: number): void {
    if (this.phase !== 'browse') {
      this.scroll(step)
      return
    }
    this.move(step, false)
  }

  private openRow(spot: RowSpot, count: number): void {
    const list = this.catalog
    if (list.focusedRow()?.kind === 'extra') {
      if (spot.part === 'box' || count === 2) {
        this.activate()
      }
    } else if (spot.part === 'box') {
      list.pick()
    } else if (spot.part === 'fold') {
      list.flip()
    } else if (count === 2) {
      list.open()
    }
  }

  private typed(): void {
    this.catalog.setFilter(this.field.value)
    this.later('search', SEARCH_AFTER, () => this.lookup())
    this.watch()
  }

  private clear(): void {
    this.field.value = ''
    this.catalog.clear()
    this.later('search', SEARCH_AFTER, () => this.lookup())
    this.watch()
  }

  private redraw(): void {
    if (this.state === 'active') {
      this.screen?.request()
    }
  }

  private focus(entry: PaletteEntry): void {
    if (this.state !== 'submit' && this.state !== 'cancel') {
      this.paint?.(entry)
    }
  }

  private track<T>(work: Promise<T>): Promise<T> {
    this.inflight.add(work)
    const done = () => this.inflight.delete(work)
    work.then(done, done)
    return work
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

  private scoped(entries: PaletteEntry[]): PaletteEntry[] {
    const source = this.scope
    const market = source === undefined ? undefined : this.active().find((m) => m.source === source)
    if (!market) {
      this.scope = undefined
      return entries
    }
    const names = new Set(market.entries.map((e) => e.name))
    return entries.filter((e) => names.has(e.name))
  }

  private reload(): void {
    this.catalog.setEntries(this.scoped(this.entries()))
  }

  private chips(): Chip[] {
    const markets = this.active().map((m) => ({
      source: m.source as string | undefined,
      label: m.id,
      count: m.entries.filter((e) => !e.default).length,
    }))
    return [{ source: undefined, label: 'All', count: this.entries().filter((e) => !e.default).length }, ...markets]
  }

  private tops(): string[] {
    return [...this.markets, ...this.adds.values()]
      .filter((m) => this.scope === undefined || m.source === this.scope)
      .map((m) => m.id)
  }

  private marketNamed(id: string): Market | undefined {
    return [...this.markets, ...this.adds.values()].find((m) => m.id === id)
  }

  private focusedMarket(): Market | undefined {
    const row = this.catalog.focusedRow()
    return row?.kind === 'group' ? this.marketNamed(row.name) : undefined
  }

  private cycle(): void {
    if (this.active().length < 2) {
      return
    }
    const chips = this.chips()
    const at = Math.max(
      0,
      chips.findIndex((c) => c.source === this.scope),
    )
    this.scopeTo(chips[(at + 1) % chips.length]?.source)
  }

  private scopeTo(source: string | undefined): void {
    this.scope = source
    this.reload()
    this.catalog.refocus()
  }

  private move(delta: number, wrap = true): void {
    this.catalog.move(delta, wrap)
    this.watch()
  }

  private autoUpdate(on: boolean): void {
    const market = this.focusedMarket()
    if (market && isRemote(market.source)) {
      if (on === market.auto) {
        this.want.delete(market.source)
      } else {
        this.want.set(market.source, on)
      }
    }
  }

  private activate(): void {
    const row = this.catalog.focusedRow()
    if (row?.kind !== 'extra') {
      this.catalog.pick()
      return
    }
    const found = row.extra.found
    if (found?.kind === 'add') {
      this.load(found.source, true)
    } else if (found?.kind === 'repo') {
      const known = this.known(found.source)
      if (known) {
        this.catalog.select(`group ${known.id}`)
      } else {
        this.load(found.source, true)
      }
    } else if (found?.kind === 'find') {
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

  private focusedFound(): Found | undefined {
    const row = this.catalog.focusedRow()
    return row?.kind === 'extra' ? row.extra.found : undefined
  }

  private watch(): void {
    if (!this.live) {
      return
    }
    const typed = typedSource(this.field.value)
    if (typed && this.wants(typed)) {
      this.later('typed', TYPED_AFTER, () => this.load(typed, false))
    } else {
      this.cancel('typed')
    }
    const found = this.focusedFound()
    if (found?.kind === 'repo' && this.wants(found.source)) {
      const source = found.source
      this.later('focus', FOCUS_AFTER, () => {
        const now = this.focusedFound()
        if (now?.kind === 'repo' && now.source === source) {
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
    const typed = typedSource(this.field.value)
    if (typed && sameMarket(typed, market.source)) {
      this.field.value = ''
      this.catalog.setFilter('')
    }
    this.reload()
    this.catalog.select(`group ${market.id}`)
  }

  private update(source: string): void {
    if (this.busy.has(source)) {
      return
    }
    this.failed.delete(source)
    this.busy.set(source, 'Updating…')
    this.track(this.io.refresh(source)).then(
      ({ market, refreshed, updates }) => {
        this.busy.delete(source)
        this.updates = new Set(updates)
        this.markets = this.markets.map((m) => (m.source === source ? market : m))
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
    const query = this.field.value.trim()
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
          this.catalog.refresh()
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

  private found(): Row[] {
    const typed = typedSource(this.field.value)
    const hit = (...fields: string[]) => containsText(fields, this.field.value)
    const repos = (this.repos ?? [])
      .map((repo) => ({ repo, source: repositorySource(repo) }))
      .filter(({ repo, source }) => hit(source, repo.description ?? ''))
    const rows: Found[] = [
      ...(typed && !this.known(typed) ? [{ kind: 'add' as const, source: typed }] : []),
      ...repos.map(({ repo, source }) => ({ kind: 'repo' as const, repo, source })),
      ...(repos.length > 0 ? [] : [{ kind: 'find' as const }]),
    ]
    return [
      {
        key: 'github',
        rule: true,
        text: () => `   ${this.p.dim(`── On GitHub${this.searching ? ' · searching…' : ''} ──────────`)}`,
      },
      ...rows.map((found) => ({
        key: found.kind === 'find' ? 'find' : `${found.kind} ${found.source}`,
        found,
        text: (focused: boolean, at: number) => this.foundLine(found, focused, at),
      })),
    ]
  }

  private lit(focused: boolean, text: string): string {
    return `${focused ? `${MARKS.gutter} ` : '  '} ${text}`
  }

  private status(market: Market): string {
    return this.adds.has(market.source)
      ? 'Will add'
      : this.removes.has(market.source)
        ? 'Will remove'
        : (this.busy.get(market.source) ??
          (this.failed.has(market.source) || market.status.startsWith('update failed') ? 'Update failed' : ''))
  }

  private badge(id: string): string {
    const m = this.marketNamed(id)
    if (!m) {
      return ''
    }
    const auto = isRemote(m.source) && (this.want.get(m.source) ?? m.auto) ? `${MARKS.auto} auto-update` : ''
    return [auto, this.status(m)]
      .filter(Boolean)
      .map((part) => `  ${this.p.dim(part)}`)
      .join('')
  }

  private peeking(source: string): string {
    const peeked = this.peeked.get(source)
    return peeked ? counted(peeked.entries.filter((e) => !e.default).length) : ''
  }

  private foundLine(found: Found, focused: boolean, at: number): string {
    const box = (mark: string) => rowSpot(at, 'box', `${mark} `)
    const after = (text: string) => (text ? `  ${this.p.dim(text)}` : '')
    if (found.kind === 'add') {
      const failure = this.failed.get(found.source) ?? this.peekFailed.get(found.source)
      const peeked = this.peeked.get(found.source)
      const note = failure
        ? `  ${this.p.error(failure)}`
        : after(
            this.busy.get(found.source) ??
              (peeked
                ? `${peeked.id} · ${this.peeking(found.source)}`
                : this.live
                  ? 'Fetching its palettes…'
                  : 'space fetches its palettes'),
          )
      return this.lit(focused, `${box('+')}Add ${shownSource(found.source)}${note}`)
    }
    if (found.kind === 'find') {
      const query = this.field.value.trim()
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
      const note = this.searchError ?? (this.searching ? '' : idle ? 'space searches' : 'space searches again')
      return this.lit(focused, `${box(MARKS.search)}${text}${after(note)}`)
    }
    const busy = this.busy.get(found.source)
    const note = [busy ?? this.peeking(found.source), found.repo.description ?? ''].filter(Boolean).join(' · ')
    return this.lit(
      focused,
      `${box(this.known(found.source) ? MARKS.on : MARKS.off)}${found.source}  ${this.p.dim(`${MARKS.star}${found.repo.stargazers_count}`)}${after(note)}`,
    )
  }

  private changes(): number {
    return this.adds.size + this.removes.size + this.want.size
  }

  private dirty(): boolean {
    const { picked, renew } = this.result()
    return (
      this.changes() > 0 ||
      renew.length > 0 ||
      picked.size !== this.installed.size ||
      [...picked].some((n) => !this.installed.has(n))
    )
  }

  private mark(entry: PaletteEntry): string {
    const tuned = this.tuned.has(entry.name) ? `  ${this.p.warn(MARKS.on)}` : ''
    if (!this.updates.has(entry.name) || !this.installed.has(entry.name)) {
      return tuned
    }
    return `${tuned}${this.renew.has(entry.name) ? `  ${this.p.bold(`${MARKS.update} update`)}` : `  ${this.p.dim(MARKS.update)}`}`
  }

  private toggleRenew(): void {
    const list = this.catalog
    const row = list.focusedRow()
    const names = (row ? list.inside(row) : [])
      .map((e) => e.name)
      .filter((name) => this.updates.has(name) && this.installed.has(name))
    if (names.length === 0) {
      return
    }
    const on = names.some((name) => !this.renew.has(name))
    for (const name of names) {
      if (on) {
        this.renew.add(name)
      } else {
        this.renew.delete(name)
      }
    }
  }

  private leave(code: number): void {
    if (this.dirty()) {
      this.leaving = code
      return
    }
    this.goto = code
    this.state = 'cancel'
  }

  private steer(key: string): void {
    if (this.phase === 'review') {
      if (key === 'enter') {
        this.begin()
      } else if (key === 'esc') {
        this.phase = 'browse'
      }
    } else if (this.phase === 'done' && (key === 'enter' || key === 'esc')) {
      this.state = 'submit'
    }
    const page = key === 'up' ? -1 : key === 'down' ? 1 : pageStep(key, this.span())
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
        `+ ${m.id}  ${this.p.dim([m.source === OFFICIAL ? 'The ttheme catalog' : m.shown, counted(m.entries.filter((e) => !e.default).length), auto].filter(Boolean).join(' · '))}`,
      )
    }
    for (const source of this.removes) {
      const m = this.markets.find((x) => x.source === source)
      const stay = (m?.entries ?? []).filter((e) => !e.default && this.installed.has(e.name) && this.picked.has(e.name))
      rows.push(
        `- ${m?.id ?? source}  ${this.p.dim([m?.shown ?? shownSource(source), stay.length > 0 ? `its ${counted(stay.length)} installed keep working` : ''].filter(Boolean).join(' · '))}`,
      )
    }
    for (const [source, on] of this.want) {
      const m = this.markets.find((x) => x.source === source)
      if (m && !this.removes.has(source)) {
        rows.push(
          `${MARKS.auto} ${m.id}  ${this.p.dim(on ? 'updates on its own from now' : 'stops updating on its own')}`,
        )
      }
    }
    return rows
  }

  private reviewLines(): string[] {
    const markets = this.marketChanges()
    const { names, dropped } = this.pending()
    const renew = new Set(this.result().renew)
    const renewed = this.entries().filter((e) => renew.has(e.name))
    const width = Math.max(0, ...[...names, ...dropped, ...renewed].map((e) => e.name.length))
    const palette = (sign: string, e: PaletteEntry) =>
      `   ${sign} ${e.name.padEnd(width)}  ${this.p.dim(marketOf(e.name) ? (e.catalog ?? '') : e.group)}`
    const counts = [
      names.length > 0 ? `${names.length} to install` : '',
      dropped.length > 0 ? `${dropped.length} to remove` : '',
      renewed.length > 0 ? `${renewed.length} to update` : '',
    ].filter(Boolean)
    return [
      ...(markets.length > 0
        ? [` ${this.p.bold('Markets')} ${this.p.dim(`(${markets.length})`)}`, ...markets.map((r) => `   ${r}`), '']
        : []),
      ...(counts.length > 0
        ? [
            ` ${this.p.bold('Palettes')} ${this.p.dim(`(${counts.join(' · ')})`)}`,
            ...names.map((e) => palette('+', e)),
            ...dropped.map((e) => palette('-', e)),
            ...renewed.map((e) => palette(MARKS.update, e)),
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
      this.result().renew.length > 0 ? `${this.result().renew.length} updated` : '',
    ]
      .filter(Boolean)
      .join(' · ')
  }

  private progressLines(): string[] {
    const lines = this.log.map((line) => ` ${line}`)
    if (this.phase === 'applying') {
      const frame = SPINNER[this.beat % SPINNER.length]
      lines.push(` ${this.p.dim(`${frame} ${this.working || 'Working…'}`)}`)
    } else if (this.stopped) {
      lines.push(
        '',
        ...wrapText(this.stopped.message, Math.max(20, this.columns() - 6)).map(
          (l, i) => ` ${i === 0 ? this.p.error(MARKS.miss) : ' '} ${l}`,
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
        ? `${this.p.bold('Review changes')}`
        : this.phase === 'applying'
          ? this.p.bold('Applying changes')
          : this.stopped
            ? `${this.p.error(MARKS.miss)} ${this.p.bold('Stopped')}`
            : `${this.p.bold(`${MARKS.ok} Applied`)} ${this.p.dim(this.summary() ? `(${this.summary()})` : '')}`
    const room = this.span()
    const most = Math.max(0, lines.length - room)
    const top = this.phase === 'applying' ? most : Math.min(this.offset, most)
    this.offset = top
    const shown = lines.slice(top, top + room)
    const below = lines.length - top - shown.length
    const body = [top > 0 ? ` ${this.more(-1, `↑ ${top} more`)}` : '', ...shown]
    while (body.length < room + 1) {
      body.push('')
    }
    body.push(below > 0 ? ` ${this.more(1, `↓ ${below} more`)}` : '')
    const scroll: Hint[] = most > 0 ? [['↑↓', 'scroll']] : []
    const bar: Bar = review
      ? { badge: 'BROWSE (APPLY)', keys: [...scroll, ['enter', 'apply']], right: ['esc', 'back'] }
      : this.phase === 'applying'
        ? { badge: 'BROWSE (APPLY)', note: 'Keys wait until it ends', keys: [] }
        : { badge: 'BROWSE (APPLY)', keys: scroll, right: ['enter', 'close'] }
    return [
      ...(this.hub ? [fit(hubBar(this.hub, this.color), width, false)] : []),
      fit(` ${title}`, width, false),
      ...body.map((line) => fit(line, width, false)),
      ` ${this.keyBar(bar, width - 1)}`,
    ]
      .slice(0, rows)
      .join('\n')
  }

  private keyBar(bar: Bar, width: number): string {
    const badge = `${pillOf(this.p, bar.badge)}${this.color ? '  ' : ' '}`
    const hint = ([key, label]: Hint) => hintOf(this.p, key, label)
    let { note, keys, right } = bar
    for (;;) {
      const line = `${badge}${[bar.lead ?? '', note ? this.p.dim(note) : '', ...keys.map(hint)].filter(Boolean).join('   ')}`
      const tail = right ? hint(right) : ''
      if (cells(line) + (right ? 3 + cells(tail) : 0) <= width) {
        return right ? spread(line, tail, width) : fit(line, width, false)
      }
      if (note) {
        note = undefined
      } else if (keys.length > 2 || (!right && keys.length > 1)) {
        const drop = keys.length - 2
        keys = keys.filter((_, i) => i !== drop)
      } else if (right) {
        right = undefined
      } else {
        return fit(line, width, false)
      }
    }
  }

  private more(step: number, text: string): string {
    return this.p.dim(zone({ kind: 'page', step } satisfies Spot, text))
  }

  private counts(): string {
    const updating = [...this.busy.values()].includes('Updating…') ? 'Updating… · ' : ''
    const list = this.catalog
    return `${updating}${list.matched()}/${list.total()} · ${list.pickedCount()} picked`
  }

  private searchText(): string {
    const typed = this.field.value
    if (typed) {
      return `${typed}_`
    }
    const example = this.hint.text()
    return this.p.dim(`Search…${example ? ` e.g. ${example}` : ''}`)
  }

  private heading(): string {
    return `${this.p.bold('Browse')} ${this.p.dim(`(${this.counts()})`)}`
  }

  private searchBox(width: number): string[] {
    const edge = (left: string, right: string) => this.p.dim(`${left}${'─'.repeat(width - 2)}${right}`)
    const side = this.p.dim('│')
    return [
      edge('╭', '╮'),
      `${side} ${fit(`${this.p.dim(MARKS.search)} ${this.searchText()}`, width - 4)} ${side}`,
      edge('╰', '╯'),
    ]
  }

  private strip(width: number): string | undefined {
    if (this.active().length < 2) {
      return undefined
    }
    const chips = this.chips()
    const sel = Math.max(
      0,
      chips.findIndex((c) => c.source === this.scope),
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
      const chip = zone({ kind: 'chip', source: chips[start + i]?.source } satisfies Spot, label)
      if (start + i === sel) {
        return this.p.accent(this.p.bold(chip))
      }
      return this.p.dim(chip)
    })
    const text = `${start > 0 ? `${this.p.dim(keyZone('ctrl+s', '…'))} ` : ''}${parts.join(this.p.dim(sep))}${left > 0 ? this.p.dim(`${sep}${keyZone('ctrl+s', `+${left} more`)}`) : ''}`
    const plain = (start > 0 ? 2 : 0) + shown.join(sep).length + tail(left)
    const hint = 'ctrl+s market'
    return plain + 2 + hint.length <= width ? `${text}  ${this.p.dim(keyZone('ctrl+s', hint))}` : text
  }

  private sourceOf(entry: PaletteEntry | undefined): string {
    const market = entry && this.active().find((m) => m.entries.some((e) => e.name === entry.name))
    if (!market) {
      return 'In no market you added'
    }
    return market.source === OFFICIAL ? 'The ttheme catalog' : market.shown
  }

  private paletteState(entry: PaletteEntry): string {
    const now = this.picked.has(entry.name)
    const was = this.installed.has(entry.name)
    const state = now && was ? 'Installed' : now ? 'Will install' : was ? 'Will remove' : 'Not installed'
    const update =
      now && was && this.updates.has(entry.name)
        ? this.renew.has(entry.name)
          ? ' · Will update'
          : ' · Update ready'
        : ''
    return `${state}${update}${this.startup === entry.name ? ' · Default' : ''}`
  }

  private detail(width: number): Detail {
    const row = this.catalog.focusedRow()
    if (!row || row.kind === 'rule' || row.kind === 'all') {
      return EMPTY
    }
    if (row.kind === 'extra') {
      return row.extra.found ? this.foundDetail(row.extra.found, width) : EMPTY
    }
    const market = row.kind === 'group' ? this.marketNamed(row.name) : undefined
    if (market) {
      return this.marketDetail(market, width)
    }
    if (row.kind === 'group' || row.kind === 'catalog') {
      const members = this.catalog.inside(row)
      const source = this.sourceOf(row.lead)
      const counts = `${counted(members.length)} · ${members.filter((e) => this.installed.has(e.name)).length} installed`
      const within = row.kind === 'catalog' ? row.group : undefined
      return {
        title: this.p.bold(row.name),
        lines: [
          ...(row.native ? wrapText(row.native, width).map((l) => this.p.dim(l)) : []),
          ...(within ? [within] : []),
          ...wrapText(source, width),
          counts,
        ],
        brief: `${within ?? source} · ${counts}`,
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
      : [e.group, ...(e.native ? [this.p.dim(e.native)] : [])]
    return {
      title: this.color ? this.p.bold(`${ansiFg(e.cursor)}${e.name}${FG_RESET}`) : e.name,
      lines: [
        ...wrapText(source, width),
        ...series,
        this.paletteState(e),
        '',
        fails.length === 0 ? `${gate} · passes` : gate,
        ...fails.flatMap((f) =>
          wrapText(f, width - 2).map((l, i) => `${i === 0 ? this.p.bold(MARKS.miss) : ' '} ${l}`),
        ),
        ...(extras ? ['', extras] : []),
      ],
      brief: [source, gate, ...(extras ? [extras] : []), this.paletteState(e)].join(' · '),
    }
  }

  private marketDetail(m: Market, width: number): Detail {
    const source = m.source === OFFICIAL ? 'The ttheme catalog' : m.shown
    const listed = m.entries.filter((e) => !e.default)
    const installed = listed.filter((e) => this.installed.has(e.name)).map((e) => e.name)
    const counts = `${counted(listed.length)} · ${installed.length} installed`
    const auto = isRemote(m.source)
      ? `Auto-update ${(this.want.get(m.source) ?? m.auto) ? 'on' : 'off'}`
      : cap(m.status)
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
      title: this.p.bold(m.id),
      lines: [
        ...wrapText(source, width),
        ...(m.description ? wrapText(m.description, width).map((l) => this.p.dim(l)) : []),
        counts,
        '',
        isRemote(m.source) ? `${auto}  ${this.p.dim('⇧←→')}` : auto,
        ...(isRemote(m.source) ? [when] : []),
        ...(failure ? wrapText(failure, width).map((l) => this.p.error(l)) : []),
        ...(staged.length > 0 ? ['', ...staged.flatMap((s) => wrapText(s, width))] : []),
      ],
      brief: [source, auto, ...staged, ...(isRemote(m.source) ? [when] : [])].join(' · '),
    }
  }

  private foundDetail(row: Found, width: number): Detail {
    if (row.kind === 'add') {
      const note =
        this.busy.get(row.source) ??
        this.failed.get(row.source) ??
        this.peekFailed.get(row.source) ??
        (this.peeked.has(row.source)
          ? 'space adds it'
          : this.live
            ? 'Fetching its palettes…'
            : 'space fetches its palettes')
      return {
        title: this.p.bold(shownSource(row.source)),
        lines: ['Not added', ...this.peekLines(row.source, width), '', ...wrapText(note, width)],
        brief: [this.peeking(row.source), note].filter(Boolean).join(' · '),
      }
    }
    if (row.kind === 'find') {
      const query = this.field.value.trim()
      const note =
        this.searchError ??
        (this.searching
          ? 'Searching…'
          : this.repos
            ? `${this.repos.length} found · space searches again`
            : 'space searches GitHub')
      return {
        title: this.p.bold('GitHub'),
        lines: [
          ...wrapText(`Repositories with the ${TOPIC} topic`, width),
          ...(query && !typedSource(query) ? [`Matching "${query}"`] : []),
          '',
          ...wrapText(note, width),
          '',
          ...wrapText('Type owner/repo or a folder to add one', width),
        ],
        brief: note,
      }
    }
    const known = this.known(row.source)
    const note = known
      ? 'Added'
      : (this.busy.get(row.source) ?? this.failed.get(row.source) ?? this.peekFailed.get(row.source) ?? 'space adds it')
    return {
      title: this.p.bold(row.source),
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
    return [
      '',
      peeked.id,
      ...(peeked.description ? wrapText(peeked.description, width) : []),
      counted(listed.length),
      ...wrapText(names, width).map((l) => this.p.dim(l)),
    ]
  }

  private footer(): Bar {
    if (this.help) {
      return { badge: 'HELP', keys: [], right: ['? esc', 'close'] }
    }
    if (this.leaving !== undefined) {
      return {
        badge: 'BROWSE',
        lead: 'Apply your changes before you leave?',
        keys: [
          ['y', 'apply'],
          ['n', 'discard'],
        ],
        right: ['esc', 'stay'],
      }
    }
    if (this.asking) {
      return {
        badge: 'BROWSE',
        lead: `Update ${this.asking.id} on its own when its author changes it?`,
        keys: [
          ['y', 'yes'],
          ['n', 'no'],
        ],
        right: ['esc', 'back'],
      }
    }
    const filter = this.field.value
    const enter: Hint = ['enter', this.dirty() ? 'apply' : 'close']
    const tail: Hint[] = [...(filter ? [['bksp', 'edit'] as Hint] : []), ['?', 'keys']]
    return {
      badge: filter ? 'BROWSE (FILTER)' : 'BROWSE',
      keys: [...this.rowKeys(enter), ...tail],
      right: filter ? ['esc', 'clear filter'] : ['esc', 'cancel'],
    }
  }

  private rowKeys(enter: Hint): Hint[] {
    const list = this.catalog
    const row = list.focusedRow()
    if (!row) {
      return [enter]
    }
    if (row.kind === 'extra') {
      const found = row.extra.found
      if (found?.kind === 'find') {
        return [['space', 'search'], enter]
      }
      if (found?.kind === 'add' || (found?.kind === 'repo' && !this.known(found.source))) {
        return [['space', 'add'], enter]
      }
      return [enter]
    }
    const fold: Hint[] =
      list.foldable() && (row.kind === 'group' || row.kind === 'catalog')
        ? [row.expanded ? ['←', 'close'] : ['→', 'open']]
        : []
    const market = this.focusedMarket()
    if (market) {
      const remote = isRemote(market.source)
      const staged = this.adds.has(market.source) || this.removes.has(market.source)
      return [
        ...fold,
        ['space', 'pick'],
        ...(remote ? [['⇧←→', 'auto-update'] as Hint] : []),
        ...(remote && !this.adds.has(market.source) ? [['ctrl+r', 'update'] as Hint] : []),
        ['del', staged ? 'undo' : 'remove'],
        ...(fold.length > 0 ? [] : [enter]),
      ]
    }
    if (fold.length > 0) {
      return [...fold, ['space', 'pick']]
    }
    const renewable = row.kind === 'palette' && this.updates.has(row.entry.name) && this.installed.has(row.entry.name)
    return [
      ['space', 'pick'],
      ...(renewable ? [['ctrl+r', this.renew.has(row.entry.name) ? 'keep' : 'update'] as Hint] : []),
      enter,
    ]
  }

  private columns(): number {
    return (this.output ?? process.stdout).columns ?? 100
  }

  private rows(): number {
    return (this.output ?? process.stdout).rows ?? 24
  }

  private fitItems(used: number): void {
    const items = Math.max(MIN_ITEMS, this.rows() - used)
    this.maxItems = items
    this.catalog.maxItems = items
  }

  private view(): string[] {
    const lines = this.draw().split('\n')
    return Array.from({ length: this.rows() }, (_, row) => lines[row] ?? '')
  }

  private small(cols: number, rows: number, need: number): string {
    return `Needs ${MIN_COLS}×${need} — now ${cols}×${rows}\n${this.p.dim('esc cancels')}`
  }

  private draw(): string {
    const cols = this.columns()
    const rows = this.rows()
    if (cols < MIN_COLS || rows < MIN_ROWS) {
      return this.small(cols, rows, MIN_ROWS)
    }
    if (this.phase !== 'browse') {
      return this.frame(cols, rows)
    }
    const wide = cols >= WIDE
    const width = cols - 1
    const left = wide ? Math.min(cols - RIGHT - 4, LEFT_MAX) : width
    const strip = this.strip(width - 1)
    const head = [
      ...(rows >= ROOMY
        ? [` ${this.heading()}`, ...this.searchBox(cols - 3).map((line) => ` ${line}`)]
        : [spread(` ${this.p.dim(MARKS.search)} ${this.searchText()}`, this.p.dim(this.counts()), width)]),
      ...(strip ? [` ${strip}`] : []),
    ]
    const chrome = head.length + 3 + (wide ? 0 : 1) + (this.hub ? 1 : 0)
    if (rows < chrome + MIN_ITEMS) {
      return this.small(cols, rows, chrome + MIN_ITEMS)
    }
    this.fitItems(chrome)
    const { lines, above, below } = this.catalog.window()
    const body = lines.map((line) => ` ${line}`)
    while (body.length < this.maxItems) {
      body.push('')
    }
    const list = [
      above > 0 ? ` ${this.more(-1, `↑ ${above} more`)}` : '',
      ...body,
      below > 0 ? ` ${this.more(1, `↓ ${below} more`)}` : '',
    ]
    const detail = this.detail(wide ? RIGHT : left - 2)
    const main = wide
      ? list.map(
          (row, i) =>
            `${fit(row, left)} ${this.p.dim('│')} ${fit(i === 0 ? detail.title : (detail.lines[i - 1] ?? ''), RIGHT, false)}`,
        )
      : [...list.map((row) => fit(row, left, false)), fit(` ${this.p.dim(detail.brief)}`, left, false)]
    const frame = [
      ...(this.hub ? [fit(hubBar(this.hub, this.color), width, false)] : []),
      ...head.map((line) => fit(line, width, false)),
      ...main,
      ` ${this.keyBar(this.footer(), width - 1)}`,
    ]
    return (this.help ? this.helpBox(frame, cols, rows, frame.length - main.length - 1) : frame).join('\n')
  }

  private helpRows(): Hint[] {
    return [
      ['Move', '↑↓  home  end  pgup  pgdn'],
      ['Open', '←→  ·  enter on a market or a series'],
      ['Pick', 'space  ·  a palette, a series, a market'],
      ['Filter', 'Any text  ·  bksp  ·  ctrl-u clears'],
      ...(this.active().length >= 2 ? [['Scope', 'ctrl+s  ·  one market, then all'] as Hint] : []),
      ['Market', '⇧←→  auto-update  ·  ctrl+r  updates it'],
      ['', 'del  removes it  ·  again to undo'],
      ['Add', 'owner/repo, a folder, or a row on GitHub'],
      ['', 'space  adds it  ·  ctrl+r  searches again'],
      ['Update', 'ctrl+r  on a palette marked ↑'],
      ['Apply', 'enter  reviews and applies  ·  esc cancels'],
      ...(this.hub ? [['Screens', 'tab  ·  shift+tab'] as Hint] : []),
      ['Close', '?  esc'],
    ]
  }

  private helpBox(lines: string[], cols: number, rows: number, top: number): string[] {
    const items = this.helpRows()
    const w = Math.min(cols - 2, 58)
    const x = Math.floor((cols - w) / 2)
    const blank = `│${' '.repeat(w - 2)}│`
    const box = [
      `╭─ Help ${'─'.repeat(w - 9)}╮`,
      blank,
      ...items.map(([label, text]) => `│${fit(`  ${this.p.bold(label.padEnd(10))}${text}`, w - 4)}  │`),
      blank,
      `╰${'─'.repeat(w - 2)}╯`,
    ]
    const y = Math.max(0, Math.min(Math.max(top, Math.floor((rows - box.length) / 2)), rows - 1 - box.length))
    return lines.map((line, i) => {
      const part = box[i - y]
      return part === undefined ? line : `${clip(line, x)}${part}`
    })
  }
}
