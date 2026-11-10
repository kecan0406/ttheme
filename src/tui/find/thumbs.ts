import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { postKey, previewOf, SITES } from '../../core/booru.ts'
import type { PaletteEntry } from '../../core/manifest.ts'
import { backgroundsDir, rackOf } from '../../pictures/backdrop.ts'
import type { Pick } from '../../pictures/fit.ts'
import type { Renderer } from '../../pictures/render.ts'
import { LOCAL } from './attach.ts'
import type { Kept } from './kept.ts'
import type { Paint } from './paint.ts'
import { type FindView, HELD, type Held, heldFit, TILE } from './screen.ts'
import { type Grid, heldPath, previewPath, previewStem } from './session.ts'

export const THUMB = 12

export function heldOf(home: string, name: string): Held[] {
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

interface Host {
  view: FindView
  grid: () => Grid
  home: string
  entry: PaletteEntry
  scratch: string
  signal: AbortSignal
  renders: Renderer
  kept: Kept
  paint: Paint
  show: () => void
}

export class Thumbs {
  private readonly thumbPath = new Map<number, string>()
  private thumbQueue: Pick[] = []
  private readonly heldFiles = new Map<string, string>()
  private readonly heldAsked = new Set<string>()
  private thumbing = 0
  private readonly thumbless = new Set<number>()

  private readonly view: FindView
  private readonly grid: () => Grid
  private readonly home: string
  private readonly entry: PaletteEntry
  private readonly scratch: string
  private readonly signal: AbortSignal
  private readonly renders: Renderer
  private readonly kept: Kept
  private readonly paint: Paint
  private readonly show: () => void

  constructor(host: Host) {
    this.view = host.view
    this.grid = host.grid
    this.home = host.home
    this.entry = host.entry
    this.scratch = host.scratch
    this.signal = host.signal
    this.renders = host.renders
    this.kept = host.kept
    this.paint = host.paint
    this.show = host.show
  }

  known(key: number): boolean {
    return this.thumbPath.has(key)
  }

  pathOf(key: number): string | undefined {
    return this.thumbPath.get(key)
  }

  missing(key: number): boolean {
    return this.thumbless.has(key)
  }

  want(...picks: Pick[]): void {
    this.thumbQueue.push(...picks)
    this.thumbs()
  }

  holds(): void {
    this.view.held = heldOf(this.home, this.entry.name).map((held) => {
      const thumb = this.heldFiles.get(held.from)

      return thumb ? { ...held, thumb } : held
    })
    this.holdThumbs()
  }

  holdThumbs(): void {
    const w = HELD.cols * this.grid().cell.w
    const h = HELD.rows * this.grid().cell.h

    if (w === 0 || h === 0) {
      return
    }

    for (const held of this.view.held.slice(0, heldFit(this.grid().cols))) {
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
    const w = TILE.cols * this.grid().cell.w
    const h = TILE.rows * this.grid().cell.h
    const from = previewOf(site, post)
    const path = heldPath(this.scratch, site, 'tile', `${previewStem(post.id, from.url)}-${w}x${h}.png`)

    if (!existsSync(path)) {
      const thumb = previewPath(this.scratch, pick)
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
}
