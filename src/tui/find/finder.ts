import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { linksOf } from '../../core/artists.ts'
import { backdropTone } from '../../core/backdrop-tone.ts'
import {
  blockSet,
  kindSet,
  postRef,
  ratingOf,
  ratingSet,
  rendition,
  SITES,
  type Site,
  siteSet,
  sourcePage,
  tagList,
} from '../../core/booru.ts'
import type { Manifest, PaletteEntry } from '../../core/manifest.ts'
import { TUNE } from '../../core/picture-panel.ts'
import { SCENES } from '../../core/scenes.ts'
import { POSITIONS } from '../../core/theme.ts'
import type { Pick } from '../../pictures/fit.ts'
import { Renderer } from '../../pictures/render.ts'
import { blurOf, coloringFor, settingDefault, stickerOf } from '../../store/wiring.ts'
import { CLEAR } from '../../terminals/terminal.ts'
import type { Tone as NoticeTone } from '../bar.ts'
import { edit, plain } from '../field.ts'
import { Help } from '../help.ts'
import { CELL_QUERY, CellProbe, type Inbound, lineStep, type Mouse } from '../keys.ts'
import { FOCUS, HIDE_CURSOR, NO_WRAP, PASTES, pointing, type Terminal, within } from '../terminal.ts'
import type { Hit } from '../zones.ts'
import { LOCAL, type Start, typedDrop } from './attach.ts'
import { Boards } from './boards.ts'
import { Installs } from './installs.ts'
import { Kept } from './kept.ts'
import { Own } from './own.ts'
import { Paint } from './paint.ts'
import {
  type AccountAsk,
  FIND_MARKS,
  type FinderView,
  type FindSpot,
  type FindView,
  findTopics,
  gridLayout,
  type Info,
  type Layer,
  layerOf,
  MIN,
  type Notice,
  type Owns,
  type Tuning,
} from './screen.ts'
import type { Grid, Net } from './session.ts'
import { initial, narrowedBy, orderOf, SETTINGS, Settings, settingValues } from './settings.ts'
import { Tags } from './tags.ts'
import { heldOf, Thumbs } from './thumbs.ts'
import { Trial } from './trial.ts'

const ALL_ANSI = 4
const FEATURES = '\x1b[?5522$p\x1b]72;t=q\x1b\\\x1b[c'
const NOTICE = 4000
const ACCOUNT_MOST = 200

function moves(key: string): boolean {
  return lineStep(key) !== undefined || key === 'tab' || key === 'shift-tab'
}

function siteOf(ask: AccountAsk): Site | undefined {
  return SITES.find((site) => site.key === ask.key)
}

const TOP_RIGHT = POSITIONS.indexOf('top-right') + 1

export interface FindIO {
  net: Net
  store: (pairs: [string, string][]) => void
  visit: (url: string) => boolean
  aligns: () => boolean
  refreshes: () => boolean
  refresh: () => Promise<void>
}

export class Finder {
  private readonly whole: FindView
  private readonly view: Owns<FinderView>
  private readonly session = new AbortController()
  private cell = { w: 0, h: 0 }
  private cols = process.stdout.columns || 80
  private rows = process.stdout.rows || 24
  private tab = 0
  private readonly renders = new Renderer()
  private terminal?: Terminal
  private noticeTimer?: NodeJS.Timeout
  private peekTimer?: NodeJS.Timeout
  private readonly slowed = new Set<string>()
  private readonly declined = new Set<string>()
  private done?: (code: number) => void
  private readonly scratch = mkdtempSync(join(tmpdir(), 'ttheme-find-'))

  private readonly start: Start | undefined
  private readonly visit: (url: string) => boolean
  private readonly net: Net
  private readonly paint: Paint
  private readonly kept: Kept
  private readonly thumbs: Thumbs
  private readonly settings: Settings
  private readonly tags: Tags
  private readonly boards: Boards
  private readonly trial: Trial
  private readonly installing: Installs
  private readonly own: Own

