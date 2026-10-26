import type { Readable, Writable } from 'node:stream'
import type { Hex } from '../../core/color.ts'
import type { PaletteEntry } from '../../core/manifest.ts'
import { marksOf } from '../../core/mark.ts'
import { cells, inert } from '../../core/text.ts'
import { isRemote, OFFICIAL, TOPIC } from '../../store/sources.ts'
import { clip, fit, pieces, spread, wrapText } from '../ansi.ts'
import { type Bar, barLine, type Hint, type Tone, toned } from '../bar.ts'
import { Field } from '../field.ts'
import { Help, type Legend, overlay, type Topic } from '../help.ts'
import { HUB_UPDATE, type HubTab, hubBar, hubGoto, hubTo } from '../hub.ts'
import { capped } from '../keycaps.ts'
import { lineStep, type Mouse } from '../keys.ts'
import { Glide } from '../motion.ts'
import type { ReleaseLine } from '../notice.ts'
import { type Card, PaletteList, pageStep, paletteExample, type RowSpot, SearchHint } from '../palette-prompt.ts'
import { Screen } from '../screen.ts'
import { MARKS, type Paint, painter } from '../style.ts'
import { ALT_SCREEN, HIDE_CURSOR, NO_WRAP, PASTES, pointing, within } from '../terminal.ts'
import { button, cap, EMPTY, FAILED, framed, MIN_ITEMS, more, whereOf } from './draw.ts'
import { AddForm } from './form.ts'
import { Network } from './network.ts'
import { Panel } from './panel.ts'
import { Review } from './review.ts'
import { Search } from './search.ts'
import { Staged } from './staged.ts'
import type { BrowseIo, BrowseOptions, BrowseResult, Detail, Found, Marketplace, Row, Spot } from './types.ts'

type Side = 'cards' | 'panel' | 'form'

type View = 'browse' | 'search'

const LEFT_MIN = 40
const LEFT_MAX = 60
const PANEL_MIN = 42
const WIDE = 94
const ROOMY = 22
const MIN_COLS = 40
const MIN_ROWS = 10

type State = 'active' | 'submit' | 'cancel'

export class BrowsePanel {
  private readonly staged: Staged
  private readonly field = new Field()
  private readonly form: AddForm
  private readonly tuned: Set<string>
  private readonly network: Network
  private readonly startup: string | undefined
  private readonly io: BrowseIo
  private readonly color: boolean
  private readonly p: Paint
  private readonly hub: HubTab | undefined
  private readonly release: (() => ReleaseLine) | undefined
  private standing: ReleaseLine | undefined
  private readonly owns: boolean
  private readonly input: Readable | undefined
  private readonly output: (Writable & { columns?: number; rows?: number }) | undefined
  private maxItems = 12
  private readonly paint: ((entry: PaletteEntry) => void) | undefined
  private inks: readonly Hex[] | undefined
  private readonly list: PaletteList<Row>
  private readonly panel: Panel
  private readonly search: Search
  private side: Side = 'cards'
  private showing: View = 'browse'
  private open: string | undefined
  private split = 0
  private readonly hint: SearchHint
  private screen: Screen | undefined
  private state: State = 'active'
  private readonly review: Review
  private beat = 0
  private removing: Marketplace | undefined
  private leaving: { to: number | undefined } | undefined
  private notice: { text: string; tone: Tone } | undefined
  private goto: number | undefined
  private help: Help | undefined
  private readonly live: boolean

  constructor(opts: BrowseOptions) {
    this.staged = new Staged(opts)
    this.tuned = new Set(opts.tuned ?? [])
    this.startup = opts.startup
    this.io = opts.io
    this.network = new Network(opts.io, () => this.redraw())
    this.color = opts.color ?? true
    this.p = painter(this.color)
    this.form = new AddForm(this.network, this.p)
    this.hub = opts.hub
    this.inks = opts.mark
    this.release = opts.release
    this.standing = opts.release?.()
    this.owns = opts.owns ?? false
    this.input = opts.input
    this.output = opts.output
    this.live = opts.lookups ?? true
    this.paint = opts.onFocus
    this.review = new Review({
      staged: this.staged,
      p: this.p,
      hub: this.hub,
      color: this.color,
      inks: () => this.inks,
      span: () => this.span(),
      columns: () => this.columns(),
      beat: () => this.beat,
      more: (step, count) => more(this.p, step, count),
      redraw: () => this.redraw(),
      apply: (result, report) => this.network.track(this.io.apply(result, report)),
    })
    this.list = new PaletteList<Row>({
      entries: this.staged.entries(),
      picked: this.staged.picked,
      layout: 'marketplaces',
      mode: 'cards',
      color: this.color,
      maxItems: this.maxItems,
      note: (entry) => this.mark(entry),
      badge: (id) => this.badge(id),
      about: (top, members, matching) => this.about(top, members, matching),
      tops: () => this.staged.tops(),
      heads: () => this.heads(),
      onFocus: (entry) => this.focus(entry),
    })
    this.panel = new Panel({
      staged: this.staged,
      network: this.network,
      p: this.p,
      color: this.color,
      startup: this.startup,
      maxItems: this.maxItems,
      open: () => this.open,
      source: () => this.focusedMarketplace()?.source ?? '',
      mark: (entry) => this.mark(entry),
      focus: (entry) => {
        if (this.side === 'panel') {
          this.focus(entry)
        }
      },
    })
    this.search = new Search({
      staged: this.staged,
      network: this.network,
      p: this.p,
      color: this.color,
      maxItems: this.maxItems,
      redraw: () => this.redraw(),
      index: () => this.network.track(this.io.index()),
    })
    this.follow()
    this.hint = new SearchHint(
      opts.fx ?? 'typewriter',
      () => paletteExample(this.list),
      () => this.redraw(),
    )

    for (const source of opts.due) {
      this.update(source)
    }
  }

