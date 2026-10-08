import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { linksOf } from '../artists.ts'
import { booruTags, find, readAvailable, siteTags } from '../available.ts'
import { backdropTone, backgroundsDir, fillSize, rackOf, type Tone, type Tune } from '../backdrop.ts'
import {
  BLOCKS,
  blockSet,
  cacheDir,
  exposed,
  extension,
  fetchCount,
  fetchLent,
  fetchPost,
  fetchPosts,
  fetchRelated,
  fetchSuggestions,
  fileOf,
  hidden,
  KINDS,
  kindSet,
  LENDER,
  lend,
  locate,
  type Narrow,
  narrowOf,
  PAGE,
  type Post,
  pausedUntil,
  pickedNames,
  postKey,
  postRef,
  previewOf,
  RATINGS,
  type Rendition,
  rated,
  ratingOf,
  ratingSet,
  rendition,
  SCORES,
  SITES,
  SIZES,
  type Site,
  siteSet,
  sourcePage,
  sweepCache,
  tagList,
  tagsOf,
} from '../booru.ts'
import { canRemoveBackground, keepable, removeBackground } from '../cutout.ts'
import { writeAtomic } from '../edits.ts'
import { type Frame, fitOrder, interleave, type Pick } from '../fit.ts'
import type { Manifest, PaletteEntry } from '../manifest.ts'
import { nameHits, primeNames } from '../names.ts'
import { aligns as alignsFor, configHome, readInstalled, refreshPictures } from '../palettes.ts'
import { type Look, Renderer, type Shown } from '../render.ts'
import { SCENES } from '../scenes.ts'
import { CLEAR, viewsInWindow, viewVar } from '../terminal.ts'
import { POSITIONS } from '../theme.ts'
import { edit } from '../tui/field.ts'
import { CELL_QUERY, CellProbe, type Inbound, type Mouse } from '../tui/keys.ts'
import { FOCUS, HIDE_CURSOR, NO_WRAP, PASTES, pointing, type Terminal, within } from '../tui/terminal.ts'
import type { Hit } from '../tui/zones.ts'
import { blurOf, coloringFor, settingDefault, withSetting } from '../wiring.ts'
import { kinKeys, near, type Shape, sameKeys, sameSet } from '../works.ts'
import {
  type Clip,
  type Got,
  Grabber,
  LOCAL,
  type Loaded,
  loadRef,
  localId,
  normalize,
  pastedRefs,
  peekClipboard,
  readClipboard,
  remember,
  remote,
  sourceLabel,
  typedDrop,
} from './attach.ts'
import { Kept } from './kept.ts'
import { Paint } from './paint.ts'
import {
  type Count,
  DIGITS,
  type FindSpot,
  type FindView,
  gridShape,
  HELD,
  type Held,
  heldFit,
  type Info,
  MIN,
  type Order,
  pageOf,
  type Row,
  type Setting,
  type Stage,
  stepped,
  TILE,
  type Tile,
  type TunePanel,
  type Tuning,
} from './screen.ts'

const SETTINGS: Setting[] = [
  {
    name: 'TTHEME_FIND_RATING',
    label: 'Rating',
    about: 'The ratings to list, each site read in its own words — space ticks one, and one stays ticked',
    choices: RATINGS,
    multi: { read: ratingSet },
  },
  {
    name: 'TTHEME_FIND_BLOCK',
    label: 'Block',
    about: 'Posts tagged with nudity or underwear are left out — space unticks one',
    choices: BLOCKS,
    multi: { read: blockSet, none: 'none' },
  },
  {
    name: 'TTHEME_FIND_POSTS',
    label: 'Posts',
    about: 'Every post of the character, or only the transparent cutouts',
    choices: ['all', 'cutouts'],
  },
  {
    name: 'TTHEME_FIND_SOLO',
    label: 'Solo',
    about:
      'When on, only the posts known to show the character alone — checked as posts arrive, so the counts below leave it out',
    choices: ['on', 'off'],
  },
  {
    name: 'TTHEME_FIND_ORDER',
    label: 'Order',
    about: 'How posts are ranked: fit, by how well each makes a backdrop; newest; or score',
    choices: ['fit', 'newest', 'score'],
  },
  {
    name: 'TTHEME_FIND_SETS',
    label: 'Sets',
    about: 'One picture posted over and over, or held by another site too: fold it into one tile, or show each',
    choices: ['fold', 'show'],
  },
  ...(canRemoveBackground()
    ? [
        {
          name: 'TTHEME_FIND_REMOVE_BG',
          label: 'Remove bg',
          about: 'Cut the character out of an opaque picture you try on, with macOS Vision',
          choices: ['on', 'off'],
        },
      ]
    : []),
  {
    name: 'TTHEME_FIND_MIN_SCORE',
    label: 'Min score',
    about:
      'Posts scored at least this — danbooru, konachan and yande.re; zerochan keeps no score. ←→ steps, or type any number',
    choices: SCORES,
    entry: 'number',
    advanced: true,
  },
  {
    name: 'TTHEME_FIND_MIN_SIZE',
    label: 'Min size',
    about: 'The shorter side of a picture, in px — every site filters it. ←→ steps, or type any number',
    choices: SIZES,
    entry: 'number',
    advanced: true,
  },
  {
    name: 'TTHEME_FIND_SITES',
    label: 'Sites',
    about: 'The sites the all tab mixes — each keeps its own tab. Space ticks one, and one stays ticked',
    choices: SITES.map((site) => site.name),
    multi: { read: siteSet },
    advanced: true,
  },
  {
    name: 'TTHEME_FIND_HIDE',
    label: 'Hide',
    about: "Comics, monochrome, sketches or chibi, told by tag in every site's spelling — checked as posts arrive",
    choices: KINDS,
    multi: { read: kindSet, none: 'none' },
    advanced: true,
  },
  {
    name: 'TTHEME_FIND_HIDE_TAGS',
    label: 'Hide tags',
    about: 'Posts with any of these tags are left out, spaced like cosplay multiple_girls — checked as posts arrive',
    choices: [],
    entry: 'text',
    advanced: true,
  },
  {
    name: 'TTHEME_FIND_PNG',
    label: 'PNG only',
    about:
      'PNG originals only — danbooru counts it, the others are told by the file; zerochan only where danbooru holds it',
    choices: ['off', 'on'],
    advanced: true,
  },
]

function initial(setting: Setting, raw: string | undefined): string {
  if (setting.multi) {
    return setting.multi.read(raw).join(' ') || (setting.multi.none as string)
  }
  if (setting.entry === 'number') {
    return /^\d+$/.test(raw ?? '') && Number(raw) > 0 ? String(Number(raw)) : 'off'
  }
  if (setting.entry === 'text') {
    return tagList(raw).join(' ')
  }
  return setting.choices.find((choice) => choice === raw) ?? (setting.choices[0] as string)
}

interface Terms {
  tag: string
  chosen?: string[]
  preset: FindView['preset']
  order: FindView['order']
  rating: FindView['rating']
  narrow: FindView['narrow']
  enabled: FindView['enabled']
}

const ORDERS: Order[] = ['fit', 'newest', 'score']

function orderOf(value: string): Order {
  return ORDERS.find((order) => order === value) ?? 'fit'
}

const STEPS: Record<string, number> = { left: -1, right: 1, 'shift-left': -10, 'shift-right': 10 }

function visit(url: string): void {
  if (process.env.SSH_CONNECTION || !/^(?:https?|file):/i.test(url)) {
    return
  }
  try {
    const opener = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], {
      stdio: 'ignore',
      detached: true,
    })
    opener.on('error', () => {})
    opener.unref()
  } catch {}
}

function resized(size: Tuning['size'], step: number, fill: number): Tuning['size'] {
  if (step < 0) {
    if (size !== 'fill') {
      return Math.max(SMALLEST, size + step)
    }
    if (!fill) {
      return size
    }
    return Math.max(SMALLEST, Math.max(100, fill) + step + 1)
  }
  return size === 'fill' || size + step > fill ? 'fill' : size + step
}

function sameTuning(a: Tuning, b: Tuning): boolean {
  return a.size === b.size && a.at === b.at && a.opacity === b.opacity
}

function toTune(tune: Tuning, untuned: Tuning): Tune | undefined {
  if (sameTuning(tune, untuned)) {
    return undefined
  }
  return {
    ...(tune.size !== 'fill' ? { size: tune.size } : {}),
    ...(tune.at !== untuned.at ? { position: POSITIONS[tune.at - 1] } : {}),
    ...(tune.opacity !== untuned.opacity ? { opacity: tune.opacity } : {}),
  }
}

function heldOf(home: string, name: string): Held[] {
  const dir = backgroundsDir(home)
  return rackOf(home, name).flatMap((picture, i): Held[] => {
    const [, key, id] = /^([a-z.]+)_(\d+)$/.exec(picture.key) ?? []
    const site = [...SITES, LOCAL].find((s) => s.key === key)
    if (!site || !id) {
      return []
    }
    return [
      {
        key: picture.key,
        id: Number(id),
        ansi: site.ansi,
        ...(site === LOCAL ? {} : { page: site.pageUrl(Number(id)) }),
        up: i === 0,
        from: join(dir, picture.original ?? picture.fill),
      },
    ]
  })
}

function completable(token: string): boolean {
  return token.length >= 2 && !/^\d+$/.test(token) && !token.includes('://') && !/^[\w.]+:\d+$/.test(token)
}