  constructor(home: string, manifest: Manifest, entry: PaletteEntry, tag: string, io: FindIO, start?: Start) {
    this.start = start
    this.visit = io.visit
    this.net = io.net
    const tone = backdropTone(entry)
    const blurring = blurOf(home)
    const sticker = stickerOf(home)
    const values = settingValues(process.env)
    const read = (name: string) => values.get(name) as string
    const untuned: Tuning = { size: 'fill', at: TOP_RIGHT, opacity: tone.opacity }
    this.whole = {
      palette: entry.name,
      tag,
      site: this.tabName,
      siteAnsi: this.tabAnsi,
      nextSite: this.nextTabName,
      preset: read('TTHEME_FIND_POSTS') === 'all' ? 'all' : 'cutouts',
      order: orderOf(read('TTHEME_FIND_ORDER')),
      solo: read('TTHEME_FIND_SOLO') === 'on',
      rating: ratingSet(read('TTHEME_FIND_RATING')),
      block: blockSet(read('TTHEME_FIND_BLOCK')),
      sets: read('TTHEME_FIND_SETS') === 'show' ? 'show' : 'fold',
      narrow: narrowedBy(read),
      enabled: siteSet(read('TTHEME_FIND_SITES')),
      hide: kindSet(read('TTHEME_FIND_HIDE')),
      hideTags: tagList(read('TTHEME_FIND_HIDE_TAGS')),
      settings: SETTINGS.map((setting) => ({
        label: setting.label,
        choices: [...setting.choices],
        value: read(setting.name),
        default: initial(setting, settingDefault(setting.name)),
        multi: setting.multi && { none: setting.multi.none },
        about: setting.about,
        entry: setting.entry,
        ...(setting.read ? { read: setting.read } : {}),
        ...(setting.unread ? { unread: setting.unread } : {}),
        advanced: setting.advanced,
        cursor: 0,
      })),
      colors: {
        cursor: entry.cursor,
        selection: entry.selection,
        background: entry.background,
        foreground: entry.foreground,
        ansi: entry.ansi,
      },
      tiles: [],
      installed: [],
      queue: [],
      held: heldOf(home, entry.name),
      checked: 0,
      total: 0,
      hunt: tag === '' ? undefined : { step: 'fetch' },
      sites: [],
      focus: 0,
      top: 0,
      scroll: 0,
      beat: 0,
      mode: { on: 'grid' },
      help: undefined,
      scene: Math.max(
        0,
        SCENES.findIndex((scene) => scene.name.toLowerCase() === process.env.TTHEME_SCENE),
      ),
      details: false,
      tune: { ...untuned },
      untuned,
      coloring: coloringFor(home),
      query: tag === '' ? { text: '' } : undefined,
      chips: [],
      keyed: process.env.TTHEME_HELP_BOX !== 'off',
    }
    this.view = this.whole
    this.paint = new Paint({
      view: this.whole,
      grid: () => this.grid(),
      background: entry.background,
      renders: this.renders,
      scratch: this.scratch,
      signal: this.signal,
      write: (text) => this.write(text),
    })
    this.kept = new Kept({
      home,
      manifest,
      entry,
      signal: this.signal,
      net: this.net,
      credited: () => {
        this.boards.show()
        this.inform()
        this.paint.draw()
      },
      quieted: (site) => this.slow(site),
      arrived: (site) => this.thumbs.revive(site),
    })
    this.thumbs = new Thumbs({
      view: this.whole,
      grid: () => this.grid(),
      home,
      entry,
      scratch: this.scratch,
      signal: this.signal,
      renders: this.renders,
      kept: this.kept,
      paint: this.paint,
      show: () => this.boards.show(),
    })
    this.settings = new Settings({
      view: this.whole,
      values,
      paint: this.paint,
      signal: this.signal,
      net: this.net,
      site: () => this.site,
      query: (site, terms) => this.tags.query(site, terms),
      adopted: () => {
        this.boards.clear()
        this.trial.forget()
        this.trial.leave()
        void this.boards.search()
      },
      tell: (notice) => this.tell(notice),
      keep: io.store,
    })
    this.tags = new Tags({
      view: this.whole,
      paint: this.paint,
      signal: this.signal,
      net: this.net,
      manifest,
      entry,
      research: () => {
        this.boards.clear()
        void this.boards.search()
      },
      commit: (text) => this.commit(text),
      leave: (code) => this.installing.leave(code),
    })
    this.boards = new Boards({
      view: this.whole,
      grid: () => this.grid(),
      entry,
      scratch: this.scratch,
      signal: this.signal,
      net: this.net,
      renders: this.renders,
      kept: this.kept,
      paint: this.paint,
      thumbs: this.thumbs,
      tags: this.tags,
      site: () => this.site,
      sites: () => this.sites,
      tabName: () => this.tabName,
      tabTo: (site) => {
        this.tab = SITES.indexOf(site) + 1
        this.syncSite()
      },
      forget: () => this.trial.forget(),
      select: () => this.trial.select(),
      enter: () => this.trial.enter(),
      tell: (notice) => this.tell(notice),
      asks: (account) => this.ask(account),
    })
    this.trial = new Trial({
      view: this.whole,
      grid: () => this.grid(),
      entry,
      tone,
      blurring,
      sticker,
      scratch: this.scratch,
      signal: this.signal,
      net: this.net,
      renders: this.renders,
      kept: this.kept,
      paint: this.paint,
      boards: this.boards,
      thumbs: this.thumbs,
      settings: this.settings,
      inform: () => this.inform(),
      tell: (notice) => this.tell(notice),
      focus: (index) => this.boards.focus(index),
      openPage: (post) => this.openPage(post),
      fromClipboard: () => this.own.fromClipboard(),
      install: () => this.installing.install(),
      landed: () => this.installing.landed(),
      hint: (text) => this.hint(text, NOTICE),
    })
    this.installing = new Installs({
      view: this.whole,
      grid: () => this.grid(),
      home,
      entry,
      tone,
      blurring,
      sticker,
      signal: this.signal,
      renders: this.renders,
      kept: this.kept,
      paint: this.paint,
      boards: this.boards,
      thumbs: this.thumbs,
      trial: this.trial,
      notice: (text, tone, ms) => this.notice(text, tone, ms),
      tell: (notice) => this.tell(notice),
      finish: (code) => this.finish(code),
      aligns: io.aligns,
      refreshes: io.refreshes,
      refresh: io.refresh,
    })
    this.own = new Own({
      view: this.whole,
      scratch: this.scratch,
      signal: this.signal,
      paint: this.paint,
      boards: this.boards,
      tags: this.tags,
      site: () => this.site,
      write: (text) => this.write(text),
      notice: (text, tone, ms) => this.notice(text, tone, ms),
      hint: (text, ms) => this.hint(text, ms),
      unhint: () => this.unhint(),
      unhelp: () => {
        this.view.help = undefined
      },
      unsave: () => this.installing.unsave(),
      tell: (notice) => this.tell(notice),
      fill: (said) => this.fillAccount(said),
    })
  }