  run(): Promise<'submit' | 'cancel'> {
    const modes = [...(this.owns ? [ALT_SCREEN, HIDE_CURSOR, NO_WRAP] : []), PASTES, ...pointing()]
    const assume = this.owns ? [] : [HIDE_CURSOR, NO_WRAP]

    return within({ input: this.input, output: this.output, modes, assume }, async (terminal) => {
      const lists = [this.list, this.panel.inside, this.search.results]

      for (const list of lists) {
        list.glide = true
      }

      const glide = new Glide(
        () => lists.map((list) => list.step()).includes(true),
        () => this.screen?.request(),
      )

      const screen = new Screen({
        write: (text) => terminal.write(text),
        view: () => {
          if (this.state !== 'active') {
            return undefined
          }

          const lines = this.view()

          if (lists.some((list) => list.moving())) {
            glide.start()
          }

          return {
            lines,
            ticking: this.review.phase === 'applying' || this.form.fetching() || this.standing?.standing === 'checking',
          }
        },
        beat: () => {
          this.beat += 1

          if (this.standing?.standing === 'checking') {
            this.standing = this.release?.()
          }
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
        glide.stop()
        screen.stop()
        this.screen = undefined
        this.hint.stop()
      }
    })
  }

  applied(): boolean {
    return this.review.started
  }

  lines(): string[] {
    return this.review.log
  }

  failure(): Error | undefined {
    return this.review.stopped
  }

  next(): number | undefined {
    return this.goto
  }

  idle(): Promise<void> {
    return this.network.idle()
  }

  result(): BrowseResult {
    return this.staged.result()
  }

  private key(key: string): void {
    this.notice = undefined

    if (key === 'ctrl-c') {
      this.interrupt()

      return
    }

    if (this.help) {
      const answer = this.help.key(key)

      if (answer !== 'stay') {
        const run = answer === 'run' ? this.help.chosen()?.run : undefined
        this.help = undefined
        run?.()
      }

      return
    }

    if (this.leaving !== undefined) {
      if (key === 'esc') {
        this.leaving = undefined
      } else if (/^[yn]$/i.test(key)) {
        if (key.toLowerCase() === 'y') {
          this.review.begin()
        } else {
          this.goto = this.leaving.to
          this.state = 'cancel'
        }

        this.leaving = undefined
      }

      return
    }

    if (this.removing) {
      if (key === 'esc' || /^[yn]$/i.test(key)) {
        this.answer(key.toLowerCase() === 'y')
      }

      return
    }

    if (this.review.phase !== 'browse') {
      if (this.review.steer(key)) {
        this.state = 'submit'
      }

      return
    }

    if (key === 'alt-u' && this.hub && this.standing?.standing === 'newer') {
      this.leave(HUB_UPDATE)

      return
    }

    if (this.showing === 'search') {
      this.searchKey(key)

      return
    }

    if (this.side === 'form') {
      this.formKey(key)

      return
    }

    const panel = this.side === 'panel'
    const found = panel ? undefined : this.focusedFound()
    const opens = found?.kind === 'new' || found?.kind === 'search'
    const page = pageStep(key, (panel ? this.panel.inside : this.list).page())
    const line = lineStep(key)

    if (key === 'enter') {
      if (this.onAction()) {
        this.act()
      } else if (panel && this.panel.inside.foldable()) {
        this.panel.inside.flip()
      } else if (!panel && this.list.focusedRow()?.kind === 'top') {
        this.enter()
      } else if (opens) {
        this.activate()
      } else {
        this.review.open()
      }
    } else if ((key === 'esc' || key === 'ctrl-u') && this.field.value) {
      this.clear()
    } else if (key === 'esc') {
      if (panel) {
        this.back()
      } else {
        this.leave(undefined)
      }
    } else if (key === '?') {
      this.help = new Help(this.topics(), this.legend())
    } else if (page !== undefined) {
      this.move(page)
    } else if (line !== undefined) {
      this.move(line)
    } else if (key === 'right') {
      if (panel) {
        this.panel.inside.fold(true)
      } else if (opens) {
        this.activate()
      } else {
        this.enter()
      }
    } else if (key === 'left') {
      if (panel && this.panel.inside.outer()) {
        this.back()
      } else if (panel) {
        this.panel.inside.fold(false)
      }
    } else if (key === 'tab' || key === 'shift-tab') {
      if (this.hub) {
        this.leave(hubGoto(this.hub, key === 'tab' ? 1 : -1))
      }
    } else if (key === ' ') {
      if (this.onAction()) {
        this.act()
      } else if (panel) {
        this.panel.inside.pick()
      } else {
        this.activate()
      }
    } else if (key === 'ctrl-r') {
      if (panel) {
        this.panel.renew()
      }
    } else if (this.field.key(key)) {
      this.typed()
    }
  }

  private searchKey(key: string): void {
    const page = pageStep(key, this.search.results.page())
    const line = lineStep(key)

    if (key === 'enter' || key === ' ') {
      this.take(key === 'enter')
    } else if ((key === 'esc' || key === 'ctrl-u') && this.search.query.value) {
      this.search.clear()
    } else if (key === 'esc' || key === 'left') {
      this.closeSearch()
    } else if (key === '?') {
      this.help = new Help(this.topics(), this.legend())
    } else if (page !== undefined) {
      this.move(page)
    } else if (line !== undefined) {
      this.move(line)
    } else if (key === 'tab' || key === 'shift-tab') {
      if (this.hub) {
        this.leave(hubGoto(this.hub, key === 'tab' ? 1 : -1))
      }
    } else if (key === 'ctrl-r') {
      this.search.load()
    } else if (this.search.query.key(key)) {
      this.search.typed()
    }
  }

  private formKey(key: string): void {
    if (key === 'esc' || key === 'left') {
      this.back()
    } else if (key === '?') {
      this.help = new Help(this.topics(), this.legend())
    } else if (key === 'tab' || key === 'shift-tab') {
      if (this.hub) {
        this.leave(hubGoto(this.hub, key === 'tab' ? 1 : -1))
      }
    } else if (this.form.fetching()) {
      return
    } else if (key === 'enter') {
      this.submit()
    } else if (this.form.address.key(key)) {
      this.form.edited()
    }
  }

  private openForm(): void {
    this.form.seed(this.field.value.trim())
    this.side = 'form'
    this.list.focus = 'held'
  }

  private submit(): void {
    const source = this.form.parse()

    if (source === undefined) {
      return
    }

    const known = this.staged.known(source)

    if (known) {
      this.form.address.value = ''
      this.unremove(known)
      this.reveal(known.id)

      return
    }

    this.form.adding = source
    this.load(source)
  }

  private reveal(id: string): void {
    this.back()

    if (this.field.value) {
      this.clear()
    }

    this.list.select(`top ${id}`)
    this.enter()
  }

  private take(back: boolean): void {
    const found = this.search.focused()

    if (found?.kind === 'back') {
      this.closeSearch()

      return
    }

    if (found?.kind === 'state') {
      this.search.load()

      return
    }

    const source = found?.kind === 'listed' ? found.listed.source : undefined

    if (source === undefined) {
      return
    }

    const known = this.staged.known(source)

    if (!known) {
      this.search.landing = back ? source : undefined
      this.load(source)
    } else if (back) {
      this.unremove(known)
      this.closeSearch()
      this.list.select(`top ${known.id}`)
    } else if (this.staged.removes.has(known.source)) {
      this.unremove(known)
    } else if (this.staged.adds.has(known.source)) {
      this.staged.drop(known.source)
      this.reload()
    }
  }

  private openSearch(): void {
    this.showing = 'search'
    this.search.open(this.field.value.trim(), this.live)
  }

  private closeSearch(): void {
    this.showing = 'browse'
    this.search.landing = undefined
    this.follow()
  }

  private enter(): boolean {
    this.follow()

    if (this.side === 'panel') {
      return true
    }

    if (this.list.focusedRow()?.kind !== 'top' || this.panel.inside.size() === 0) {
      return false
    }

    this.side = 'panel'
    this.list.focus = 'held'
    this.panel.inside.focus = 'lit'
    this.panel.inside.refocus()

    return true
  }

  private back(): void {
    if (this.side === 'form') {
      this.form.drop()
    }

    this.side = 'cards'
    this.list.focus = 'lit'
    this.panel.inside.focus = 'off'
  }

  private follow(fresh = false): void {
    const row = this.list.focusedRow()
    const top = row?.kind === 'top' ? row.name : undefined

    if (fresh || top !== this.open) {
      this.open = top
      this.panel.inside.setEntries(top === undefined ? [] : this.staged.membersOf(top))
    }

    if (this.side === 'panel' && this.panel.inside.size() === 0) {
      this.back()
    }
  }

  private pasted(text: string): void {
    if (this.help) {
      this.help.paste(text)

      return
    }

    if (this.review.phase !== 'browse' || this.removing || this.leaving !== undefined) {
      return
    }

    if (this.showing === 'search') {
      this.search.paste(text)
    } else if (this.side === 'form') {
      if (!this.form.fetching()) {
        this.form.address.paste(text)
        this.form.edited()
      }
    } else {
      this.field.paste(text)
      this.typed()
    }
  }

  private mouse(event: Mouse, screen: Screen): void {
    const hit = screen.point(event)
    const spot = hit?.target as Spot | undefined

    if (event.action === 'press') {
      this.notice = undefined
    }

    if (this.help) {
      if (event.action === 'wheel') {
        this.help.wheel(event.wheel)
      } else if (event.action === 'press' && event.button === 'left' && spot?.kind === 'topic') {
        this.help.point(spot.index)
      } else if (event.action === 'release' && spot?.kind === 'key' && hit?.inside) {
        this.key(spot.key)
      } else if (event.action === 'release' && spot?.kind === 'topic') {
        if (hit?.inside && event.count >= 2 && this.help.point(spot.index)) {
          this.key('enter')
        }
      } else if (event.action === 'release' && spot?.kind !== 'help') {
        this.help = undefined
      }

      return
    }

    const free = this.review.phase === 'browse' && this.leaving === undefined && !this.removing

    if (event.action === 'wheel') {
      if (!event.sideways && (free || this.review.phase !== 'browse')) {
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
      } else if (free && spot.kind === 'form') {
        this.openForm()
      }
    } else if (event.action === 'release' && hit?.inside) {
      if (spot.kind === 'key') {
        this.key(spot.key)
      } else if (spot.kind === 'page') {
        if (this.review.phase !== 'browse') {
          this.review.scroll(spot.step * this.span())
        } else if (free && this.side === (spot.pane ? 'panel' : 'cards')) {
          this.move(spot.step * (spot.pane ? this.panel.inside : this.current()).page())
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
    if (this.showing === 'search') {
      this.search.results.point(spot.at)

      return
    }

    if (spot.pane) {
      if (this.enter()) {
        this.panel.inside.point(spot.at)
      }

      return
    }

    this.back()
    this.list.point(spot.at)
  }

  private wheel(step: number, panel: boolean): void {
    if (this.review.phase !== 'browse') {
      this.review.scroll(step)

      return
    }

    if (this.showing === 'search') {
      this.move(step, false)

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
    if (this.showing === 'search') {
      if (spot.part === 'box' || count === 2) {
        this.take(count === 2)
      }
    } else if (spot.pane) {
      if (this.onAction()) {
        if (spot.part === 'box' || count === 2) {
          this.act()
        }
      } else if (spot.part === 'box') {
        this.panel.inside.pick()
      } else if (spot.part === 'fold') {
        this.panel.inside.flip()
      } else if (count === 2) {
        this.panel.inside.open()
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

    this.panel.inside.setFilter(query)
    this.follow()

    if (query.trim() && this.list.focusedRow()?.kind === 'top' && this.panel.inside.matched() > 0) {
      this.enter()
    } else if (query.trim()) {
      this.back()
    }
  }

  private clear(): void {
    this.field.value = ''
    const was = this.list.focusedRow()
    this.panel.inside.clear()
    this.list.setFilter('')

    if (was?.kind === 'top') {
      this.list.select(`top ${was.name}`)
    }

    this.follow()
  }

  private redraw(): void {
    if (this.state === 'active') {
      this.screen?.request()
    }
  }

  private focus(entry: PaletteEntry): void {
    if (this.paint && this.state !== 'submit' && this.state !== 'cancel') {
      this.paint(entry)
      this.inks = marksOf(entry.background, entry.foreground, entry.signature)
    }
  }

  private reload(): void {
    this.list.setEntries(this.staged.entries())
    this.follow(true)
  }

  private focusedMarketplace(): Marketplace | undefined {
    const row = this.list.focusedRow()

    return row?.kind === 'top' ? this.staged.named(row.name) : undefined
  }

  private current(): PaletteList<Row> {
    return this.showing === 'search' ? this.search.results : this.list
  }

  private move(delta: number, wrap = true): void {
    ;(this.side === 'panel' ? this.panel.inside : this.current()).move(delta, wrap)
  }

  private onAction(): boolean {
    return this.side === 'panel' && this.panel.onAction()
  }

  private act(): void {
    const marketplace = this.focusedMarketplace()
    const action = this.panel.action()

    if (!marketplace || action === undefined) {
      return
    }

    if (action === 'update') {
      this.update(marketplace.source)
    } else if (action === 'auto') {
      this.staged.toggleAuto(marketplace)
    } else if (this.staged.adds.has(marketplace.source)) {
      this.staged.drop(marketplace.source)
      this.back()
      this.reload()
    } else {
      this.removing = marketplace
    }
  }

  private activate(): void {
    const row = this.list.focusedRow()

    if (row?.kind !== 'extra') {
      this.list.pick()

      return
    }

    const found = row.extra.found

    if (found?.kind === 'new') {
      this.openForm()
    } else if (found?.kind === 'search') {
      this.openSearch()
    }
  }

  private remove(marketplace: Marketplace): void {
    const at = this.staged.tops().indexOf(marketplace.id)
    this.staged.remove(marketplace.source)
    this.back()
    this.reload()
    const tops = this.staged.tops()
    const next = tops[Math.min(at, tops.length - 1)]

    if (next !== undefined) {
      this.list.select(`top ${next}`)
    }
  }

  private unremove(known: Marketplace): void {
    if (this.staged.unremove(known.source)) {
      this.reload()
    }
  }

  private load(source: string): void {
    this.network.fetch(
      source,
      (marketplace) => this.arrive(source, marketplace),
      () => {
        this.search.landing = undefined
      },
    )
  }

  private arrive(source: string, marketplace: Marketplace): void {
    const clash = this.staged.named(marketplace.id)

    if (clash) {
      this.network.failed.set(source, `${marketplace.id} already names the marketplace at ${clash.shown}`)
      this.search.landing = undefined
    } else {
      this.stage(marketplace)
    }

    this.redraw()
  }

  private focusedFound(): Found | undefined {
    const row = this.list.focusedRow()

    return row?.kind === 'extra' ? row.extra.found : undefined
  }

  private answer(yes: boolean): void {
    const marketplace = this.removing
    this.removing = undefined

    if (marketplace && yes) {
      this.remove(marketplace)
    } else if (marketplace) {
      this.notice = { text: inert(`${marketplace.id} kept`), tone: 'ok' }
    }
  }

  private stage(marketplace: Marketplace): void {
    this.staged.add(marketplace)
    this.reload()

    if (this.form.lands(marketplace.source)) {
      this.form.done()
      this.reveal(marketplace.id)

      return
    }

    this.list.select(`top ${marketplace.id}`)

    if (this.search.lands(marketplace.source)) {
      this.closeSearch()
    } else {
      this.search.results.refresh()
    }
  }

  private update(source: string): void {
    this.network.refresh(source, ({ marketplace, refreshed, updates }) => {
      this.staged.refresh(source, marketplace, refreshed, updates)
      this.reload()
    })
  }

  private row(found: Found, idle = false): Row {
    return {
      key: found.kind === 'listed' ? `listed ${found.listed.source}` : found.kind,
      ...(idle ? { idle } : {}),
      found,
      text: (focused: boolean, at: number, held: boolean) => this.foundLine(found, focused, at, held),
    }
  }

  private heads(): Row[] {
    return [this.row({ kind: 'new' }, true), this.row({ kind: 'search' })]
  }

  private status(marketplace: Marketplace): string {
    return this.staged.adds.has(marketplace.source)
      ? 'Will add'
      : (this.network.busy.get(marketplace.source) ?? (this.network.failed.has(marketplace.source) ? FAILED : ''))
  }

  private about(top: string, members: PaletteEntry[], matching?: number): Card {
    const m = this.staged.named(top)
    const installed = members.filter((e) => this.staged.installed.has(e.name)).length
    const adding = members.filter((e) => this.staged.picked.has(e.name) && !this.staged.installed.has(e.name)).length
    const dropping = members.filter((e) => this.staged.installed.has(e.name) && !this.staged.picked.has(e.name)).length

    const counts = [
      ...(m && matching !== undefined ? [`${matching} of ${m.entries.filter((e) => !e.default).length} match`] : []),
      ...(m && matching === undefined ? [`${m.entries.filter((e) => !e.default).length} available`] : []),
      ...(installed > 0 || !m ? [`${installed} installed`] : []),
      ...(adding > 0 ? [`${adding} to install`] : []),
      ...(dropping > 0 ? [`${dropping} to remove`] : []),
      ...(m && m.source !== OFFICIAL && !(this.staged.adds.has(m.source) && isRemote(m.source)) ? [cap(m.status)] : []),
    ]

    return {
      added: m !== undefined,
      lines: [this.p.dim(m ? whereOf(m.source) : 'Not added'), this.p.dim(counts.join(' · '))],
    }
  }

  private badge(id: string): string {
    const m = this.staged.named(id)

    if (!m) {
      return ''
    }

    const auto = isRemote(m.source) && this.staged.auto(m) ? `${MARKS.auto} auto-update` : ''
    const status = this.status(m)
    const failed = status === FAILED ? `  ${this.p.error(status)}` : status ? `  ${this.p.dim(status)}` : ''

    return `${auto ? `  ${this.p.dim(auto)}` : ''}${failed}`
  }

  private foundLine(found: Found, focused: boolean, at: number, held: boolean): string {
    const after = (text: string) => `  ${this.p.dim(text)}`

    return found.kind === 'new'
      ? button(this.p, at, focused, '+', 'Add marketplace', after('owner/repo or a folder'), { held })
      : button(this.p, at, focused, MARKS.search, 'Search marketplace', after('find one on GitHub'), { held })
  }

  private mark(entry: PaletteEntry): string {
    const tuned = this.tuned.has(entry.name) ? `  ${this.p.warn(MARKS.on)}` : ''

    if (!this.staged.outdated(entry.name)) {
      return tuned
    }

    return `${tuned}${this.staged.renew.has(entry.name) ? `  ${this.p.bold(`${MARKS.update} update`)}` : `  ${this.p.dim(MARKS.update)}`}`
  }

  private leave(to: number | undefined): void {
    if (this.staged.dirty()) {
      this.leaving = { to }

      return
    }

    this.goto = to
    this.state = 'cancel'
  }

  private interrupt(): void {
    if (this.leaving) {
      this.goto = this.leaving.to
      this.state = 'cancel'
    } else if ((this.review.phase === 'browse' || this.review.phase === 'review') && this.staged.dirty()) {
      this.help = undefined
      this.removing = undefined
      this.leaving = { to: undefined }
    } else {
      this.state = 'cancel'
    }
  }

  private span(): number {
    return Math.max(MIN_ITEMS, this.rows() - (this.hub ? 1 : 0) - 4)
  }

  private counts(): string {
    if (this.showing === 'search') {
      return this.search.counts()
    }

    const updating = this.network.updating() ? 'Updating… · ' : ''
    const list = this.list
    const dropped = this.staged.removes.size
    const removing = dropped > 0 ? ` · ${dropped} marketplace${dropped === 1 ? '' : 's'} to remove` : ''

    return `${updating}${list.matched()}/${list.total()} · ${list.pickedCount()} picked${removing}`
  }

  private searchText(): string {
    const typed = (this.showing === 'search' ? this.search.query : this.field).value

    if (typed) {
      return `${typed}_`
    }

    if (this.showing === 'search') {
      return this.p.dim('Search… a marketplace or a palette')
    }

    const example = this.hint.text()

    return this.p.dim(`Search…${example ? ` e.g. ${example}` : ''}`)
  }

  private heading(): string {
    const title = this.showing === 'search' ? 'Search marketplace' : 'Browse'

    return `${this.p.bold(title)} ${this.p.dim(`(${this.counts()})`)}`
  }

  private searchBox(width: number): string[] {
    return framed(this.p, width, `${this.p.dim(MARKS.search)} ${this.searchText()}`)
  }

  private detail(width: number): Detail {
    if (this.showing === 'search') {
      return this.search.detail(width)
    }

    const row = this.list.focusedRow()

    if (row?.kind === 'extra') {
      return row.extra.found ? this.foundDetail(row.extra.found, width) : EMPTY
    }

    if (row?.kind !== 'top') {
      return EMPTY
    }

    const marketplace = this.staged.named(row.name)

    if (marketplace) {
      return this.panel.marketplace(marketplace, width)
    }

    const note = 'In no marketplace you added — its installed palettes stay'

    return { title: this.p.bold(row.name), lines: wrapText(note, width), brief: note }
  }

  private foundDetail(row: Found, width: number): Detail {
    if (row.kind === 'new') {
      return {
        title: this.p.bold('Add marketplace'),
        lines: this.form.lines(width, this.side === 'form', this.beat),
        brief: capped('enter adds a repository or a folder'),
      }
    }

    const what = `The marketplaces anyone publishes on GitHub with the ${TOPIC} topic, listed every half hour`

    return {
      title: this.p.bold('Search marketplace'),
      lines: [...wrapText(what, width), '', ...wrapText(capped('enter opens the search'), width)],
      brief: capped('enter searches the marketplaces on GitHub'),
    }
  }

  private footer(): Bar {
    if (this.help) {
      return this.help.bar()
    }

    if (this.leaving !== undefined) {
      const count = this.staged.count()

      return {
        badge: 'BROWSE',
        lead: `Apply ${count} ${count === 1 ? 'change' : 'changes'} before you leave?`,
        keys: [
          ['y', 'apply'],
          ['n', 'discard'],
        ],
        right: ['esc', 'stay'],
        keep: ['y', 'n'],
      }
    }

    if (this.removing) {
      return {
        badge: 'BROWSE',
        lead: `Remove ${this.removing.id}? Its installed palettes stay installed`,
        keys: [
          ['y', 'remove'],
          ['n', 'keep'],
        ],
        right: ['esc', 'back'],
        keep: ['y', 'n'],
      }
    }

    if (this.showing === 'search') {
      return this.search.bar()
    }

    if (this.side === 'form') {
      return { badge: 'BROWSE (ADD)', keys: [...this.form.keys(), ['?', 'keys']], right: ['esc', 'cancel'] }
    }

    const filter = this.field.value
    const apply: Hint[] = this.staged.dirty() ? [['enter', 'apply']] : []
    const tail: Hint[] = [...(filter ? [['bksp', 'edit'] as Hint] : []), ['?', 'keys']]

    return {
      badge: filter ? 'BROWSE (FILTER)' : 'BROWSE',
      ...(this.notice ? { lead: toned(this.p, this.notice.tone, this.notice.text) } : {}),
      keys: [...(this.side === 'panel' ? this.panel.keys(apply) : this.cardKeys(apply)), ...tail],
      right: filter ? ['esc', 'clear filter'] : this.side === 'panel' ? ['esc', 'back'] : ['esc', 'cancel'],
      ...(this.standing ? { standing: this.standing } : {}),
    }
  }

  private cardKeys(apply: Hint[]): Hint[] {
    const row = this.list.focusedRow()

    if (row?.kind === 'extra') {
      return [['enter', 'open']]
    }

    if (row?.kind !== 'top') {
      return apply
    }

    const open: Hint[] = this.panel.inside.size() > 0 ? [['→', 'open']] : []

    return [...open, ['space', 'pick']]
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
    this.search.results.maxItems = items
  }

  private view(): string[] {
    const lines = this.draw().split('\n')

    return Array.from({ length: this.rows() }, (_, row) => lines[row] ?? '')
  }

  private small(cols: number, rows: number, need: number): string {
    return [`Needs ${MIN_COLS}×${need} — now ${cols}×${rows}`, this.p.dim('esc cancels')]
      .map((line) => clip(line, cols))
      .join('\n')
  }

  private draw(): string {
    const cols = this.columns()
    const rows = this.rows()

    if (cols < MIN_COLS || rows < MIN_ROWS) {
      return this.small(cols, rows, MIN_ROWS)
    }

    if (this.review.phase !== 'browse') {
      return this.review.frame(cols, rows)
    }

    this.follow()
    const wide = cols >= WIDE
    const width = cols - 1

    const head =
      rows >= ROOMY
        ? [` ${this.heading()}`, ...this.searchBox(width - 1).map((line) => ` ${line}`)]
        : [spread(` ${this.p.dim(MARKS.search)} ${this.searchText()}`, this.p.dim(this.counts()), width)]

    const chrome = head.length + 3 + (wide ? 0 : 1) + (this.hub ? 1 : 0)

    if (rows < chrome + MIN_ITEMS) {
      return this.small(cols, rows, chrome + MIN_ITEMS)
    }

    this.fitItems(chrome)
    const view = this.current().window()

    const plain = (line: string) =>
      pieces(line)
        .flatMap((piece) => (piece.sequence ? [] : [piece.text]))
        .join('')
        .trimEnd()

    const widest = Math.max(0, ...view.lines.map((line) => cells(plain(line)) + 3))
    const left = wide ? Math.min(LEFT_MAX, width - PANEL_MIN - 1, Math.max(LEFT_MIN, widest)) : width
    this.split = wide ? left + 1 : 0

    const main =
      !wide && this.side !== 'cards'
        ? this.box(width - 1, this.maxItems + 3).map((line) => ` ${line}`)
        : this.cards(view, wide, left, width)

    const frame = [
      ...(this.hub ? [fit(hubBar(this.hub, this.color, this.inks), width, false)] : []),
      ...head.map((line) => fit(line, width, false)),
      ...main,
      ` ${barLine(this.p, this.footer(), width - 1)}`,
    ]

    return (
      this.help ? overlay(frame, this.help.box(this.p, cols, rows), cols, rows, frame.length - main.length - 1) : frame
    ).join('\n')
  }

  private cards(
    { lines, above, below }: { lines: string[]; above: number; below: number },
    wide: boolean,
    left: number,
    width: number,
  ): string[] {
    const typed = this.field.value.trim()
    const none = this.showing !== 'search' && typed !== '' && this.list.matched() === 0
    const empty = none && lines.length + 2 <= this.maxItems ? ['', this.p.dim(`   No palettes match '${typed}'`)] : []
    const body = [...lines, ...empty].map((line) => ` ${line}`)

    while (body.length < this.maxItems) {
      body.push('')
    }

    const list = [
      above > 0 ? ` ${more(this.p, -1, above)}` : '',
      ...body,
      below > 0 ? ` ${more(this.p, 1, below)}` : '',
    ]

    if (!wide) {
      const { brief, failed } = this.detail(left - 2)

      return [
        ...list.map((row) => fit(row, left, false)),
        fit(` ${(failed ? this.p.error : this.p.dim)(brief)}`, left, false),
      ]
    }

    const box = this.box(width - left - 1, list.length)

    return list.map((row, i) => `${fit(row, left)} ${box[i] ?? ''}`)
  }

  private box(width: number, height: number): string[] {
    const top = this.current().focusedRow()?.kind === 'top'

    return this.panel.draw(width, height, this.detail(width - 4), top, this.side !== 'cards')
  }

  private topics(): Topic[] {
    const screens: Topic[] = this.hub
      ? [{ label: 'Screens', text: 'tab  ·  shift+tab', run: () => this.key('tab') }]
      : []

    const close: Topic = { label: 'Close', text: '?  esc', run: () => {} }

    if (this.showing === 'search') {
      return [
        { label: 'Move', text: '↑↓  ctrl+j  ctrl+k  home  end  pgup  pgdn' },
        { label: 'Filter', text: 'Any text  ·  bksp  ·  ctrl+u clears' },
        { label: 'Add', text: 'space  adds it  ·  again to undo', run: () => this.take(false) },
        { label: '', text: 'enter  adds it and goes back to its card', run: () => this.take(true) },
        {
          label: 'Reload',
          text: 'ctrl+r  the list, which GitHub fills every half hour',
          run: () => this.search.load(),
        },
        { label: 'Back', text: '←  esc  ·  ← Back', run: () => this.closeSearch() },
        ...screens,
        close,
      ]
    }

    const form = this.side === 'form'
    const panel = this.side === 'panel'
    const when = (on: boolean, run: () => void) => (on ? { run } : {})

    return [
      { label: 'Move', text: '↑↓  ctrl+j  ctrl+k  home  end  pgup  pgdn' },
      {
        label: 'Open',
        text: '→  enter  ·  a marketplace into the panel, a catalog',
        ...when(!form, () => this.key('right')),
      },
      {
        label: 'Back',
        text: '←  esc  ·  from the panel to the marketplaces',
        ...when(panel || form, () => this.back()),
      },
      { label: 'Pick', text: 'space  ·  a palette, a catalog, a marketplace', ...when(!form, () => this.key(' ')) },
      { label: 'Filter', text: 'Any text  ·  bksp  ·  ctrl+u clears' },
      { label: 'Marketplace', text: '↓  below its palettes, to its own actions' },
      { label: '', text: 'enter  updates it, turns auto-update on or off, removes it' },
      {
        label: 'Add',
        text: 'enter  on + Add marketplace  ·  a repository or a folder, in the panel',
        ...when(!form, () => {
          this.back()
          this.list.select('extra new')
          this.openForm()
        }),
      },
      {
        label: 'Search',
        text: 'enter  on Search marketplace  ·  finds one on GitHub',
        ...when(!form, () => {
          this.back()
          this.list.select('extra search')
          this.openSearch()
        }),
      },
      {
        label: 'Update',
        text: `ctrl+r  on a palette marked ${MARKS.update}`,
        ...when(panel, () => this.key('ctrl-r')),
      },
      {
        label: 'Apply',
        text: 'enter  reviews and applies  ·  esc cancels',
        ...when(this.staged.dirty(), () => this.review.open()),
      },
      ...screens,
      close,
    ]
  }

  private legend(): Legend {
    return [
      [MARKS.on, 'picked'],
      [MARKS.off, 'not picked'],
      [`${MARKS.closed} ${MARKS.opened}`, 'a catalog, closed or open'],
      [MARKS.update, 'has an update'],
      [MARKS.auto, 'updates on its own'],
      [MARKS.miss, 'misses the gate'],
      [MARKS.star, 'stars on GitHub'],
    ]
  }
}
