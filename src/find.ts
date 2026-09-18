import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { backdropTone, installBackdrop, origins, type Tone, tryOn } from './backdrop.ts'
import {
  cacheDir,
  extension,
  fetchBytes,
  fetchCount,
  fetchPost,
  fetchPosts,
  headOf,
  mates,
  originHost,
  PAGE,
  type Post,
  SITES,
  type Site,
  safe,
} from './booru.ts'
import { find, readCatalog } from './catalog.ts'
import type { Manifest, PaletteEntry } from './emit/manifest.ts'
import {
  decodeKeys,
  type FindView,
  gridShape,
  MIN,
  place,
  release,
  renderFind,
  TILE,
  type Tile,
  transmit,
} from './find-screen.ts'
import { configHome } from './palettes.ts'
import { contain, decodeImage, encodePng, type Rgba, transparency } from './png.ts'

const WORKERS = 4
const SETTLE = 150
const TRY_WIDTH = 1280
const LOOKAHEAD = 1

interface Source {
  tags: string
  page: number
  done: boolean
}

interface Current {
  site: Site
  id: number
  image: Rgba
  bytes: Uint8Array
  ext: string
  clear: number
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
  return typeof code === 'string' ? code : error.message || error.name
}

function reason(site: Site, error: unknown): string {
  return `${site.name}: ${describe(error)}`
}