  private get signal(): AbortSignal {
    return this.session.signal
  }

  private grid(): Grid {
    return { cols: this.cols, rows: this.rows, cell: this.cell }
  }

  private get site(): Site | undefined {
    return this.tab === 0 ? undefined : SITES[this.tab - 1]
  }

  private get sites(): Site[] {
    return this.site ? [this.site] : SITES.filter((site) => this.view.enabled.includes(site.name))
  }

  private get tabName(): string {
    return this.site?.name ?? 'all'
  }

  private get tabAnsi(): number {
    return this.site?.ansi ?? ALL_ANSI
  }

  private get nextTabName(): string {
    const next = (this.tab + 1) % (SITES.length + 1)

    return next === 0 ? 'all' : (SITES[next - 1] as Site).name
  }

  private syncSite(): void {
    const view = this.view
    view.site = this.tabName
    view.siteAnsi = this.tabAnsi
    view.nextSite = this.nextTabName
  }

  run(): Promise<number> {
    const burst = (typed: string) => layerOf(this.view).on !== 'query' && typedDrop(typed)

    return within({ modes: [PASTES, ...pointing()], assume: [HIDE_CURSOR, NO_WRAP], burst }, async (terminal) => {
      this.terminal = terminal
      terminal.onResize(this.onResize)
      terminal.onHover((event) => this.paint.hover(event))
      terminal.listen((events) => {
        for (const event of events) {
          this.inbound(event)
        }

        this.paint.soon()
      })
      terminal.write(CLEAR)

      const exit = new Promise<number>((resolve) => {
        this.done = resolve
      })

      const clock = setInterval(this.onClock, 250)

      try {
        const probe = new CellProbe()
        const cell = await terminal.ask(CELL_QUERY, (event) => probe.see(event), 1000)

        if (cell) {
          this.cell = cell
          this.thumbs.holdThumbs()

          if (this.view.tag) {
            void this.boards.search()
            void this.tags.relate(this.view.tag)
          }
        } else {
          this.boards.still()
          this.view.notice = {
            text: 'This terminal does not report its cell size — find needs kitty graphics',
            tone: 'warn',
          }
        }

        if (!process.env.TMUX) {
          await terminal.ask(FEATURES, (event) => (event.kind === 'attributes' ? true : undefined), 500, false)
        }

        for (const mode of this.own.grabber.modes()) {
          terminal.hold(mode)
        }

        terminal.hold(FOCUS)

        if (this.start && 'paste' in this.start) {
          this.own.pasted(this.start.paste)
        } else if (this.start) {
          void this.own.fromClipboard()
        } else {
          void this.own.peek()
        }

        this.paint.draw()

        return await terminal.until(exit)
      } finally {
        this.session.abort()
        this.own.stop()
        clearTimeout(this.noticeTimer)
        clearTimeout(this.peekTimer)
        this.trial.stop()
        this.tags.quiet()
        this.settings.quietCount()
        clearInterval(clock)
        this.paint.stop()
        terminal.write(`\x1b_Ga=d,d=A,q=2\x1b\\${CLEAR}`)
        this.renders.close()
        rmSync(this.scratch, { recursive: true, force: true })
      }
    })
  }

