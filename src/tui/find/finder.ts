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
import { pausedUntil } from '../../pictures/booru-net.ts'
import type { Pick } from '../../pictures/fit.ts'
import { Renderer } from '../../pictures/render.ts'
import { blurOf, coloringFor, settingDefault, stickerOf } from '../../store/wiring.ts'
import { CLEAR } from '../../terminals/terminal.ts'
import type { Tone as NoticeTone } from '../bar.ts'
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
  FIND_MARKS,
  type FindSpot,
  type FindView,
  findTopics,
  gridLayout,
  type Info,
  MIN,
  pageOf,
  type Tuning,
} from './screen.ts'
import type { Grid } from './session.ts'
import { initial, narrowedBy, orderOf, SETTINGS, Settings, settingValues } from './settings.ts'
import { Tags } from './tags.ts'
import { heldOf, Thumbs } from './thumbs.ts'
import { Trial } from './trial.ts'

const ALL_ANSI = 4
const FEATURES = '\x1b[?5522$p\x1b]72;t=q\x1b\\\x1b[c'
const NOTICE = 4000
const TOP_RIGHT = POSITIONS.indexOf('top-right') + 1

export interface FindIO {
  visit: (url: string) => boolean
  aligns: () => boolean
  refreshes: () => boolean
  refresh: () => Promise<void>
}

export class Finder {
  readonly view: FindView
  private readonly session = new AbortController()
  private cell = { w: 0, h: 0 }
  private cols = process.stdout.columns || 80
  private rows = process.stdout.rows || 24
  private tab = 0
  private readonly renders = new Renderer()
  private terminal?: Terminal
  private noticeTimer?: NodeJS.Timeout
  private peekTimer?: NodeJS.Timeout
  private done?: (code: number) => void
  private readonly scratch = mkdtempSync(join(tmpdir(), 'ttheme-find-'))

