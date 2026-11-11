import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Tone } from '../../core/backdrop-tone.ts'
import { fileOf, postKey, type Rendition, rendition, type Site } from '../../core/booru.ts'
import type { PaletteEntry } from '../../core/manifest.ts'
import { resized, TUNE, TUNE_SIZE_LEAST } from '../../core/picture-panel.ts'
import { fillSize, rescaled } from '../../pictures/backdrop.ts'
import { canRemoveBackground, keepable, removeBackground } from '../../pictures/cutout.ts'
import type { Pick } from '../../pictures/fit.ts'
import type { Lane, Renderer, Shown } from '../../pictures/render.ts'
import { lineStep } from '../keys.ts'
import type { Hit } from '../zones.ts'
import type { Boards } from './boards.ts'
import type { Kept } from './kept.ts'
import type { Paint } from './paint.ts'
import type { FindSpot, FindView, Notice, Owns, Tile, TrialView, Tuning, Work } from './screen.ts'
import { type Grid, heldPath, type Net, origPath, reason } from './session.ts'
import type { Settings } from './settings.ts'
import type { Thumbs } from './thumbs.ts'

const SETTLE = 150

const PRELOAD = 2

const TRY_WIDTH = 1280

const TUNED_HELD = 16

const STEPS = new Map([
  ['left', -1],
  ['right', 1],
  ['shift-left', -10],
  ['shift-right', 10],
])

export function sameTuning(a: Tuning, b: Tuning): boolean {
  return a.size === b.size && a.at === b.at && a.opacity === b.opacity
}

function scaleOf(opacity: number, base: number): number | undefined {
  return opacity === base || base <= 0 ? undefined : opacity / base
}

export interface Current {
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

function clarityKey(
  current: Current,
  using: Current['using'],
  coloring: FindView['coloring'],
  width: number,
  height: number,
): string {
  return `${current.site.key}:${current.id}:${using}:${coloring}:${width}x${height}`
}

interface Host {
  view: Owns<TrialView>
  grid: () => Grid
  entry: PaletteEntry
  tone: Tone
  blurring: number
  sticker: boolean
  scratch: string
  signal: AbortSignal
  net: Net
  renders: Renderer
  kept: Kept
  paint: Paint
  boards: Boards
  thumbs: Thumbs
  settings: Settings
  inform: () => void
  tell: (notice?: Notice) => void
  focus: (index: number) => void
  openPage: (post: boolean) => void
  fromClipboard: () => Promise<void>
  install: () => void
  landed: () => void
  hint: (text: string) => void
}

interface Job {
  control: AbortController
  timer?: NodeJS.Timeout
  work?: Work
}

interface Showing {
  again: boolean
  over: Promise<Error | undefined>
}

export class Trial {
  current?: Current
  private job?: Job
  private showing?: Showing
  private direction = 1
  private prefetching = 0
  private readonly clarity = new Map<string, Shown>()
  private readonly rendering = new Map<string, Promise<Shown>>()
  private readonly tunedFiles: string[] = []
  private aheadTail: Promise<unknown> = Promise.resolve()
  private readonly twins = new Map<string, boolean>()

  private readonly view: Owns<TrialView>
  private readonly grid: () => Grid
  private readonly entry: PaletteEntry
  private readonly tone: Tone
  private readonly blurring: number
  private readonly sticker: boolean
  private readonly scratch: string
  private readonly signal: AbortSignal
  private readonly net: Net
  private readonly renders: Renderer
  private readonly kept: Kept
  private readonly paint: Paint
  private readonly boards: Boards
  private readonly thumbs: Thumbs
  private readonly settings: Settings
  private readonly inform: () => void
  private readonly tell: (notice?: Notice) => void
  private readonly focus: (index: number) => void
  private readonly openPage: (post: boolean) => void
  private readonly fromClipboard: () => Promise<void>
  private readonly install: () => void
  private readonly landed: () => void
  private readonly hint: (text: string) => void

  constructor(host: Host) {
    this.view = host.view
    this.grid = host.grid
    this.entry = host.entry
    this.tone = host.tone
    this.blurring = host.blurring
    this.sticker = host.sticker
    this.scratch = host.scratch
    this.signal = host.signal
    this.net = host.net
    this.renders = host.renders
    this.kept = host.kept
    this.paint = host.paint
    this.boards = host.boards
    this.thumbs = host.thumbs
    this.settings = host.settings
    this.inform = host.inform
    this.tell = host.tell
    this.focus = host.focus
    this.openPage = host.openPage
    this.fromClipboard = host.fromClipboard
    this.install = host.install
    this.landed = host.landed
    this.hint = host.hint
  }