  private write(text: string): void {
    this.terminal?.write(text)
  }

  get saved(): string | undefined {
    return this.view.saved?.text
  }

  get installs(): number {
    return this.view.installed.length
  }

  private finish(code: number): void {
    this.done?.(code === 2 && this.saved ? 0 : code)
  }

  private inbound(event: Inbound): void {
    if (event.kind === 'key') {
      this.key(event.key)
    } else if (event.kind === 'mouse') {
      this.pointer(event)
    } else if (event.kind === 'paste') {
      this.own.pasted(event.text)
    } else if (event.kind === 'mode') {
      if (event.mode === 5522) {
        this.own.grabber.clipboard = event.value !== 0 && event.value !== 4
      }
    } else if (event.kind === 'osc') {
      if (event.code === '72' && event.meta.t === 'q') {
        this.own.grabber.drops = true
      } else {
        this.own.grabber.take(event)
      }
    }
  }

  private notice(text: string, tone: NoticeTone = 'warn', ms = NOTICE): void {
    const view = this.view
    const told = { text, tone }
    view.notice = told
    clearTimeout(this.noticeTimer)
    this.noticeTimer = setTimeout(() => {
      if (view.notice === told) {
        view.notice = undefined
        this.paint.draw()
      }
    }, ms)
    this.paint.draw()
  }

  private tell(notice?: Notice): void {
    this.view.notice = notice
  }

  private slow(key: string): void {
    if (this.slowed.has(key)) {
      return
    }

    this.slowed.add(key)
    const name = SITES.find((site) => site.key === key)?.name ?? key
    const unranked = this.view.order === 'fit' ? ', so its pictures are not ranked by color' : ''
    this.notice(`${name} is slow to send previews${unranked}`)
  }

  private unhint(): void {
    clearTimeout(this.peekTimer)
    this.view.hint = undefined
  }

  private hint(text: string, ms: number): void {
    const view = this.view
    view.hint = text
    clearTimeout(this.peekTimer)
    this.peekTimer = setTimeout(() => {
      view.hint = undefined
      this.paint.draw()
    }, ms)
    this.paint.draw()
  }

  private readonly onClock = (): void => {
    const slow = this.sites.reduce((a, b) => (this.net.pausedUntil(b) > this.net.pausedUntil(a) ? b : a))
    const left = Math.ceil((this.net.pausedUntil(slow) - Date.now()) / 1000)
    const waiting = left > 0 ? left : undefined

    if (waiting !== this.view.waiting) {
      this.view.waiting = waiting
      this.view.slow = slow.name
      this.paint.draw()
    }
  }

