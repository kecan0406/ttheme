import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { backdropTone, origins, type Tone } from './backdrop.ts'
import {
  BLOCKS,
  blockSet,
  cacheDir,
  exposed,
  extension,
  fetchBytes,
  fetchCount,
  fetchPost,
  fetchPosts,
  headOf,
  mates,
  mirrored,
  originHost,
  PAGE,
  type Post,
  pausedUntil,
  postRef,
  RATINGS,
  rated,
  ratingSet,
  rendition,
  SITES,
  type Site,
  sweepCache,
  tagsOf,
} from './booru.ts'
import { find, readCatalog } from './catalog.ts'
import { canRemoveBackground, keepable, removeBackground } from './cutout.ts'
import type { Manifest, PaletteEntry } from './emit/manifest.ts'
import {
  CELL_QUERY,
  cellReport,
  decodeKeys,
  type FindView,
  gridShape,
  MIN,
  place,
  release,
  renderFind,
  type Setting,
  TILE,
  type Tile,
  transmit,
} from './find-screen.ts'
import { configHome } from './palettes.ts'
import { Renderer } from './render.ts'
import { tunnel } from './unblock.ts'
import { withSetting } from './wiring.ts'

const SETTINGS: Setting[] = [
  { name: 'TTHEME_FIND_RATING', label: 'rating', choices: RATINGS, multi: { read: ratingSet } },
  { name: 'TTHEME_FIND_BLOCK', label: 'block', choices: BLOCKS, multi: { read: blockSet, none: 'none' } },
  { name: 'TTHEME_FIND_POSTS', label: 'posts', choices: ['all', 'cutouts'] },
  { name: 'TTHEME_FIND_ORDER', label: 'order', choices: ['newest', 'score'] },
  { name: 'TTHEME_FIND_SETS', label: 'sets', choices: ['fold', 'show'] },
  ...(canRemoveBackground() ? [{ name: 'TTHEME_FIND_REMOVE_BG', label: 'remove bg', choices: ['on', 'off'] }] : []),
]

function initial(setting: Setting, raw: string | undefined): string {
  if (setting.multi) {
    return setting.multi.read(raw).join(' ') || (setting.multi.none as string)
  }
  return setting.choices.find((choice) => choice === raw) ?? (setting.choices[0] as string)
}

const PROBE = 12
const THUMB = 12
const PRELOAD = 2
const SETTLE = 150
const ESCAPE = 30
const TRY_WIDTH = 1280
const LOOKAHEAD = 2

interface Source {
  tags: string
  page: number
  done: boolean
}

interface Group {
  posts: Post[]
  open: boolean
}

interface Board {
  key: string
  groups: Group[]
  sources: Source[]
  queue: Post[]
  seen: Set<number>
  checked: number
  total: number
  focus: number
  top: number
  searching: boolean
  error?: string
  note?: string
}

function blank(key: string, searching: boolean): Board {
  return {
    key,
    groups: [],
    sources: [],
    queue: [],
    seen: new Set(),
    checked: 0,
    total: 0,
    focus: 0,
    top: 0,
    searching,
  }
}

