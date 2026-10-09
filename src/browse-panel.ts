import type { Readable, Writable } from 'node:stream'
import { cells, clip, fit, pieces, spread, wrapText } from './ansi.ts'
import { gateFailures } from './available.ts'
import { GATE_RULES } from './contrast.ts'
import { type HubSpot, type HubTab, hubBar, hubGoto, hubTo } from './hub.ts'
import type { PaletteEntry } from './manifest.ts'
import { type Repository, repositorySource } from './marketplaces.ts'
import { containsText } from './names.ts'
import {
  type Card,
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
import { isLocal, isRemote, OFFICIAL, parseSource, sameMarketplace, shownSource, TOPIC } from './sources.ts'
import { marketplaceOf, slugOf } from './theme.ts'
import { Field } from './tui/field.ts'
import type { Mouse } from './tui/keys.ts'
import { boxEdge, hintOf, pillOf } from './tui/parts.ts'
import { Screen } from './tui/screen.ts'
import { ansiFg, FG_RESET, MARKS, type Paint, painter, SPINNER } from './tui/style.ts'
import { ALT_SCREEN, HIDE_CURSOR, NO_WRAP, PASTES, pointing, within } from './tui/terminal.ts'
import { type KeySpot, zone } from './tui/zones.ts'

export interface Marketplace {
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
  refresh(source: string): Promise<{ marketplace: Marketplace; refreshed: Refreshed; updates: string[] }>
  fetch(source: string): Promise<Marketplace>
  search(query: string | undefined): Promise<Repository[]>
  apply(result: BrowseResult, report: Report): Promise<void>
}

interface BrowseOptions {
  marketplaces: Marketplace[]
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
  adds: Marketplace[]
  removes: string[]
  auto: Record<string, boolean>
  renew: string[]
  refreshed: Refreshed[]
}

type Phase = 'browse' | 'review' | 'applying' | 'done'

type Found =
  | { kind: 'new' }
  | { kind: 'add'; source: string }
  | { kind: 'find' }
  | { kind: 'repo'; repo: Repository; source: string }

interface Row extends Extra {
  found?: Found
}

interface Detail {
  title: string
  lines: string[]
  brief: string
}

type Side = 'cards' | 'panel'

type Spot = RowSpot | KeySpot | HubSpot | { kind: 'page'; step: number; pane?: string }

type Hint = [string, string]

interface Bar {
  badge: string
  lead?: string
  note?: string
  keys: Hint[]
  right?: Hint
}

const LEFT_MIN = 40
const LEFT_MAX = 60
const PANEL_MIN = 42
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

function whereOf(source: string): string {
  return source === OFFICIAL ? 'Built in' : isRemote(source) ? source : shownSource(source)
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

type State = 'active' | 'submit' | 'cancel'

export class BrowsePanel {
  readonly picked: Set<string>
  private readonly field = new Field()
  private readonly adds = new Map<string, Marketplace>()
  private readonly removes = new Set<string>()
  private readonly want = new Map<string, boolean>()
  private readonly renew = new Set<string>()
  private updates: Set<string>
  private readonly tuned: Set<string>
  private readonly busy = new Map<string, string>()
  private readonly failed = new Map<string, string>()
  private readonly peeked = new Map<string, Marketplace>()
  private readonly peekFailed = new Map<string, string>()
  private readonly staging = new Set<string>()
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly refreshed: Refreshed[] = []
  private readonly inflight = new Set<Promise<unknown>>()
  private marketplaces: Marketplace[]
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
  private readonly list: PaletteList<Row>
  private readonly inside: PaletteList<Row>
  private side: Side = 'cards'
  private open: string | undefined
  private split = 0
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
  private asking: Marketplace | undefined
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
    this.marketplaces = opts.marketplaces
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
    this.list = new PaletteList<Row>({
      entries: this.entries(),
      picked: this.picked,
      layout: 'marketplaces',
      mode: 'cards',
      color: this.color,
      maxItems: this.maxItems,
      note: (entry) => this.mark(entry),
      badge: (id) => this.badge(id),
      about: (top, members, matching) => this.about(top, members, matching),
      tops: () => this.tops(),
      heads: () => this.heads(),
      extras: () => this.found(),
      onFocus: (entry) => this.focus(entry),
    })
    this.inside = new PaletteList<Row>({
      entries: [],
      picked: this.picked,
      layout: 'marketplaces',
      mode: 'inside',
      pane: 'panel',
      color: this.color,
      maxItems: this.maxItems,
      note: (entry) => this.mark(entry),
      onFocus: (entry) => {
        if (this.side === 'panel') {
          this.focus(entry)
        }
      },
    })
    this.inside.focus = 'off'
    this.follow()
    this.hint = new SearchHint(
      opts.fx ?? 'typewriter',
      () => paletteExample(this.list),
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
    const panel = this.side === 'panel'
    const page = pageStep(key, (panel ? this.inside : this.list).page())
    if (key === 'enter') {
      if (panel && this.inside.foldable()) {
        this.inside.flip()
      } else if (!panel && this.list.focusedRow()?.kind === 'top') {
        this.enter()
      } else {
        this.finish()
      }
    } else if ((key === 'esc' || key === 'ctrl-u') && this.field.value) {
      this.clear()
    } else if (key === 'esc') {
      if (panel) {
        this.back()
      } else {
        this.state = 'cancel'
      }
    } else if (key === '?') {
      this.help = true
    } else if (page !== undefined) {
      this.move(page)
    } else if (key === 'up' || key === 'down') {
      this.move(key === 'up' ? -1 : 1)
    } else if (key === 'right') {
      if (panel) {
        this.inside.fold(true)
      } else {
        this.enter()
      }
    } else if (key === 'left') {
      if (panel && this.inside.outer()) {
        this.back()
      } else if (panel) {
        this.inside.fold(false)
      }
    } else if (key === 'tab' || key === 'shift-tab') {
      if (this.hub) {
        this.leave(hubGoto(this.hub, key === 'tab' ? 1 : -1))
      }
    } else if (key === 'shift-left' || key === 'shift-right') {
      if (!panel) {
        this.autoUpdate(key === 'shift-right')
      }
    } else if (key === ' ') {
      if (panel) {
        this.inside.pick()
      } else {
        this.activate()
      }
    } else if (key === 'delete') {
      const marketplace = this.focusedMarketplace()
      if (marketplace && !panel) {
        this.toggleMarketplace(marketplace)
      }
    } else if (key === 'ctrl-r') {
      this.refresh()
    } else if (this.field.key(key)) {
      this.typed()
    }
  }

  private finish(): void {
    if (this.dirty()) {
      this.phase = 'review'
      this.offset = 0
    } else {
      this.state = 'submit'
    }
  }

  private enter(): boolean {
    this.follow()
    if (this.side === 'panel') {
      return true
    }
    if (this.list.focusedRow()?.kind !== 'top' || this.inside.size() === 0) {
      return false
    }
    this.side = 'panel'
    this.list.focus = 'held'
    this.inside.focus = 'lit'
    this.inside.refocus()
    return true
  }

  private back(): void {
    this.side = 'cards'
    this.list.focus = 'lit'
    this.inside.focus = 'off'
  }

  private follow(fresh = false): void {
    const row = this.list.focusedRow()
    const top = row?.kind === 'top' ? row.name : undefined
    if (fresh || top !== this.open) {
      this.open = top
      this.inside.setEntries(top === undefined ? [] : this.membersOf(top))
    }
    if (this.side === 'panel' && this.inside.size() === 0) {
      this.back()
    }
  }

  private membersOf(top: string): PaletteEntry[] {
    return this.entries().filter((e) => (marketplaceOf(e.name) ?? OFFICIAL) === top)
  }

  private refresh(): void {
    const row = this.list.focusedRow()
    const marketplace = this.focusedMarketplace()
    if (this.side === 'panel') {
      this.toggleRenew()
    } else if (marketplace) {
      if (isRemote(marketplace.source) && !this.adds.has(marketplace.source)) {
        this.update(marketplace.source)
      }
    } else if (row?.kind === 'extra' && row.extra.found?.kind === 'find') {
      this.search()
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
        this.wheel(event.wheel, this.split > 0 && event.col >= this.split)
      }
      return
    }
    if (!spot) {
      return
    }
    if (event.action === 'press' && event.button === 'left') {
      if (free && spot.kind === 'row') {
        this.point(spot)
      }
    } else if (event.action === 'release' && hit?.inside) {
      if (spot.kind === 'key') {
        this.key(spot.key)
      } else if (spot.kind === 'page') {
        if (this.phase !== 'browse') {
          this.scroll(spot.step * this.span())
        } else if (free && this.side === (spot.pane ? 'panel' : 'cards')) {
          this.move(spot.step * (spot.pane ? this.inside : this.list).page())
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

  private point(spot: RowSpot): void {
    if (spot.pane) {
      if (this.enter()) {
        this.inside.point(spot.at)
      }
      return
    }
    this.back()
    this.list.point(spot.at)
    this.watch()
  }

  private wheel(step: number, panel: boolean): void {
    if (this.phase !== 'browse') {
      this.scroll(step)
      return
    }
    if (panel && !this.enter()) {
      return
    }
    if (!panel) {
      this.back()
    }
    this.move(step, false)
  }

  private openRow(spot: RowSpot, count: number): void {
    if (spot.pane) {
      if (spot.part === 'box') {
        this.inside.pick()
      } else if (spot.part === 'fold') {
        this.inside.flip()
      } else if (count === 2) {
        this.inside.open()
      }
    } else if (this.list.focusedRow()?.kind === 'extra') {
      if (spot.part === 'box' || count === 2) {
        this.activate()
      }
    } else if (spot.part === 'fold' || count === 2) {
      this.enter()
    }
  }

  private typed(): void {
    const query = this.field.value
    const was = this.list.focusedRow()
    this.list.setFilter(query)
    if (was?.kind === 'top') {
      this.list.select(`top ${was.name}`)
    }
    this.inside.setFilter(query)
    this.follow()
    if (query.trim() && this.list.focusedRow()?.kind === 'top' && this.inside.matched() > 0) {
      this.enter()
    } else if (query.trim()) {
      this.back()
    }
    this.later('search', SEARCH_AFTER, () => this.lookup())
    this.watch()
  }

  private clear(): void {
    this.field.value = ''
    const was = this.list.focusedRow()
    this.inside.clear()
    this.list.setFilter('')
    if (was?.kind === 'top') {
      this.list.select(`top ${was.name}`)
    }
    this.follow()
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

  private active(): Marketplace[] {
    return [...this.marketplaces.filter((m) => !this.removes.has(m.source)), ...this.adds.values()]
  }

  private entries(): PaletteEntry[] {
    const listed = this.active().flatMap((m) => m.entries)
    const names = new Set(listed.map((e) => e.name))
    const orphans = new Map<string, PaletteEntry>()
    const dropped = this.marketplaces.filter((m) => this.removes.has(m.source)).flatMap((m) => m.entries)
    for (const entry of [...this.kept, ...dropped]) {
      if (this.installed.has(entry.name) && !names.has(entry.name)) {
        orphans.set(entry.name, entry)
      }
    }
    return this.order([...listed, ...orphans.values()])
  }

  private reload(): void {
    this.list.setEntries(this.entries())
    this.follow(true)
  }

  private tops(): string[] {
    return [...this.marketplaces, ...this.adds.values()].map((m) => m.id)
  }

  private marketplaceNamed(id: string): Marketplace | undefined {
    return [...this.marketplaces, ...this.adds.values()].find((m) => m.id === id)
  }

  private focusedMarketplace(): Marketplace | undefined {
    const row = this.list.focusedRow()
    return row?.kind === 'top' ? this.marketplaceNamed(row.name) : undefined
  }

  private move(delta: number, wrap = true): void {
    ;(this.side === 'panel' ? this.inside : this.list).move(delta, wrap)
    this.watch()
  }

  private autoUpdate(on: boolean): void {
    const marketplace = this.focusedMarketplace()
    if (marketplace && isRemote(marketplace.source)) {
      if (on === marketplace.auto) {
        this.want.delete(marketplace.source)
      } else {
        this.want.set(marketplace.source, on)
      }
    }
  }

  private activate(): void {
    const row = this.list.focusedRow()
    if (row?.kind !== 'extra') {
      this.list.pick()
      return
    }
    const found = row.extra.found
    if (found?.kind === 'add') {
      this.load(found.source, true)
    } else if (found?.kind === 'repo') {
      const known = this.known(found.source)
      if (known) {
        this.list.select(`top ${known.id}`)
      } else {
        this.load(found.source, true)
      }
    } else if (found?.kind === 'find') {
      this.search()
    }
  }

  private toggleMarketplace(marketplace: Marketplace): void {
    if (this.adds.has(marketplace.source)) {
      this.adds.delete(marketplace.source)
      this.want.delete(marketplace.source)
    } else if (this.removes.has(marketplace.source)) {
      this.removes.delete(marketplace.source)
    } else {
      this.removes.add(marketplace.source)
    }
    this.reload()
  }

  private known(source: string): Marketplace | undefined {
    return [...this.marketplaces, ...this.adds.values()].find((m) => sameMarketplace(m.source, source))
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
      (marketplace) => {
        this.busy.delete(source)
        this.peeked.set(source, marketplace)
        if (this.staging.delete(source)) {
          this.arrive(source, marketplace)
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

  private arrive(source: string, marketplace: Marketplace): void {
    const clash = this.active().find((m) => m.id === marketplace.id)
    if (clash) {
      this.failed.set(source, `${marketplace.id} already names the marketplace at ${clash.shown}`)
    } else if (isLocal(source) || source === OFFICIAL) {
      this.stage(marketplace, marketplace.auto)
    } else {
      this.asking = marketplace
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
    const row = this.list.focusedRow()
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
    const marketplace = this.asking
    this.asking = undefined
    if (marketplace) {
      this.stage(marketplace, yes)
    }
  }

  private stage(marketplace: Marketplace, auto: boolean): void {
    this.adds.set(marketplace.source, marketplace)
    if (auto === marketplace.auto) {
      this.want.delete(marketplace.source)
    } else {
      this.want.set(marketplace.source, auto)
    }
    const typed = typedSource(this.field.value)
    if (typed && sameMarketplace(typed, marketplace.source)) {
      this.field.value = ''
      this.list.setFilter('')
    }
    this.reload()
    this.list.select(`top ${marketplace.id}`)
  }

  private update(source: string): void {
    if (this.busy.has(source)) {
      return
    }
    this.failed.delete(source)
    this.busy.set(source, 'Updating…')
    this.track(this.io.refresh(source)).then(
      ({ marketplace, refreshed, updates }) => {
        this.busy.delete(source)
        this.updates = new Set(updates)
        this.marketplaces = this.marketplaces.map((m) => (m.source === source ? marketplace : m))
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
          this.list.refresh()
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

  private heads(): Row[] {
    const typed = typedSource(this.field.value)
    const found: Found = typed && !this.known(typed) ? { kind: 'add', source: typed } : { kind: 'new' }
    return [
      {
        key: 'add',
        idle: found.kind === 'new',
        found,
        text: (focused: boolean, at: number) => this.foundLine(found, focused, at),
      },
    ]
  }

  private found(): Row[] {
    const hit = (...fields: string[]) => containsText(fields, this.field.value)
    const repos = (this.repos ?? [])
      .map((repo) => ({ repo, source: repositorySource(repo) }))
      .filter(({ repo, source }) => hit(source, repo.description ?? ''))
    const rows: Found[] = [
      ...repos.map(({ repo, source }) => ({ kind: 'repo' as const, repo, source })),
      ...(repos.length > 0 ? [] : [{ kind: 'find' as const }]),
    ]
    return [
      {
        key: 'github',
        rule: true,
        text: () => `\n   ${this.p.dim(`── On GitHub${this.searching ? ' · searching…' : ''} ──────────`)}`,
      },
      ...rows.map((found) => ({
        key: found.kind === 'repo' ? `repo ${found.source}` : found.kind,
        found,
        text: (focused: boolean, at: number) => this.foundLine(found, focused, at),
      })),
    ]
  }

  private lit(focused: boolean, text: string): string {
    return `${focused ? `${MARKS.gutter} ` : '  '} ${text}`
  }

  private status(marketplace: Marketplace): string {
    return this.adds.has(marketplace.source)
      ? 'Will add'
      : this.removes.has(marketplace.source)
        ? 'Will remove'
        : (this.busy.get(marketplace.source) ?? (this.failed.has(marketplace.source) ? 'Update failed' : ''))
  }

  private about(top: string, members: PaletteEntry[], matching?: number): Card {
    const m = this.marketplaceNamed(top)
    const installed = members.filter((e) => this.installed.has(e.name)).length
    const adding = members.filter((e) => this.picked.has(e.name) && !this.installed.has(e.name)).length
    const dropping = members.filter((e) => this.installed.has(e.name) && !this.picked.has(e.name)).length
    const counts = [
      ...(m && matching !== undefined ? [`${matching} of ${m.entries.filter((e) => !e.default).length} match`] : []),
      ...(m && matching === undefined ? [`${m.entries.filter((e) => !e.default).length} available`] : []),
      ...(installed > 0 || !m ? [`${installed} installed`] : []),
      ...(adding > 0 ? [`${adding} to install`] : []),
      ...(dropping > 0 ? [`${dropping} to remove`] : []),
      ...(m && m.source !== OFFICIAL && !(this.adds.has(m.source) && isRemote(m.source)) ? [cap(m.status)] : []),
    ]
    return {
      added: m !== undefined && !this.removes.has(m.source),
      lines: [this.p.dim(m ? whereOf(m.source) : 'Not added'), this.p.dim(counts.join(' · '))],
    }
  }

  private badge(id: string): string {
    const m = this.marketplaceNamed(id)
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
    if (found.kind === 'new') {
      const typed = typedSource(this.field.value)
      const known = typed ? this.known(typed) : undefined
      const note = known ? `${known.id} is already added` : 'type owner/repo or a folder'
      return this.lit(focused, `${box('+')}Add marketplace${after(note)}`)
    }
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
      return this.lit(focused, `${box('+')}Add ${whereOf(found.source)}${note}`)
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
              : 'Find marketplaces on GitHub'
            : named
              ? `No marketplace on GitHub matches "${query}"`
              : 'No marketplace on GitHub yet'
      const note = this.searchError ?? (this.searching ? '' : idle ? 'space searches' : 'space searches again')
      return this.lit(focused, `${box(MARKS.search)}${text}${after(note)}`)
    }
    const known = this.known(found.source)
    const failure = this.failed.get(found.source) ?? this.peekFailed.get(found.source)
    const peeked = this.peeked.get(found.source)
    const facts = [
      `${MARKS.star}${found.repo.stargazers_count}`,
      known ? `Added as ${known.id}` : peeked ? `${peeked.entries.filter((e) => !e.default).length} available` : '',
      this.busy.get(found.source) ?? '',
    ].filter(Boolean)
    return [
      '',
      this.lit(focused, `${box(known ? MARKS.on : MARKS.off)}${found.source}`),
      ...(found.repo.description ? [this.lit(focused, `  ${this.p.dim(found.repo.description)}`)] : []),
      this.lit(focused, `  ${this.p.dim(facts.join(' · '))}${failure ? `  ${this.p.error(failure)}` : ''}`),
    ].join('\n')
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
    const list = this.inside
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

  private marketplaceChanges(): string[] {
    const rows: string[] = []
    for (const m of this.adds.values()) {
      const auto = m.source !== OFFICIAL && (this.want.get(m.source) ?? m.auto) ? 'updates on its own' : ''
      rows.push(
        `+ ${m.id}  ${this.p.dim([m.source === OFFICIAL ? 'The official marketplace' : m.shown, counted(m.entries.filter((e) => !e.default).length), auto].filter(Boolean).join(' · '))}`,
      )
    }
    for (const source of this.removes) {
      const m = this.marketplaces.find((x) => x.source === source)
      const stay = (m?.entries ?? []).filter((e) => !e.default && this.installed.has(e.name) && this.picked.has(e.name))
      rows.push(
        `- ${m?.id ?? source}  ${this.p.dim([m?.shown ?? shownSource(source), stay.length > 0 ? `its ${counted(stay.length)} installed keep working` : ''].filter(Boolean).join(' · '))}`,
      )
    }
    for (const [source, on] of this.want) {
      const m = this.marketplaces.find((x) => x.source === source)
      if (m && !this.removes.has(source)) {
        rows.push(
          `${MARKS.auto} ${m.id}  ${this.p.dim(on ? 'updates on its own from now' : 'stops updating on its own')}`,
        )
      }
    }
    return rows
  }

  private reviewLines(): string[] {
    const marketplaces = this.marketplaceChanges()
    const { names, dropped } = this.pending()
    const renew = new Set(this.result().renew)
    const renewed = this.entries().filter((e) => renew.has(e.name))
    const width = Math.max(0, ...[...names, ...dropped, ...renewed].map((e) => e.name.length))
    const palette = (sign: string, e: PaletteEntry) =>
      `   ${sign} ${e.name.padEnd(width)}  ${this.p.dim(e.catalog ?? '')}`
    const counts = [
      names.length > 0 ? `${names.length} to install` : '',
      dropped.length > 0 ? `${dropped.length} to remove` : '',
      renewed.length > 0 ? `${renewed.length} to update` : '',
    ].filter(Boolean)
    return [
      ...(marketplaces.length > 0
        ? [
            ` ${this.p.bold('Marketplaces')} ${this.p.dim(`(${marketplaces.length})`)}`,
            ...marketplaces.map((r) => `   ${r}`),
            '',
          ]
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
      added > 0 ? `${added} marketplace${added === 1 ? '' : 's'} added` : '',
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

  private more(step: number, text: string, pane?: string): string {
    return this.p.dim(zone({ kind: 'page', step, ...(pane ? { pane } : {}) } satisfies Spot, text))
  }

  private counts(): string {
    const updating = [...this.busy.values()].includes('Updating…') ? 'Updating… · ' : ''
    const list = this.list
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
    const row = this.list.focusedRow()
    if (row?.kind === 'extra') {
      return row.extra.found ? this.foundDetail(row.extra.found, width) : EMPTY
    }
    if (row?.kind !== 'top') {
      return EMPTY
    }
    const marketplace = this.marketplaceNamed(row.name)
    if (marketplace) {
      return this.marketplaceDetail(marketplace, width)
    }
    const note = 'In no marketplace you added — its installed palettes stay'
    return { title: this.p.bold(row.name), lines: wrapText(note, width), brief: note }
  }

  private foot(width: number): string[] {
    const row = this.inside.focusedRow()
    if (row?.kind === 'catalog') {
      const members = this.inside.inside(row)
      const installed = members.filter((e) => this.installed.has(e.name)).length
      return [
        `${this.p.bold(row.name)}${row.native ? ` ${this.p.dim(row.native)}` : ''}`,
        this.p.dim(`${counted(members.length)} · ${installed} installed`),
        '',
      ]
    }
    if (row?.kind !== 'palette') {
      return ['', '', '']
    }
    const e = row.entry
    const fails = gateFailures(e)
    const gate = `Gate ${GATE_RULES.length - fails.length}/${GATE_RULES.length}`
    const pictures = e.pictures?.length ?? 0
    const extras = [
      ...(pictures > 0 ? [`${pictures} picture${pictures === 1 ? '' : 's'}`] : []),
      ...(e.base ? [`Base ${e.base}`] : []),
    ].join(' · ')
    const more = fails.length > 1 ? ` · +${fails.length - 1}` : ''
    return [
      `${this.color ? this.p.bold(`${ansiFg(e.cursor)}${e.name}${FG_RESET}`) : e.name}  ${this.p.dim(this.paletteState(e))}`,
      fails[0] === undefined
        ? this.p.dim(`${gate} · passes`)
        : `${gate} · ${this.p.bold(MARKS.miss)} ${fails[0]}${more}`,
      fit(this.p.dim(extras), width),
    ]
  }

  private marketplaceDetail(m: Marketplace, width: number): Detail {
    const listed = m.entries.filter((e) => !e.default)
    const installed = listed.filter((e) => this.installed.has(e.name)).map((e) => e.name)
    const auto = isRemote(m.source)
      ? `Auto-update ${(this.want.get(m.source) ?? m.auto) ? 'on' : 'off'}`
      : cap(m.status)
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
        ...(m.description ? [...wrapText(m.description, width).map((l) => this.p.dim(l)), ''] : []),
        isRemote(m.source) ? `${auto}  ${this.p.dim('⇧←→')}` : auto,
        ...(failure ? wrapText(failure, width).map((l) => this.p.error(l)) : []),
        ...(staged.length > 0 ? ['', ...staged.flatMap((s) => wrapText(s, width))] : []),
      ],
      brief: [auto, ...staged].join(' · '),
    }
  }

  private foundDetail(row: Found, width: number): Detail {
    if (row.kind === 'new') {
      const how = 'Type owner/repo, owner/repo#ref or a folder into the search, and space adds it'
      return {
        title: this.p.bold('Add marketplace'),
        lines: [...wrapText(how, width), '', ...wrapText(`Or pick one on GitHub, below the marketplaces`, width)],
        brief: how,
      }
    }
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
        title: this.p.bold(whereOf(row.source)),
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
      keys: [...(this.side === 'panel' ? this.panelKeys(enter) : this.cardKeys(enter)), ...tail],
      right: filter ? ['esc', 'clear filter'] : this.side === 'panel' ? ['esc', 'back'] : ['esc', 'cancel'],
    }
  }

  private panelKeys(enter: Hint): Hint[] {
    const list = this.inside
    const row = list.focusedRow()
    if (row?.kind === 'catalog' && list.foldable()) {
      return [row.expanded ? ['←', 'close'] : ['→', 'open'], ['space', 'pick']]
    }
    const renewable = row?.kind === 'palette' && this.updates.has(row.entry.name) && this.installed.has(row.entry.name)
    return [
      ['space', 'pick'],
      ...(renewable ? [['ctrl+r', this.renew.has(row.entry.name) ? 'keep' : 'update'] as Hint] : []),
      enter,
    ]
  }

  private cardKeys(enter: Hint): Hint[] {
    const row = this.list.focusedRow()
    if (row?.kind === 'extra') {
      const found = row.extra.found
      if (found?.kind === 'find') {
        return [['space', 'search'], enter]
      }
      if (found?.kind === 'add' || (found?.kind === 'repo' && !this.known(found.source))) {
        return [['space', 'add'], enter]
      }
      return [enter]
    }
    if (row?.kind !== 'top') {
      return [enter]
    }
    const open: Hint[] = this.inside.size() > 0 ? [['→', 'open']] : []
    const marketplace = this.focusedMarketplace()
    if (!marketplace) {
      return [...open, ['space', 'pick']]
    }
    const remote = isRemote(marketplace.source)
    const staged = this.adds.has(marketplace.source) || this.removes.has(marketplace.source)
    return [
      ...open,
      ['space', 'pick'],
      ...(remote ? [['⇧←→', 'auto-update'] as Hint] : []),
      ...(remote && !this.adds.has(marketplace.source) ? [['ctrl+r', 'update'] as Hint] : []),
      ['del', staged ? 'undo' : 'remove'],
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
    this.list.maxItems = items
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
    this.follow()
    const wide = cols >= WIDE
    const width = cols - 1
    const head =
      rows >= ROOMY
        ? [` ${this.heading()}`, ...this.searchBox(cols - 3).map((line) => ` ${line}`)]
        : [spread(` ${this.p.dim(MARKS.search)} ${this.searchText()}`, this.p.dim(this.counts()), width)]
    const chrome = head.length + 3 + (wide ? 0 : 1) + (this.hub ? 1 : 0)
    if (rows < chrome + MIN_ITEMS) {
      return this.small(cols, rows, chrome + MIN_ITEMS)
    }
    this.fitItems(chrome)
    const view = this.list.window()
    const plain = (line: string) =>
      pieces(line)
        .flatMap((piece) => (piece.sequence ? [] : [piece.text]))
        .join('')
        .trimEnd()
    const widest = Math.max(0, ...view.lines.map((line) => cells(plain(line)) + 3))
    const left = wide ? Math.min(LEFT_MAX, width - PANEL_MIN - 1, Math.max(LEFT_MIN, widest)) : width
    this.split = wide ? left + 1 : 0
    const main =
      !wide && this.side === 'panel'
        ? this.panel(width - 1, this.maxItems + 3).map((line) => ` ${line}`)
        : this.cards(view, wide, left, width)
    const frame = [
      ...(this.hub ? [fit(hubBar(this.hub, this.color), width, false)] : []),
      ...head.map((line) => fit(line, width, false)),
      ...main,
      ` ${this.keyBar(this.footer(), width - 1)}`,
    ]
    return (this.help ? this.helpBox(frame, cols, rows, frame.length - main.length - 1) : frame).join('\n')
  }

  private cards(
    { lines, above, below }: { lines: string[]; above: number; below: number },
    wide: boolean,
    left: number,
    width: number,
  ): string[] {
    const body = lines.map((line) => ` ${line}`)
    while (body.length < this.maxItems) {
      body.push('')
    }
    const list = [
      above > 0 ? ` ${this.more(-1, `↑ ${above} more`)}` : '',
      ...body,
      below > 0 ? ` ${this.more(1, `↓ ${below} more`)}` : '',
    ]
    if (!wide) {
      return [
        ...list.map((row) => fit(row, left, false)),
        fit(` ${this.p.dim(this.detail(left - 2).brief)}`, left, false),
      ]
    }
    const box = this.panel(width - left - 1, list.length)
    return list.map((row, i) => `${fit(row, left)} ${box[i] ?? ''}`)
  }

  private panel(width: number, height: number): string[] {
    const lit = this.side === 'panel'
    const frame = (text: string) => (lit ? this.p.accent(text) : this.p.dim(text))
    const inner = width - 4
    const side = (text: string) => `${frame('│')} ${fit(text, inner)} ${frame('│')}`
    const detail = this.detail(inner)
    const title = lit ? this.p.accent(detail.title) : detail.title
    const body = height - 2
    if (this.list.focusedRow()?.kind !== 'top') {
      const lines = detail.lines.slice(0, body)
      while (lines.length < body) {
        lines.push('')
      }
      return [this.edge(width, 'top', title, '', lit), ...lines.map(side), this.edge(width, 'bottom', '', '', lit)]
    }
    const foot = lit ? this.foot(inner) : []
    const head = detail.lines.slice(0, Math.max(0, body - 2 - (foot.length > 0 ? foot.length + 1 : 0)))
    this.inside.maxItems = Math.max(1, body - head.length - 1 - (foot.length > 0 ? foot.length + 1 : 0))
    const { lines, above, below } = this.inside.window()
    const tree = this.inside.size() > 0 ? lines : [this.p.dim('   No palettes yet')]
    while (tree.length < this.inside.maxItems) {
      tree.push('')
    }
    const down = below > 0 ? this.more(1, `↓ ${below} more`, 'panel') : ''
    return [
      this.edge(width, 'top', title, '', lit),
      ...head.map(side),
      side(above > 0 ? this.more(-1, `↑ ${above} more`, 'panel') : ''),
      ...tree.map(side),
      ...(foot.length > 0 ? [this.edge(width, 'mid', '', down, lit), ...foot.map(side)] : []),
      this.edge(width, 'bottom', '', foot.length > 0 ? '' : down, lit),
    ]
  }

  private edge(width: number, at: 'top' | 'mid' | 'bottom', head: string, tail: string, lit: boolean): string {
    const frame = (text: string) => (lit ? this.p.accent(text) : this.p.dim(text))
    const [left = '', right = ''] = [...boxEdge(2, at)]
    const title = head ? ` ${fit(head, width - 8, false)} ` : ''
    const end = tail ? ` ${tail} ` : ''
    const fill = Math.max(0, width - 3 - cells(title) - cells(end) - (tail ? 1 : 0))
    return `${frame(`${left}─`)}${title}${frame('─'.repeat(fill))}${end}${frame(`${tail ? '─' : ''}${right}`)}`
  }

  private helpRows(): Hint[] {
    return [
      ['Move', '↑↓  home  end  pgup  pgdn'],
      ['Open', '→  enter  ·  a marketplace into the panel, a catalog'],
      ['Back', '←  esc  ·  from the panel to the marketplaces'],
      ['Pick', 'space  ·  a palette, a catalog, a marketplace'],
      ['Filter', 'Any text  ·  bksp  ·  ctrl-u clears'],
      ['Marketplace', '⇧←→  auto-update  ·  ctrl+r  updates it'],
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
    const pad = Math.max(...items.map(([label]) => label.length)) + 3
    const w = Math.min(cols - 2, 6 + pad + Math.max(...items.map(([, text]) => cells(text))))
    const x = Math.floor((cols - w) / 2)
    const blank = `│${' '.repeat(w - 2)}│`
    const box = [
      `╭─ Help ${'─'.repeat(w - 9)}╮`,
      blank,
      ...items.map(([label, text]) => `│${fit(`  ${this.p.bold(label.padEnd(pad))}${text}`, w - 4)}  │`),
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