const PROBE = 12
const ALL_ANSI = 4
const SUGGEST_WAIT = 150
const COUNT_WAIT = 300
const THUMB = 12
const PRELOAD = 2
const PROFILE_WAIT = 5000
const SETTLE = 150
const FEATURES = '\x1b[?5522$p\x1b]72;t=q\x1b\\\x1b[c'
const NOTICE = 4000
const PEEK = 8000
const PICTURE = /\.(png|jpe?g|gif|webp|heic|tiff?|bmp)$/i
const PASTE_KEY = process.platform === 'win32' ? 'alt+v' : 'ctrl+v'
const SCREENSHOT = process.platform === 'darwin' ? 'ctrl+shift+cmd+4 copies a screenshot' : 'copy a picture first'
const TRY_WIDTH = 1280
const TUNED_HELD = 16
const TOP_RIGHT = POSITIONS.indexOf('top-right') + 1
const SMALLEST = 20
const LOOKAHEAD = 2
const KNOWN = 3
const SPOKEN = /[\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u
const SUGGESTED = 8
const CHIPS = 9

interface Source {
  site: Site
  tags: string
  page: number
  done: boolean
}

interface Group {
  posts: Pick[]
  open: boolean
}

interface Board {
  key: string
  groups: Group[]
  sources: Source[]
  queue: Pick[]
  rounds: number
  roundOf: Map<Pick, number>
  last: Map<Source, { post: Post; set: string }>
  kin: Map<Pick, string[]>
  kindred: Map<string, Group>
  shapes: { shape: Shape; group: Group }[]
  seen: Set<number>
  same: Map<string, Pick>
  checked: number
  total: number
  focus: number
  top: number
  searching: boolean
  stage: Stage
  ranking?: { done: number; total: number }
  arrived: Set<string>
  error?: string
  note?: string
}

function blank(key: string, searching: boolean): Board {
  return {
    key,
    groups: [],
    sources: [],
    queue: [],
    rounds: 0,
    roundOf: new Map(),
    last: new Map(),
    kin: new Map(),
    kindred: new Map(),
    shapes: [],
    seen: new Set(),
    same: new Map(),
    checked: 0,
    total: 0,
    focus: 0,
    top: 0,
    searching,
    stage: 'fetch',
    arrived: new Set(),
  }
}

interface Current {
  site: Site
  id: number
  key: number
  path: string
  ext: string
  size: number
  cut?: string
  using: 'plain' | 'cut'
  failed: boolean
  fill?: number
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error)
  }
  if (error instanceof AggregateError && error.errors[0]) {
    return describe(error.errors[0])
  }
  if (error.cause) {
    return describe(error.cause)
  }
  const code: unknown = (error as NodeJS.ErrnoException).code
  if (typeof code === 'string') {
    return code
  }
  const first = (error.message || error.name).split('.')[0] ?? ''
  return first.length > 56 ? `${first.slice(0, 55)}…` : first
}

function reason(name: string, error: unknown): string {
  return `${name}: ${describe(error)}`
}

function area(post: Post): number {
  return post.width * post.height
}

function previewStem(id: number, url: string): string {
  return `${id}-${createHash('sha1').update(url).digest('hex').slice(0, 8)}`
}

class Finder {
  readonly view: FindView
  private readonly tone: Tone
  private readonly session = new AbortController()
  private cell = { w: 0, h: 0 }
  private cols = process.stdout.columns || 80
  private rows = process.stdout.rows || 24
  private gen = 0
  private pumping = 0
  private readonly boards = new Map<string, Board>()
  private board: Board
  private readonly posts = new Map<number, Pick>()
  private readonly thumbPath = new Map<number, string>()
  private readonly looking = new Map<number, Promise<Look | undefined>>()
  private readonly looked = new Map<number, Look>()
  private readonly matched = new Map<Post, number>()
  private aheading = false
  private readonly pages = new Map<string, Promise<Post[]>>()
  private tab = 0
  private readonly values = new Map<string, string>(
    SETTINGS.map((setting) => [setting.name, initial(setting, process.env[setting.name])]),
  )
  private direction = 1
  private prefetching = 0
  private readonly related = new Map<string, string[]>()
  private pool: string[] = []
  private relating?: AbortController
  private thumbQueue: Pick[] = []
  private readonly heldFiles = new Map<string, string>()
  private readonly heldAsked = new Set<string>()
  private thumbing = 0
  private readonly clarity = new Map<string, Shown>()
  private readonly tunedFiles: string[] = []
  private presenting = false
  private again = false
  private readonly renders = new Renderer()
  private showing?: Board
  private readonly thumbless = new Set<number>()
  private current?: Current
  private fetch?: AbortController
  private settle?: NodeJS.Timeout
  private suggestTimer?: NodeJS.Timeout
  private suggesting?: AbortController
  private countTimer?: NodeJS.Timeout
  private counting?: AbortController
  private terminal?: Terminal
  private readonly grabber = new Grabber(
    (text) => this.write(text),
    (got) => void this.got(got),
  )
  private noticeTimer?: NodeJS.Timeout
  private peekTimer?: NodeJS.Timeout
  private peeked?: string
  private attaching?: AbortController
  private done?: (code: number) => void
  private readonly scratch = mkdtempSync(join(tmpdir(), 'ttheme-find-'))

  private readonly home: string
  private readonly manifest: Manifest
  private readonly entry: PaletteEntry
  private readonly tagged: ReadonlySet<string>
  private readonly blurring: number
  private readonly start: Start | undefined
  private readonly paint: Paint
  private readonly kept: Kept