interface Current {
  site: Site
  id: number
  path: string
  ext: string
  size: number
  cut?: string
  using: 'plain' | 'cut'
  failed: boolean
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

function reason(site: Site, error: unknown): string {
  return `${site.name}: ${describe(error)}`
}

function incomplete(input: string): boolean {
  const at = input.lastIndexOf('\u001b')
  return at !== -1 && /^\[?[0-9;]*$/.test(input.slice(at + 1))
}

function readCache<T>(site: Site, name: string): Record<string, T> {
  try {
    return JSON.parse(readFileSync(join(cacheDir(site), name), 'utf8')) as Record<string, T>
  } catch {
    return {}
  }
}

function writeCache(site: Site, name: string, data: Record<string, unknown>): void {
  mkdirSync(cacheDir(site), { recursive: true })
  writeFileSync(join(cacheDir(site), name), `${JSON.stringify(data)}\n`)
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
  private readonly posts = new Map<string, Post>()
  private readonly thumbPath = new Map<string, string>()
  private siteIndex = 0
  private readonly values = new Map<string, string>(
    SETTINGS.map((setting) => [setting.name, initial(setting, process.env[setting.name])]),
  )
  private direction = 1
  private prefetching = 0
  private readonly inflight = new Map<string, Promise<number>>()
  private readonly owners = new Map<string, Map<string, string[]>>()
  private readonly probed = new Map<string, Record<string, boolean>>()
  private readonly unsaved = new Set<string>()
  private thumbQueue: { site: Site; post: Post }[] = []
  private thumbing = 0
  private readonly clarity = new Map<string, number>()
  private readonly renders = new Renderer()
  private readonly sent = new Map<number, string>()
  private readonly placed = new Map<number, string>()
  private current?: Current
  private fetch?: AbortController
  private settle?: NodeJS.Timeout
  private partial?: NodeJS.Timeout
  private input = ''
  private probeWait?: (cell: { w: number; h: number } | null) => void
  private done?: (code: number) => void
  private dirty = false
  private readonly scratch = mkdtempSync(join(tmpdir(), 'ttheme-find-'))

  private readonly home: string
  private readonly catalog: Manifest
  private readonly entry: PaletteEntry

  constructor(home: string, catalog: Manifest, entry: PaletteEntry, tag: string) {
    this.home = home
    this.catalog = catalog
    this.entry = entry
    this.tone = backdropTone(entry, entry.signatureSlots)
    this.view = {
      palette: entry.name,
      tag,
      site: this.site.name,
      siteAnsi: this.site.ansi,
      nextSite: this.nextSite.name,
      preset: this.setting('TTHEME_FIND_POSTS') === 'all' ? 'all' : 'cutouts',
      order: this.setting('TTHEME_FIND_ORDER') === 'score' ? 'score' : 'newest',
      rating: ratingSet(this.setting('TTHEME_FIND_RATING')),
      block: blockSet(this.setting('TTHEME_FIND_BLOCK')),
      sets: this.setting('TTHEME_FIND_SETS') === 'show' ? 'show' : 'fold',
      unblocked: process.env.TTHEME_FIND_PROXY !== undefined,
      settings: SETTINGS.map((setting) => ({
        label: setting.label,
        choices: [...setting.choices],
        value: this.setting(setting.name),
        multi: setting.multi && { none: setting.multi.none },
        cursor: 0,
      })),
      colors: { cursor: entry.cursor, selection: entry.selection, ansi: entry.ansi },
      tiles: [],
      checked: 0,
      total: 0,
      searching: tag !== '',
      focus: 0,
      top: 0,
      mode: 'grid',
      help: false,
      editing: tag === '' ? '' : undefined,
    }
    this.board = blank(this.boardKey, tag !== '')
    this.boards.set(this.board.key, this.board)
  }

  private get signal(): AbortSignal {
    return this.session.signal
  }

  private get site(): Site {
    return SITES[this.siteIndex] as Site
  }

  private get nextSite(): Site {
    return SITES[(this.siteIndex + 1) % SITES.length] as Site
  }

  private setting(name: string): string {
    return this.values.get(name) as string
  }

  private get boardKey(): string {
    return `${this.site.key}|${this.view.preset}|${this.view.order}`
  }

  private mark(site: Site, id: number): string {
    return `${site.key}:${id}`
  }

  private origPath(site: Site, id: number, ext: string): string {
    return join(cacheDir(site), 'orig', `${id}.${ext}`)
  }

  private tileOf(site: Site, post: Post, variants: number): Tile {
    const version = rendition(post) ?? post
    return {
      id: post.id,
      width: version.width,
      height: version.height,
      reduced: version !== post,
      owner: mirrored(post.owner) ? '' : post.owner,
      artist: post.artist,
      score: post.score,
      variants,
      origin: originHost(post.source),
      mates: this.owners.get(site.key)?.get(post.owner) ?? [],
      thumb: this.thumbPath.get(this.mark(site, post.id)),
    }
  }

  private show(): void {
    const site = this.site
    const view = this.view
    const board = this.board
    view.tiles = board.groups.flatMap((group) =>
      group.open
        ? group.posts.map((post) => this.tileOf(site, post, 0))
        : [this.tileOf(site, group.posts[0] as Post, group.posts.length)],
    )
    view.checked = board.checked
    view.total = board.total
    view.searching = board.searching
    view.note = board.note
    view.focus = Math.max(0, Math.min(board.focus, view.tiles.length - 1))
    view.top = board.top
  }

  private syncSite(): void {
    const view = this.view
    view.site = this.site.name
    view.siteAnsi = this.site.ansi
    view.nextSite = this.nextSite.name
  }

  async run(): Promise<number> {
    const { stdin, stdout } = process
    stdin.setRawMode(true)
    stdin.resume()
    stdin.on('data', this.onData)
    stdout.on('resize', this.onResize)
    this.write('\x1b[?25l\x1b[?7l\x1b[H\x1b[J')
    const exit = new Promise<number>((resolve) => {
      this.done = resolve
    })
    const clock = setInterval(this.onClock, 250)
    const cell = await this.probe()
    if (cell) {
      this.cell = cell
      if (this.view.tag) {
        void this.search()
      }
    } else {
      this.view.searching = false
      this.view.error = 'this terminal does not report its cell size — find needs kitty graphics'
    }
    this.draw()
    const code = await exit
    this.session.abort()
    this.fetch?.abort()
    clearTimeout(this.settle)
    clearTimeout(this.partial)
    clearInterval(clock)
    stdin.off('data', this.onData)
    stdout.off('resize', this.onResize)
    this.write('\x1b_Ga=d,d=A,q=2\x1b\\\x1b[H\x1b[J')
    stdin.setRawMode(false)
    stdin.pause()
    this.saveProbes()
    this.renders.close()
    rmSync(this.scratch, { recursive: true, force: true })
    sweepCache()
    return code
  }

  private write(text: string): void {
    process.stdout.write(text)
  }

  private finish(code: number): void {
    this.done?.(code)
  }

  private probe(): Promise<{ w: number; h: number } | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.probeWait = undefined
        resolve(null)
      }, 1000)
      this.probeWait = (cell) => {
        clearTimeout(timer)
        this.probeWait = undefined
        resolve(cell)
      }
      this.write(CELL_QUERY)
    })
  }

  private readonly onData = (chunk: Buffer): void => {
    this.input += chunk.toString('utf8')
    for (let report = cellReport(this.input); report; report = cellReport(this.input)) {
      this.input = report.rest
      this.probeWait?.(report.cell)
    }
    if (this.probeWait) {
      return
    }
    clearTimeout(this.partial)
    if (incomplete(this.input)) {
      this.partial = setTimeout(this.flushKeys, ESCAPE)
      return
    }
    this.flushKeys()
  }

  private readonly flushKeys = (): void => {
    const keys = decodeKeys(this.input)
    this.input = ''
    for (const key of keys) {
      this.key(key)
    }
  }

  private readonly onClock = (): void => {
    const left = Math.ceil((pausedUntil(this.site) - Date.now()) / 1000)
    const waiting = left > 0 ? left : undefined
    if (waiting !== this.view.waiting) {
      this.view.waiting = waiting
      this.draw()
    }
  }

  private readonly onResize = (): void => {
    this.cols = process.stdout.columns || this.cols
    this.rows = process.stdout.rows || this.rows
    this.scroll()
    if (this.view.mode === 'try' && this.current) {
      this.reveal()
    }
    void this.pump()
    this.draw()
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
        this.draw()
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
      this.draw()
      return
    }
    if (view.mode === 'try') {
      this.tryKey(key)
      return
    }
    this.gridKey(key)
  }

  private gridKey(key: string): void {
    const view = this.view
    const { perRow, rowsVis } = gridShape(this.cols, this.rows)
    const moves: Record<string, number> = {
      left: -1,
      right: 1,
      up: -perRow,
      down: perRow,
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
    if (key === 'enter' && view.tiles[view.focus]) {
      view.mode = 'try'
      view.error = undefined
      this.select()
      return
    }
    if (key === 'c') {
      view.preset = view.preset === 'cutouts' ? 'all' : 'cutouts'
      void this.turn()
      return
    }
    if (key === 'tab') {
      this.siteIndex = (this.siteIndex + 1) % SITES.length
      this.syncSite()
      void this.turn()
      return
    }
    if (key === '/') {
      view.editing = ''
      this.draw()
      return
    }
    if (key === ' ') {
      this.unfold()
      return
    }
    if (key === 'o') {
      this.openPage()
      return
    }
    if (key === 's') {
      view.panel = 0
      this.draw()
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
    if (key === 'up' || key === 'down') {
      view.panel = Math.max(0, Math.min(view.settings.length - 1, at + (key === 'up' ? -1 : 1)))
      this.draw()
      return
    }
    if ((key === 'left' || key === 'right') && row) {
      const step = key === 'left' ? -1 : 1
      if (row.multi) {
        row.cursor = (row.cursor + step + row.choices.length) % row.choices.length
      } else {
        const index = row.choices.indexOf(row.value)
        row.value = row.choices[(index + step + row.choices.length) % row.choices.length] as string
      }
      this.draw()
      return
    }
    if (key === ' ' && row?.multi) {
      const on = row.value.split(' ')
      const next = row.choices.filter((choice, k) => (k === row.cursor ? !on.includes(choice) : on.includes(choice)))
      const empty = row.multi.none
      if (next.length > 0 || empty !== undefined) {
        row.value = next.length > 0 ? next.join(' ') : (empty as string)
        this.draw()
      }
      return
    }
    if (key === 'esc') {
      view.settings.forEach((setting, i) => {
        setting.value = this.setting(SETTINGS[i]?.name ?? '')
      })
      view.panel = undefined
      this.draw()
      return
    }
    if (key === 'enter' || key === 'alt-c') {
      view.panel = undefined
      this.adopt()
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
      this.draw()
      return
    }
    this.save(changed)
    view.rating = ratingSet(this.setting('TTHEME_FIND_RATING'))
    view.block = blockSet(this.setting('TTHEME_FIND_BLOCK'))
    view.sets = this.setting('TTHEME_FIND_SETS') === 'show' ? 'show' : 'fold'
    view.preset = this.setting('TTHEME_FIND_POSTS') === 'all' ? 'all' : 'cutouts'
    view.order = this.setting('TTHEME_FIND_ORDER') === 'score' ? 'score' : 'newest'
    this.boards.clear()
    this.current = undefined
    view.shown = undefined
    view.mode = 'grid'
    void this.search()
  }

  private save(changed: Setting[]): void {
    const path = join(this.home, 'ttheme', 'config.zsh')
    try {
      const before = existsSync(path) ? readFileSync(path, 'utf8') : ''
      const after = changed.reduce(
        (text, setting) => withSetting(text, setting.name, this.setting(setting.name)),
        before,
      )
      writeFileSync(path, after)
    } catch (error) {
      this.view.error = error instanceof Error ? error.message : String(error)
    }
  }

  private editKey(key: string): void {
    const view = this.view
    const text = view.editing ?? ''
    if (key === 'esc') {
      view.editing = undefined
      if (view.tag === '') {
        this.finish(2)
        return
      }
      this.draw()
      return
    }
    if (key === 'enter') {
      view.editing = undefined
      if (text.trim()) {
        void this.commit(text.trim())
        return
      }
      if (view.tag === '') {
        this.finish(2)
        return
      }
      this.draw()
      return
    }
    if (key === 'backspace') {
      view.editing = text.slice(0, -1)
      this.draw()
      return
    }
    if (key.length === 1 && key >= ' ') {
      view.editing = text + key
      this.draw()
    }
  }

  private async commit(text: string): Promise<void> {
    const ref = postRef(text, this.site)
    if (ref) {
      await this.jump(ref.site, ref.id)
      return
    }
    this.view.tag = text
    this.boards.clear()
    await this.search()
  }

  private async jump(site: Site, id: number): Promise<void> {
    const gen = ++this.gen
    this.siteIndex = SITES.indexOf(site)
    this.syncSite()
    this.current = undefined
    this.view.shown = undefined
    this.view.error = undefined
    const board = blank(`${site.key}|post:${id}`, true)
    this.board = board
    this.boards.set(board.key, board)
    this.show()
    this.draw()
    try {
      const post = await fetchPost(site, id, this.signal)
      if (gen !== this.gen) {
        return
      }
      board.searching = false
      if (!post) {
        board.error = `${site.name} has no post ${id}`
        this.view.error = board.error
      } else {
        this.posts.set(this.mark(site, post.id), post)
        board.groups = [{ posts: [post], open: false }]
        board.checked = 1
        board.total = 1
        this.thumbQueue.push({ site, post })
        this.thumbs()
        this.view.mode = 'try'
      }
      this.show()
      if (post) {
        this.select()
      }
      this.draw()
    } catch (error) {
      this.fail(gen, error)
    }
  }

  private async turn(): Promise<void> {
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
    this.draw()
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
        for (const post of group.posts) {
          if (!this.thumbPath.has(this.mark(this.site, post.id))) {
            this.thumbQueue.push({ site: this.site, post })
          }
        }
        this.thumbs()
        this.show()
        this.scroll()
        this.draw()
        return
      }
      index += size
    }
  }

  private openPage(): void {
    const tile = this.view.tiles[this.view.focus]
    if (!tile) {
      return
    }
    const opener = process.platform === 'darwin' ? 'open' : 'xdg-open'
    try {
      spawn(opener, [this.site.pageUrl(tile.id)], { stdio: 'ignore', detached: true }).unref()
    } catch {}
  }

  private tryKey(key: string): void {
    const view = this.view
    if (key === 'left' || key === 'right') {
      this.direction = key === 'left' ? -1 : 1
      this.focus(view.focus + this.direction)
      return
    }
    if (key === 'o') {
      this.openPage()
      return
    }
    if (key === 'x') {
      this.swap()
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
      this.draw()
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
    void this.pump()
    if (view.mode === 'try') {
      this.select()
    }
    this.draw()
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

  private query(site: Site): string {
    const view = this.view
    const wanted = [
      view.tag,
      site.rate(this.view.rating),
      view.preset === 'cutouts' ? site.cutouts : '',
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
    this.board.note =
      dropped.length > 0 ? `${site.name} takes ${site.tagBudget} tags — ${dropped.join(' ')} left out` : undefined
    return kept.join(' ')
  }

  private async search(): Promise<void> {
    const gen = ++this.gen
    const site = this.site
    const board = blank(this.boardKey, true)
    this.board = board
    this.boards.set(board.key, board)
    this.view.error = undefined
    this.show()
    this.draw()
    const tags = this.query(site)
    void this.tally(gen, site, board, tags)
    try {
      const owners = await this.mateOwners(site)
      if (gen !== this.gen) {
        return
      }
      const room = tagsOf(tags) + 1 <= site.tagBudget
      board.sources = [
        ...(room ? [...owners.keys()].map((owner) => ({ tags: `${tags} user:${owner}`, page: 0, done: false })) : []),
        { tags, page: 0, done: false },
      ]
      this.show()
      this.draw()
      await this.pump()
    } catch (error) {
      this.fail(gen, error)
    }
  }

  private async tally(gen: number, site: Site, board: Board, tags: string): Promise<void> {
    try {
      const total = await fetchCount(site, tags, this.signal)
      if (gen === this.gen) {
        board.total = total
        this.show()
        this.draw()
      }
    } catch {}
  }

  private fail(gen: number, error: unknown): void {
    if (gen !== this.gen || this.signal.aborted) {
      return
    }
    this.board.error = reason(this.site, error)
    this.board.searching = false
    this.view.error = this.board.error
    this.show()
    this.draw()
  }

  private wants(): boolean {
    const { perRow, rowsVis } = gridShape(this.cols, this.rows)
    return this.view.tiles.length < (this.board.top + rowsVis + LOOKAHEAD) * perRow
  }

  private async nextPage(site: Site, board: Board, gen: number): Promise<void> {
    const source = board.sources.find((s) => !s.done)
    if (!source) {
      return
    }
    const posts = await fetchPosts(site, source.tags, source.page, this.signal)
    if (gen !== this.gen) {
      return
    }
    source.page++
    source.done = posts.length < PAGE
    for (const post of posts) {
      if (!board.seen.has(post.id)) {
        board.seen.add(post.id)
        board.queue.push(post)
      }
    }
  }

  private async pump(): Promise<void> {
    const gen = this.gen
    const board = this.board
    if (this.pumping === gen || board.sources.length === 0) {
      return
    }
    this.pumping = gen
    const site = this.site
    const flight: { post: Post; passed: Promise<boolean> }[] = []
    let page: Promise<void> | undefined
    try {
      board.searching = true
      while (gen === this.gen) {
        while (flight.length < PROBE && board.queue.length > 0 && this.wants()) {
          const post = board.queue.shift() as Post
          flight.push({ post, passed: this.passes(site, post) })
        }
        if (!page && board.queue.length < PROBE && board.sources.some((s) => !s.done) && this.wants()) {
          const job = this.nextPage(site, board, gen).then(() => {
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
          continue
        }
        const passed = await head.passed
        if (gen !== this.gen) {
          return
        }
        board.checked++
        if (passed) {
          this.admit(site, head.post)
        }
        this.show()
        this.draw()
      }
      if (gen === this.gen) {
        board.searching = false
        this.show()
        this.draw()
      }
    } catch (error) {
      this.fail(gen, error)
    } finally {
      this.saveProbes()
      if (this.pumping === gen) {
        this.pumping = 0
      }
    }
  }

  private async passes(site: Site, post: Post): Promise<boolean> {
    const version = rendition(post)
    if (!rated(site, post, this.view.rating) || exposed(post, this.view.block).length > 0 || !version) {
      return false
    }
    if (this.view.preset === 'all') {
      return ['png', 'jpg', 'jpeg'].includes(version.ext)
    }
    if (post.ext !== 'png') {
      return false
    }
    return site.vouched || this.transparent(site, post)
  }

  private probes(site: Site): Record<string, boolean> {
    let known = this.probed.get(site.key)
    if (!known) {
      known = readCache<boolean>(site, 'probes.json')
      this.probed.set(site.key, known)
    }
    return known
  }

  private async transparent(site: Site, post: Post): Promise<boolean> {
    const known = this.probes(site)
    const cached = known[post.id]
    if (cached !== undefined) {
      return cached
    }
    try {
      const alpha = (await headOf(site, post.file, this.signal))?.alpha === true
      known[post.id] = alpha
      this.unsaved.add(site.key)
      return alpha
    } catch {
      return false
    }
  }

  private saveProbes(): void {
    for (const key of this.unsaved) {
      const site = SITES.find((s) => s.key === key)
      if (site) {
        writeCache(site, 'probes.json', this.probes(site))
      }
    }
    this.unsaved.clear()
  }

  private admit(site: Site, post: Post): void {
    this.posts.set(this.mark(site, post.id), post)
    const last = this.view.sets === 'fold' ? this.board.groups.at(-1) : undefined
    const head = last?.posts[0]
    const credit = post.owner || post.artist
    if (
      last &&
      head &&
      credit &&
      (head.owner || head.artist) === credit &&
      head.width === post.width &&
      head.height === post.height
    ) {
      last.posts.push(post)
      if (last.open) {
        this.thumbQueue.push({ site, post })
        this.thumbs()
      }
      return
    }
    this.board.groups.push({ posts: [post], open: false })
    this.thumbQueue.push({ site, post })
    this.thumbs()
  }

  private async mateOwners(site: Site): Promise<Map<string, string[]>> {
    const cached = this.owners.get(site.key)
    if (cached) {
      return cached
    }
    const found = origins(this.home)
    const known = readCache<string>(site, 'owners.json')
    const siblings = this.catalog.palettes.flatMap((sibling) => {
      const origin = found.get(sibling.name)
      return sibling.group === this.entry.group && sibling.name !== this.entry.name && origin?.site === site.key
        ? [{ name: sibling.name, id: origin.id }]
        : []
    })
    const asked = await Promise.all(
      siblings.map(async (sibling) => {
        const owner = known[sibling.id]
        if (owner !== undefined) {
          return { ...sibling, owner }
        }
        try {
          return { ...sibling, owner: (await fetchPost(site, sibling.id, this.signal))?.owner ?? '' }
        } catch {
          return undefined
        }
      }),
    )
    const byPalette = new Map<string, string>()
    for (const sibling of asked) {
      if (sibling) {
        known[sibling.id] = sibling.owner
        byPalette.set(sibling.name, sibling.owner)
      }
    }
    writeCache(site, 'owners.json', known)
    const owners = mates(byPalette)
    this.owners.set(site.key, owners)
    return owners
  }

  private async cached(
    site: Site,
    path: string,
    url: string,
    progress?: (got: number, size: number) => void,
  ): Promise<number> {
    if (existsSync(path)) {
      return statSync(path).size
    }
    const running = this.inflight.get(path)
    if (running) {
      return running
    }
    const job = (async () => {
      const bytes = await fetchBytes(site, url, this.signal, progress)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, bytes)
      return bytes.length
    })()
    this.inflight.set(path, job)
    try {
      return await job
    } finally {
      this.inflight.delete(path)
    }
  }

  private thumbs(): void {
    while (this.thumbing < THUMB && this.thumbQueue.length > 0) {
      const { site, post } = this.thumbQueue.shift() as { site: Site; post: Post }
      this.thumbing++
      this.thumb(site, post)
        .catch(() => {})
        .finally(() => {
          this.thumbing--
          this.thumbs()
        })
    }
  }

  private async thumb(site: Site, post: Post): Promise<void> {
    const w = TILE.cols * this.cell.w
    const h = TILE.rows * this.cell.h
    const path = join(cacheDir(site), 'tile', `${post.id}-${w}x${h}.png`)
    if (!existsSync(path)) {
      const thumb = join(cacheDir(site), 'thumb', `${post.id}.${extension(post.preview)}`)
      await this.cached(site, thumb, post.preview)
      await this.renders.run({ job: 'thumb', from: thumb, to: path, width: w, height: h })
    }
    this.thumbPath.set(this.mark(site, post.id), path)
    this.show()
    this.draw()
  }

  private select(): void {
    const view = this.view
    const tile = view.tiles[view.focus]
    this.fetch?.abort()
    clearTimeout(this.settle)
    view.fetching = undefined
    if (!tile) {
      return
    }
    if (this.current?.id === tile.id) {
      this.reveal()
      return
    }
    this.settle = setTimeout(() => void this.load(tile), SETTLE)
    this.draw()
  }

  private async load(tile: Tile): Promise<void> {
    const view = this.view
    const post = this.posts.get(this.mark(this.site, tile.id))
    const version = post && rendition(post)
    if (!version) {
      return
    }
    const site = this.site
    const control = new AbortController()
    this.fetch = control
    try {
      const path = this.origPath(site, tile.id, version.ext)
      if (!existsSync(path)) {
        view.fetching = { id: tile.id, got: 0, size: 0 }
        this.draw()
      }
      const size = await this.cached(site, path, version.file, (got, total) => {
        if (view.fetching?.id === tile.id) {
          view.fetching = { id: tile.id, got, size: total }
          this.draw()
        }
      })
      if (control.signal.aborted) {
        return
      }
      view.fetching = undefined
      if (site !== this.site) {
        return
      }
      const current: Current = { site, id: tile.id, path, ext: version.ext, size, using: 'plain', failed: false }
      view.preparing = tile.id
      this.flush()
      const plain = await this.render(current, 'plain')
      if (control.signal.aborted || site !== this.site) {
        return
      }
      if (plain.clear === 0 && canRemoveBackground() && this.setting('TTHEME_FIND_REMOVE_BG') !== 'off') {
        view.preparing = undefined
        view.cutting = tile.id
        this.flush()
        current.cut = await this.cutOut(site, tile.id, path, control.signal)
        if (control.signal.aborted || site !== this.site) {
          return
        }
        view.cutting = undefined
        if (current.cut) {
          view.preparing = tile.id
          this.flush()
          const made = await this.render(current, 'cut').catch(() => undefined)
          if (control.signal.aborted || site !== this.site) {
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
      if (view.tiles[view.focus]?.id === tile.id) {
        await this.present()
      }
      this.preload()
    } catch (error) {
      if (!control.signal.aborted && !this.signal.aborted) {
        view.error = reason(site, error)
      }
    } finally {
      if (view.fetching?.id === tile.id) {
        view.fetching = undefined
      }
      if (view.preparing === tile.id) {
        view.preparing = undefined
      }
      if (view.cutting === tile.id) {
        view.cutting = undefined
      }
      this.draw()
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
    if (!current?.cut || this.view.shown?.id !== current.id) {
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
    const site = this.site
    for (const index of [view.focus + this.direction, view.focus - this.direction]) {
      if (this.prefetching >= PRELOAD) {
        return
      }
      const tile = view.tiles[index]
      const post = tile && this.posts.get(this.mark(site, tile.id))
      const version = post && rendition(post)
      if (!version) {
        continue
      }
      const path = this.origPath(site, post.id, version.ext)
      this.prefetching++
      void this.cached(site, path, version.file)
        .then(() =>
          this.render({ site, id: post.id, path, ext: version.ext, size: 0, using: 'plain', failed: false }, 'plain'),
        )
        .catch(() => {})
        .finally(() => {
          this.prefetching--
        })
    }
  }

  private async render(current: Current, using: 'plain' | 'cut'): Promise<{ clear: number; path: string }> {
    const W = this.cols * this.cell.w
    const H = this.rows * this.cell.h
    const width = Math.min(W, TRY_WIDTH)
    const height = Math.max(1, Math.round((H * width) / W))
    const path = join(
      this.scratch,
      `${current.site.key}-${current.id}${using === 'cut' ? 'c' : ''}-${width}x${height}.png`,
    )
    const key = `${current.site.key}:${current.id}:${using}`
    const known = this.clarity.get(key)
    if (known !== undefined && existsSync(path)) {
      return { clear: known, path }
    }
    const clear = await this.renders.run({
      job: 'show',
      from: using === 'cut' ? (current.cut as string) : current.path,
      to: path,
      width,
      height,
      colors: this.entry,
      tone: this.tone,
    })
    this.clarity.set(key, clear)
    return { clear, path }
  }

  private async present(): Promise<void> {
    const current = this.current
    if (!current) {
      return
    }
    const using = current.using
    const { clear, path } = await this.render(current, using)
    if (this.current !== current || current.using !== using) {
      return
    }
    this.view.shown = {
      id: current.id,
      clear,
      bytes: current.size,
      path,
      cut: current.cut ? (using === 'cut' ? 'on' : 'off') : current.failed ? 'failed' : 'none',
    }
  }

  private reveal(): void {
    const view = this.view
    view.preparing = this.current?.id
    this.flush()
    void this.present()
      .catch((error: unknown) => {
        view.error = error instanceof Error ? error.message : String(error)
      })
      .finally(() => {
        if (view.preparing === this.current?.id) {
          view.preparing = undefined
        }
        this.draw()
      })
  }

  private async install(): Promise<void> {
    const view = this.view
    const tile = view.tiles[view.focus]
    const current = this.current
    if (!tile || current?.id !== tile.id || view.preparing !== undefined || view.shown?.id !== tile.id) {
      return
    }
    view.installing = tile.id
    view.error = undefined
    this.flush()
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
        },
      })
      const known = readCache<string>(current.site, 'owners.json')
      known[current.id] = this.posts.get(this.mark(current.site, current.id))?.owner ?? ''
      writeCache(current.site, 'owners.json', known)
      process.stderr.write(`background · ${this.entry.name} ← ${current.site.name} ${current.id}\n`)
      this.finish(0)
    } catch (error) {
      view.installing = undefined
      view.error = error instanceof Error ? error.message : String(error)
      this.draw()
    }
  }

  private draw(): void {
    if (this.dirty) {
      return
    }
    this.dirty = true
    setImmediate(() => {
      this.dirty = false
      this.flush()
    })
  }

  private flush(): void {
    const frame = renderFind(this.view, this.cols, this.rows)
    let out = '\x1b[?2026h'
    frame.lines.forEach((line, r) => {
      out += `\x1b[${r + 1};1H\x1b[K${line}`
    })
    const keep = new Set<number>()
    for (const p of frame.images) {
      keep.add(p.id)
      if (this.sent.get(p.id) !== p.path) {
        out += transmit(p)
        this.sent.set(p.id, p.path)
        this.placed.delete(p.id)
      }
      const at = `${p.row};${p.col};${p.cols};${p.rows};${p.z}`
      if (this.placed.get(p.id) !== at) {
        out += place(p)
        this.placed.set(p.id, at)
      }
    }
    for (const id of this.sent.keys()) {
      if (!keep.has(id)) {
        out += release(id)
        this.sent.delete(id)
        this.placed.delete(id)
      }
    }
    this.write(`${out}\x1b[?2026l`)
  }
}

function routable(): boolean {
  if (process.versions.bun) {
    return true
  }
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number)
  return major > 22 || (major === 22 && minor >= 21)
}

async function relaunch(): Promise<number> {
  if (!routable()) {
    process.stderr.write(`unblock needs node 22.21 or newer — this is ${process.versions.node}\n`)
    return 1
  }
  const proxy = await tunnel()
  const child = spawn(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_USE_ENV_PROXY: '1',
      NODE_NO_WARNINGS: '1',
      HTTPS_PROXY: `http://127.0.0.1:${proxy.port}`,
      TTHEME_FIND_PROXY: String(proxy.port),
    },
  })
  const code = await new Promise<number>((resolve) => child.on('exit', (status) => resolve(status ?? 1)))
  proxy.close()
  return code
}

export async function runFind(name: string): Promise<number> {
  if (process.env.TTHEME_FIND_UNBLOCK === '1' && !process.env.TTHEME_FIND_PROXY) {
    return relaunch()
  }
  const home = configHome()
  const catalog = readCatalog(home)
  const entry = find(catalog.palettes, name)
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('ttheme find needs a terminal')
  }
  return new Finder(home, catalog, entry, entry.booru ?? '').run()
}