  private readonly onResize = (): void => {
    this.cols = process.stdout.columns || this.cols
    this.rows = process.stdout.rows || this.rows
    this.paint.resized()
    this.thumbs.holdThumbs()
    this.boards.scroll()
    this.paint.snap()

    if (this.view.mode.on !== 'grid' && this.trial.current) {
      this.trial.reveal()
    }

    void this.boards.pump()
    this.paint.draw()
  }

  private key(key: string): void {
    const view = this.view
    const layer = layerOf(view)

    if (key === 'ctrl-c') {
      if (layer.on === 'closing') {
        this.finish(2)
      } else {
        this.installing.leave(2)
      }

      return
    }

    if (layer.on === 'closing' || key === 'focus-out') {
      return
    }

    if (key === 'focus-in') {
      void this.own.peek()

      return
    }

    if (layer.on === 'account') {
      this.accountKey(layer.account, key)

      return
    }

    if (layer.on === 'help') {
      const answer = layer.help.key(key)

      if (answer !== 'stay') {
        const run = answer === 'run' ? layer.help.chosen()?.run : undefined
        view.help = undefined
        run?.()
      }

      this.paint.draw()

      return
    }

    if ((key === 'ctrl-v' || key === 'alt-v') && layer.on !== 'panel') {
      void this.own.fromClipboard()

      return
    }

    if (layer.on === 'query') {
      this.tags.editKey(key)

      return
    }

    if (layer.on === 'panel') {
      this.settings.panelKey(key)

      return
    }

    if (this.cols < MIN.cols || this.rows < MIN.rows) {
      if (key === 'esc') {
        this.installing.leave(2)
      }

      return
    }

    if (key === '?') {
      view.help = new Help(
        findTopics(view, (pressed) => this.key(pressed)),
        FIND_MARKS,
      )
      this.paint.draw()

      return
    }

    if (layer.on === 'grid') {
      this.gridKey(key)

      return
    }

    this.installing.touches++
    this.trial.tryKey(key)
  }

  private pointer(event: Mouse): void {
    const layer = layerOf(this.view)
    const hit = this.paint.point(event)
    const spot = hit?.target as FindSpot | undefined

    if (layer.on === 'closing') {
      return
    }

    if (layer.on === 'help') {
      this.helpPoint(layer.help, spot, hit, event)

      return
    }

    if (layer.on === 'account') {
      if (event.action !== 'release' || !hit?.inside) {
        return
      }

      if (spot?.kind === 'account') {
        if (spot.act === 'save') {
          this.saveAccount(layer.account)
        } else {
          layer.account.focus = 'field'
          this.paint.draw()
        }
      } else if (spot?.kind === 'key' || spot?.kind === 'link') {
        this.released(layer, spot, event)
      }

      return
    }

    if (event.action === 'wheel') {
      if (!event.sideways) {
        this.wheel(layer, event.wheel)
      }

      return
    }

    if ((event.action === 'press' || event.action === 'drag') && event.button !== 'left') {
      return
    }

    if (spot?.kind === 'track' && hit && event.action !== 'release') {
      if (layer.on === 'try' || layer.on === 'tune') {
        this.trial.slide(spot.field, hit)
      }
    } else if (event.action === 'press') {
      this.pressed(layer, spot)
    } else if (event.action === 'release' && hit?.inside) {
      this.released(layer, spot, event)
    }
  }

  private helpPoint(help: Help, spot: FindSpot | undefined, hit: Hit | undefined, event: Mouse): void {
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
      this.view.help = undefined
    }