  constructor(home: string, manifest: Manifest, entry: PaletteEntry, tag: string, start?: Start) {
    this.start = start
    this.home = home
    this.manifest = manifest
    this.entry = entry
    this.tagged = new Set(manifest.palettes.flatMap((p) => (p.booru ? [p.booru] : [])))
    this.tone = backdropTone(entry, entry.signatureSlots)
    this.blurring = blurOf(home)
    const untuned: Tuning = { size: 'fill', at: TOP_RIGHT, opacity: this.tone.opacity }
    this.view = {
      palette: entry.name,
      tag,
      site: this.tabName,
      siteAnsi: this.tabAnsi,
      nextSite: this.nextTabName,
      preset: this.setting('TTHEME_FIND_POSTS') === 'all' ? 'all' : 'cutouts',
      order: orderOf(this.setting('TTHEME_FIND_ORDER')),
      solo: this.setting('TTHEME_FIND_SOLO') === 'on',
      rating: ratingSet(this.setting('TTHEME_FIND_RATING')),
      block: blockSet(this.setting('TTHEME_FIND_BLOCK')),
      sets: this.setting('TTHEME_FIND_SETS') === 'show' ? 'show' : 'fold',
      narrow: this.narrowed(),
      enabled: siteSet(this.setting('TTHEME_FIND_SITES')),
      hide: kindSet(this.setting('TTHEME_FIND_HIDE')),
      hideTags: tagList(this.setting('TTHEME_FIND_HIDE_TAGS')),
      advanced: false,
      settings: SETTINGS.map((setting) => ({
        label: setting.label,
        choices: [...setting.choices],
        value: this.setting(setting.name),
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
      help: false,
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
    }
    this.paint = new Paint({
      view: this.view,
      grid: () => ({ cols: this.cols, rows: this.rows, cell: this.cell }),
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
        this.show()
        this.inform()
        this.paint.draw()
      },
    })
    this.pool = this.selected(this.view)
    this.syncChips()
    this.board = blank(this.boardKey, tag !== '')
    this.boards.set(this.board.key, this.board)
  }

  private get signal(): AbortSignal {
    return this.session.signal
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

  private frame(): Frame {
    return { w: this.cols * (this.cell.w || 10), h: this.rows * (this.cell.h || 20) }
  }

  private setting(name: string): string {
    return this.values.get(name) as string
  }

  private narrowed(): Narrow {
    return narrowOf(
      this.setting('TTHEME_FIND_MIN_SCORE'),
      this.setting('TTHEME_FIND_MIN_SIZE'),
      this.setting('TTHEME_FIND_PNG'),
    )
  }

  private get boardKey(): string {
    return `${this.site?.key ?? 'all'}|${this.view.preset}|${this.view.order}`
  }

  private origPath(site: Site, id: number, ext: string): string {
    return join(cacheDir(site), 'orig', `${id}.${ext}`)
  }

  private previewPath(pick: Pick): string {
    const { url } = previewOf(pick.site, pick.post)
    return join(cacheDir(pick.site), 'thumb', `${previewStem(pick.post.id, url)}.${extension(url)}`)
  }

  private tileOf(pick: Pick, variants: number): Tile {
    const { site, post } = pick
    const key = postKey(site, post.id)
    const version = rendition(post) ?? post
    return {
      id: post.id,
      key,
      site: site.name,
      siteAnsi: site.ansi,
      width: version.width,
      height: version.height,
      reduced: version !== post,
      page: site === LOCAL ? '' : site.pageUrl(post.id),
      artist: site === LOCAL ? sourceLabel(post.source) : (post.named.artist[0] ?? ''),
      score: post.score,
      variants,
      mates: this.kept.matesOf(site, post.owner),
      thumb: this.thumbPath.get(key),
      missing: this.thumbless.has(key),
    }
  }

  private show(): void {
    const view = this.view
    const board = this.board
    view.tiles = board.groups.flatMap((group) =>
      group.open
        ? group.posts.map((pick) => this.tileOf(pick, 0))
        : [this.tileOf(group.posts[0] as Pick, group.posts.length)],
    )
    view.checked = board.checked
    view.total = board.total
    view.searching = board.searching
    this.stageOf(board)
    view.note = board.note
    view.focus = Math.max(0, Math.min(board.focus, view.tiles.length - 1))
    view.top = board.top
    if (this.showing !== board) {
      this.showing = board
      this.paint.snap()
    }
  }

  private stageOf(board: Board): void {
    const view = this.view
    view.stage = board.stage
    view.ranking = board.ranking
    view.sites = this.sites.map((site) => ({ name: site.name, arrived: board.arrived.has(site.name) }))
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
      setTimeout(primeNames, 0)
      try {
        const probe = new CellProbe()
        const cell = await terminal.ask(CELL_QUERY, (event) => probe.see(event), 1000)
        if (cell) {
          this.cell = cell
          this.holdThumbs()
          if (this.view.tag) {
            void this.search()
            void this.relate(this.view.tag)
          }
        } else {
          this.view.searching = false
          this.view.error = 'This terminal does not report its cell size — find needs kitty graphics'
        }
        if (!process.env.TMUX) {
          await terminal.ask(FEATURES, (event) => (event.kind === 'attributes' ? true : undefined), 500, false)
        }
        this.grabber.start()
        terminal.hold(FOCUS)
        if (this.start && 'paste' in this.start) {
          this.pasted(this.start.paste)
        } else if (this.start) {
          void this.fromClipboard()
        } else {
          void this.peek()
        }
        this.paint.draw()
        return await terminal.until(exit)
      } finally {
        this.session.abort()
        this.grabber.stop()
        this.attaching?.abort()
        clearTimeout(this.noticeTimer)
        clearTimeout(this.peekTimer)
        this.fetch?.abort()
        clearTimeout(this.settle)
        this.quietSuggest()
        this.quietCount()
        clearInterval(clock)
        this.paint.stop()
        terminal.write(`\x1b_Ga=d,d=A,q=2\x1b\\${CLEAR}`)
        this.kept.save()
        this.renders.close()
        rmSync(this.scratch, { recursive: true, force: true })
        sweepCache()
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
      this.pasted(event.text)
    } else if (event.kind === 'mode') {
      if (event.mode === 5522) {
        this.grabber.clipboard = event.value !== 0 && event.value !== 4
      }
    } else if (event.kind === 'osc') {
      if (event.code === '72' && event.meta.t === 'q') {
        this.grabber.drops = true
      } else {
        this.grabber.take(event)
      }
    }
  }

  private pasted(text: string): void {
    const view = this.view
    if (view.editing !== undefined && text.trim() !== '' && !this.picture(text)) {
      view.editing += text.replace(/[\r\n]+/g, ' ')
      this.suggest()
      this.paint.draw()
      return
    }
    if (view.installing !== undefined || view.panel !== undefined || view.help) {
      return
    }
    if (text.trim() === '') {
      void this.fromClipboard()
      return
    }
    void this.attach(text)
  }

  private picture(text: string): boolean {
    const trimmed = text.trim()
    if (/^https?:\/\/\S+$/i.test(trimmed)) {
      return !postRef(trimmed, this.site ?? (SITES[0] as Site))
    }
    return pastedRefs(trimmed).length > 0
  }

  private async got(got: Got): Promise<void> {
    if (got.kind === 'error') {
      this.notice(got.message)
      return
    }
    if (got.kind === 'text') {
      if (got.text.trim() === '') {
        this.notice(`No picture on the clipboard — ${SCREENSHOT}`)
        return
      }
      this.pasted(got.text)
      return
    }
    await this.bring(() => normalize(got.bytes, got.source))
  }

  private notice(text: string, ms = NOTICE): void {
    const view = this.view
    view.error = text
    clearTimeout(this.noticeTimer)
    this.noticeTimer = setTimeout(() => {
      if (view.error === text) {
        view.error = undefined
        this.paint.draw()
      }
    }, ms)
    this.paint.draw()
  }

  private async peek(): Promise<void> {
    const view = this.view
    let seen: Awaited<ReturnType<typeof peekClipboard>>
    try {
      seen = await peekClipboard()
    } catch {
      return
    }
    if (!seen || seen.stamp === this.peeked) {
      return
    }
    this.peeked = seen.stamp
    if (!seen.picture || view.installing !== undefined) {
      return
    }
    view.hint = `Picture on the clipboard · ${PASTE_KEY} uses it`
    clearTimeout(this.peekTimer)
    this.peekTimer = setTimeout(() => {
      view.hint = undefined
      this.paint.draw()
    }, PEEK)
    this.paint.draw()
  }

  private async fromClipboard(): Promise<void> {
    const view = this.view
    if (remote()) {
      if (this.grabber.clipboard) {
        this.grabber.ask()
        return
      }
      this.notice('Over SSH the clipboard is not here — drop the file')
      return
    }
    let clip: Clip
    try {
      clip = await readClipboard(join(this.scratch, `clipboard-${Date.now()}.png`))
    } catch (error) {
      this.notice(`Could not read the clipboard: ${describe(error)}`)
      return
    }
    clearTimeout(this.peekTimer)
    view.hint = undefined
    if ('image' in clip) {
      await this.bring(async (signal) => ({ ...(await loadRef(clip.image, signal)), source: 'clipboard' }))
      return
    }
    const text = clip.text.trim()
    if (!text) {
      this.notice(`No picture on the clipboard — ${SCREENSHOT}`)
      return
    }
    if (this.picture(text)) {
      await this.attach(text)
      return
    }
    if (view.editing === undefined) {
      view.editing = ''
    }
    this.pasted(text)
  }

  private async attach(text: string): Promise<void> {
    const trimmed = text.trim()
    if (/^https?:\/\//i.test(trimmed)) {
      const ref = postRef(trimmed, this.site ?? (SITES[0] as Site))
      if (ref) {
        await this.jump(ref.site, ref.id)
        return
      }
    }
    const [first, ...more] = pastedRefs(trimmed).sort((a, b) => Number(!PICTURE.test(a)) - Number(!PICTURE.test(b)))
    if (!first) {
      this.notice('Nothing to use in that — drop a picture, or paste one or its link')
      return
    }
    await this.bring((signal) => loadRef(first, signal), more.length)
  }

  private async bring(load: (signal: AbortSignal) => Promise<Loaded>, skipped = 0): Promise<void> {
    const view = this.view
    this.attaching?.abort()
    const control = new AbortController()
    this.attaching = control
    view.error = undefined
    view.saved = undefined
    view.note = 'Reading the picture…'
    this.paint.draw()
    let image: Loaded
    try {
      image = await load(AbortSignal.any([control.signal, this.signal]))
    } catch (error) {
      if (!control.signal.aborted) {
        view.note = undefined
        this.notice(describe(error), 8000)
      }
      return
    }
    if (control.signal.aborted) {
      return
    }
    view.note = skipped > 0 ? `The first picture of ${skipped + 1} — drop one at a time to try the others` : undefined
    this.quietSuggest()
    view.editing = undefined
    view.suggest = undefined
    view.pick = undefined
    const id = localId(image.bytes)
    remember(id, image.source)
    const orig = this.origPath(LOCAL, id, image.ext)
    writeAtomic(orig, image.bytes)
    const url = pathToFileURL(orig).href
    const post: Post = {
      id,
      file: url,
      width: image.width,
      height: image.height,
      ext: image.ext,
      preview: url,
      owner: '',
      score: 0,
      rating: 's',
      md5: createHash('md5').update(image.bytes).digest('hex'),
      source: image.source,
      tags: [],
      named: { artist: [], character: [], copyright: [] },
      solo: undefined,
      family: 0,
      smaller: [],
    }
    const pick = { site: LOCAL, post }
    const preview = this.previewPath(pick)
    writeAtomic(preview, image.bytes)
    ++this.gen
    this.current = undefined
    view.shown = undefined
    const board = blank(`local|post:${id}`, false)
    this.board = board
    this.boards.set(board.key, board)
    this.single(board, pick)
  }

  private single(board: Board, pick: Pick): void {
    board.searching = false
    this.posts.set(postKey(pick.site, pick.post.id), pick)
    board.groups = [{ posts: [pick], open: false }]
    board.checked = 1
    board.total = 1
    this.thumbQueue.push(pick)
    this.thumbs()
    this.view.mode = 'try'
    this.show()
    this.select()
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
    this.holdThumbs()
    this.scroll()
    this.paint.snap()
    if (this.view.mode === 'try' && this.current) {
      this.reveal()
    }
    void this.pump()
    this.paint.draw()
  }

  private key(key: string): void {
    const view = this.view
    if (key === 'ctrl-c') {
      this.finish(2)
      return
    }
    if (view.installing !== undefined) {
      return
    }
    if (key === 'focus-in') {
      void this.peek()
      return
    }
    if (key === 'focus-out') {
      return
    }
    if ((key === 'ctrl-v' || key === 'alt-v') && view.panel === undefined) {
      void this.fromClipboard()
      return
    }
    if (view.editing !== undefined) {
      this.editKey(key)
      return
    }
    if (view.panel !== undefined) {
      this.panelKey(key)
      return
    }
    if (view.help) {
      if (key === '?' || key === 'esc') {
        view.help = false
        this.paint.draw()
      }
      return
    }
    if (this.cols < MIN.cols || this.rows < MIN.rows) {
      if (key === 'esc') {
        this.finish(2)
      }
      return
    }
    if (key === '?') {
      view.help = true
      this.paint.draw()
      return
    }
    if (view.mode === 'try') {
      this.tryKey(key)
      return
    }
    this.gridKey(key)
  }

  private pointer(event: Mouse): void {
    const view = this.view
    const hit = this.paint.point(event)
    const spot = hit?.target as FindSpot | undefined
    if (view.installing !== undefined) {
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
      this.slide(spot.field, hit)
    } else if (event.action === 'press') {
      this.pressed(spot)
    } else if (event.action === 'release' && hit?.inside) {
      this.released(spot, event)
    }
  }

  private pressed(spot: FindSpot | undefined): void {
    const view = this.view
    if (view.help) {
      this.paint.drop()
      this.key('esc')
    } else if (view.editing !== undefined || spot === undefined) {
      return
    } else if (view.panel !== undefined) {
      if (spot.kind === 'setting' && spot.index < view.settings.length && view.typing === undefined) {
        view.panel = spot.index
        this.paint.draw()
      }
    } else if (view.mode === 'try') {
      this.tryPoint(spot)
    } else if (spot.kind === 'tile') {
      this.focus(spot.index)
    } else if (spot.kind === 'query') {
      this.gridKey('/')
    } else if (spot.kind === 'site') {
      this.tab = spot.tab
      this.syncSite()
      void this.turn()
    }
  }

  private released(spot: FindSpot | undefined, event: Mouse): void {
    const view = this.view
    if (spot?.kind === 'key') {
      this.key(spot.key)
    } else if (spot?.kind === 'link') {
      if (!event.shift && !event.alt && !event.ctrl) {
        visit(spot.url)
      }
    } else if (view.editing !== undefined) {
      if (spot?.kind === 'suggest') {
        view.pick = spot.index
        this.editKey('enter')
      }
    } else if (view.panel !== undefined) {
      this.panelPoint(spot)
    } else if (view.mode === 'try') {
      if (spot?.kind === 'place' && view.tuning) {
        this.tuneKey(String(spot.at))
      }
    } else if (spot?.kind === 'tile' && event.count === 2) {
      this.gridKey('enter')
    } else if (spot?.kind === 'chip') {
      this.toggle(spot.index)
    }
  }

  private wheel(step: number): void {
    const view = this.view
    if (view.help) {
      return
    }
    if (view.editing !== undefined) {
      if (view.suggest?.length) {
        this.editKey(step < 0 ? 'up' : 'down')
      }
    } else if (view.panel !== undefined) {
      if (view.typing === undefined) {
        this.panelKey(step < 0 ? 'up' : 'down')
      }
    } else if (view.tuning) {
      this.tuneKey(step < 0 ? 'up' : 'down')
    } else if (view.mode === 'try') {
      this.tryKey(step < 0 ? 'left' : 'right')
    } else {
      this.focus(view.focus + step * gridShape(this.cols, this.rows).perRow)
    }
  }

  private panelPoint(spot: FindSpot | undefined): void {
    const view = this.view
    if (spot?.kind !== 'setting' && spot?.kind !== 'choice') {
      return
    }
    const row = view.settings[spot.index]
    if (view.typing !== undefined) {
      const typed = view.settings[view.panel ?? 0]
      if (typed && (spot.index !== view.panel || spot.kind === 'setting')) {
        this.typeKey(typed, 'enter')
      } else {
        return
      }
    }
    if (spot.kind === 'setting' && spot.index === view.settings.length) {
      view.panel = spot.index
      this.panelKey('enter')
      return
    }
    view.panel = spot.index
    if (spot.kind === 'choice' && row) {
      if (row.entry === 'text' || spot.choice === undefined) {
        this.panelKey('enter')
        return
      }
      if (row.multi) {
        row.cursor = Math.max(0, row.choices.indexOf(spot.choice))
        this.panelKey(' ')
        return
      }
      if (row.value !== spot.choice) {
        row.value = spot.choice
        this.recount()
      }
    }
    this.paint.draw()
  }

  private tryPoint(spot: FindSpot): void {
    const view = this.view
    if (spot.kind === 'scene') {
      view.scene = spot.scene
      view.details = false
      this.paint.draw()
    } else if (view.tuning && spot.kind === 'field') {
      view.tuning.field = spot.field
      this.paint.draw()
    }
  }

  private slide(field: number, hit: Hit): void {
    const view = this.view
    const panel = view.tuning
    if (!panel) {
      return
    }
    const along = Math.min(1, Math.max(0, hit.width > 1 ? hit.x / (hit.width - 1) : 0))
    panel.field = field
    if (field === 0) {
      const top = Math.max(100, panel.fill)
      const size = SMALLEST + Math.round(along * (top - SMALLEST + 1))
      view.tune.size = along === 1 || (panel.fill > 0 && size >= panel.fill) ? 'fill' : Math.min(top, size)
    } else {
      view.tune.opacity = Math.round(along * 100) / 100
    }
    this.retune()
  }

  private gridKey(key: string): void {
    const view = this.view
    const { perRow, rowsVis } = gridShape(this.cols, this.rows)
    const moves: Record<string, number> = {
      left: -1,
      right: 1,
      up: -perRow,
      down: perRow,
      k: -perRow,
      j: perRow,
      pgup: -perRow * rowsVis,
      pgdn: perRow * rowsVis,
      home: -view.focus,
      end: view.tiles.length,
    }
    const move = moves[key]
    if (move !== undefined) {
      this.focus(view.focus + move)
      return
    }
    if (/^[1-9]$/.test(key)) {
      this.toggle(Number(key) - 1)
      return
    }
    if (key === 'enter' && view.tiles[view.focus]) {
      view.mode = 'try'
      view.error = undefined
      this.select()
      return
    }
    if (key === 'v') {
      void this.fromClipboard()
      return
    }
    if (key === 'c') {
      view.preset = view.preset === 'cutouts' ? 'all' : 'cutouts'
      void this.turn()
      return
    }
    if (key === 'tab' || key === 'shift-tab') {
      const tabs = SITES.length + 1
      this.tab = (this.tab + (key === 'tab' ? 1 : tabs - 1)) % tabs
      this.syncSite()
      void this.turn()
      return
    }
    if (key === '/') {
      view.editing = ''
      this.paint.draw()
      return
    }
    if (key === ' ') {
      this.unfold()
      return
    }
    if (key === 'o' || key === 'O') {
      this.openPage(key === 'O')
      return
    }
    if (key === 's') {
      view.panel = 0
      view.advanced = false
      this.recount()
      this.paint.draw()
      return
    }
    if (key === 'esc') {
      this.finish(2)
    }
  }

  private panelKey(key: string): void {
    const view = this.view
    const at = view.panel ?? 0
    const row = view.settings[at]
    if (view.typing !== undefined && row) {
      this.typeKey(row, key)
      return
    }
    const page = pageOf(view)
    if (key === 'up' || key === 'down') {
      const k = page.indexOf(at) + (key === 'up' ? -1 : 1)
      view.panel = page[(k + page.length) % page.length] ?? at
      this.paint.draw()
      return
    }
    if (key === 'a' || (key === 'enter' && at === view.settings.length)) {
      view.advanced = !view.advanced
      view.panel = pageOf(view)[0] ?? 0
      this.paint.draw()
      return
    }
    if (row?.entry && (key === 'enter' || (row.entry === 'number' && /^[0-9]$/.test(key)))) {
      view.typing = key === 'enter' ? (row.entry === 'text' ? row.value : '') : key
      this.paint.draw()
      return
    }
    if ((key === 'left' || key === 'right') && row && row.entry !== 'text') {
      const step = key === 'left' ? -1 : 1
      if (row.multi) {
        row.cursor = (row.cursor + step + row.choices.length) % row.choices.length
      } else {
        row.value = stepped(row.choices, row.value, step)
        this.recount()
      }
      this.paint.draw()
      return
    }
    if (key === ' ' && row?.multi) {
      const on = row.value.split(' ')
      const next = row.choices.filter((choice, k) => (k === row.cursor ? !on.includes(choice) : on.includes(choice)))
      const empty = row.multi.none
      if (next.length > 0 || empty !== undefined) {
        row.value = next.length > 0 ? next.join(' ') : (empty as string)
        this.recount()
        this.paint.draw()
      }
      return
    }
    if (key === 'esc') {
      view.settings.forEach((setting, i) => {
        setting.value = this.setting(SETTINGS[i]?.name ?? '')
      })
      view.panel = undefined
      view.advanced = false
      this.quietCount()
      this.paint.draw()
      return
    }
    if (key === 'enter' || key === 's' || key === 'alt-c') {
      view.panel = undefined
      view.advanced = false
      this.quietCount()
      this.adopt()
    }
  }

  private typeKey(row: Row, key: string): void {
    const view = this.view
    const typed = view.typing ?? ''
    if (key === 'esc') {
      view.typing = undefined
      this.paint.draw()
      return
    }
    if (key === 'enter' || key === 'up' || key === 'down') {
      row.value =
        row.entry === 'number' ? (Number(typed) > 0 ? String(Number(typed)) : 'off') : tagList(typed).join(' ')
      view.typing = undefined
      this.recount()
      if (key === 'enter') {
        this.paint.draw()
        return
      }
      this.panelKey(key)
      return
    }
    const next = edit(typed, key, (ch) =>
      row.entry === 'number' ? /^[0-9]$/.test(ch) && typed.length < DIGITS : /^[\x20-\x7e]$/.test(ch),
    )
    if (next !== undefined) {
      view.typing = next
      this.paint.draw()
    }
  }

  private quietCount(): void {
    clearTimeout(this.countTimer)
    this.counting?.abort()
    this.counting = undefined
  }

  private recount(): void {
    this.quietCount()
    this.view.counts = undefined
    if (!this.view.tag) {
      return
    }
    const asked = new AbortController()
    this.counting = asked
    this.countTimer = setTimeout(() => void this.countPending(asked), COUNT_WAIT)
  }

  private pending(): Terms {
    const value = (name: string) =>
      this.view.settings[SETTINGS.findIndex((setting) => setting.name === name)]?.value ?? this.setting(name)
    return {
      tag: this.view.tag,
      chosen: this.view.chosen,
      preset: value('TTHEME_FIND_POSTS') === 'all' ? 'all' : 'cutouts',
      order: orderOf(value('TTHEME_FIND_ORDER')),
      rating: ratingSet(value('TTHEME_FIND_RATING')),
      narrow: narrowOf(value('TTHEME_FIND_MIN_SCORE'), value('TTHEME_FIND_MIN_SIZE'), value('TTHEME_FIND_PNG')),
      enabled: siteSet(value('TTHEME_FIND_SITES')),
    }
  }

  private async countPending(asked: AbortController): Promise<void> {
    const terms = this.pending()
    const sites = this.site ? [this.site] : SITES.filter((site) => terms.enabled.includes(site.name))
    const signal = AbortSignal.any([this.signal, asked.signal])
    const counts = await Promise.all(
      sites.map(async (site): Promise<Count> => {
        const plan = this.query(site, terms)
        if (!plan) {
          return { site: site.name, count: 0 }
        }
        if (site.counts && !site.counts(plan.tags)) {
          return { site: site.name }
        }
        try {
          const count = await fetchCount(site, plan.tags, signal)
          return { site: site.name, ...(Number.isFinite(count) ? { count } : {}) }
        } catch {
          return { site: site.name }
        }
      }),
    )
    if (this.counting === asked && this.view.panel !== undefined) {
      this.view.counts = counts
      this.paint.draw()
    }
  }

  private adopt(): void {
    const view = this.view
    const before = SETTINGS.map((setting) => this.setting(setting.name))
    view.settings.forEach((row, i) => {
      const setting = SETTINGS[i]
      if (setting) {
        this.values.set(setting.name, row.value)
      }
    })
    const changed = SETTINGS.filter((setting, i) => this.setting(setting.name) !== before[i])
    if (changed.length === 0) {
      this.paint.draw()
      return
    }
    this.save(changed)
    view.rating = ratingSet(this.setting('TTHEME_FIND_RATING'))
    view.block = blockSet(this.setting('TTHEME_FIND_BLOCK'))
    view.sets = this.setting('TTHEME_FIND_SETS') === 'show' ? 'show' : 'fold'
    view.preset = this.setting('TTHEME_FIND_POSTS') === 'all' ? 'all' : 'cutouts'
    view.order = orderOf(this.setting('TTHEME_FIND_ORDER'))
    view.solo = this.setting('TTHEME_FIND_SOLO') === 'on'
    view.narrow = this.narrowed()
    view.enabled = siteSet(this.setting('TTHEME_FIND_SITES'))
    view.hide = kindSet(this.setting('TTHEME_FIND_HIDE'))
    view.hideTags = tagList(this.setting('TTHEME_FIND_HIDE_TAGS'))
    this.boards.clear()
    this.current = undefined
    view.shown = undefined
    view.mode = 'grid'
    void this.search()
  }

  private save(changed: Setting[]): void {
    this.store(changed.map((setting) => [setting.name, this.setting(setting.name)]))
  }

  private store(pairs: [string, string][]): boolean {
    const path = join(this.home, 'ttheme', 'config.zsh')
    try {
      const before = existsSync(path) ? readFileSync(path, 'utf8') : ''
      writeAtomic(
        path,
        pairs.reduce((text, [name, value]) => withSetting(text, name, value), before),
      )
      return true
    } catch (error) {
      this.view.error = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  private editKey(key: string): void {
    const view = this.view
    const text = view.editing ?? ''
    const shown = view.suggest ?? []
    if ((key === 'up' || key === 'down') && shown.length > 0) {
      const at = view.pick ?? shown.length
      const next = (at + (key === 'down' ? 1 : shown.length)) % (shown.length + 1)
      view.pick = next === shown.length ? undefined : next
      this.paint.draw()
      return
    }
    if (key === 'esc' || key === 'enter') {
      this.quietSuggest()
    }
    if (key === 'esc') {
      view.editing = undefined
      if (view.tag === '') {
        this.finish(2)
        return
      }
      this.paint.draw()
      return
    }
    if (key === 'enter') {
      const picked = view.pick === undefined ? undefined : shown[view.pick]
      const chosen = picked ? (picked.whole ? picked.value : text.replace(/\S*$/, picked.value)) : text
      view.editing = undefined
      view.suggest = undefined
      view.pick = undefined
      if (chosen.trim()) {
        void this.commit(chosen.trim())
        return
      }
      if (view.tag === '') {
        this.finish(2)
        return
      }
      this.paint.draw()
      return
    }
    const next = edit(text, key)
    if (next !== undefined) {
      view.editing = next
      this.suggest()
      this.paint.draw()
    }
  }

  private quietSuggest(): void {
    clearTimeout(this.suggestTimer)
    this.suggesting?.abort()
    this.suggesting = undefined
  }

  private suggest(): void {
    this.quietSuggest()
    const view = this.view
    view.pick = undefined
    const text = view.editing ?? ''
    const token = /\S*$/.exec(text)?.[0] ?? ''
    const typed = completable(token)
    const named = nameHits(text, KNOWN, this.tagged).map((hit) => ({
      value: hit.tag,
      count: 0,
      alias: hit.name,
      whole: true,
    }))
    if (!typed && named.length === 0) {
      view.suggest = undefined
      return
    }
    const ours = typed
      ? booruTags(this.manifest.palettes, this.entry, token).map((p) => ({
          value: p.booru as string,
          count: 0,
          palette: p.name,
        }))
      : []
    const known = [...new Map([...ours.slice(0, KNOWN), ...named].map((item) => [item.value, item] as const)).values()]
    view.suggest = known.length > 0 ? known : undefined
    if (named.length > 0 && SPOKEN.test(text)) {
      view.pick = known.findIndex((item) => 'whole' in item)
    }
    if (!typed) {
      return
    }
    const asked = new AbortController()
    this.suggesting = asked
    this.suggestTimer = setTimeout(async () => {
      try {
        const found = await fetchSuggestions(token, AbortSignal.any([this.signal, asked.signal]))
        if (this.suggesting === asked && view.editing !== undefined) {
          const counts = new Map(found.map((item) => [item.value, item.count]))
          const names = new Set(known.map((item) => item.value))
          view.suggest = [
            ...known.map((item) => ({ ...item, count: counts.get(item.value) ?? 0 })),
            ...found.filter((item) => !names.has(item.value)),
          ].slice(0, SUGGESTED)
          view.pick = view.pick !== undefined && view.pick < known.length ? view.pick : undefined
          this.paint.draw()
        }
      } catch {}
    }, SUGGEST_WAIT)
  }

  private async commit(text: string): Promise<void> {
    const ref = postRef(text, this.site ?? (SITES[0] as Site))
    if (ref) {
      await this.jump(ref.site, ref.id)
      return
    }
    if (this.picture(text)) {
      await this.attach(text)
      return
    }
    this.view.tag = text
    this.view.chosen = undefined
    void this.relate(text)
    this.boards.clear()
    await this.search()
  }

  private async jump(site: Site, id: number): Promise<void> {
    const gen = ++this.gen
    this.tab = SITES.indexOf(site) + 1
    this.syncSite()
    this.current = undefined
    this.view.shown = undefined
    this.view.error = undefined
    const board = blank(`${site.key}|post:${id}`, true)
    this.board = board
    this.boards.set(board.key, board)
    this.show()
    this.paint.draw()
    try {
      const post = await fetchPost(site, id, this.signal)
      if (gen !== this.gen) {
        return
      }
      if (!post) {
        board.searching = false
        board.error = `${site.name} has no post ${id}`
        this.view.error = board.error
        this.show()
        this.paint.draw()
        return
      }
      this.single(board, { site, post })
    } catch (error) {
      this.fail(gen, error, site)
    }
  }

  private async turn(): Promise<void> {
    this.fetch?.abort()
    this.current = undefined
    this.view.shown = undefined
    const known = this.boards.get(this.boardKey)
    if (!known) {
      await this.search()
      return
    }
    this.gen++
    this.board = known
    this.view.error = known.error
    this.show()
    this.paint.draw()
    await this.pump()
  }

  private unfold(): void {
    const view = this.view
    let index = 0
    for (const group of this.board.groups) {
      const size = group.open ? group.posts.length : 1
      if (view.focus < index + size) {
        if (group.posts.length < 2) {
          return
        }
        group.open = !group.open
        this.board.focus = index
        for (const pick of group.posts) {
          if (!this.thumbPath.has(postKey(pick.site, pick.post.id))) {
            this.thumbQueue.push(pick)
          }
        }
        this.thumbs()
        this.show()
        this.scroll()
        this.paint.glide()
        this.paint.draw()
        return
      }
      index += size
    }
  }

  private openPage(post: boolean): void {
    const tile = this.view.tiles[this.view.focus]
    const pick = tile && this.posts.get(tile.key)
    if (!pick) {
      return
    }
    const source = sourcePage(pick.post.source)
    const page = pick.site === LOCAL ? '' : pick.site.pageUrl(pick.post.id)
    const url = !post && /^https?:\/\//i.test(source) ? source : page
    if (url) {
      visit(url)
    }
  }

  private tryKey(key: string): void {
    const view = this.view
    if (view.tuning) {
      this.tuneKey(key)
      return
    }
    if (key === 'left' || key === 'right') {
      this.direction = key === 'left' ? -1 : 1
      this.focus(view.focus + this.direction)
      return
    }
    if (key === 'shift-left' || key === 'shift-right') {
      view.scene += key === 'shift-left' ? -1 : 1
      view.details = false
      this.paint.draw()
      return
    }
    if (key === 'i') {
      view.details = !view.details
      this.inform()
      this.paint.draw()
      return
    }
    if (key === 't') {
      view.tuning = { field: 0, held: { ...view.tune }, fill: this.current?.fill ?? 0, coloring: view.coloring }
      this.paint.draw()
      return
    }
    if (key === 'c') {
      this.recolor()
      return
    }
    if (key === 'o' || key === 'O') {
      this.openPage(key === 'O')
      return
    }
    if (key === 'x') {
      this.swap()
      return
    }
    if (key === 'v') {
      void this.fromClipboard()
      return
    }
    if (key === 'enter') {
      void this.install()
      return
    }
    if (key === 'esc') {
      this.fetch?.abort()
      clearTimeout(this.settle)
      view.fetching = undefined
      view.mode = 'grid'
      view.error = undefined
      this.paint.draw()
    }
  }

  private tuneKey(key: string): void {
    const view = this.view
    const panel = view.tuning as TunePanel
    const tune = view.tune
    if (key === 'up' || key === 'down') {
      panel.field = (panel.field + (key === 'up' ? 2 : 1)) % 3
      this.paint.draw()
      return
    }
    const step = STEPS[key]
    if (step !== undefined) {
      if (panel.field === 0) {
        tune.size = resized(tune.size, step, panel.fill)
      } else if (panel.field === 1) {
        tune.at = ((tune.at - 1 + Math.sign(step) + 9) % 9) + 1
      } else {
        tune.opacity = Math.max(0, Math.min(100, Math.round(tune.opacity * 100) + step)) / 100
      }
      this.retune()
      return
    }
    if (/^[1-9]$/.test(key)) {
      panel.field = 1
      tune.at = Number(key)
      this.retune()
      return
    }
    if (key === '=') {
      const base = view.untuned
      if (panel.field === 0) {
        tune.size = base.size
      } else if (panel.field === 1) {
        tune.at = base.at
      } else {
        tune.opacity = base.opacity
      }
      this.retune()
      return
    }
    if (key === '+') {
      view.tune = { ...view.untuned }
      this.retune()
      return
    }
    if (key === 'enter') {
      view.tuning = undefined
      this.paint.draw()
      return
    }
    if (key === 'c') {
      this.recolor()
      return
    }
    if (key === 'esc') {
      view.tune = { ...panel.held, ...(panel.coloring === view.coloring ? {} : { opacity: view.untuned.opacity }) }
      view.tuning = undefined
      this.retune()
    }
  }

  private recolor(): void {
    const view = this.view
    if (!this.current || view.shown?.id !== this.current.key) {
      return
    }
    view.coloring = view.coloring === 'tone' ? 'original' : 'tone'
    view.tune.opacity = view.untuned.opacity
    this.paint.draw()
    this.reveal()
  }

  private retune(): void {
    this.paint.draw()
    if (this.current && this.view.shown?.id === this.current.key) {
      this.reveal()
    }
  }

  private inform(): void {
    const view = this.view
    const tile = view.tiles[view.focus]
    const pick = tile && this.posts.get(tile.key)
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
    this.board.focus = next
    this.scroll()
    this.paint.glide()
    void this.pump()
    if (view.mode === 'try') {
      this.select()
    }
    this.paint.draw()
  }

  private scroll(): void {
    const view = this.view
    const { perRow, rowsVis } = gridShape(this.cols, this.rows)
    const row = Math.floor(view.focus / perRow)
    if (row < view.top) {
      view.top = row
    }
    if (row > view.top + rowsVis - 1) {
      view.top = row - rowsVis + 1
    }
    this.board.top = view.top
  }

  private selected(terms: { tag: string; chosen?: string[] }): string[] {
    if (terms.chosen) {
      return terms.chosen
    }
    if (!terms.tag) {
      return []
    }
    return this.namesOf(terms.tag, 'danbooru')
  }

  private namesOf(tag: string, site: string): string[] {
    const owner = tag === this.entry.booru ? this.entry : this.manifest.palettes.find((p) => p.booru === tag)
    return owner ? siteTags(owner, site) : [tag]
  }

  private syncChips(): void {
    const on = this.selected(this.view)
    this.view.chips = this.pool.slice(0, CHIPS).map((name) => ({ name, on: on.includes(name) }))
  }

  private toggle(at: number): void {
    const view = this.view
    const chip = view.chips[at]
    if (!chip) {
      return
    }
    const on = this.selected(view)
    const chosen = chip.on ? on.filter((name) => name !== chip.name) : [...on, chip.name]
    if (chosen.length === 0) {
      return
    }
    view.chosen = chosen
    view.tag = chosen.join(' or ')
    this.syncChips()
    this.boards.clear()
    void this.search()
  }

  private async relate(tag: string): Promise<void> {
    this.relating?.abort()
    const names = this.selected({ tag, chosen: undefined })
    this.pool = names
    this.syncChips()
    this.paint.draw()
    if (!tag || /\s/.test(tag)) {
      return
    }
    let found = this.related.get(tag)
    if (!found) {
      const asked = new AbortController()
      this.relating = asked
      try {
        found = (await fetchRelated(tag, AbortSignal.any([this.signal, asked.signal]))).map((item) => item.value)
      } catch {
        return
      }
      if (this.relating !== asked) {
        return
      }
      this.related.set(tag, found)
    }
    this.pool = [...new Set([...names, ...found])]
    this.syncChips()
    this.paint.draw()
  }

  private query(site: Site, view: Terms = this.view): { tags: string; notes: string[] } | undefined {
    const names = view.chosen ? pickedNames(site, view.chosen) : this.namesOf(view.tag, site.key)
    if (names.length === 0) {
      return undefined
    }
    const left = view.chosen?.slice(names.length) ?? []
    const either = names.length > 1
    const cutouts = view.preset === 'cutouts' ? site.cutouts : ''
    const clash = either && cutouts.includes('~')
    const wanted = [
      either ? names.map((name) => `~${name}`).join(' ') : (names[0] as string),
      site.rate(view.rating),
      ...site.narrow(view.narrow),
      clash ? '' : cutouts,
      view.order === 'score' ? site.best : '',
    ].filter(Boolean)
    const kept: string[] = []
    const dropped: string[] = []
    for (const part of wanted) {
      if (tagsOf([...kept, part].join(' ')) <= site.tagBudget) {
        kept.push(part)
      } else {
        dropped.push(part)
      }
    }
    return {
      tags: kept.join(' '),
      notes: [
        ...(dropped.length > 0 ? [`${site.name} takes ${site.tagBudget} tags — ${dropped.join(' ')} left out`] : []),
        ...(left.length > 0
          ? [`${site.name} takes ${names.length} tag${names.length === 1 ? '' : 's'} — ${left.join(' ')} left out`]
          : []),
        ...(clash ? [`${site.name} ORs the names, so cutouts are told by the file`] : []),
        ...(view.narrow.score > 0 && !site.scored ? [`${site.name} keeps no score`] : []),
        ...(view.narrow.png && site.guesses
          ? [`${site.name} names a file type only where danbooru holds the file`]
          : []),
      ],
    }
  }

  private async search(): Promise<void> {
    const gen = ++this.gen
    const board = blank(this.boardKey, true)
    this.board = board
    this.boards.set(board.key, board)
    this.view.error = undefined
    const plans = this.sites.flatMap((site) => {
      const query = this.query(site)
      return query ? [{ site, ...query }] : []
    })
    const missing = this.sites.filter((site) => !plans.some((plan) => plan.site === site))
    const notes = [
      ...plans.flatMap(({ notes }) => notes),
      ...(missing.length > 0
        ? [`${this.entry.name} has no tag on ${missing.map((site) => site.name).join(', ')}`]
        : []),
    ]
    board.note = notes.length > 0 ? notes.join(' · ') : undefined
    if (plans.length === 0) {
      board.searching = false
    }
    this.show()
    this.paint.draw()
    void this.tally(gen, board, plans)
    try {
      const owned = await Promise.all(
        plans.map(async (plan) => ({ plan, owners: await this.kept.mateOwners(plan.site) })),
      )
      if (gen !== this.gen) {
        return
      }
      board.sources = owned.flatMap(({ plan: { site, tags }, owners }) => {
        const by = tagsOf(tags) + 1 <= site.tagBudget ? site.uploadedBy : undefined
        return [
          ...(by
            ? [...owners.keys()].map((owner) => ({ site, tags: `${tags} ${by(owner)}`, page: 0, done: false }))
            : []),
          { site, tags, page: 0, done: false },
        ]
      })
      this.show()
      this.paint.draw()
      await this.pump()
    } catch (error) {
      this.fail(gen, error)
    }
  }

  private async tally(gen: number, board: Board, plans: { site: Site; tags: string }[]): Promise<void> {
    const counts = await Promise.allSettled(plans.map(({ site, tags }) => fetchCount(site, tags, this.signal)))
    if (gen === this.gen) {
      board.total = counts.reduce(
        (sum, count) => sum + (count.status === 'fulfilled' && Number.isFinite(count.value) ? count.value : 0),
        0,
      )
      this.show()
      this.paint.draw()
    }
  }

  private fail(gen: number, error: unknown, site = this.site): void {
    if (gen !== this.gen || this.signal.aborted) {
      return
    }
    this.board.error = reason(site?.name ?? this.tabName, error)
    this.board.searching = false
    this.view.error = this.board.error
    this.show()
    this.paint.draw()
  }

  private drop(board: Board, site: Site, error: unknown): void {
    for (const source of board.sources) {
      if (source.site === site) {
        source.done = true
      }
    }
    board.note = [board.note, reason(site.name, error)].filter(Boolean).join(' · ')
  }

  private wants(): boolean {
    const { perRow, rowsVis } = gridShape(this.cols, this.rows)
    return this.view.tiles.length < (this.board.top + rowsVis + LOOKAHEAD) * perRow
  }

  private need(): number {
    const { perRow, rowsVis } = gridShape(this.cols, this.rows)
    return (rowsVis + LOOKAHEAD) * perRow
  }

  private live(board: Board): boolean {
    return this.boards.get(board.key) === board
  }

  private page(site: Site, tags: string, page: number): Promise<Post[]> {
    const key = `${site.key}|${tags}|${page}`
    let job = this.pages.get(key)
    if (!job) {
      job = fetchPosts(site, tags, page, this.signal).then((posts) => this.borrow(site, posts))
      this.pages.set(key, job)
      job.catch(() => this.pages.delete(key))
    }
    return job
  }

  private async borrow(site: Site, posts: Post[]): Promise<Post[]> {
    const asking = site === LENDER ? [] : posts.filter((post) => post.md5 !== '')
    if (asking.length > 0) {
      try {
        lend(
          asking,
          await fetchLent(
            asking.map((post) => post.md5),
            this.signal,
          ),
        )
      } catch {}
    }
    return posts
  }

  private staged(board: Board): void {
    if (board === this.board) {
      this.stageOf(board)
      this.paint.draw()
    }
  }

  private async round(board: Board): Promise<void> {
    board.stage = 'fetch'
    this.staged(board)
    const due = SITES.flatMap((site) => {
      const source = board.sources.find((s) => s.site === site && !s.done)
      return source ? [source] : []
    })
    const got = await Promise.all(
      due.map(async (source) => {
        try {
          const posts = await this.page(source.site, source.tags, source.page)
          board.arrived.add(source.site.name)
          this.staged(board)
          return { source, posts }
        } catch (error) {
          if (board.sources.every((s) => s.site === source.site) || this.signal.aborted) {
            throw error
          }
          this.drop(board, source.site, error)
          return { source, posts: undefined }
        }
      }),
    )
    if (!this.live(board)) {
      return
    }
    const picks: Pick[] = []
    for (const { source, posts } of got) {
      if (!posts) {
        continue
      }
      source.page++
      source.done = posts.length < PAGE
      let last = board.last.get(source)
      for (const post of posts) {
        const set = last && sameSet(last.post, post) ? last.set : `set:${source.site.key}:${post.id}`
        last = { post, set }
        const key = postKey(source.site, post.id)
        if (board.seen.has(key)) {
          continue
        }
        board.seen.add(key)
        const pick = { site: source.site, post }
        if (this.eligible(pick)) {
          board.kin.set(pick, [set, ...kinKeys(source.site, post)])
          picks.push(pick)
        } else {
          board.checked++
        }
      }
      if (last) {
        board.last.set(source, last)
      }
    }
    const kept = this.dedupe(board, picks)
    const round = ++board.rounds
    let ordered: Pick[]
    if (this.view.order !== 'fit') {
      ordered = due.length > 1 ? interleave(kept) : kept
    } else {
      const rough = fitOrder(kept, this.frame(), this.matched)
      const head = rough.slice(0, this.need())
      const ranking = { done: 0, total: head.length }
      board.ranking = ranking
      this.staged(board)
      await this.looks(head, () => {
        ranking.done++
        this.staged(board)
      })
      board.ranking = undefined
      if (!this.live(board)) {
        return
      }
      ordered = [...fitOrder(head, this.frame(), this.matched), ...rough.slice(head.length)]
    }
    board.stage = 'check'
    this.staged(board)
    for (const pick of ordered) {
      board.roundOf.set(pick, round)
    }
    board.queue.push(...ordered)
    this.ahead(board)
  }

  private ahead(board: Board): void {
    if (this.aheading || this.view.order !== 'fit' || !this.live(board)) {
      return
    }
    const next = board.queue.slice(0, this.need()).filter((pick) => !this.looking.has(postKey(pick.site, pick.post.id)))
    if (next.length === 0) {
      return
    }
    this.aheading = true
    void this.looks(next).then(() => {
      this.aheading = false
      for (const round of new Set(next.map((pick) => board.roundOf.get(pick) ?? 0))) {
        this.resort(board, round)
      }
      this.ahead(board)
    })
  }

  private resort(board: Board, round: number): void {
    const at = board.queue.flatMap((pick, i) => (board.roundOf.get(pick) === round ? [i] : []))
    const sorted = fitOrder(
      at.map((i) => board.queue[i] as Pick),
      this.frame(),
      this.matched,
    )
    at.forEach((i, k) => {
      board.queue[i] = sorted[k] as Pick
    })
  }

  private dedupe(board: Board, picks: Pick[]): Pick[] {
    const out: Pick[] = []
    for (const pick of picks) {
      const keys = sameKeys(pick.post)
      const held = keys.map((key) => board.same.get(key)).find(Boolean)
      if (!held) {
        for (const key of keys) {
          board.same.set(key, pick)
        }
        out.push(pick)
        continue
      }
      board.checked++
      if (area(pick.post) <= area(held.post)) {
        continue
      }
      for (const key of [...keys, ...sameKeys(held.post)]) {
        board.same.set(key, pick)
      }
      const within = out.indexOf(held)
      if (within >= 0) {
        out[within] = pick
        continue
      }
      this.replace(board, held, pick)
    }
    return out
  }

  private replace(board: Board, held: Pick, pick: Pick): void {
    board.roundOf.set(pick, board.roundOf.get(held) ?? 0)
    const queued = board.queue.indexOf(held)
    if (queued >= 0) {
      board.queue[queued] = pick
      return
    }
    for (const group of board.groups) {
      const at = group.posts.indexOf(held)
      if (at >= 0) {
        group.posts[at] = pick
        this.posts.set(postKey(pick.site, pick.post.id), pick)
        this.thumbQueue.push(pick)
        this.thumbs()
        return
      }
    }
  }

  private async looks(picks: Pick[], each?: () => void): Promise<void> {
    let next = 0
    const lane = async () => {
      while (next < picks.length) {
        await this.look(picks[next++] as Pick)
        each?.()
      }
    }
    await Promise.all(Array.from({ length: THUMB }, lane))
  }

  private look(pick: Pick): Promise<Look | undefined> {
    const key = postKey(pick.site, pick.post.id)
    let job = this.looking.get(key)
    if (!job) {
      job = (async () => {
        const path = this.previewPath(pick)
        const from = previewOf(pick.site, pick.post)
        await this.kept.cached(from.site, path, from.url)
        const look = await this.renders.run({ job: 'match', from: path, colors: this.entry.signature })
        this.looked.set(key, look)
        this.matched.set(pick.post, look.match)
        return look
      })().catch(() => undefined)
      this.looking.set(key, job)
    }
    return job
  }

  private async pump(): Promise<void> {
    const gen = this.gen
    const board = this.board
    if (this.pumping === gen || board.sources.length === 0) {
      return
    }
    this.pumping = gen
    const flight: { pick: Pick; passed: Promise<boolean> }[] = []
    let page: Promise<void> | undefined
    try {
      board.searching = true
      while (gen === this.gen) {
        while (flight.length < PROBE && board.queue.length > 0 && this.wants()) {
          const pick = board.queue.shift() as Pick
          flight.push({ pick, passed: this.vet(pick) })
        }
        this.ahead(board)
        if (!page && board.queue.length < PROBE && board.sources.some((s) => !s.done) && this.wants()) {
          const job = this.round(board).then(() => {
            if (page === job) {
              page = undefined
            }
          })
          job.catch(() => {})
          page = job
        }
        const head = flight.shift()
        if (!head) {
          if (!page) {
            break
          }
          await page
          this.show()
          this.paint.draw()
          continue
        }
        const passed = await head.passed
        if (gen !== this.gen) {
          return
        }
        board.checked++
        if (passed) {
          this.admit(head.pick)
        }
        this.show()
        this.paint.draw()
      }
      if (gen === this.gen) {
        board.searching = false
        this.show()
        this.paint.draw()
      }
    } catch (error) {
      this.fail(gen, error)
    } finally {
      this.kept.save()
      if (this.pumping === gen) {
        this.pumping = 0
      }
    }
  }

  private eligible({ site, post }: Pick): boolean {
    const version = rendition(post)
    if (!rated(site, post, this.view.rating) || exposed(post, this.view.block).length > 0 || !version) {
      return false
    }
    if (this.view.solo && post.solo === false) {
      return false
    }
    const { score, size, png } = this.view.narrow
    if (
      Math.min(post.width, post.height) < size ||
      (site.scored && post.score < score) ||
      (png && post.ext !== 'png') ||
      hidden(post, this.view.hide).length > 0 ||
      this.view.hideTags.some((tag) => post.tags.includes(tag))
    ) {
      return false
    }
    return this.view.preset === 'all'
      ? ['png', 'jpg', 'jpeg', ''].includes(version.ext)
      : ['png', ''].includes(post.ext)
  }

  private async vet(pick: Pick): Promise<boolean> {
    const [passed] = await Promise.all([this.passes(pick), this.look(pick)])
    return passed
  }

  private async passes({ site, post }: Pick): Promise<boolean> {
    return this.view.preset === 'all' || site.vouched || this.kept.transparent(site, post)
  }

  private admit(pick: Pick): void {
    const { site, post } = pick
    const board = this.board
    const key = postKey(site, post.id)
    this.posts.set(key, pick)
    const keys = board.kin.get(pick) ?? []
    const look = this.looked.get(key)
    const shape = look && { hash: look.hash, width: post.width, height: post.height }
    const kindred = this.view.sets === 'fold' ? this.kindred(board, keys, shape) : undefined
    if (kindred) {
      kindred.posts.push(pick)
      this.register(board, kindred, keys, shape)
      if (kindred.open) {
        this.thumbQueue.push(pick)
        this.thumbs()
      }
      return
    }
    const group = { posts: [pick], open: false }
    board.groups.push(group)
    this.register(board, group, keys, shape)
    this.thumbQueue.push(pick)
    this.thumbs()
  }

  private kindred(board: Board, keys: string[], shape: Shape | undefined): Group | undefined {
    for (const key of keys) {
      const group = board.kindred.get(key)
      if (group) {
        return group
      }
    }
    return shape && board.shapes.find((held) => near(held.shape, shape))?.group
  }

  private register(board: Board, group: Group, keys: string[], shape: Shape | undefined): void {
    for (const key of keys) {
      if (!board.kindred.has(key)) {
        board.kindred.set(key, group)
      }
    }
    if (shape) {
      board.shapes.push({ shape, group })
    }
  }

  private holds(): void {
    this.view.held = heldOf(this.home, this.entry.name).map((held) => {
      const thumb = this.heldFiles.get(held.from)
      return thumb ? { ...held, thumb } : held
    })
    this.holdThumbs()
  }

  private holdThumbs(): void {
    const w = HELD.cols * this.cell.w
    const h = HELD.rows * this.cell.h
    if (w === 0 || h === 0) {
      return
    }
    for (const held of this.view.held.slice(0, heldFit(this.cols))) {
      if (held.thumb || this.heldAsked.has(held.from)) {
        continue
      }
      this.heldAsked.add(held.from)
      const to = join(this.scratch, `held-${basename(held.from)}-${w}x${h}.png`)
      this.renders
        .run({ job: 'thumb', from: held.from, to, width: w, height: h })
        .then(() => {
          this.heldFiles.set(held.from, to)
          this.holds()
          this.paint.draw()
        })
        .catch(() => {})
    }
  }

  private thumbs(): void {
    while (!this.signal.aborted && this.thumbing < THUMB && this.thumbQueue.length > 0) {
      const pick = this.thumbQueue.shift() as Pick
      this.thumbing++
      this.thumb(pick)
        .catch(() => {
          this.thumbless.add(postKey(pick.site, pick.post.id))
          this.show()
          this.paint.draw()
        })
        .finally(() => {
          this.thumbing--
          this.thumbs()
        })
    }
  }

  private async thumb(pick: Pick): Promise<void> {
    const { site, post } = pick
    const w = TILE.cols * this.cell.w
    const h = TILE.rows * this.cell.h
    const from = previewOf(site, post)
    const path = join(cacheDir(site), 'tile', `${previewStem(post.id, from.url)}-${w}x${h}.png`)
    if (!existsSync(path)) {
      const thumb = this.previewPath(pick)
      await this.kept.cached(from.site, thumb, from.url)
      if (this.signal.aborted) {
        return
      }
      await this.renders.run({ job: 'thumb', from: thumb, to: path, width: w, height: h })
    }
    this.thumbPath.set(postKey(site, post.id), path)
    this.show()
    this.paint.draw()
  }

  private select(): void {
    const view = this.view
    const tile = view.tiles[view.focus]
    this.fetch?.abort()
    clearTimeout(this.settle)
    view.fetching = undefined
    this.inform()
    if (!tile) {
      return
    }
    if (this.current?.key === tile.key) {
      this.reveal()
      return
    }
    this.settle = setTimeout(() => void this.load(tile), SETTLE)
    this.paint.draw()
  }

  private async load(tile: Tile): Promise<void> {
    const view = this.view
    const pick = this.posts.get(tile.key)
    if (!pick) {
      return
    }
    const control = new AbortController()
    this.fetch = control
    void this.kept.profile(pick, control.signal)
    if (!rendition(pick.post)) {
      return
    }
    const { site } = pick
    const board = this.board
    try {
      await locate(site, pick.post, control.signal)
      const version = rendition(pick.post) as Rendition
      const path = this.origPath(site, tile.id, version.ext)
      if (!existsSync(path)) {
        view.fetching = { id: tile.key, got: 0, size: 0 }
        this.paint.draw()
      }
      const from = fileOf(site, pick.post, version)
      const size = await this.kept.cached(from.site, path, from.url, (got, total) => {
        if (view.fetching?.id === tile.key) {
          view.fetching = { id: tile.key, got, size: total }
          this.paint.draw()
        }
      })
      if (control.signal.aborted) {
        return
      }
      view.fetching = undefined
      if (board !== this.board) {
        return
      }
      const current: Current = {
        site,
        id: tile.id,
        key: tile.key,
        path,
        ext: version.ext,
        size,
        using: 'plain',
        failed: false,
      }
      view.preparing = tile.key
      this.paint.flush()
      const plain = await this.render(current, 'plain')
      if (control.signal.aborted || board !== this.board) {
        return
      }
      if (plain.clear === 0 && canRemoveBackground() && this.setting('TTHEME_FIND_REMOVE_BG') !== 'off') {
        view.preparing = undefined
        view.cutting = tile.key
        this.paint.flush()
        current.cut = await this.cutOut(site, tile.id, path, control.signal)
        if (control.signal.aborted || board !== this.board) {
          return
        }
        view.cutting = undefined
        if (current.cut) {
          view.preparing = tile.key
          this.paint.flush()
          const made = await this.render(current, 'cut').catch(() => undefined)
          if (control.signal.aborted || board !== this.board) {
            return
          }
          if (made && keepable(made.clear)) {
            current.using = 'cut'
          } else {
            rmSync(current.cut, { force: true })
            current.cut = undefined
            current.failed = true
          }
        } else {
          current.failed = true
        }
      }
      this.current = current
      if (view.tiles[view.focus]?.key === tile.key) {
        await this.present()
      }
      this.preload()
    } catch (error) {
      if (!control.signal.aborted && !this.signal.aborted) {
        view.error = reason(site.name, error)
      }
    } finally {
      if (view.fetching?.id === tile.key) {
        view.fetching = undefined
      }
      if (view.preparing === tile.key) {
        view.preparing = undefined
      }
      if (view.cutting === tile.key) {
        view.cutting = undefined
      }
      this.paint.draw()
    }
  }

  private async cutOut(site: Site, id: number, path: string, signal: AbortSignal): Promise<string | undefined> {
    const out = join(cacheDir(site), 'cut', `${id}.png`)
    if (existsSync(out)) {
      return out
    }
    try {
      mkdirSync(dirname(out), { recursive: true })
      await removeBackground(path, out, signal)
      return out
    } catch {
      rmSync(out, { force: true })
      return undefined
    }
  }

  private swap(): void {
    const current = this.current
    if (!current?.cut || this.view.shown?.id !== current.key) {
      return
    }
    current.using = current.using === 'cut' ? 'plain' : 'cut'
    this.reveal()
  }

  private preload(): void {
    const view = this.view
    if (view.mode !== 'try') {
      return
    }
    for (const index of [view.focus + this.direction, view.focus - this.direction]) {
      const tile = view.tiles[index]
      const pick = tile && this.posts.get(tile.key)
      if (pick) {
        void this.kept.profile(pick, this.signal)
      }
      if (this.prefetching >= PRELOAD || !pick || !rendition(pick.post)) {
        continue
      }
      const { site, post } = pick
      this.prefetching++
      void locate(site, post, this.signal)
        .then(async () => {
          const version = rendition(post) as Rendition
          const path = this.origPath(site, post.id, version.ext)
          const from = fileOf(site, post, version)
          await this.kept.cached(from.site, path, from.url)
          return this.render(
            { site, id: post.id, key: tile.key, path, ext: version.ext, size: 0, using: 'plain', failed: false },
            'plain',
          )
        })
        .catch(() => {})
        .finally(() => {
          this.prefetching--
        })
    }
  }

  private async render(
    current: Current,
    using: 'plain' | 'cut',
  ): Promise<{ clear: number; path: string; opacity: number; touched: boolean }> {
    const W = this.cols * this.cell.w
    const H = this.rows * this.cell.h
    const width = Math.min(W, TRY_WIDTH)
    const height = Math.max(1, Math.round((H * width) / W))
    const tune = { ...this.view.tune }
    const { coloring } = this.view
    const tuned = !sameTuning(tune, this.view.untuned)
    const touched = tune.opacity !== this.view.untuned.opacity
    const mark = tuned ? `-${tune.size}-${tune.at}${touched ? `-${Math.round(tune.opacity * 100)}` : ''}` : ''
    const path = join(
      this.scratch,
      `${current.site.key}-${current.id}${using === 'cut' ? 'c' : ''}${coloring === 'original' ? 'o' : ''}-${width}x${height}${mark}.png`,
    )
    const key = `${current.site.key}:${current.id}:${using}:${coloring}:${width}x${height}`
    const known = this.clarity.get(key)
    if (known && existsSync(path)) {
      current.fill = known.fill
      return { clear: known.clear, path, opacity: known.opacity, touched }
    }
    const made = await this.renders.run({
      job: 'show',
      from: using === 'cut' ? (current.cut as string) : current.path,
      to: path,
      width,
      height,
      colors: this.entry,
      tone: this.tone,
      blur: (this.blurring * width) / fillSize(W, H).width,
      coloring,
      ...(tuned ? { tune: { size: tune.size, at: tune.at, ...(touched ? { opacity: tune.opacity } : {}) } } : {}),
    })
    this.clarity.set(key, made)
    current.fill = made.fill
    if (tuned) {
      this.keepTuned(path)
    }
    return { clear: made.clear, path, opacity: made.opacity, touched }
  }

  private keepTuned(path: string): void {
    this.tunedFiles.push(path)
    while (this.tunedFiles.length > TUNED_HELD) {
      const at = this.tunedFiles.findIndex((file) => file !== this.view.shown?.path && file !== path)
      if (at === -1) {
        return
      }
      rmSync(this.tunedFiles.splice(at, 1)[0] as string, { force: true })
    }
  }

  private async present(): Promise<void> {
    const current = this.current
    if (!current) {
      return
    }
    const using = current.using
    const { coloring } = this.view
    const asked = this.view.tune.opacity
    const { clear, path, opacity, touched } = await this.render(current, using)
    if (this.current !== current || current.using !== using || this.view.coloring !== coloring) {
      return
    }
    if (!touched && this.view.tune.opacity === asked) {
      this.view.untuned.opacity = opacity
      this.view.tune.opacity = opacity
    }
    if (this.view.tuning && current.fill) {
      this.view.tuning.fill = current.fill
    }
    this.view.shown = {
      id: current.key,
      clear,
      bytes: current.size,
      path,
      cut: current.cut ? (using === 'cut' ? 'on' : 'off') : current.failed ? 'failed' : 'none',
    }
  }

  private reveal(): void {
    const view = this.view
    if (this.presenting) {
      this.again = true
      return
    }
    this.presenting = true
    view.preparing = this.current?.key
    this.paint.flush()
    void this.present()
      .catch((error: unknown) => {
        view.error = error instanceof Error ? error.message : String(error)
      })
      .finally(() => {
        this.presenting = false
        if (this.again) {
          this.again = false
          this.reveal()
          return
        }
        if (view.preparing === this.current?.key) {
          view.preparing = undefined
        }
        this.paint.draw()
      })
  }

  private async install(): Promise<void> {
    const view = this.view
    const tile = view.tiles[view.focus]
    const current = this.current
    if (!tile || current?.key !== tile.key || view.preparing !== undefined || view.shown?.id !== tile.key) {
      return
    }
    view.installing = tile.key
    view.error = undefined
    this.paint.flush()
    const tune = toTune(view.tune, view.untuned)
    const pick = this.posts.get(current.key)
    const post = pick?.post
    if (pick) {
      await Promise.race([this.kept.profile(pick, this.signal), sleep(PROFILE_WAIT, undefined, { ref: false })])
    }
    try {
      await this.renders.run({
        job: 'backdrop',
        from: current.using === 'cut' ? (current.cut as string) : current.path,
        source: current.path,
        home: this.home,
        colors: this.entry,
        tone: this.tone,
        origin: {
          site: current.site.key,
          id: current.id,
          ext: current.ext,
          from: `${current.site.name} ${current.id} ${current.site.pageUrl(current.id)}`,
          artist: post?.named.artist ?? [],
          profiles: this.kept.links(post?.named.artist ?? []),
          source: sourcePage(post?.source ?? ''),
        },
        width: this.cols * this.cell.w,
        height: this.rows * this.cell.h,
        blur: this.blurring,
        coloring: view.coloring,
        ...(tune ? { tune, aligns: alignsFor(readInstalled(this.home).terminals), user: homedir() } : {}),
      })
      this.kept.owned(current.site, current.id, post?.owner ?? '')
      refreshPictures(this.home)
      this.holds()
      const { size, at, opacity } = view.tune
      const framing = tune
        ? ` · ${size === 'fill' ? 'fill' : `${size}%`} · ${POSITIONS[at - 1]} · ${opacity.toFixed(2)}`
        : ''
      const by = post?.named.artist.length ? `${post.named.artist.join(', ')} · ` : ''
      view.saved = {
        text: `Background · ${this.entry.name} ← ${by}${current.site.name} ${current.id}${framing}`,
        key: tile.key,
      }
      view.installed.push(tile.key)
      this.fetch?.abort()
      clearTimeout(this.settle)
      view.fetching = undefined
      view.mode = 'grid'
    } catch (error) {
      view.error = error instanceof Error ? error.message : String(error)
    }
    view.installing = undefined
    this.paint.draw()
  }
}

export type Start = { paste: string } | { clipboard: true }

export async function findFor(
  home: string,
  entry: PaletteEntry,
  start?: Start,
): Promise<{ saved: string | undefined; installs: number }> {
  const finder = new Finder(home, readAvailable(home), entry, entry.booru ?? '', start)
  await finder.run()
  if (viewsInWindow(process.env)) {
    process.stdout.write(viewVar(''))
  }
  return { saved: finder.saved, installs: finder.installs }
}

export async function runFind(name: string): Promise<number> {
  const home = configHome()
  const manifest = readAvailable(home)
  const entry = find(manifest.palettes, name)
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('needs a terminal')
  }
  const finder = new Finder(home, manifest, entry, entry.booru ?? '')
  const code = await finder.run()
  if (finder.saved && code !== 0) {
    process.stderr.write(`${finder.saved}\n`)
    return 0
  }
  return code
}