function tick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
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
  private sources: Source[] = []
  private queue: Post[] = []
  private readonly seen = new Set<number>()
  private readonly posts = new Map<number, Post>()
  private siteIndex = 0
  private readonly owners = new Map<string, Map<string, string[]>>()
  private thumbQueue: Tile[] = []
  private thumbing = 0
  private readonly sent = new Map<number, string>()
  private readonly placed = new Map<number, string>()
  private current?: Current
  private fetch?: AbortController
  private settle?: NodeJS.Timeout
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
      preset: 'cutouts',
      colors: { cursor: entry.cursor, selection: entry.selection, ansi: entry.ansi },
      tiles: [],
      checked: 0,
      total: 0,
      searching: true,
      focus: 0,
      top: 0,
      mode: 'grid',
      help: false,
    }
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
    const cell = await this.probe()
    if (cell) {
      this.cell = cell
      void this.search()
    } else {
      this.view.searching = false
      this.view.error = 'this terminal does not report its cell size — find needs kitty graphics'
    }
    this.draw()
    const code = await exit
    this.session.abort()
    this.fetch?.abort()
    clearTimeout(this.settle)
    stdin.off('data', this.onData)
    stdout.off('resize', this.onResize)
    this.write('\x1b_Ga=d,d=A,q=2\x1b\\\x1b[H\x1b[J')
    stdin.setRawMode(false)
    stdin.pause()
    rmSync(this.scratch, { recursive: true, force: true })
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
      this.write('\x1b[16t')
    })
  }

  private readonly onData = (chunk: Buffer): void => {
    this.input += chunk.toString('utf8')
    if (this.probeWait) {
      const at = this.input.indexOf('\x1b[6;')
      const m = at === -1 ? null : /^\[6;(\d+);(\d+)t/.exec(this.input.slice(at + 1))
      if (!m) {
        return
      }
      this.input = this.input.slice(0, at) + this.input.slice(at + 1 + m[0].length)
      this.probeWait({ h: Number(m[1]), w: Number(m[2]) })
    }
    const keys = decodeKeys(this.input)
    this.input = ''
    for (const key of keys) {
      this.key(key)
    }
  }

  private readonly onResize = (): void => {
    this.cols = process.stdout.columns || this.cols
    this.rows = process.stdout.rows || this.rows
    this.scroll()
    if (this.view.mode === 'try' && this.current) {
      this.present()
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
    if (key === 'tab') {
      view.preset = view.preset === 'cutouts' ? 'all' : 'cutouts'
      void this.search()
      return
    }
    if (key === 'p') {
      this.siteIndex = (this.siteIndex + 1) % SITES.length
      this.current = undefined
      view.shown = undefined
      view.site = this.site.name
      view.siteAnsi = this.site.ansi
      view.nextSite = this.nextSite.name
      void this.search()
      return
    }
    if (key === 'esc') {
      this.finish(2)
    }
  }

  private tryKey(key: string): void {
    const view = this.view
    if (key === 'left' || key === 'right') {
      this.focus(view.focus + (key === 'left' ? -1 : 1))
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
  }

  private async search(): Promise<void> {
    const gen = ++this.gen
    const view = this.view
    Object.assign(view, { tiles: [], checked: 0, total: 0, searching: true, focus: 0, top: 0, error: undefined })
    this.seen.clear()
    this.queue = []
    this.sources = []
    this.thumbQueue = []
    this.draw()
    const site = this.site
    const tags = view.preset === 'cutouts' ? `${view.tag} ${site.cutouts}` : view.tag
    try {
      const [total, owners] = await Promise.all([fetchCount(site, tags, this.signal), this.mateOwners(site)])
      if (gen !== this.gen) {
        return
      }
      view.total = total
      this.sources = [
        ...[...owners.keys()].map((owner) => ({ tags: `${tags} user:${owner}`, page: 0, done: false })),
        { tags, page: 0, done: false },
      ]
      this.draw()
      await this.pump()
    } catch (error) {
      this.fail(gen, error)
    }
  }

  private fail(gen: number, error: unknown): void {
    if (gen !== this.gen || this.signal.aborted) {
      return
    }
    this.view.error = reason(this.site, error)
    this.view.searching = false
    this.draw()
  }

  private wants(): boolean {
    const view = this.view
    if (view.checked < Math.min(view.total, PAGE)) {
      return true
    }
    const { perRow, rowsVis } = gridShape(this.cols, this.rows)
    return view.tiles.length < (view.top + rowsVis + LOOKAHEAD) * perRow
  }

  private async pump(): Promise<void> {
    const gen = this.gen
    if (this.pumping === gen || this.sources.length === 0) {
      return
    }
    this.pumping = gen
    const view = this.view
    try {
      view.searching = true
      while (gen === this.gen && this.wants()) {
        if (this.queue.length === 0) {
          const source = this.sources.find((s) => !s.done)
          if (!source) {
            break
          }
          const posts = await fetchPosts(this.site, source.tags, source.page, this.signal)
          if (gen !== this.gen) {
            return
          }
          source.page++
          source.done = posts.length < PAGE
          for (const post of posts) {
            if (!this.seen.has(post.id)) {
              this.seen.add(post.id)
              this.queue.push(post)
            }
          }
          continue
        }
        const batch = this.queue.splice(0, WORKERS)
        const passed = await Promise.all(batch.map((post) => this.passes(post)))
        if (gen !== this.gen) {
          return
        }
        batch.forEach((post, i) => {
          view.checked++
          if (passed[i]) {
            this.admit(post)
          }
        })
        this.draw()
      }
      if (gen === this.gen) {
        view.searching = false
        this.draw()
      }
    } catch (error) {
      this.fail(gen, error)
    } finally {
      if (this.pumping === gen) {
        this.pumping = 0
      }
    }
  }

  private async passes(post: Post): Promise<boolean> {
    if (!safe(post)) {
      return false
    }
    if (this.view.preset === 'all') {
      return ['png', 'jpg', 'jpeg'].includes(post.ext)
    }
    if (post.ext !== 'png') {
      return false
    }
    if (this.site.vouched) {
      return true
    }
    try {
      return (await headOf(this.site, post.file, this.signal))?.alpha === true
    } catch {
      return false
    }
  }

  private admit(post: Post): void {
    const tile: Tile = {
      id: post.id,
      width: post.width,
      height: post.height,
      owner: post.owner,
      origin: originHost(post.source),
      mates: this.owners.get(this.site.key)?.get(post.owner) ?? [],
    }
    this.posts.set(post.id, post)
    this.view.tiles.push(tile)
    this.thumbQueue.push(tile)
    this.thumbs()
  }

  private async mateOwners(site: Site): Promise<Map<string, string[]>> {
    const cached = this.owners.get(site.key)
    if (cached) {
      return cached
    }
    const found = origins(this.home)
    const cachePath = join(cacheDir(site), 'owners.json')
    let known: Record<string, string> = {}
    try {
      known = JSON.parse(readFileSync(cachePath, 'utf8')) as Record<string, string>
    } catch {}
    const byPalette = new Map<string, string>()
    for (const sibling of this.catalog.palettes) {
      const origin = found.get(sibling.name)
      if (sibling.group !== this.entry.group || sibling.name === this.entry.name || origin?.site !== site.key) {
        continue
      }
      let owner = known[origin.id]
      if (owner === undefined) {
        try {
          owner = (await fetchPost(site, origin.id, this.signal))?.owner ?? ''
          known[origin.id] = owner
        } catch {
          continue
        }
      }
      byPalette.set(sibling.name, owner)
    }
    mkdirSync(dirname(cachePath), { recursive: true })
    writeFileSync(cachePath, `${JSON.stringify(known)}\n`)
    const owners = mates(byPalette)
    this.owners.set(site.key, owners)
    return owners
  }

  private async cached(site: Site, path: string, url: string): Promise<Uint8Array> {
    if (existsSync(path)) {
      return new Uint8Array(readFileSync(path))
    }
    const bytes = await fetchBytes(site, url, this.signal)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, bytes)
    return bytes
  }

  private thumbs(): void {
    while (this.thumbing < WORKERS && this.thumbQueue.length > 0) {
      const tile = this.thumbQueue.shift() as Tile
      this.thumbing++
      this.thumb(tile)
        .catch(() => {})
        .finally(() => {
          this.thumbing--
          this.thumbs()
        })
    }
  }

  private async thumb(tile: Tile): Promise<void> {
    const post = this.posts.get(tile.id)
    const site = this.site
    if (!post) {
      return
    }
    const w = TILE.cols * this.cell.w
    const h = TILE.rows * this.cell.h
    const path = join(cacheDir(site), 'tile', `${tile.id}-${w}x${h}.png`)
    if (!existsSync(path)) {
      const thumb = join(cacheDir(site), 'thumb', `${tile.id}.${extension(post.preview)}`)
      const bytes = await this.cached(site, thumb, post.preview)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, encodePng(contain(decodeImage(bytes), w, h)))
    }
    tile.thumb = path
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
      this.present()
      this.draw()
      return
    }
    this.settle = setTimeout(() => void this.load(tile), SETTLE)
    this.draw()
  }

  private async load(tile: Tile): Promise<void> {
    const view = this.view
    const post = this.posts.get(tile.id)
    if (!post) {
      return
    }
    const site = this.site
    const control = new AbortController()
    this.fetch = control
    const signal = AbortSignal.any([this.signal, control.signal])
    try {
      const path = join(cacheDir(site), 'orig', `${tile.id}.${post.ext}`)
      let bytes: Uint8Array
      if (existsSync(path)) {
        bytes = new Uint8Array(readFileSync(path))
      } else {
        view.fetching = { id: tile.id, got: 0, size: 0 }
        this.draw()
        bytes = await fetchBytes(site, post.file, signal, (got, size) => {
          if (view.fetching?.id === tile.id) {
            view.fetching = { id: tile.id, got, size }
            this.draw()
          }
        })
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, bytes)
      }
      if (control.signal.aborted) {
        return
      }
      view.fetching = undefined
      view.preparing = tile.id
      this.flush()
      await tick()
      const image = decodeImage(bytes)
      if (site !== this.site) {
        return
      }
      this.current = { site, id: tile.id, image, bytes, ext: post.ext, clear: transparency(image) }
      if (view.tiles[view.focus]?.id === tile.id) {
        this.present()
      }
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
      this.draw()
    }
  }

  private present(): void {
    const current = this.current
    if (!current) {
      return
    }
    const W = this.cols * this.cell.w
    const H = this.rows * this.cell.h
    const width = Math.min(W, TRY_WIDTH)
    const height = Math.max(1, Math.round((H * width) / W))
    const path = join(this.scratch, `${current.id}-${width}x${height}.png`)
    if (!existsSync(path)) {
      writeFileSync(path, encodePng(tryOn(current.image, this.entry, this.tone, width, height)))
    }
    this.view.shown = { id: current.id, clear: current.clear, bytes: current.bytes.length, path }
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
    await tick()
    try {
      installBackdrop(this.home, this.entry, this.tone, current.image, {
        site: current.site.key,
        id: current.id,
        ext: current.ext,
        bytes: current.bytes,
        from: `${current.site.name} ${current.id} ${current.site.pageUrl(current.id)}`,
      })
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

export async function runFind(name: string): Promise<number> {
  const home = configHome()
  const catalog = readCatalog(home)
  const entry = find(catalog.palettes, name)
  if (!entry.booru) {
    throw new Error(`${name} has no booru tag to search for`)
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('ttheme find needs a terminal')
  }
  return new Finder(home, catalog, entry, entry.booru).run()
}
