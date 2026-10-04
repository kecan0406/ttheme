import { type Hex, luminance, mix, rgb } from './color.ts'
import { edgeChroma, srgb } from './fix.ts'
import { colorless } from './osc.ts'
import { encodeRgba, type Rgba } from './png.ts'
import { layersUnderCells, showsPictures } from './terminal.ts'

export const PLANE_TOP = 0.98
export const PLANE_BOTTOM = 0.12
const PLANE_CHROMA = 0.37
const RAINBOW_L = 0.74
const RAINBOW_C = 0.15

const PANEL_Z = -1073741828
const ART_Z = -1073741827
const ORIGIN_Z = -1073741826
const THUMB_Z = -1073741825
const FIRST_ID = 2 ** 31 - 64
const NAMES = [
  'panel',
  'plane',
  'hue',
  'contrast',
  'mark',
  'hue-thumb',
  'contrast-thumb',
  'origin',
  'hue-origin',
  'contrast-origin',
] as const
const CHUNK = 4096

type Env = Record<string, string | undefined>
type Name = (typeof NAMES)[number]
type Color = [number, number, number, number]

export interface Cell {
  w: number
  h: number
}

export interface Box {
  row: number
  col: number
  cols: number
  rows: number
}

export interface Art {
  panel: Box
  ground: Hex
  ink: Hex
  accent: Hex
  plane: Box & { h: number; l: number; c: number }
  hue: Box & { h: number; color: Hex }
  contrast: Box & { at: number; floor: number | undefined; color: Hex; lit: boolean }
  tabs: Box & { active: number; count: number }
  field: Box
  divider: number | undefined
  origin: { l: number; c: number; h: number; color: Hex; at: number } | undefined
}

interface Piece {
  name: Name
  key: string
  box: Box
  z: number
  paint: () => Rgba
}

interface Shown {
  key: string
  id: number
  at: string
}

export function reach(l: number, h: number): number {
  return edgeChroma(l, h, PLANE_CHROMA)
}

export function shareOf(l: number, c: number, h: number): number {
  const most = reach(l, h)
  return most > 1e-6 ? Math.min(1, c / most) : 0
}

function canvas(width: number, height: number): Rgba {
  return { width, height, data: new Uint8Array(width * height * 4) }
}

function blend(image: Rgba, x: number, y: number, color: Color, cover: number): void {
  const a = color[3] * cover
  if (a <= 0 || x < 0 || y < 0 || x >= image.width || y >= image.height) {
    return
  }
  const i = (y * image.width + x) * 4
  const d = image.data
  if (a >= 1) {
    d[i] = color[0]
    d[i + 1] = color[1]
    d[i + 2] = color[2]
    d[i + 3] = 255
    return
  }
  const da = (d[i + 3] as number) / 255
  const out = a + da * (1 - a)
  for (let k = 0; k < 3; k++) {
    d[i + k] = Math.round(((color[k] as number) * a + (d[i + k] as number) * da * (1 - a)) / out)
  }
  d[i + 3] = Math.round(out * 255)
}

function rgbaOf(hex: Hex, alpha = 1): Color {
  return [...rgb(hex), alpha]
}

function roundRect(x: number, y: number, left: number, top: number, w: number, h: number, r: number): number {
  const cx = Math.abs(x - (left + w / 2)) - (w / 2 - r)
  const cy = Math.abs(y - (top + h / 2)) - (h / 2 - r)
  return Math.hypot(Math.max(cx, 0), Math.max(cy, 0)) + Math.min(Math.max(cx, cy), 0) - r
}

interface Mask {
  at: Uint32Array
  cover: Float32Array
}

function maskOf(width: number, height: number, cover: (x: number, y: number) => number, area?: Rect): Mask {
  const at: number[] = []
  const covers: number[] = []
  const x0 = Math.max(0, Math.floor(area?.x ?? 0))
  const y0 = Math.max(0, Math.floor(area?.y ?? 0))
  const x1 = Math.min(width, Math.ceil(area ? area.x + area.w : width))
  const y1 = Math.min(height, Math.ceil(area ? area.y + area.h : height))
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const c = cover(x + 0.5, y + 0.5)
      if (c > 0.002) {
        at.push(y * width + x)
        covers.push(Math.min(1, c))
      }
    }
  }
  return { at: Uint32Array.from(at), cover: Float32Array.from(covers) }
}

