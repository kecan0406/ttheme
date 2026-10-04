import { closeSync, mkdtempSync, openSync, readSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { backgroundsDir, frameAt, type Picture, readBackdrop, readStore } from './backdrop.ts'
import { type Hex, rgb } from './color.ts'
import { release, transmit } from './find/screen.ts'
import { colorless } from './osc.ts'
import { colorsOf } from './palette-editor.ts'
import { Renderer } from './render.ts'
import { cropsInBands, layersUnderCells, readsFiles, showsPictures, viewsInWindow, viewVar } from './terminal.ts'
import { POSITIONS } from './theme.ts'
import { drafted, pictureOf, Tints } from './tints.ts'

const COVER_ID = 2 ** 31 - 23
const VEIL_ID = 2 ** 31 - 22
const PICTURE_ID = 2 ** 31 - 21
const COVER_Z = -1073741831
const PICTURE_Z = -1073741830
const VEIL_Z = -1073741829
const BANDS_HELD = 4

type Env = Record<string, string | undefined>

interface Cell {
  w: number
  h: number
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface Area {
  col: number
  row: number
  cols: number
  rows: number
}

export interface Rect {
  col: number
  row: number
  cols: number
  rows: number
  x: number
  y: number
  w: number
  h: number
}

interface Held {
  picture: Picture
  image: string
  opacity: number
  cover: boolean
  at: number
}

interface Look {
  image: string
  opacity: number
  width: number
  height: number
  box: Box
  rect: Rect
}

export function cellRect(width: number, height: number, area: Area, cell: Cell, box: Box): Rect | undefined {
  const t = Math.trunc
  const left = area.col * cell.w
  const top = area.row * cell.h
  const c0 = t((Math.max(box.x, left) + cell.w - 1) / cell.w)
  const c1 = t(Math.min(box.x + box.w, left + area.cols * cell.w) / cell.w)
  const r0 = t((Math.max(box.y, top) + cell.h - 1) / cell.h)
  const r1 = t(Math.min(box.y + box.h, top + area.rows * cell.h) / cell.h)
  if (c1 <= c0 || r1 <= r0) {
    return undefined
  }
  return {
    col: c0,
    row: r0,
    cols: c1 - c0,
    rows: r1 - r0,
    x: t(((c0 * cell.w - box.x) * width) / box.w),
    y: t(((r0 * cell.h - box.y) * height) / box.h),
    w: t(((c1 - c0) * cell.w * width) / box.w),
    h: t(((r1 - r0) * cell.h * height) / box.h),
  }
}

function sizeOf(path: string): { width: number; height: number } | undefined {
  try {
    const fd = openSync(path, 'r')
    const head = Buffer.alloc(24)
    readSync(fd, head, 0, 24, 0)
    closeSync(fd)
    return head.readUInt32BE(0) === 0x89504e47
      ? { width: head.readUInt32BE(16), height: head.readUInt32BE(20) }
      : undefined
  } catch {
    return undefined
  }
}

export class Backdrop {
  ready: () => void = () => {}
  private cell: Cell = { w: 0, h: 0 }
  private held: Held | undefined
  private readonly tints = new Tints()
  private readonly sent = new Map<number, string>()
  private readonly placed = new Map<number, string>()
  private viewed = ''
  private renders: Renderer | undefined
  private scratch: string | undefined
  private made = 0
  private readonly bands = new Map<string, { path: string; ready: boolean }>()

  private readonly home: string
  private readonly name: string
  private readonly views: boolean
  private readonly banded: boolean
  private readonly files: boolean

  static of(env: Env, home: string, name: string, terminals: readonly string[]): Backdrop | undefined {
    if (colorless(env) || !showsPictures(env, terminals) || !(layersUnderCells(env) || viewsInWindow(env))) {
      return undefined
    }
    return new Backdrop(env, home, name)
  }

  constructor(env: Env, home: string, name: string) {
    this.home = home
    this.name = name
    this.views = viewsInWindow(env)
    this.banded = cropsInBands(env)
    this.files = readsFiles(env)
  }

  get laid(): boolean {
    return this.cell.w > 0
  }

  measured(cell: Cell): void {
    if (this.cell.w === 0 && cell.w > 0 && cell.h > 0) {
      this.cell = cell
    }
  }

  load(): void {
    const dir = backgroundsDir(this.home)
    const shown = readBackdrop(dir, this.name, homedir())
    let pictures: Picture[] = []
    try {
      pictures = readStore(dir).palettes[this.name]?.pictures ?? []
    } catch {}
    const picture = shown ? pictureOf(pictures, shown.image) : undefined
    this.held =
      shown && picture
        ? {
            picture,
            image: shown.image,
            opacity: shown.opacity,
            cover: shown.cover,
            at: (POSITIONS as readonly string[]).indexOf(shown.position) + 1 || 5,
          }
        : undefined
  }

  draw(
    list: readonly Hex[],
    signature: readonly string[],
    waive: readonly string[],
    cols: number,
    rows: number,
    area: Area = { col: 0, row: 0, cols, rows },
  ): string {
    if (this.cell.w === 0) {
      return ''
    }
    const background = list[0] as Hex
    const look = this.look(list, signature, waive, area, !this.views || (area.cols === cols && area.rows === rows))
    if (this.views) {
      const W = cols * this.cell.w
      const H = rows * this.cell.h
      const view = look
        ? `${background}|${look.image}|${look.opacity}|${W}|${H}|${look.box.w}|${look.box.h}|${look.box.x}|${look.box.y}|${this.held?.at ?? 5}`
        : `${background}||1|${W}|${H}|0|0|0|0|5`
      if (view === this.viewed) {
        return ''
      }
      this.viewed = view
      return viewVar(view)
    }
    let out = this.layer(COVER_ID, COVER_Z, 'f=24', Buffer.from(rgb(background)), area)
    if (look) {
      const alpha = Math.max(0, Math.min(255, Math.round((1 - look.opacity) * 255)))
      out += this.picture(look)
      out += this.layer(VEIL_ID, VEIL_Z, 'f=32', Buffer.from([...rgb(background), alpha]), area)
    } else {
      out += this.drop(PICTURE_ID) + this.drop(VEIL_ID)
    }
    return out
  }

  resized(): void {
    this.sent.clear()
    this.placed.clear()
    this.viewed = ''
  }

  clear(): string {
    let out = this.views && this.viewed ? viewVar('') : ''
    for (const id of this.sent.keys()) {
      out += release(id)
    }
    this.resized()
    return out
  }

  close(): string {
    const out = this.clear()
    this.tints.clear()
    this.renders?.close()
    if (this.scratch) {
      rmSync(this.scratch, { recursive: true, force: true })
    }
    return out
  }

  private look(
    list: readonly Hex[],
    signature: readonly string[],
    waive: readonly string[],
    area: Area,
    spills: boolean,
  ): Look | undefined {
    const held = this.held
    if (!held) {
      return undefined
    }
    const colors = { name: this.name, ...colorsOf([...list]), waived: [...waive] }
    const image = drafted(held.picture, held.image, colors, signature, this.tints)
    const size = sizeOf(image)
    if (!size) {
      return undefined
    }
    const framed = frameAt(
      size.width,
      size.height,
      area.cols * this.cell.w,
      area.rows * this.cell.h,
      100,
      held.at,
      held.cover && spills,
    )
    const box = { ...framed, x: framed.x + area.col * this.cell.w, y: framed.y + area.row * this.cell.h }
    const rect = cellRect(size.width, size.height, area, this.cell, box)
    if (!rect) {
      return undefined
    }
    return {
      image,
      opacity: held.opacity,
      ...size,
      box,
      rect,
    }
  }

  private layer(id: number, z: number, format: string, pixel: Buffer, plate: Area): string {
    const data = pixel.toString('base64')
    const key = `${data}|${plate.col}|${plate.row}|${plate.cols}|${plate.rows}`
    if (this.placed.get(id) === key) {
      return ''
    }
    this.sent.set(id, key)
    this.placed.set(id, key)
    return `\x1b_Ga=t,${format},s=1,v=1,i=${id},q=2;${data}\x1b\\\x1b[${plate.row + 1};${plate.col + 1}H\x1b_Ga=p,i=${id},p=${id},c=${plate.cols},r=${plate.rows},C=1,z=${z},q=2\x1b\\`
  }

  private picture(look: Look): string {
    let path = look.image
    let rect = look.rect
    if (this.banded && (2 * rect.y + rect.h - look.height) ** 2 > 1) {
      const band = this.band(look.image, rect.y, rect.h)
      if (!band.ready) {
        return ''
      }
      path = band.path
      rect = { ...rect, y: 0 }
    }
    let out = ''
    if (this.sent.get(PICTURE_ID) !== path) {
      const data = transmit({ id: PICTURE_ID, path, row: 0, col: 0, cols: 0, rows: 0, z: PICTURE_Z }, this.files)
      if (data === undefined) {
        return ''
      }
      out += data
      this.sent.set(PICTURE_ID, path)
      this.placed.delete(PICTURE_ID)
    }
    const at = `${rect.col};${rect.row};${rect.cols};${rect.rows};${rect.x};${rect.y};${rect.w};${rect.h}`
    if (this.placed.get(PICTURE_ID) !== at) {
      out += `\x1b[${rect.row + 1};${rect.col + 1}H\x1b_Ga=p,i=${PICTURE_ID},p=${PICTURE_ID},x=${rect.x},y=${rect.y},w=${rect.w},h=${rect.h},c=${rect.cols},r=${rect.rows},C=1,z=${PICTURE_Z},q=2\x1b\\`
      this.placed.set(PICTURE_ID, at)
    }
    return out
  }

  private drop(id: number): string {
    if (!this.sent.has(id)) {
      return ''
    }
    this.sent.delete(id)
    this.placed.delete(id)
    return release(id)
  }

  private band(from: string, y: number, height: number): { path: string; ready: boolean } {
    const key = `${from}|${y}|${height}`
    const held = this.bands.get(key)
    if (held) {
      return held
    }
    this.scratch ??= mkdtempSync(join(tmpdir(), 'ttheme-edit-'))
    this.renders ??= new Renderer()
    const band = { path: join(this.scratch, `band-${++this.made}.png`), ready: false }
    this.bands.set(key, band)
    this.renders
      .run({ job: 'band', from, to: band.path, y, height })
      .then(() => {
        band.ready = true
        this.ready()
      })
      .catch(() => {})
    for (const [old, made] of this.bands) {
      if (this.bands.size <= BANDS_HELD) {
        break
      }
      if (made.ready && made.path !== this.sent.get(PICTURE_ID)) {
        this.bands.delete(old)
        rmSync(made.path, { force: true })
      }
    }
    return band
  }
}
