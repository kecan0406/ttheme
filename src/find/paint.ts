import { rmSync } from 'node:fs'
import { join } from 'node:path'
import cells from 'fast-string-width'
import { type Hex, rgb } from '../color.ts'
import type { Renderer } from '../render.ts'
import {
  cropsInBands,
  layersUnderCells,
  movesPlacements,
  readsFiles,
  viewsInWindow,
  viewVar,
  wipesPlacements,
} from '../terminal.ts'
import {
  type FindView,
  gridShape,
  type Placement,
  place,
  release,
  renderFind,
  TILE,
  TRY_ID,
  transmit,
  unplace,
} from './screen.ts'

const COVER_ID = 2 ** 31 - 3
const ANCHOR_ID = 2 ** 31 - 2
const COVER_Z = -1073741827
const ANCHOR_Z = -1073741828
const TICK = 80
const GLIDE = 16
const GLIDE_SHARE = 0.4
const BAND_ID = 3 * 2 ** 30
const BANDS_HELD = 256

function marginOf(raw: string | undefined): { x: number; y: number } | undefined {
  const m = /^(\d+) (\d+)$/.exec(raw ?? '')
  return m && (Number(m[1]) > 0 || Number(m[2]) > 0) ? { x: Number(m[1]), y: Number(m[2]) } : undefined
}

const MARGIN = marginOf(process.env.TTHEME_BG_MARGIN)

export interface Grid {
  cols: number
  rows: number
  cell: { w: number; h: number }
}

export interface Canvas {
  view: FindView
  grid: () => Grid
  background: Hex
  renders: Renderer
  scratch: string
  signal: AbortSignal
  write: (text: string) => void
}

export class Paint {
  private screen: string[] = []
  private dirty = false
  private ticking?: NodeJS.Timeout
  private gliding?: NodeJS.Timeout
  private readonly sent = new Map<number, string>()
  private readonly placed = new Map<number, string>()
  private covered = ''
  private viewed = ''
  private readonly bands = cropsInBands(process.env)
  private readonly files = readsFiles(process.env)
  private readonly moves = movesPlacements(process.env)
  private readonly layers = layersUnderCells(process.env)
  private readonly wipes = wipesPlacements(process.env)
  private readonly views = viewsInWindow(process.env)
  private readonly bandFiles = new Map<string, { id: number; path: string; ready: boolean }>()
  private nextBand = BAND_ID

  private readonly view: FindView
  private readonly grid: () => Grid
  private readonly background: Hex
  private readonly renders: Renderer
  private readonly scratch: string
  private readonly signal: AbortSignal
  private readonly write: (text: string) => void

  constructor(canvas: Canvas) {
    this.view = canvas.view
    this.grid = canvas.grid
    this.background = canvas.background
    this.renders = canvas.renders
    this.scratch = canvas.scratch
    this.signal = canvas.signal
    this.write = canvas.write
  }

  draw(): void {
    if (this.dirty || this.signal.aborted) {
      return
    }
    this.dirty = true
    setImmediate(() => {
      this.dirty = false
      this.flush()
    })
  }