    this.paint.draw()
  }

  private pressed(layer: Layer, spot: FindSpot | undefined): void {
    if (spot === undefined) {
      return
    }

    switch (layer.on) {
      case 'panel':
        if (spot.kind === 'setting' && spot.index < this.view.settings.length && layer.panel.typing === undefined) {
          this.settings.point(spot.index)
          this.paint.draw()
        }

        break
      case 'try':
      case 'tune':
        this.installing.touches++
        this.trial.tryPoint(spot)
        break
      case 'grid':
        if (spot.kind === 'tile') {
          this.boards.focus(spot.index)
        } else if (spot.kind === 'query') {
          this.gridKey('/')
        } else if (spot.kind === 'site') {
          this.tab = spot.tab
          this.syncSite()
          void this.boards.turn()
        }

        break
      default:
    }
  }

  private released(layer: Layer, spot: FindSpot | undefined, event: Mouse): void {
    if (spot?.kind === 'key') {
      this.key(spot.key)

      return
    }

    if (spot?.kind === 'link') {
      if (!event.shift && !event.alt && !event.ctrl) {
        this.visit(spot.url)
      }

      return
    }

    switch (layer.on) {
      case 'query':
        if (spot?.kind === 'suggest') {
          this.tags.point(spot.index)
          this.tags.editKey('enter')
        }

        break
      case 'panel':
        this.settings.panelPoint(spot)
        break
      case 'try':
      case 'tune':
        if (spot?.kind === 'place') {
          this.trial.tuneOn(TUNE.position, true)
          this.trial.tuneKey(String(spot.at))
        } else if (spot?.kind === 'coloring') {
          this.trial.tuneOn(TUNE.colors)

          if (spot.coloring === this.view.coloring) {
            this.paint.draw()
          } else {
            this.trial.recolor()
          }
        }

        break
      case 'grid':
        if (spot?.kind === 'tile' && event.count === 2) {
          this.gridKey('enter')
        } else if (spot?.kind === 'chip') {
          this.tags.toggle(spot.index)
        }

        break
      default:
    }
  }

  private wheel(layer: Layer, step: number): void {
    const key = step < 0 ? 'up' : 'down'

    switch (layer.on) {
      case 'query':
        if (layer.query.suggest) {
          this.tags.editKey(key)
        }

        break
      case 'panel':
        if (layer.panel.typing === undefined) {
          this.settings.panelKey(key)
        }

        break
      case 'tune':
        this.trial.tuneKey(key)
        break
      case 'try':
        this.trial.tryKey(step < 0 ? 'left' : 'right')
        break
      case 'grid':
        this.boards.focus(this.view.focus + step * gridLayout(this.cols, this.rows).perRow)
        break
      default:
    }
  }

  private gridKey(key: string): void {
    const view = this.view
    const { perRow, rowsVis } = gridLayout(this.cols, this.rows)

    const moves = new Map([
      ['left', -1],
      ['right', 1],
      ['h', -1],
      ['l', 1],
      ['pgup', -perRow * rowsVis],
      ['pgdn', perRow * rowsVis],
      ['home', -view.focus],
      ['end', view.tiles.length],
    ])

    const line = lineStep(key, true)
    const move = line === undefined ? moves.get(key) : line * perRow

    if (move !== undefined) {
      this.boards.focus(view.focus + move)

      return
    }

    if (/^[1-9]$/.test(key)) {
      this.tags.toggle(Number(key) - 1)

      return
    }

    if (key === 'enter' && view.tiles[view.focus]) {
      this.trial.enter()
      view.notice = undefined
      this.trial.select()

      return
    }

    if (key === 'v') {
      void this.own.fromClipboard()

      return
    }

    if (key === 'c') {
      this.settings.swap()
      void this.boards.turn()

      return
    }

    if (key === 'tab' || key === 'shift-tab') {
      const tabs = SITES.length + 1
      this.tab = (this.tab + (key === 'tab' ? 1 : tabs - 1)) % tabs
      this.syncSite()
      void this.boards.turn()

      return
    }

    if (key === '/') {
      this.tags.edit()
      this.paint.draw()

      return
    }

    if (key === ' ') {
      this.boards.unfold()

      return
    }

    if (key === 'o' || key === 'O') {
      this.openPage(key === 'O')

      return
    }

    if (key === 's' || key === 'a') {
      this.settings.open(key === 'a', this.boards.wanted())
      this.paint.draw()

      return
    }

    if (key === 'esc') {
      this.installing.leave(2)
    }
  }

  private async commit(text: string): Promise<void> {
    const ref = postRef(text, this.site ?? (SITES[0] as Site))

    if (ref) {
      await this.boards.jump(ref.site, ref.id)

      return
    }

    if (this.own.picture(text)) {
      await this.own.attach(text)

      return
    }

    this.tags.retag(text)
    void this.tags.relate(text)
    this.boards.clear()
    await this.boards.search()
  }

  private ask(setting: string): void {
    const site = SITES.find((one) => one.account?.setting === setting)
    const account = site?.account

    if (!site || !account || this.declined.has(site.key) || layerOf(this.view).on !== 'grid') {
      return
    }

    this.view.account = {
      key: site.key,
      site: site.name,
      siteAnsi: site.ansi,
      title: `${site.name} wants ${account.wants}`,
      about: account.ask,
      field: account.field,
      link: account.profile(site.origin),
      unread: account.unread,
      typed: '',
      read: '',
      focus: 'field',
    }
    this.paint.draw()
  }

  private typeAccount(typed: string): void {
    const ask = this.view.account
    const account = ask && siteOf(ask)?.account

    if (ask && account) {
      ask.typed = typed
      ask.read = account.read(typed)
      ask.focus = 'field'
      ask.note = undefined
      this.paint.draw()
    }
  }

  private accountKey(ask: AccountAsk, key: string): void {
    if (key === 'esc') {
      const site = siteOf(ask)

      if (site) {
        this.declined.add(site.key)
      }

      this.view.account = undefined
      this.paint.draw()

      return
    }

    if (key === 'ctrl-o') {
      this.visit(ask.link)

      return
    }

    if (key === 'ctrl-v' || key === 'alt-v') {
      void this.own.fromClipboard()

      return
    }

    if (key === 'enter') {
      this.saveAccount(ask)

      return
    }

    if (moves(key)) {
      ask.focus = ask.read && ask.focus === 'field' ? 'save' : 'field'
      this.paint.draw()

      return
    }

    const next = edit(ask.typed, key, (ch) => /^[\x20-\x7e]$/.test(ch) && ask.typed.length < ACCOUNT_MOST)

    if (next !== undefined) {
      this.typeAccount(next)
    }
  }

  private fillAccount(said: { text: string } | { note: string }): void {
    const ask = this.view.account

    if (!ask) {
      return
    }

    if ('text' in said) {
      this.typeAccount([...`${ask.typed}${plain(said.text).trim()}`].slice(0, ACCOUNT_MOST).join(''))
    } else {
      ask.note = said.note
      this.paint.draw()
    }
  }

  private saveAccount(ask: AccountAsk): void {
    const account = siteOf(ask)?.account

    if (ask.read && account) {
      this.view.account = undefined
      this.settings.put(account.setting, ask.read)
    }
  }

  private openPage(post: boolean): void {
    const tile = this.view.tiles[this.view.focus]
    const pick = tile && this.boards.posts.get(tile.key)

    if (!pick) {
      return
    }

    const source = sourcePage(pick.post.source)
    const page = pick.site === LOCAL ? '' : pick.site.pageUrl(pick.post.id)
    const url = !post && /^https?:\/\//i.test(source) ? source : page

    if (url) {
      this.visit(url)
    }
  }

  private inform(): void {
    const view = this.view
    const tile = view.tiles[view.focus]
    const pick = tile && this.boards.posts.get(tile.key)
    view.info = pick ? this.infoOf(pick) : undefined
  }

  private infoOf(pick: Pick): Info {
    const { site, post } = pick
    const named = post.named
    const rating = ratingOf(site, post)
    const listed = new Set([...named.artist, ...named.character, ...named.copyright])
    const source = sourcePage(post.source)

    const link = /^https?:\/\//i.test(source)
      ? source
      : site === LOCAL && source.startsWith('/')
        ? pathToFileURL(source).href
        : undefined

    return {
      page: site === LOCAL ? '' : site.pageUrl(post.id),
      source,
      ...(link ? { link } : {}),
      artists: named.artist,
      profiles: Object.fromEntries(
        Object.entries(this.kept.links(named.artist)).map(([name, urls]) => [name, linksOf(urls)]),
      ),
      characters: named.character,
      series: named.copyright,
      tags: post.tags.filter((tag) => !listed.has(tag)),
      ...(rating ? { rating } : {}),
      ...(post.posted ? { posted: post.posted } : {}),
      ext: (rendition(post) ?? post).ext,
      uploader: post.owner,
    }
  }
}