function paint(image: Rgba, mask: Mask, color: Color): void {
  for (let k = 0; k < mask.at.length; k++) {
    const i = mask.at[k] as number
    blend(image, i % image.width, Math.floor(i / image.width), color, mask.cover[k] as number)
  }
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function fill(rect: Rect, r: number): (x: number, y: number) => number {
  return (x, y) => Math.max(0, 0.5 - roundRect(x, y, rect.x, rect.y, rect.w, rect.h, r))
}

function stroke(rect: Rect, r: number, width: number): (x: number, y: number) => number {
  return (x, y) =>
    Math.max(0, 0.5 - Math.abs(roundRect(x, y, rect.x, rect.y, rect.w, rect.h, r) + width / 2) + width / 2)
}

interface PanelMasks {
  shadow: Mask
  fill: Mask
  border: Mask
  track: Mask
  segment: Mask
  field: Mask
  divider: Mask | undefined
}

const panels = new Map<string, PanelMasks>()

function panelMasks(art: Art, cell: Cell, width: number, height: number): PanelMasks {
  const key = `${cell.w}x${cell.h} ${panelKey({ ...art, ground: '#000000', ink: '#000000', accent: '#000000' })}`
  const held = panels.get(key)
  if (held) {
    return held
  }
  const { panel } = art
  const body = { x: cell.w, y: 0, w: panel.cols * cell.w, h: panel.rows * cell.h }
  const radius = Math.round(cell.h * 0.45)
  const lift = Math.round(cell.h * 0.18)
  const blur = cell.h * 0.6
  const line = Math.max(1, Math.round(cell.h / 22))
  const at = (box: Box) => ({ x: (box.col - panel.col + 1) * cell.w, y: (box.row - panel.row) * cell.h })
  const inset = Math.max(1, Math.round(cell.h * 0.08))
  const tabs = at(art.tabs)
  const track = { x: tabs.x, y: tabs.y + inset, w: art.tabs.cols * cell.w, h: cell.h - 2 * inset }
  const segment = Math.floor(art.tabs.cols / art.tabs.count) * cell.w
  const pad = Math.max(1, Math.round(inset / 2))
  const active = {
    x: track.x + art.tabs.active * segment + pad,
    y: track.y + pad,
    w: (art.tabs.active === art.tabs.count - 1 ? track.w - art.tabs.active * segment : segment) - 2 * pad,
    h: track.h - 2 * pad,
  }
  const field = at(art.field)
  const box = { x: field.x, y: field.y + inset, w: art.field.cols * cell.w, h: cell.h - 2 * inset }
  const divider =
    art.divider === undefined
      ? undefined
      : { x: body.x + cell.w * 0.6, y: (art.divider - panel.row) * cell.h, w: body.w - cell.w * 1.2, h: line }
  const masks: PanelMasks = {
    shadow: maskOf(width, height, (x, y) => {
      const d = roundRect(x, y, body.x, lift, body.w, body.h, radius)
      return d > 0 && d < blur ? (1 - d / blur) ** 2 : 0
    }),
    fill: maskOf(width, height, fill(body, radius), body),
    border: maskOf(width, height, stroke(body, radius, line), body),
    track: maskOf(width, height, fill(track, track.h * 0.3), track),
    segment: maskOf(width, height, fill(active, active.h * 0.3), active),
    field: maskOf(width, height, stroke(box, box.h * 0.3, line), box),
    divider: divider && maskOf(width, height, () => 1, divider),
  }
  if (panels.size > 8) {
    panels.clear()
  }
  panels.set(key, masks)
  return masks
}

function surfaceOf(art: Pick<Art, 'ground' | 'ink'>): { dark: boolean; surface: Hex } {
  const dark = luminance(art.ground) < 0.18
  return { dark, surface: mix(art.ground, art.ink, dark ? 0.07 : 0.04) }
}

export function panelPixels(art: Art, cell: Cell): Rgba {
  const image = canvas((art.panel.cols + 2) * cell.w, (art.panel.rows + 1) * cell.h)
  const masks = panelMasks(art, cell, image.width, image.height)
  const { dark, surface } = surfaceOf(art)
  paint(image, masks.shadow, [0, 0, 0, dark ? 0.45 : 0.18])
  paint(image, masks.fill, rgbaOf(surface))
  paint(image, masks.border, rgbaOf(art.ink, dark ? 0.16 : 0.2))
  paint(image, masks.track, rgbaOf(art.ink, dark ? 0.06 : 0.07))
  paint(image, masks.segment, rgbaOf(art.accent, dark ? 0.24 : 0.2))
  paint(image, masks.field, rgbaOf(art.ink, dark ? 0.22 : 0.28))
  if (masks.divider) {
    paint(image, masks.divider, rgbaOf(art.ink, dark ? 0.12 : 0.16))
  }
  return image
}

export function planePixels(box: Box, h: number, cell: Cell): Rgba {
  const image = canvas(Math.round(box.cols * cell.w), Math.round(box.rows * cell.h))
  const { width, height, data } = image
  const radius = Math.round(cell.h * 0.3)
  const span = Math.max(1, (box.cols - 1) * cell.w)
  const share = (x: number) => Math.min(1, Math.max(0, (x + 0.5 - cell.w / 2) / span))
  const rows = box.rows * 2 - 1
  const lightness = (y: number) =>
    PLANE_TOP - Math.min(1, Math.max(0, (((y + 0.5) / cell.h) * 2 - 0.5) / rows)) * (PLANE_TOP - PLANE_BOTTOM)
  let row: number[][] = []
  for (let y = 0; y < height; y++) {
    if (y % 2 === 0) {
      const l = lightness(y + 0.5)
      const most = reach(l, h)
      row = Array.from({ length: Math.ceil(width / 2) }, (_, k) => srgb(l, share(k * 2 + 0.5) * most, h) ?? [0, 0, 0])
    }
    for (let x = 0; x < width; x++) {
      const near = (x < radius || x >= width - radius) && (y < radius || y >= height - radius)
      const shape = near ? Math.min(1, Math.max(0, 0.5 - roundRect(x + 0.5, y + 0.5, 0, 0, width, height, radius))) : 1
      if (shape <= 0) {
        continue
      }
      const color = row[x >> 1] as number[]
      const i = (y * width + x) * 4
      data[i] = color[0] as number
      data[i + 1] = color[1] as number
      data[i + 2] = color[2] as number
      data[i + 3] = Math.round(shape * 255)
    }
  }
  return image
}

function pill(cell: Cell, cols: number): { top: number; height: number; width: number } {
  const height = Math.max(4, Math.round(cell.h * 0.42))
  return { top: Math.round((cell.h - height) / 2), height, width: cols * cell.w }
}

export function huePixels(art: Art['hue'], cell: Cell): Rgba {
  const image = canvas(art.cols * cell.w, cell.h)
  const { top, height, width } = pill(cell, art.cols)
  const colors = Array.from({ length: width }, (_, x) => {
    const along = Math.min(1, Math.max(0, ((x + 0.5) / cell.w - 0.5) / Math.max(1, art.cols - 1)))
    const h = along * 360
    return srgb(RAINBOW_L, edgeChroma(RAINBOW_L, h, RAINBOW_C), h) ?? [0, 0, 0]
  })
  for (let y = top; y < top + height; y++) {
    for (let x = 0; x < width; x++) {
      const shape = Math.min(1, Math.max(0, 0.5 - roundRect(x + 0.5, y + 0.5, 0, top, width, height, height / 2)))
      const color = colors[x] as number[]
      blend(image, x, y, [color[0] as number, color[1] as number, color[2] as number, 1], shape)
    }
  }
  return image
}

export function contrastPixels(art: Art['contrast'], ink: Hex, cell: Cell): Rgba {
  const image = canvas(art.cols * cell.w, cell.h)
  const { top, height, width } = pill(cell, art.cols)
  const tick = art.floor === undefined ? -1 : Math.round((art.floor * (art.cols - 1) + 0.5) * cell.w)
  const thin = Math.max(2, Math.round(height * 0.45))
  const thinTop = top + Math.round((height - thin) / 2)
  for (let y = thinTop; y < thinTop + thin; y++) {
    for (let x = 0; x < width; x++) {
      const shape = Math.min(1, Math.max(0, 0.5 - roundRect(x + 0.5, y + 0.5, 0, thinTop, width, thin, thin / 2)))
      const passes = tick < 0 || x >= tick
      blend(image, x, y, rgbaOf(ink, passes ? (art.lit ? 0.5 : 0.36) : 0.14), shape)
    }
  }
  if (tick >= 0) {
    const w = Math.max(2, Math.round(cell.w / 5))
    for (let y = top - 1; y < top + height + 1; y++) {
      for (let x = tick - Math.floor(w / 2); x < tick - Math.floor(w / 2) + w; x++) {
        blend(image, x, y, rgbaOf(ink, 0.85), 1)
      }
    }
  }
  return image
}

export function thumbPixels(
  cols: number,
  rows: number,
  x: number,
  y: number,
  radius: number,
  fill: Hex | undefined,
  cell: Cell,
): Rgba {
  const image = canvas(cols * cell.w, rows * cell.h)
  const ring = Math.max(2, Math.round(radius * 0.3))
  const cover = (r: number, d: number) => Math.min(1, Math.max(0, r - d + 0.5))
  const dark: Color = [0, 0, 0, 0.5]
  for (let py = 0; py < image.height; py++) {
    for (let px = 0; px < image.width; px++) {
      const d = Math.hypot(px + 0.5 - x, py + 0.5 - y)
      if (fill) {
        blend(image, px, py, rgbaOf(fill), cover(radius - ring, d))
      } else {
        blend(image, px, py, dark, cover(radius - ring, d) - cover(radius - ring - 1, d))
      }
      blend(image, px, py, dark, cover(radius + 1, d) - cover(radius, d))
      blend(image, px, py, [255, 255, 255, 1], cover(radius, d) - cover(radius - ring, d))
    }
  }
  return image
}

function thumb(
  name: Name,
  cx: number,
  cy: number,
  radius: number,
  fill: Hex | undefined,
  cell: Cell,
  z = THUMB_Z,
): Piece {
  const c0 = Math.floor((cx - radius - 2) / cell.w)
  const c1 = Math.floor((cx + radius + 2) / cell.w)
  const r0 = Math.floor((cy - radius - 2) / cell.h)
  const r1 = Math.floor((cy + radius + 2) / cell.h)
  const box = { row: r0, col: c0, cols: c1 - c0 + 1, rows: r1 - r0 + 1 }
  const x = Math.round((cx - c0 * cell.w) * 2) / 2
  const y = Math.round((cy - r0 * cell.h) * 2) / 2
  return {
    name,
    key: `${box.cols}x${box.rows} ${x},${y} ${radius} ${fill ?? '-'}`,
    box,
    z,
    paint: () => thumbPixels(box.cols, box.rows, x, y, radius, fill, cell),
  }
}

function panelKey(art: Art): string {
  const { panel } = art
  const at = (box: Box) => `${box.row - panel.row},${box.col - panel.col},${box.cols}`
  const divider = art.divider === undefined ? '-' : art.divider - panel.row
  return `${panel.cols}x${panel.rows} ${art.ground} ${art.ink} ${art.accent} ${at(art.tabs)},${art.tabs.active}/${art.tabs.count} ${at(art.field)} ${divider}`
}

export function piecesOf(art: Art, cell: Cell): Piece[] {
  const size = `${cell.w}x${cell.h}`
  const radius = Math.max(4, Math.round(cell.h * 0.34))
  const along = (box: Box, at: number) => (box.col + 0.5 + at * (box.cols - 1)) * cell.w
  const middle = (box: Box) => (box.row + 0.5) * cell.h
  const plane = art.plane
  const yOf = (l: number) => {
    const sample = ((PLANE_TOP - l) / (PLANE_TOP - PLANE_BOTTOM)) * (plane.rows * 2 - 1)
    return plane.row * cell.h + ((Math.min(plane.rows * 2 - 1, Math.max(0, sample)) + 0.5) * cell.h) / 2
  }
  const markY = yOf(plane.l)
  const pieces: Piece[] = [
    {
      name: 'panel',
      key: `${size} ${panelKey(art)}`,
      box: { row: art.panel.row, col: art.panel.col - 1, cols: art.panel.cols + 2, rows: art.panel.rows + 1 },
      z: PANEL_Z,
      paint: () => panelPixels(art, cell),
    },
    {
      name: 'plane',
      key: `${size} ${plane.cols}x${plane.rows} ${plane.h.toFixed(2)}`,
      box: plane,
      z: ART_Z,
      paint: () => planePixels(plane, plane.h, cell.h >= 24 ? { w: cell.w / 2, h: cell.h / 2 } : cell),
    },
    {
      name: 'hue',
      key: `${size} ${art.hue.cols}`,
      box: { ...art.hue, rows: 1 },
      z: ART_Z,
      paint: () => huePixels(art.hue, cell),
    },
    {
      name: 'contrast',
      key: `${size} ${art.contrast.cols} ${art.contrast.floor ?? '-'} ${art.contrast.lit} ${art.ink}`,
      box: { ...art.contrast, rows: 1 },
      z: ART_Z,
      paint: () => contrastPixels(art.contrast, art.ink, cell),
    },
    thumb('mark', along(plane, shareOf(plane.l, plane.c, plane.h)), markY, radius, undefined, cell),
    thumb('hue-thumb', along(art.hue, art.hue.h / 360), middle(art.hue), radius, art.hue.color, cell),
    thumb(
      'contrast-thumb',
      along(art.contrast, art.contrast.at),
      middle(art.contrast),
      radius,
      art.contrast.color,
      cell,
    ),
  ]
  const origin = art.origin
  if (origin) {
    const small = Math.max(3, Math.round(radius * 0.55))
    pieces.push(
      thumb(
        'origin',
        along(plane, shareOf(origin.l, origin.c, origin.h)),
        yOf(origin.l),
        small,
        origin.color,
        cell,
        ORIGIN_Z,
      ),
      thumb('hue-origin', along(art.hue, origin.h / 360), middle(art.hue), small, origin.color, cell, ORIGIN_Z),
      thumb(
        'contrast-origin',
        along(art.contrast, origin.at),
        middle(art.contrast),
        small,
        origin.color,
        cell,
        ORIGIN_Z,
      ),
    )
  }
  return pieces
}

function transmit(id: number, png: Buffer): string {
  const data = png.toString('base64')
  const chunks = data.match(new RegExp(`.{1,${CHUNK}}`, 'g')) ?? ['']
  return chunks
    .map((chunk, i) => {
      const more = i < chunks.length - 1 ? 1 : 0
      return i === 0 ? `\x1b_Ga=t,f=100,i=${id},m=${more},q=2;${chunk}\x1b\\` : `\x1b_Gm=${more},q=2;${chunk}\x1b\\`
    })
    .join('')
}

function place(id: number, box: Box, z: number): string {
  return `\x1b[${box.row + 1};${box.col + 1}H\x1b_Ga=p,i=${id},p=${id},c=${box.cols},r=${box.rows},C=1,z=${z},q=2\x1b\\`
}

function release(id: number): string {
  return `\x1b_Ga=d,d=I,i=${id},q=2\x1b\\`
}

export class PickerLayer {
  private cell: Cell = { w: 0, h: 0 }
  private readonly shown = new Map<Name, Shown>()

  static of(env: Env, terminals: readonly string[]): PickerLayer | undefined {
    return colorless(env) || !showsPictures(env, terminals) || !layersUnderCells(env) ? undefined : new PickerLayer()
  }

  get ready(): boolean {
    return this.cell.w > 0
  }

  measured(cell: Cell): void {
    if (this.cell.w === 0 && cell.w > 0 && cell.h > 0) {
      this.cell = cell
    }
  }

  draw(art: Art | undefined): string {
    if (!this.ready) {
      return ''
    }
    const pieces = art ? piecesOf(art, this.cell) : []
    let out = ''
    for (const piece of pieces) {
      out += this.put(piece)
    }
    for (const [name, shown] of this.shown) {
      if (!pieces.some((piece) => piece.name === name)) {
        out += release(shown.id)
        this.shown.delete(name)
      }
    }
    return out
  }

  clear(): string {
    let out = ''
    for (const shown of this.shown.values()) {
      out += release(shown.id)
    }
    this.shown.clear()
    return out
  }

  private put(piece: Piece): string {
    const at = `${piece.box.row};${piece.box.col};${piece.box.cols};${piece.box.rows}`
    const was = this.shown.get(piece.name)
    if (was && was.key === piece.key) {
      if (was.at === at) {
        return ''
      }
      was.at = at
      return place(was.id, piece.box, piece.z)
    }
    const base = FIRST_ID + NAMES.indexOf(piece.name) * 2
    const id = was?.id === base ? base + 1 : base
    this.shown.set(piece.name, { key: piece.key, id, at })
    return `${transmit(id, encodeRgba(piece.paint()))}${place(id, piece.box, piece.z)}${was ? release(was.id) : ''}`
  }
}