  flush(): void {
    if (this.signal.aborted) {
      return
    }
    const { cols, rows, cell } = this.grid()
    const frame = renderFind(this.view, cols, rows)
    this.view.loaderFrom = frame.loader ? (this.view.loaderFrom ?? this.view.beat) : undefined
    let out = ''
    const wiped = new Set<number>()
    frame.lines.forEach((line, r) => {
      if (this.screen[r] !== line) {
        out += `\x1b[${r + 1};1H\x1b[K${line}`
        this.screen[r] = line
        wiped.add(r)
      }
    })
    const keep = new Set<number>()
    let tried: Placement | undefined
    for (const wanted of frame.images) {
      if (this.views && wanted.id >= TRY_ID) {
        tried = wanted
        continue
      }
      const p = this.bands ? this.banded(wanted) : wanted
      if (!p) {
        continue
      }
      if (this.wipes && [...wiped].some((r) => r >= p.row && r < p.row + p.rows)) {
        this.placed.delete(p.id)
      }
      keep.add(p.id)
      if (this.sent.get(p.id) !== p.path) {
        const data = transmit(p, this.files)
        if (data === undefined) {
          continue
        }
        out += data
        this.sent.set(p.id, p.path)
        this.placed.delete(p.id)
      }
      const at = `${p.row};${p.col};${p.cols};${p.rows};${p.crop};${p.z}`
      if (this.placed.get(p.id) !== at) {
        if (!this.moves && this.placed.has(p.id)) {
          out += unplace(p.id)
        }
        out += place(p, cell)
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
    out += this.views ? this.backdrop(tried) : this.cover()
    const caret = this.view.mode === 'grid' && this.view.editing !== undefined ? this.caret() : ''
    if (out || caret) {
      this.write(`\x1b[?2026h${out}${caret}\x1b[?2026l`)
    }
    this.pace(frame.tick)
  }

  glide(): void {
    if (this.bands) {
      this.prebake()
    }
    if (this.gliding) {
      return
    }
    const { cols, rows } = this.grid()
    const span = gridShape(cols, rows).height
    const step = (): void => {
      const view = this.view
      const target = view.top * TILE.height
      let d = target - view.scroll
      if (d === 0 || view.mode !== 'grid') {
        view.scroll = target
        const settled = this.gliding !== undefined
        this.gliding = undefined
        if (settled) {
          this.draw()
        }
        return
      }
      if (Math.abs(d) > 2 * span) {
        view.scroll = target - Math.sign(d) * span
        d = target - view.scroll
      }
      view.scroll += Math.sign(d) * Math.max(1, Math.round(Math.abs(d) * GLIDE_SHARE))
      this.draw()
      this.gliding = setTimeout(step, GLIDE)
    }
    step()
  }

  snap(): void {
    clearTimeout(this.gliding)
    this.gliding = undefined
    this.view.scroll = this.view.top * TILE.height
  }

  resized(): void {
    this.screen = []
  }

  stop(): void {
    clearInterval(this.ticking)
    clearTimeout(this.gliding)
  }

  private prebake(): void {
    const view = this.view
    const { cols, rows } = this.grid()
    for (const p of renderFind({ ...view, scroll: view.top * TILE.height }, cols, rows).images) {
      if (p.crop !== undefined) {
        this.band(p.path, p.crop, p.rows)
      }
    }
  }

  private cover(): string {
    const { cols, rows } = this.grid()
    const at = `${cols};${rows}`
    if (!this.layers || this.covered === at) {
      return ''
    }
    let out = ''
    if (!this.covered) {
      const pixel = Buffer.from(rgb(this.background)).toString('base64')
      out += `\x1b_Ga=t,f=24,s=1,v=1,i=${COVER_ID},q=2;${pixel}\x1b\\`
      if (MARGIN) {
        out += `\x1b_Ga=t,f=32,s=1,v=1,i=${ANCHOR_ID},q=2;AAAAAA==\x1b\\\x1b[H\x1b_Ga=p,i=${ANCHOR_ID},p=${ANCHOR_ID},c=1,r=1,C=1,z=${ANCHOR_Z},q=2\x1b\\`
      }
    } else if (!this.moves) {
      out += unplace(COVER_ID)
    }
    this.covered = at
    if (MARGIN) {
      const { x, y } = MARGIN
      return `${out}\x1b_Ga=p,i=${COVER_ID},p=${COVER_ID},P=${ANCHOR_ID},Q=${ANCHOR_ID},H=${-x},V=${-y},c=${cols + 2 * x},r=${rows + 2 * y},C=1,z=${COVER_Z},q=2\x1b\\`
    }
    return `${out}\x1b[H\x1b_Ga=p,i=${COVER_ID},p=${COVER_ID},c=${cols},r=${rows},C=1,z=${COVER_Z},q=2\x1b\\`
  }

  private backdrop(tried: Placement | undefined): string {
    const { cols, rows, cell } = this.grid()
    const W = cols * cell.w
    const H = rows * cell.h
    const view = tried
      ? `${this.background}|${tried.path}|1|${W}|${H}|${W}|${H}|0|0|1`
      : `${this.background}||1|${W}|${H}|0|0|0|0|5`
    if (view === this.viewed) {
      return ''
    }
    this.viewed = view
    return viewVar(view)
  }

  private caret(): string {
    return `\x1b[1;${Math.min(this.grid().cols, cells(`⌕ ${this.view.editing ?? ''}`) + 1)}H`
  }

  private pace(tick: boolean): void {
    if (tick) {
      this.ticking ??= setInterval(() => {
        this.view.beat++
        this.draw()
      }, TICK)
    } else if (this.ticking) {
      clearInterval(this.ticking)
      this.ticking = undefined
    }
  }

  private banded(p: Placement): Placement | undefined {
    if (p.crop === undefined) {
      return p
    }
    const band = this.band(p.path, p.crop, p.rows, !this.gliding)
    return band?.ready ? { ...p, id: band.id, path: band.path, crop: undefined } : undefined
  }

  private band(
    from: string,
    crop: number,
    rows: number,
    make = true,
  ): { id: number; path: string; ready: boolean } | undefined {
    const key = `${from}|${crop}|${rows}`
    const held = this.bandFiles.get(key)
    if (held || !make) {
      return held
    }
    const { cell } = this.grid()
    const id = this.nextBand++
    const made = { id, path: join(this.scratch, `band-${id}.png`), ready: false }
    this.bandFiles.set(key, made)
    this.renders
      .run({ job: 'band', from, to: made.path, y: crop * cell.h, height: rows * cell.h })
      .then(() => {
        made.ready = true
        this.draw()
      })
      .catch(() => {})
    this.trimBands()
    return made
  }

  private trimBands(): void {
    for (const [key, band] of this.bandFiles) {
      if (this.bandFiles.size <= BANDS_HELD) {
        return
      }
      if (band.ready && !this.sent.has(band.id)) {
        this.bandFiles.delete(key)
        rmSync(band.path, { force: true })
      }
    }
  }
}
