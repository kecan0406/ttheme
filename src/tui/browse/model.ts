import type { Writable } from 'node:stream'
import type { Hex } from '../../core/color.ts'
import type { PaletteEntry } from '../../core/manifest.ts'
import { marksOf } from '../../core/mark.ts'
import { inert } from '../../core/text.ts'
import type { Tone } from '../bar.ts'
import { Field } from '../field.ts'
import { Help } from '../help.ts'
import { HUB_UPDATE, type HubTab, hubGoto, hubTo } from '../hub.ts'
import { lineStep, type Mouse } from '../keys.ts'
import type { ReleaseLine } from '../notice.ts'
import { PaletteList, pageStep, paletteExample, type RowSpot, type Scroll, SearchHint } from '../palette-prompt.ts'
import { type Paint, painter } from '../style.ts'
import type { Hit } from '../zones.ts'
import { MIN_ITEMS, more } from './draw.ts'
import { AddForm } from './form.ts'
import { Network } from './network.ts'
import { Panel } from './panel.ts'
import { type Phase, Review } from './review.ts'
import { Search } from './search.ts'
import { Staged } from './staged.ts'
import { browseLegend, browseTopics, type TopicsHost } from './topics.ts'
import type { BrowseIo, BrowseOptions, BrowseResult, Found, Marketplace, Row, Spot } from './types.ts'
import { about, badge, heads, mark } from './view.ts'

export type Place = 'cards' | 'panel' | 'form' | 'search'

export type Modal =
  | { readonly kind: 'help'; readonly help: Help }
  | { readonly kind: 'leave'; readonly to: number | undefined }
  | { readonly kind: 'remove'; readonly marketplace: Marketplace }

export type Layer = Modal['kind'] | Exclude<Phase, 'browse'> | Place

type State = 'active' | 'submit' | 'cancel'

export interface Laid {
  split?: number
  offset?: number
  help?: number
  hinted?: boolean
  scrolls: [PaletteList<Row>, Scroll][]
}

export type Shown = Readonly<Browse>