  private readonly start: Start | undefined
  private readonly visit: (url: string) => boolean
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
    const tone = backdropTone(entry)
    const blurring = blurOf(home)
    const sticker = stickerOf(home)
    const values = settingValues(process.env)
    const read = (name: string) => values.get(name) as string
    const untuned: Tuning = { size: 'fill', at: TOP_RIGHT, opacity: tone.opacity }
    this.view = {
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
      advanced: false,
      settings: SETTINGS.map((setting) => ({
        label: setting.label,
        choices: [...setting.choices],
        value: read(setting.name),
        default: initial(setting, settingDefault(setting.name)),
        multi: setting.multi && { none: setting.multi.none },
        about: setting.about,
        entry: setting.entry,
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
      queued: [],
      held: heldOf(home, entry.name),
      checked: 0,
      total: 0,
      searching: tag !== '',
      stage: 'fetch',
      sites: [],
      focus: 0,
      top: 0,
      scroll: 0,
      beat: 0,
      mode: 'grid',
      help: undefined,
      scene: Math.max(
        0,
        SCENES.findIndex((scene) => scene.name.toLowerCase() === process.env.TTHEME_SCENE),
      ),
      details: false,
      tune: { ...untuned },
      untuned,
      coloring: coloringFor(home),
      editing: tag === '' ? '' : undefined,
      chips: [],
      keyed: process.env.TTHEME_HELP_BOX !== 'off',
    }
    this.paint = new Paint({
      view: this.view,
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
      credited: () => {
        this.boards.show()
        this.inform()
        this.paint.draw()
      },
    })
    this.thumbs = new Thumbs({
      view: this.view,
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
      view: this.view,
      values,
      paint: this.paint,
      signal: this.signal,
      home,
      site: () => this.site,
      query: (site, terms) => this.tags.query(site, terms),
      adopted: () => {
        this.boards.clear()
        this.trial.forget()
        this.view.mode = 'grid'
        void this.boards.search()
      },
    })
    this.tags = new Tags({
      view: this.view,
      paint: this.paint,
      signal: this.signal,
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
      view: this.view,
      grid: () => this.grid(),
      entry,
      scratch: this.scratch,
      signal: this.signal,
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
      halt: () => this.trial.halt(),
      select: () => this.trial.select(),
      scroll: () => this.scroll(),
    })
    this.trial = new Trial({
      view: this.view,
      grid: () => this.grid(),
      entry,
      tone,
      blurring,
      sticker,
      scratch: this.scratch,
      signal: this.signal,
      renders: this.renders,
      kept: this.kept,
      paint: this.paint,
      boards: this.boards,
      thumbs: this.thumbs,
      settings: this.settings,
      inform: () => this.inform(),
      focus: (index) => this.focus(index),
      openPage: (post) => this.openPage(post),
      fromClipboard: () => this.own.fromClipboard(),
      install: (touches) => this.installing.install(touches),
      hint: (text) => this.hint(text, NOTICE),
    })
    this.installing = new Installs({
      view: this.view,
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
      finish: (code) => this.finish(code),
      aligns: io.aligns,
      refreshes: io.refreshes,
      refresh: io.refresh,
    })
    this.own = new Own({
      view: this.view,
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
    const burst = (typed: string) => this.view.editing === undefined && typedDrop(typed)

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
          this.view.searching = false
          this.view.notice = {
            text: 'This terminal does not report its cell size — find needs kitty graphics',
            tone: 'warn',
          }
        }

        if (!process.env.TMUX) {
          await terminal.ask(FEATURES, (event) => (event.kind === 'attributes' ? true : undefined), 500, false)
        }

        this.own.grabber.start()
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
        this.tags.quietSuggest()
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
    const slow = this.sites.reduce((a, b) => (pausedUntil(b) > pausedUntil(a) ? b : a))
    const left = Math.ceil((pausedUntil(slow) - Date.now()) / 1000)
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
    this.scroll()
    this.paint.snap()

    if (this.view.mode === 'try' && this.trial.current) {
      this.trial.reveal()
    }

    void this.boards.pump()
    this.paint.draw()
  }

  private key(key: string): void {
    const view = this.view

    if (key === 'ctrl-c') {
      if (view.closing) {
        this.finish(2)
      } else {
        this.installing.leave(2)
      }

      return
    }

    if (view.closing) {
      return
    }

    if (key === 'focus-in') {
      void this.own.peek()

      return
    }

    if (key === 'focus-out') {
      return
    }

    if (view.help) {
      const answer = view.help.key(key)

      if (answer !== 'stay') {
        const run = answer === 'run' ? view.help.chosen()?.run : undefined
        view.help = undefined
        run?.()
      }

      this.paint.draw()

      return
    }

    if ((key === 'ctrl-v' || key === 'alt-v') && view.panel === undefined) {
      void this.own.fromClipboard()

      return
    }

    if (view.editing !== undefined) {
      this.tags.editKey(key)

      return
    }

    if (view.panel !== undefined) {
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

    if (view.mode === 'try') {
      this.installing.touches++
      this.trial.tryKey(key)

      return
    }

    this.gridKey(key)
  }

  private pointer(event: Mouse): void {
    const view = this.view
    const hit = this.paint.point(event)
    const spot = hit?.target as FindSpot | undefined

    if (view.closing) {
      return
    }

    if (view.help) {
      this.helpPoint(view.help, spot, hit, event)

      return
    }

    if (event.action === 'wheel') {
      if (!event.sideways) {
        this.wheel(event.wheel)
      }

      return
    }

    if ((event.action === 'press' || event.action === 'drag') && event.button !== 'left') {
      return
    }

    if (spot?.kind === 'track' && hit && event.action !== 'release') {
      this.trial.slide(spot.field, hit)
    } else if (event.action === 'press') {
      this.pressed(spot)
    } else if (event.action === 'release' && hit?.inside) {
      this.released(spot, event)
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

  private pressed(spot: FindSpot | undefined): void {
    const view = this.view

    if (view.editing !== undefined || spot === undefined) {
      return
    } else if (view.panel !== undefined) {
      if (spot.kind === 'setting' && spot.index < view.settings.length && view.typing === undefined) {
        view.panel = spot.index
        this.paint.draw()
      }
    } else if (view.mode === 'try') {
      this.installing.touches++
      this.trial.tryPoint(spot)
    } else if (spot.kind === 'tile') {
      this.focus(spot.index)
    } else if (spot.kind === 'query') {
      this.gridKey('/')
    } else if (spot.kind === 'site') {
      this.tab = spot.tab
      this.syncSite()
      void this.boards.turn()
    }
  }

  private released(spot: FindSpot | undefined, event: Mouse): void {
    const view = this.view

    if (spot?.kind === 'key') {
      this.key(spot.key)
    } else if (spot?.kind === 'link') {
      if (!event.shift && !event.alt && !event.ctrl) {
        this.visit(spot.url)
      }
    } else if (view.editing !== undefined) {
      if (spot?.kind === 'suggest') {
        view.pick = spot.index
        this.tags.editKey('enter')
      }
    } else if (view.panel !== undefined) {
      this.settings.panelPoint(spot)
    } else if (view.mode === 'try') {
      if (spot?.kind === 'place') {
        view.tuning ??= { field: TUNE.position }
        this.trial.tuneKey(String(spot.at))
      } else if (spot?.kind === 'coloring') {
        view.tuning = { field: TUNE.colors }

        if (spot.coloring === view.coloring) {
          this.paint.draw()
        } else {
          this.trial.recolor()
        }
      }
    } else if (spot?.kind === 'tile' && event.count === 2) {
      this.gridKey('enter')
    } else if (spot?.kind === 'chip') {
      this.tags.toggle(spot.index)
    }
  }

  private wheel(step: number): void {
    const view = this.view

    if (view.editing !== undefined) {
      if (view.suggest?.length) {
        this.tags.editKey(step < 0 ? 'up' : 'down')
      }
    } else if (view.panel !== undefined) {
      if (view.typing === undefined) {
        this.settings.panelKey(step < 0 ? 'up' : 'down')
      }
    } else if (view.tuning) {
      this.trial.tuneKey(step < 0 ? 'up' : 'down')
    } else if (view.mode === 'try') {
      this.trial.tryKey(step < 0 ? 'left' : 'right')
    } else {
      this.focus(view.focus + step * gridLayout(this.cols, this.rows).perRow)
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
      this.focus(view.focus + move)

      return
    }

    if (/^[1-9]$/.test(key)) {
      this.tags.toggle(Number(key) - 1)

      return
    }

    if (key === 'enter' && view.tiles[view.focus]) {
      view.mode = 'try'
      view.notice = undefined
      this.trial.select()

      return
    }

    if (key === 'v') {
      void this.own.fromClipboard()

      return
    }

    if (key === 'c') {
      view.preset = view.preset === 'cutouts' ? 'all' : 'cutouts'
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
      view.editing = ''
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
      view.advanced = key === 'a'
      view.panel = pageOf(view)[0] ?? 0
      this.settings.recount()
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

    this.view.tag = text
    this.view.chosen = undefined
    void this.tags.relate(text)
    this.boards.clear()
    await this.boards.search()
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

  private focus(index: number): void {
    const view = this.view

    if (view.tiles.length === 0) {
      return
    }

    const next = Math.max(0, Math.min(view.tiles.length - 1, index))

    if (next === view.focus) {
      return
    }

    view.focus = next
    this.boards.board.focus = next
    this.scroll()
    this.paint.glide()
    void this.boards.pump()

    if (view.mode === 'try') {
      this.trial.select()
    }

    this.paint.draw()
  }

  private scroll(): void {
    const view = this.view
    const { perRow, rowsVis } = gridLayout(this.cols, this.rows)
    const row = Math.floor(view.focus / perRow)

    if (row < view.top) {
      view.top = row
    }

    if (row > view.top + rowsVis - 1) {
      view.top = row - rowsVis + 1
    }

    this.boards.board.top = view.top
  }
}