  get presenting(): boolean {
    return this.showing !== undefined
  }

  enter(): void {
    if (this.view.mode.on === 'grid') {
      this.view.mode = { on: 'try' }
    }
  }

  leave(): void {
    this.cancel()

    if (this.view.work?.step === 'failed') {
      this.view.work = undefined
    }

    this.view.mode = { on: 'grid' }
    this.kept.letGo(new Set())
  }

  tuneOn(field: number, keep = false): void {
    if (this.view.mode.on === 'try' || (this.view.mode.on === 'tune' && !keep)) {
      this.view.mode = { on: 'tune', field }
    }
  }

  forget(): void {
    this.cancel()
    this.current = undefined
    this.view.shown = undefined
  }

  stop(): void {
    this.cancel()
  }

  private cancel(): void {
    const job = this.job

    if (job) {
      this.job = undefined
      job.control.abort()
      clearTimeout(job.timer)
      this.cleared(job.work)
    }
  }

  private doing(job: Job, work?: Work): void {
    if (this.job === job) {
      this.cleared(job.work)
      job.work = work

      if (work) {
        this.view.work = work
      }
    }
  }

  private cleared(work: Work | undefined): void {
    if (work && this.view.work === work) {
      this.view.work = undefined
    }
  }

  tryPoint(spot: FindSpot): void {
    const view = this.view

    if (spot.kind === 'scene') {
      view.scene = spot.scene
      view.details = false
      this.paint.draw()
    } else if (spot.kind === 'field') {
      view.mode = spot.field < 0 ? { on: 'try' } : { on: 'tune', field: spot.field }
      this.paint.draw()
    }
  }

  slide(field: number, hit: Hit): void {
    const view = this.view

    if (view.mode.on === 'grid') {
      return
    }

    const along = Math.min(1, Math.max(0, hit.width > 1 ? hit.x / (hit.width - 1) : 0))
    const fill = view.fill ?? 0
    view.mode = { on: 'tune', field }

    if (field === TUNE.size) {
      const top = Math.max(100, fill)
      const size = TUNE_SIZE_LEAST + Math.round(along * (top - TUNE_SIZE_LEAST + 1))
      view.tune.size = along === 1 || (fill > 0 && size >= fill) ? 'fill' : Math.min(top, size)
    } else {
      view.tune.opacity = Math.round(along * 100) / 100
    }

    this.retune()
  }

