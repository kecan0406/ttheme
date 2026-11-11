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
import { cap } from '../keycaps.ts'
import { lineStep } from '../keys.ts'
import type { Hit } from '../zones.ts'
import type { Boards } from './boards.ts'
import type { Kept } from './kept.ts'
import type { Paint } from './paint.ts'
import type { FindSpot, FindView, Notice, Owns, Tile, TrialView, TunePanel, Tuning } from './screen.ts'
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
  install: (touches?: number) => void
  hint: (text: string) => void
}

export class Trial {
  current?: Current
  presenting = false
  installAfter?: { key: number; touches: number }
  private fetch?: AbortController
  private settle?: NodeJS.Timeout
  private direction = 1
  private prefetching = 0
  private readonly clarity = new Map<string, Shown>()
  private readonly rendering = new Map<string, Promise<Shown>>()
  private readonly tunedFiles: string[] = []
  private aheadTail: Promise<unknown> = Promise.resolve()
  private again = false
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
  private readonly install: (touches?: number) => void
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
    this.hint = host.hint
  }

  enter(): void {
    this.view.mode = 'try'
  }

  leave(): void {
    this.view.mode = 'grid'
  }

  tuneOn(field: number, keep = false): void {
    if (!keep || !this.view.tuning) {
      this.view.tuning = { field }
    }
  }

  forget(): void {
    this.current = undefined
    this.view.shown = undefined
  }

  halt(): void {
    this.fetch?.abort()
  }

  stop(): void {
    this.fetch?.abort()
    clearTimeout(this.settle)
  }

  quiet(): void {
    this.fetch?.abort()
    clearTimeout(this.settle)
    this.view.fetching = undefined
  }

  tryPoint(spot: FindSpot): void {
    const view = this.view

    if (spot.kind === 'scene') {
      view.scene = spot.scene
      view.details = false
      this.paint.draw()
    } else if (spot.kind === 'field') {
      view.tuning = spot.field < 0 ? undefined : { field: spot.field }
      this.paint.draw()
    }
  }

  slide(field: number, hit: Hit): void {
    const view = this.view
    const along = Math.min(1, Math.max(0, hit.width > 1 ? hit.x / (hit.width - 1) : 0))
    const fill = view.fill ?? 0
    view.tuning = { field }

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

    if (key === 'enter' && tile && view.failed === tile.key) {
      view.failed = undefined
      this.tell()
      void this.load(tile)

      return
    }

    if (view.tuning) {
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
      view.tuning = { field: line < 0 ? TUNE.opacity : TUNE.colors }
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
      this.fetch?.abort()
      clearTimeout(this.settle)
      view.fetching = undefined
      view.failed = undefined
      view.mode = 'grid'
      this.tell()
      this.paint.draw()
    }
  }

  tuneKey(key: string): void {
    const view = this.view
    const panel = view.tuning as TunePanel
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
      view.tuning = next < TUNE.colors || next > TUNE.opacity ? undefined : { field: next }
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
      panel.field = TUNE.position
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
      view.tuning = undefined
      this.install()
      this.paint.draw()

      return
    }

    if (key === 'c') {
      this.recolor()

      return
    }

    if (key === 'esc') {
      view.tuning = undefined
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

    if (this.current && this.view.shown?.id === this.current.key) {
      this.reveal()
    }
  }

  select(): void {
    const view = this.view
    const tile = view.tiles[view.focus]
    this.fetch?.abort()
    clearTimeout(this.settle)
    view.fetching = undefined

    if (view.failed !== undefined) {
      view.failed = undefined
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

    this.settle = setTimeout(() => void this.load(tile), SETTLE)
    this.paint.draw()
  }

  private async load(tile: Tile): Promise<void> {
    const view = this.view
    const pick = this.boards.posts.get(tile.key)

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
    const board = this.boards.board
    let instead: Pick | undefined

    try {
      await this.net.locate(site, pick.post, control.signal)
      const version = rendition(pick.post) as Rendition
      const path = origPath(this.scratch, site, tile.id, version.ext)

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

      if (board !== this.boards.board) {
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

      if (control.signal.aborted || board !== this.boards.board) {
        return
      }

      instead = plain.clear === 0 ? await this.twinOf(pick, path, control.signal) : undefined

      if (instead || control.signal.aborted || board !== this.boards.board) {
        return
      }

      if (plain.clear === 0 && canRemoveBackground() && this.settings.setting('TTHEME_FIND_REMOVE_BG') !== 'off') {
        view.preparing = undefined
        view.cutting = tile.key
        this.paint.flush()
        current.cut = await this.cutOut(site, tile.id, path, control.signal)

        if (control.signal.aborted || board !== this.boards.board) {
          return
        }

        view.cutting = undefined

        if (current.cut) {
          view.preparing = tile.key
          this.paint.flush()
          const made = await this.render(current, 'cut').catch(() => undefined)

          if (control.signal.aborted || board !== this.boards.board) {
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
        const told = reason(site.name, error instanceof Error ? error : String(error))
        view.failed = tile.key
        this.tell({ text: `${told} — ${cap('enter')} tries again`, tone: 'error' })
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

    const next = instead && board === this.boards.board ? this.swapIn(instead) : undefined

    if (next) {
      await this.load(next)
    }
  }

  private async twinOf(pick: Pick, whole: string, signal: AbortSignal): Promise<Pick | undefined> {
    const view = this.view
    const group = this.boards.board.groups.find((held) => !held.open && held.posts[0] === pick)

    for (const other of group?.posts.slice(1) ?? []) {
      const key = postKey(other.site, other.post.id)
      const verdict = `${postKey(pick.site, pick.post.id)}>${key}`

      if (this.twins.get(verdict) === false || !(await this.kept.transparent(other.site, other.post))) {
        continue
      }

      const version = rendition(other.post)

      if (signal.aborted || version?.ext !== 'png') {
        continue
      }

      try {
        const path = origPath(this.scratch, other.site, other.post.id, version.ext)
        const from = fileOf(other.site, other.post, version)
        view.fetching = { id: key, got: 0, size: 0 }
        await this.kept.cached(from.site, path, from.url, (got, total) => {
          if (view.fetching?.id === key) {
            view.fetching = { id: key, got, size: total }
            this.paint.draw()
          }
        })
        view.fetching = undefined
        view.preparing = key
        this.paint.flush()
        const same = this.twins.get(verdict) ?? (await this.renders.run({ job: 'twin', cut: path, whole }))
        this.twins.set(verdict, same)

        if (same && group?.posts.includes(other) && !signal.aborted) {
          group.posts.splice(group.posts.indexOf(other), 1)
          group.posts.unshift(other)

          return other
        }
      } catch {
        this.twins.set(verdict, false)
      } finally {
        if (view.fetching?.id === key) {
          view.fetching = undefined
        }

        if (view.preparing === key) {
          view.preparing = undefined
        }
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

    if (view.mode !== 'try') {
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
          await this.kept.cached(from.site, path, from.url)

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
    const view = this.view

    if (this.presenting) {
      this.again = true

      return
    }

    this.presenting = true
    view.preparing = this.current?.key
    this.paint.flush()
    void this.presented()
  }

  private async presented(): Promise<void> {
    const view = this.view

    try {
      await this.present()
    } catch (error) {
      this.tell({ text: error instanceof Error ? error.message : String(error), tone: 'error' })
    }

    this.presenting = false

    if (this.again) {
      this.again = false
      this.reveal()

      return
    }

    if (view.preparing === this.current?.key) {
      view.preparing = undefined
    }

    if (view.redraw) {
      view.redraw.done = true
    }

    const asked = this.installAfter
    this.installAfter = undefined

    if (asked && view.tiles[view.focus]?.key === asked.key) {
      this.install(asked.touches)
    }

    this.paint.draw()
  }
}
