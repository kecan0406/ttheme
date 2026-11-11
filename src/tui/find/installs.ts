import { homedir } from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'
import type { Tone } from '../../core/backdrop-tone.ts'
import { type Post, sourcePage } from '../../core/booru.ts'
import type { PaletteEntry } from '../../core/manifest.ts'
import { POSITIONS } from '../../core/theme.ts'
import type { Tune } from '../../pictures/backdrop.ts'
import type { Renderer } from '../../pictures/render.ts'
import type { Tone as NoticeTone } from '../bar.ts'
import type { Boards } from './boards.ts'
import type { Kept } from './kept.ts'
import type { Paint } from './paint.ts'
import { type FindView, type InstallsView, layerOf, type Notice, type Owns, type Tuning } from './screen.ts'
import type { Grid } from './session.ts'
import type { Thumbs } from './thumbs.ts'
import { type Current, sameTuning, type Trial } from './trial.ts'

const PROFILE_WAIT = 5000

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

interface Queued {
  current: Current
  from: string
  tune: Tune | undefined
  coloring: FindView['coloring']
  framing: string
  post: Post | undefined
  profiled: Promise<unknown>
  touches: number
}

interface Host {
  view: Owns<InstallsView>
  grid: () => Grid
  home: string
  entry: PaletteEntry
  tone: Tone
  blurring: number
  sticker: boolean
  signal: AbortSignal
  renders: Renderer
  kept: Kept
  paint: Paint
  boards: Boards
  thumbs: Thumbs
  trial: Trial
  notice: (text: string, tone?: NoticeTone, ms?: number) => void
  tell: (notice?: Notice) => void
  finish: (code: number) => void
  aligns: () => boolean
  refreshes: () => boolean
  refresh: () => Promise<void>
}

export class Installs {
  touches = 0
  private readonly queue: Queued[] = []
  private asked?: { key: number; touches: number }

  private readonly view: Owns<InstallsView>
  private readonly grid: () => Grid
  private readonly home: string
  private readonly entry: PaletteEntry
  private readonly tone: Tone
  private readonly blurring: number
  private readonly sticker: boolean
  private readonly signal: AbortSignal
  private readonly renders: Renderer
  private readonly kept: Kept
  private readonly paint: Paint
  private readonly boards: Boards
  private readonly thumbs: Thumbs
  private readonly trial: Trial
  private readonly notice: (text: string, tone?: NoticeTone, ms?: number) => void
  private readonly tell: (notice?: Notice) => void
  private readonly finish: (code: number) => void
  private readonly aligns: () => boolean
  private readonly refreshes: () => boolean
  private readonly refresh: () => Promise<void>

  constructor(host: Host) {
    this.view = host.view
    this.grid = host.grid
    this.home = host.home
    this.entry = host.entry
    this.tone = host.tone
    this.blurring = host.blurring
    this.sticker = host.sticker
    this.signal = host.signal
    this.renders = host.renders
    this.kept = host.kept
    this.paint = host.paint
    this.boards = host.boards
    this.thumbs = host.thumbs
    this.trial = host.trial
    this.notice = host.notice
    this.tell = host.tell
    this.finish = host.finish
    this.aligns = host.aligns
    this.refreshes = host.refreshes
    this.refresh = host.refresh
  }

  unsave(): void {
    this.view.saved = undefined
  }

  leave(code: number): void {
    if (this.queue.length === 0 && !this.asked) {
      this.finish(code)

      return
    }

    this.view.closing = { code }
    this.paint.draw()
  }

  landed(): void {
    const view = this.view
    const asked = this.asked
    this.asked = undefined

    if (asked && view.tiles[view.focus]?.key === asked.key) {
      this.install(asked.touches)
    }

    this.rest()
  }

  private rest(): void {
    const closing = this.view.closing

    if (closing && this.queue.length === 0 && !this.asked && !this.signal.aborted) {
      this.finish(closing.code)
    }
  }

  install(touches = this.touches): void {
    const view = this.view
    const tile = view.tiles[view.focus]
    const current = this.trial.current

    if (!tile || current?.key !== tile.key || view.shown?.id !== tile.key) {
      return
    }

    if (this.trial.presenting) {
      this.asked = { key: tile.key, touches }

      return
    }

    if (this.queue.some((queued) => queued.current.key === tile.key)) {
      this.notice('Already in the queue', 'info')

      return
    }

    if (this.queue.length === 0) {
      this.tell()
    }

    const tune = toTune(view.tune, view.untuned)
    const pick = this.boards.posts.get(current.key)
    const { size, at, opacity } = view.tune

    this.queue.push({
      current,
      from: current.using === 'cut' ? (current.cut as string) : current.path,
      tune,
      coloring: view.coloring,
      framing: tune ? `  ${size === 'fill' ? 'fill' : `${size}%`}  ${POSITIONS[at - 1]}  ${opacity.toFixed(2)}` : '',
      post: pick?.post,
      profiled: pick
        ? Promise.race([this.kept.profile(pick, this.signal), sleep(PROFILE_WAIT, undefined, { ref: false })])
        : Promise.resolve(),
      touches,
    })

    this.showQueue()
    this.paint.flush()

    if (this.queue.length === 1) {
      void this.installQueue()
    }
  }

  private showQueue(): void {
    this.view.queue = this.queue.map((queued) => queued.current.key)
  }

  private async installQueue(): Promise<void> {
    for (let next = this.queue[0]; next && !this.signal.aborted; next = this.queue[0]) {
      await this.installOne(next)
      this.queue.shift()
      this.showQueue()
      this.paint.draw()
    }

    this.rest()
  }

  private async installOne({ current, from, tune, coloring, framing, post, profiled, touches }: Queued): Promise<void> {
    const view = this.view

    try {
      await profiled
      await this.renders.run({
        job: 'backdrop',
        from,
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
        width: this.grid().cols * this.grid().cell.w,
        height: this.grid().rows * this.grid().cell.h,
        blur: this.blurring,
        sticker: this.sticker,
        coloring,
        ...(tune ? { tune, aligns: this.aligns(), user: homedir() } : {}),
      })
      this.kept.owned(current.site, current.id, post?.owner ?? '')

      if (this.refreshes()) {
        await this.refresh()
      }

      this.thumbs.holds()
      const by = post?.named.artist.length ? `${post.named.artist.join(', ')}  ` : ''
      view.saved = {
        text: `Background  ${this.entry.name} ← ${by}${current.site.name} ${current.id}${framing}`,
        key: current.key,
      }
      view.installed.push(current.key)

      if (layerOf(view).on === 'try' && this.touches === touches && view.tiles[view.focus]?.key === current.key) {
        this.trial.leave()
      }
    } catch (error) {
      if (!this.signal.aborted) {
        this.notice(
          `${current.site.name} ${current.id} — ${error instanceof Error ? error.message : String(error)}`,
          'error',
        )
      }
    }
  }
}