  tryKey(key: string): void {
    const view = this.view
    const tile = view.tiles[view.focus]

    if (key === 'enter' && tile && view.work?.step === 'failed' && view.work.key === tile.key) {
      view.work = undefined
      this.tell()
      this.begin(tile, 0)

      return
    }

    if (view.mode.on === 'tune') {
      this.tuneKey(key)

      return
    }

    if (key === 'left' || key === 'right' || key === 'h' || key === 'l' || key === ',' || key === '.') {
      this.direction = key === 'left' || key === 'h' || key === ',' ? -1 : 1
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

    const line = lineStep(key)

    if (line !== undefined) {
      view.mode = { on: 'tune', field: line < 0 ? TUNE.opacity : TUNE.colors }
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
      this.install()

      return
    }

    if (key === 'esc') {
      this.leave()
      this.tell()
      this.paint.draw()
    }
  }

  tuneKey(key: string): void {
    const view = this.view
    const panel = view.mode

    if (panel.on !== 'tune') {
      return
    }

    const tune = view.tune

    if (key === ',' || key === '.') {
      this.direction = key === ',' ? -1 : 1
      this.focus(view.focus + this.direction)

      return
    }

    if (key === 'x') {
      this.swap()

      return
    }

    const line = lineStep(key)

    if (line !== undefined) {
      const next = panel.field + (line < 0 ? -1 : 1)
      view.mode = next < TUNE.colors || next > TUNE.opacity ? { on: 'try' } : { on: 'tune', field: next }
      this.paint.draw()

      return
    }

    const step = STEPS.get(key)

    if (step !== undefined) {
      if (panel.field === TUNE.colors) {
        this.recolor()

        return
      }

      if (panel.field === TUNE.size) {
        tune.size = resized(tune.size, step, view.fill ?? 0)
      } else if (panel.field === TUNE.position) {
        tune.at = ((tune.at - 1 + Math.sign(step) + 9) % 9) + 1
      } else {
        tune.opacity = Math.max(0, Math.min(100, Math.round(tune.opacity * 100) + step)) / 100
        view.rescale = undefined
      }

      this.retune()

      return
    }

    if (/^[1-9]$/.test(key)) {
      view.mode = { on: 'tune', field: TUNE.position }
      tune.at = Number(key)
      this.retune()

      return
    }

    if (key === '=' && panel.field !== TUNE.colors) {
      const base = view.untuned

      if (panel.field === TUNE.size) {
        tune.size = base.size
      } else if (panel.field === TUNE.position) {
        tune.at = base.at
      } else {
        tune.opacity = base.opacity
        view.rescale = undefined
      }

      this.retune()

      return
    }

    if (key === '+') {
      view.tune = { ...view.untuned }
      view.rescale = undefined
      this.retune()

      return
    }

    if (key === 'enter') {
      view.mode = { on: 'try' }
      this.install()
      this.paint.draw()

      return
    }

    if (key === 'c') {
      this.recolor()

      return
    }

    if (key === 'esc') {
      view.mode = { on: 'try' }
      this.tryKey('esc')
    }
  }

  recolor(): void {
    const view = this.view

    if (!this.current || view.shown?.id !== this.current.key) {
      return
    }

    view.rescale ??= scaleOf(view.tune.opacity, view.untuned.opacity)
    view.coloring = view.coloring === 'tone' ? 'original' : 'tone'
    view.tune.opacity = view.untuned.opacity
    view.redraw = { key: this.current.key, from: view.beat, done: false }
    this.paint.draw()
    this.reveal()
  }

  private retune(): void {
    this.paint.draw()

    if (this.current && (this.view.shown?.id === this.current.key || this.showing)) {
      this.reveal()
    }
  }

  select(): void {
    const view = this.view
    const tile = view.tiles[view.focus]
    this.cancel()

    if (view.work?.step === 'failed') {
      view.work = undefined
      this.tell()
    }

    this.inform()

    if (!tile) {
      return
    }

    if (this.current?.key === tile.key) {
      this.reveal()

      return
    }

    this.begin(tile, SETTLE)
    this.paint.draw()
  }

  private begin(tile: Tile, wait: number): void {
    this.cancel()
    const job: Job = { control: new AbortController() }
    this.job = job

    if (wait > 0) {
      job.timer = setTimeout(() => void this.load(tile, job), wait)
    } else {
      void this.load(tile, job)
    }
  }

  private near(): Set<number> {
    const { tiles, focus } = this.view

    return new Set([focus, focus + this.direction, focus - this.direction].flatMap((at) => tiles[at]?.key ?? []))
  }

  private async load(tile: Tile, job: Job): Promise<void> {
    const view = this.view
    const pick = this.boards.posts.get(tile.key)
    const { signal } = job.control
    this.kept.letGo(this.near())

    if (!pick) {
      this.ended(job)

      return
    }

    void this.kept.profile(pick, signal)

    if (!rendition(pick.post)) {
      this.ended(job)

      return
    }

    const { site } = pick
    let instead: Pick | undefined

    try {
      instead = await this.loaded(tile, pick, job)
    } catch (error) {
      if (this.job === job && !this.signal.aborted) {
        this.job = undefined
        view.work = {
          step: 'failed',
          key: tile.key,
          reason: reason(site.name, error instanceof Error ? error : String(error)),
        }
      }
    }

    this.doing(job)
    this.paint.draw()
    const next = instead && this.job === job ? this.swapIn(instead) : undefined

    if (next) {
      await this.load(next, job)
    } else {
      this.ended(job)
    }
  }

  private ended(job: Job): void {
    if (this.job === job) {
      this.job = undefined
    }
  }

  private async loaded(tile: Tile, pick: Pick, job: Job): Promise<Pick | undefined> {
    const view = this.view
    const { site } = pick
    const { signal } = job.control
    await this.net.locate(site, pick.post, signal)
    const version = rendition(pick.post) as Rendition
    const path = origPath(this.scratch, site, tile.id, version.ext)
    const fetching: Work = { step: 'fetch', key: tile.key, got: 0, size: 0 }

    if (!existsSync(path)) {
      this.doing(job, fetching)
      this.paint.draw()
    }

    const from = fileOf(site, pick.post, version)

    const size = await this.kept.cached(
      from.site,
      path,
      from.url,
      (got, total) => {
        if (view.work === fetching) {
          fetching.got = got
          fetching.size = total
          this.paint.draw()
        }
      },
      tile.key,
    )

    if (this.job !== job) {
      return undefined
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

    this.doing(job, { step: 'prepare', key: tile.key })
    this.paint.flush()
    const plain = await this.render(current, 'plain')

    if (this.job !== job) {
      return undefined
    }

    const twin = plain.clear === 0 ? await this.twinOf(pick, path, job) : undefined

    if (twin || this.job !== job) {
      return twin
    }

    if (plain.clear === 0 && canRemoveBackground() && this.settings.setting('TTHEME_FIND_REMOVE_BG') !== 'off') {
      this.doing(job, { step: 'cut', key: tile.key })
      this.paint.flush()
      current.cut = await this.cutOut(site, tile.id, path, signal)

      if (this.job !== job) {
        return undefined
      }

      this.doing(job)

      if (current.cut) {
        this.doing(job, { step: 'prepare', key: tile.key })
        this.paint.flush()
        const made = await this.render(current, 'cut').catch(() => undefined)

        if (this.job !== job) {
          return undefined
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
      const failure = await this.show()

      if (failure) {
        throw failure
      }
    }

    this.preload()

    return undefined
  }

  private async twinOf(pick: Pick, whole: string, job: Job): Promise<Pick | undefined> {
    const view = this.view
    const group = this.boards.board.groups.find((held) => !held.open && held.posts[0] === pick)

    for (const other of group?.posts.slice(1) ?? []) {
      const key = postKey(other.site, other.post.id)
      const verdict = `${postKey(pick.site, pick.post.id)}>${key}`

      if (this.twins.get(verdict) === false || !(await this.kept.transparent(other.site, other.post))) {
        continue
      }

      const version = rendition(other.post)

      if (this.job !== job || version?.ext !== 'png') {
        continue
      }

      try {
        const path = origPath(this.scratch, other.site, other.post.id, version.ext)
        const from = fileOf(other.site, other.post, version)
        const fetching: Work = { step: 'fetch', key, got: 0, size: 0 }
        this.doing(job, fetching)
        await this.kept.cached(
          from.site,
          path,
          from.url,
          (got, total) => {
            if (view.work === fetching) {
              fetching.got = got
              fetching.size = total
              this.paint.draw()
            }
          },
          postKey(pick.site, pick.post.id),
        )
        this.doing(job, { step: 'prepare', key })
        this.paint.flush()
        const same = this.twins.get(verdict) ?? (await this.renders.run({ job: 'twin', cut: path, whole }))
        this.twins.set(verdict, same)

        if (same && group?.posts.includes(other) && this.job === job) {
          group.posts.splice(group.posts.indexOf(other), 1)
          group.posts.unshift(other)

          return other
        }
      } catch {
        if (this.job === job) {
          this.twins.set(verdict, false)
        }
      } finally {
        this.doing(job)
      }
    }

    return undefined
  }

  private swapIn(twin: Pick): Tile | undefined {
    const view = this.view
    const key = postKey(twin.site, twin.post.id)

    if (!this.thumbs.known(key)) {
      this.thumbs.want(twin)
    }

    this.boards.show()
    this.inform()
    const tile = view.tiles[view.focus]

    if (tile?.key !== key) {
      return undefined
    }

    this.hint(`Trying ${twin.site.name} ${twin.post.id}, the same picture with a transparent background`)

    return tile
  }

  private async cutOut(site: Site, id: number, path: string, signal: AbortSignal): Promise<string | undefined> {
    const out = heldPath(this.scratch, site, 'cut', `${id}.png`)

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
    const view = this.view
    const current = this.current

    if (!current?.cut || view.shown?.id !== current.key || view.tiles[view.focus]?.key !== current.key) {
      return
    }

    current.using = current.using === 'cut' ? 'plain' : 'cut'
    const { width, height } = this.tryBox()
    const known = this.clarity.get(clarityKey(current, current.using, view.coloring, width, height))
    view.shown = { ...view.shown, cut: current.using === 'cut' ? 'on' : 'off', clear: known?.clear ?? view.shown.clear }
    view.redraw = { key: current.key, from: view.beat, done: false }
    this.reveal()
  }

  private tryBox() {
    const W = this.grid().cols * this.grid().cell.w
    const H = this.grid().rows * this.grid().cell.h
    const width = Math.min(W, TRY_WIDTH)

    return { width, height: Math.max(1, Math.round((H * width) / W)) }
  }

  private inTurn<T>(work: () => Promise<T>): Promise<T> {
    const run = this.aheadTail.then(work)
    this.aheadTail = run.catch(() => undefined)

    return run
  }

  private preload(): void {
    const view = this.view

    if (view.mode.on === 'grid') {
      return
    }

    for (const index of [view.focus + this.direction, view.focus - this.direction]) {
      const tile = view.tiles[index]
      const pick = tile && this.boards.posts.get(tile.key)

      if (pick) {
        void this.kept.profile(pick, this.signal)
      }

      if (this.prefetching >= PRELOAD || !pick || !rendition(pick.post)) {
        continue
      }

      const { site, post } = pick
      this.prefetching++
      void this.net
        .locate(site, post, this.signal)
        .then(async () => {
          const version = rendition(post) as Rendition
          const path = origPath(this.scratch, site, post.id, version.ext)
          const from = fileOf(site, post, version)
          await this.kept.cached(from.site, path, from.url, undefined, tile.key)

          return this.inTurn(() =>
            this.render(
              { site, id: post.id, key: tile.key, path, ext: version.ext, size: 0, using: 'plain', failed: false },
              'plain',
              'ahead',
            ),
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
    lane?: Lane,
  ): Promise<{ clear: number; path: string; opacity: number; touched: boolean }> {
    const W = this.grid().cols * this.grid().cell.w
    const H = this.grid().rows * this.grid().cell.h
    const { width, height } = this.tryBox()
    const tune = { ...this.view.tune }
    const { coloring } = this.view
    const touched = tune.opacity !== this.view.untuned.opacity
    const scale = touched ? undefined : this.view.rescale
    const tuned = !sameTuning(tune, this.view.untuned) || scale !== undefined

    const strength = touched
      ? `-${Math.round(tune.opacity * 100)}`
      : scale === undefined
        ? ''
        : `-x${Math.round(scale * 100)}`

    const mark = tuned ? `-${tune.size}-${tune.at}${strength}` : ''

    const path = join(
      this.scratch,
      `${current.site.key}-${current.id}${using === 'cut' ? 'c' : ''}${coloring === 'original' ? 'o' : ''}-${width}x${height}${mark}.png`,
    )

    const key = clarityKey(current, using, coloring, width, height)
    const known = this.clarity.get(key)

    if (known && existsSync(path)) {
      current.fill = known.fill

      return { clear: known.clear, path, opacity: known.opacity, touched }
    }

    let job = this.rendering.get(path)

    if (!job) {
      job = this.renders
        .run(
          {
            job: 'show',
            from: using === 'cut' ? (current.cut as string) : current.path,
            cut: using === 'cut',
            to: path,
            width,
            height,
            colors: this.entry,
            tone: this.tone,
            blur: (this.blurring * width) / fillSize(W, H).width,
            sticker: this.sticker,
            coloring,
            ...(tuned
              ? {
                  tune: {
                    size: tune.size,
                    at: tune.at,
                    ...(touched ? { opacity: tune.opacity } : {}),
                    ...(scale === undefined ? {} : { scale }),
                  },
                }
              : {}),
          },
          lane,
        )
        .then((shown) => {
          this.clarity.set(key, shown)

          if (tuned) {
            this.keepTuned(path)
          }

          return shown
        })
        .finally(() => {
          this.rendering.delete(path)
        })

      this.rendering.set(path, job)
    }

    const made = await job
    current.fill = made.fill

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
      this.view.tune.opacity = this.view.rescale === undefined ? opacity : rescaled(this.view.rescale, 1, opacity)
      this.view.rescale = undefined
    }

    if (current.fill) {
      this.view.fill = current.fill
    }

    this.view.shown = {
      id: current.key,
      clear,
      bytes: current.size,
      path,
      cut: current.cut ? (using === 'cut' ? 'on' : 'off') : current.failed ? 'failed' : 'none',
    }
  }

  reveal(): void {
    if (this.showing) {
      this.showing.again = true

      return
    }

    void this.show().then((failure) => {
      if (failure) {
        this.tell({ text: failure.message, tone: 'error' })
        this.paint.draw()
      }
    })
  }

  private show(): Promise<Error | undefined> {
    if (this.showing) {
      this.showing.again = true

      return this.showing.over
    }

    const showing: Showing = { again: false, over: Promise.resolve(undefined) }
    this.showing = showing
    showing.over = this.shows(showing)

    return showing.over
  }

  private async shows(showing: Showing): Promise<Error | undefined> {
    const view = this.view
    let failure: Error | undefined

    do {
      showing.again = false
      failure = undefined
      const work: Work | undefined = this.current && { step: 'prepare', key: this.current.key }

      if (work && !view.work) {
        view.work = work
      }

      this.paint.flush()

      try {
        await this.present()
      } catch (error) {
        failure = error instanceof Error ? error : new Error(String(error))
      }

      this.cleared(work)
    } while (showing.again)

    this.showing = undefined

    if (view.redraw) {
      view.redraw.done = true
    }

    this.landed()
    this.paint.draw()

    return failure
  }
}