export class Browse {
  readonly staged: Staged
  readonly field = new Field()
  readonly form: AddForm
  readonly tuned: Set<string>
  readonly network: Network
  private readonly startup: string | undefined
  private readonly io: BrowseIo
  readonly color: boolean
  readonly p: Paint
  readonly hub: HubTab | undefined
  private readonly release: (() => ReleaseLine) | undefined
  private readonly notes: (() => string | undefined) | undefined
  standing: ReleaseLine | undefined
  readonly owns: boolean
  readonly output: (Writable & { columns?: number; rows?: number }) | undefined
  private readonly paint: ((entry: PaletteEntry) => void) | undefined
  inks: readonly Hex[] | undefined
  readonly list: PaletteList<Row>
  readonly panel: Panel
  readonly search: Search
  readonly topicsHost: TopicsHost
  place: Place = 'cards'
  modal: Modal | undefined
  private open: string | undefined
  private split = 0
  readonly hint: SearchHint
  state: State = 'active'
  readonly review: Review
  beat = 0
  notice: { text: string; tone: Tone } | undefined
  private goto: number | undefined
  readonly keyed: boolean
  private readonly live: boolean
  request: () => void = () => {}

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
    this.notes = opts.notes
    this.standing = opts.release?.()
    this.owns = opts.owns ?? false
    this.output = opts.output
    this.live = opts.lookups ?? true
    this.keyed = opts.help ?? true
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
      works: this.staged.works(),
      picked: this.staged.picked,
      layout: 'marketplaces',
      mode: 'cards',
      color: this.color,
      note: (entry) => mark(this, entry),
      badge: (id) => badge(this, id),
      about: (top, members, matching) => about(this, top, members, matching),
      tops: () => this.staged.tops(),
      heads: () => heads(this),
      onFocus: (entry) => this.focus(entry),
    })
    this.panel = new Panel({
      staged: this.staged,
      network: this.network,
      p: this.p,
      color: this.color,
      startup: this.startup,
      open: () => this.open,
      source: () => this.focusedMarketplace()?.source ?? '',
      mark: (entry) => mark(this, entry),
      focus: (entry) => {
        if (this.place === 'panel') {
          this.focus(entry)
        }
      },
    })
    this.search = new Search({
      staged: this.staged,
      network: this.network,
      p: this.p,
      color: this.color,
      redraw: () => this.redraw(),
      index: () => this.network.track(this.io.index()),
      ...(this.io.names ? { names: this.io.names.bind(this.io) } : {}),
      visit: (url) => this.io.visit(url),
    })
    this.topicsHost = {
      hub: this.hub,
      list: this.list,
      staged: this.staged,
      search: this.search,
      review: this.review,
      place: () => this.place,
      key: (key) => this.key(key),
      take: (back) => this.take(back),
      back: () => this.back(),
      openSearch: () => this.openSearch(),
      openForm: () => this.openForm(),
      closeSearch: () => this.closeSearch(),
    }
    this.follow()

    if (opts.search?.trim()) {
      this.place = 'search'
      this.search.open(opts.search.trim(), this.live)
    }

    this.hint = new SearchHint(
      opts.fx ?? 'typewriter',
      () => paletteExample(this.list),
      () => this.redraw(),
    )

    for (const source of opts.due) {
      this.update(source)
    }
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

  reviewing(): boolean {
    return this.review.phase !== 'browse'
  }

  layer(): Layer {
    return this.modal?.kind ?? (this.review.phase === 'browse' ? this.place : this.review.phase)
  }

  free(): boolean {
    return this.layer() === this.place
  }

  key(key: string): void {
    this.notice = undefined

    if (key === 'ctrl-c') {
      this.interrupt()

      return
    }

    const modal = this.modal

    switch (modal?.kind) {
      case 'help': {
        const answer = modal.help.key(key)

        if (answer !== 'stay') {
          const run = answer === 'run' ? modal.help.chosen()?.run : undefined
          this.modal = undefined
          run?.()
        }

        return
      }

      case 'leave':
        if (key === 'esc') {
          this.modal = undefined
        } else if (/^[yn]$/i.test(key)) {
          this.modal = undefined

          if (key.toLowerCase() === 'y') {
            this.review.begin()
          } else {
            this.goto = modal.to
            this.state = 'cancel'
          }
        }

        return
      case 'remove':
        if (key === 'esc' || /^[yn]$/i.test(key)) {
          this.answer(modal.marketplace, key.toLowerCase() === 'y')
        }

        return
      default:
        this.underKey(key)
    }
  }

  private underKey(key: string): void {
    if (this.reviewing()) {
      if (this.review.steer(key)) {
        this.state = 'submit'
      }

      return
    }

    if (key === 'alt-u' && this.hub && this.standing?.standing === 'newer') {
      this.leave(HUB_UPDATE)
    } else if (key === 'alt-u' && this.hub && this.standing?.standing === 'updated') {
      this.readNotes()
    } else if (this.place === 'search') {
      this.searchKey(key)
    } else if (this.place === 'form') {
      this.formKey(key)
    } else {
      this.listKey(key, this.place === 'panel')
    }
  }

  private readNotes(): void {
    const url = this.notes?.()

    if (url && !this.io.visit(url)) {
      this.notice = { text: url, tone: 'info' }
    }

    this.standing = this.release?.()
  }

  private listKey(key: string, panel: boolean): void {
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
      this.openHelp()
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

  private openHelp(): void {
    this.modal = { kind: 'help', help: new Help(browseTopics(this.topicsHost), browseLegend()) }
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
      this.openHelp()
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
      this.openHelp()
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
    this.place = 'form'
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

    if (back && this.search.visitFocused()) {
      return
    }

    const source =
      found?.kind === 'listed' ? found.listed.source : found?.kind === 'offer' ? found.offer.source : undefined

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
    this.place = 'search'
    this.search.open(this.field.value.trim(), this.live)
  }

  private closeSearch(): void {
    this.back()
    this.follow()
  }

  private enter(): boolean {
    this.follow()

    if (this.place === 'panel') {
      return true
    }

    if (this.list.focusedRow()?.kind !== 'top' || this.panel.inside.size() === 0) {
      return false
    }

    this.place = 'panel'
    this.list.focus = 'held'
    this.panel.inside.focus = 'lit'
    this.panel.inside.refocus()

    return true
  }

  private back(): void {
    if (this.place === 'form') {
      this.form.drop()
    } else if (this.place === 'search') {
      this.search.landing = undefined
    }

    this.place = 'cards'
    this.list.focus = 'lit'
    this.panel.inside.focus = 'off'
  }

  follow(fresh = false): void {
    const row = this.list.focusedRow()
    const top = row?.kind === 'top' ? row.name : undefined

    if (fresh || top !== this.open) {
      this.open = top
      this.panel.inside.setEntries(top === undefined ? [] : this.staged.membersOf(top), this.staged.works())
    }

    if (this.place === 'panel' && this.panel.inside.size() === 0) {
      this.back()
    }
  }

  pasted(text: string): void {
    if (this.modal?.kind === 'help') {
      this.modal.help.paste(text)

      return
    }

    switch (this.layer()) {
      case 'search':
        this.search.paste(text)

        return
      case 'form':
        if (!this.form.fetching()) {
          this.form.address.paste(text)
          this.form.edited()
        }

        return
      case 'cards':
      case 'panel':
        this.field.paste(text)
        this.typed()

        return
      default:
        return
    }
  }

  mouse(event: Mouse, hit: Hit | undefined): void {
    const spot = hit?.target as Spot | undefined

    if (event.action === 'press') {
      this.notice = undefined
    }

    if (this.modal?.kind === 'help') {
      const { help } = this.modal

      if (event.action === 'wheel') {
        help.wheel(event.wheel)
      } else if (event.action === 'press' && event.button === 'left' && spot?.kind === 'topic') {
        help.point(spot.index)
      } else if (event.action === 'release' && spot?.kind === 'key' && hit?.inside) {
        this.key(spot.key)
      } else if (event.action === 'release' && spot?.kind === 'topic') {
        if (hit?.inside && event.count >= 2 && help.point(spot.index)) {
          this.key('enter')
        }
      } else if (event.action === 'release' && spot?.kind !== 'help') {
        this.modal = undefined
      }

      return
    }

    const free = this.free()
    const reviewing = this.reviewing()

    if (event.action === 'wheel') {
      if (!event.sideways && (free || reviewing)) {
        this.wheel(event.wheel, reviewing, this.split > 0 && event.col >= this.split)
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
        if (reviewing) {
          this.review.scroll(spot.step * this.span())
        } else if (free && (spot.pane ? this.place === 'panel' : this.place === 'cards' || this.place === 'search')) {
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
    if (this.place === 'search') {
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

  private wheel(step: number, reviewing: boolean, panel: boolean): void {
    if (reviewing) {
      this.review.scroll(step)

      return
    }

    if (this.place === 'search') {
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
    if (this.place === 'search') {
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
      this.follow()
      this.request()
    }
  }

  private focus(entry: PaletteEntry): void {
    if (this.paint && this.state !== 'submit' && this.state !== 'cancel') {
      this.paint(entry)
      this.inks = marksOf(entry.background, entry.foreground, entry.cursor, entry.selection)
    }
  }

  private reload(): void {
    this.list.setEntries(this.staged.entries(), this.staged.works())
    this.follow(true)
  }

  private focusedMarketplace(): Marketplace | undefined {
    const row = this.list.focusedRow()

    return row?.kind === 'top' ? this.staged.named(row.name) : undefined
  }

  current(): PaletteList<Row> {
    return this.place === 'search' ? this.search.results : this.list
  }

  private move(delta: number, wrap = true): void {
    ;(this.place === 'panel' ? this.panel.inside : this.current()).move(delta, wrap)
  }

  private onAction(): boolean {
    return this.place === 'panel' && this.panel.onAction()
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
      this.modal = { kind: 'remove', marketplace }
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
      this.network.fail(source, `${marketplace.id} already names the marketplace at ${clash.shown}`)
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

  private answer(marketplace: Marketplace, yes: boolean): void {
    this.modal = undefined

    if (yes) {
      this.remove(marketplace)
    } else {
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
    this.network.refresh(source, ({ marketplace, updates }) => {
      this.staged.refresh(source, marketplace, updates)
      this.reload()
    })
  }

  private leave(to: number | undefined): void {
    if (this.staged.dirty()) {
      this.modal = { kind: 'leave', to }

      return
    }

    this.goto = to
    this.state = 'cancel'
  }

  private interrupt(): void {
    if (this.modal?.kind === 'leave') {
      this.goto = this.modal.to
      this.state = 'cancel'
    } else if ((this.review.phase === 'browse' || this.review.phase === 'review') && this.staged.dirty()) {
      this.modal = { kind: 'leave', to: undefined }
    } else {
      this.state = 'cancel'
    }
  }

  tick(): void {
    this.beat += 1

    if (this.standing?.standing === 'checking') {
      this.standing = this.release?.()
    }
  }

  stop(): void {
    this.hint.stop()
    this.search.close()
  }

  private span(): number {
    return Math.max(MIN_ITEMS, this.rows() - (this.hub ? 1 : 0) - 4)
  }

  query(): string {
    return (this.place === 'search' ? this.search.query : this.field).value
  }

  hinting(): boolean {
    return !this.query() && this.place !== 'search'
  }

  columns(): number {
    return (this.output ?? process.stdout).columns ?? 100
  }

  rows(): number {
    return (this.output ?? process.stdout).rows ?? 24
  }

  lay({ split, offset, help, hinted, scrolls }: Laid): void {
    if (hinted) {
      this.hint.unfold()
    }

    if (split !== undefined) {
      this.split = split
    }

    if (offset !== undefined) {
      this.review.scrolled(offset)
    }

    if (help !== undefined && this.modal?.kind === 'help') {
      this.modal.help.scrolled(help)
    }

    for (const [list, scroll] of scrolls) {
      list.scrolled(scroll)
    }
  }
}
