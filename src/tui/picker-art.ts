import { type Hex, luminance, mix, rgb } from '../core/color.ts'
import { edgeChroma, srgb } from '../core/fix.ts'
import { PLANE_BOTTOM, PLANE_TOP, RAINBOW_C, RAINBOW_L, reach, shareOf } from '../core/plane.ts'
import { encodeRgba, type Rgba } from '../core/png.ts'
import { graphic } from '../terminals/graphics.ts'
import { colorless } from '../terminals/osc.ts'
import { layersUnderCells, showsPictures } from '../terminals/terminal.ts'

const STAGE_Z = -1073741836
const TABS_Z = -1073741835
const BODY_Z = -1073741834
const PANEL_Z = -1073741828
const ART_Z = -1073741827
const ORIGIN_Z = -1073741826
const THUMB_Z = -1073741825
const FIRST_ID = 2 ** 31 - 128

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
  'stage-top',
  'stage-top-left',
  'stage-top-right',
  'stage-bottom',
  'stage-bottom-left',
  'stage-bottom-right',
  'stage-left',
  'stage-right',
  'body-seam',
  'body-left',
  'body-right',
  'body-bottom',
  'tabs',
  'chart-lightness',
  'chart-lightness-grid',
  'chart-lightness-lit',
  'chart-chroma',
  'chart-chroma-grid',
  'chart-chroma-lit',
  'chart-hue',
  'chart-hue-grid',
  'chart-hue-lit',
] as const

export const LIGHTS: Hex[] = ['#ff5f57', '#febc2e', '#28c840']

type Env = Record<string, string | undefined>

type Name = (typeof NAMES)[number]

type Color = [number, number, number, number]

interface Cell {
  w: number
  h: number
}

export interface Box {
  row: number
  col: number
  cols: number
  rows: number
}

export interface Drawn {
  lines: string[]
  art: Art | undefined
  mock?: Mock
  charts?: Chart[]
}

interface Point {
  x: number
  y: number
}

export interface Chart {
  name: 'lightness' | 'chroma' | 'hue'
  box: Box
  ink: Hex
  rules: number[]
  ticks: number[]
  lit: { x: number; w: number; color: Hex }[]
  bars: { x0: number; x1: number; y: number; color: Hex }[]
  links: { from: Point; to: Point; color: Hex; alpha: number }[]
  dots: (Point & { color: Hex; ring: boolean })[]
}

export interface Mock {
  panel: Box
  frame: Box
  tabs: Box[]
  active: number
  stage: Hex
  bar: Hex
  track: Hex
  tab: Hex
  ink: Hex
  body: Hex
  dark: boolean
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

function surfaceOf(art: Pick<Art, 'ground' | 'ink'>) {
  const dark = luminance(art.ground) < 0.18

  return { dark, surface: mix(art.ground, art.ink, dark ? 0.07 : 0.04) }
}

function panelPixels(art: Art, cell: Cell): Rgba {
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

function planePixels(box: Box, h: number, cell: Cell): Rgba {
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

      const coverage = near
        ? Math.min(1, Math.max(0, 0.5 - roundRect(x + 0.5, y + 0.5, 0, 0, width, height, radius)))
        : 1

      if (coverage <= 0) {
        continue
      }

      const color = row[x >> 1] as number[]
      const i = (y * width + x) * 4
      data[i] = color[0] as number
      data[i + 1] = color[1] as number
      data[i + 2] = color[2] as number
      data[i + 3] = Math.round(coverage * 255)
    }
  }

  return image
}

function pill(cell: Cell, cols: number) {
  const height = Math.max(4, Math.round(cell.h * 0.42))

  return { top: Math.round((cell.h - height) / 2), height, width: cols * cell.w }
}

function huePixels(art: Art['hue'], cell: Cell): Rgba {
  const image = canvas(art.cols * cell.w, cell.h)
  const { top, height, width } = pill(cell, art.cols)

  const colors = Array.from({ length: width }, (_, x) => {
    const along = Math.min(1, Math.max(0, ((x + 0.5) / cell.w - 0.5) / Math.max(1, art.cols - 1)))
    const h = along * 360

    return srgb(RAINBOW_L, edgeChroma(RAINBOW_L, h, RAINBOW_C), h) ?? [0, 0, 0]
  })

  for (let y = top; y < top + height; y++) {
    for (let x = 0; x < width; x++) {
      const coverage = Math.min(1, Math.max(0, 0.5 - roundRect(x + 0.5, y + 0.5, 0, top, width, height, height / 2)))
      const color = colors[x] as number[]
      blend(image, x, y, [color[0] as number, color[1] as number, color[2] as number, 1], coverage)
    }
  }

  return image
}

function contrastPixels(art: Art['contrast'], ink: Hex, cell: Cell): Rgba {
  const image = canvas(art.cols * cell.w, cell.h)
  const { top, height, width } = pill(cell, art.cols)
  const tick = art.floor === undefined ? -1 : Math.round((art.floor * (art.cols - 1) + 0.5) * cell.w)
  const thin = Math.max(2, Math.round(height * 0.45))
  const thinTop = top + Math.round((height - thin) / 2)

  for (let y = thinTop; y < thinTop + thin; y++) {
    for (let x = 0; x < width; x++) {
      const coverage = Math.min(1, Math.max(0, 0.5 - roundRect(x + 0.5, y + 0.5, 0, thinTop, width, thin, thin / 2)))
      const passes = tick < 0 || x >= tick
      blend(image, x, y, rgbaOf(ink, passes ? (art.lit ? 0.5 : 0.36) : 0.14), coverage)
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

function thumbPixels(
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

function piecesOf(art: Art, cell: Cell): Piece[] {
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

interface Outline {
  x0: number
  y0: number
  w: number
  h: number
  r: number
  bar: number
}

function outlineOf(mock: Mock, cell: Cell): Outline {
  const { panel, frame } = mock
  const x0 = (frame.col + 0.5 - panel.col) * cell.w
  const y0 = (frame.row + 0.5 - panel.row) * cell.h

  return {
    x0,
    y0,
    w: (frame.cols - 1) * cell.w,
    h: (frame.rows - 1) * cell.h,
    r: cell.h / 2,
    bar: (frame.row + 2.5 - panel.row) * cell.h,
  }
}

function clamp(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function stagePixels(mock: Mock, cell: Cell, box: Box, cols: number, rows: number): Rgba {
  const image = canvas(cols * cell.w, rows * cell.h)
  const { width, height, data } = image
  const s = outlineOf(mock, cell)
  const ox = (box.col - mock.panel.col) * cell.w
  const oy = (box.row - mock.panel.row) * cell.h
  const middle = s.y0 + cell.h
  const unit = Math.min(cell.h, cell.w * 2.5)
  const dot = 0.3 * unit
  const lights = LIGHTS.map((hex, k) => ({ x: s.x0 + (1 + k) * unit, fill: rgb(hex) }))
  const lift = cell.h * 0.3
  const spread = 2 * (cell.h * 0.42) ** 2
  const reach = cell.h * 1.5
  const depth = mock.dark ? 0.5 : 0.18
  const edge = mock.dark ? 0.14 : 0.16
  const [sr, sg, sb] = rgb(mock.stage)
  const [br, bg, bb] = rgb(mock.bar)
  const [ir, ig, ib] = rgb(mock.ink)

  for (let y = 0; y < height; y++) {
    const gy = oy + y + 0.5
    const lit = Math.abs(gy - middle) < dot + 1.5

    for (let x = 0; x < width; x++) {
      const gx = ox + x + 0.5
      const d = roundRect(gx, gy, s.x0, s.y0, s.w, s.h, s.r)
      let r = br
      let g = bg
      let b = bb

      if (d < -1 && gy >= s.bar) {
        r = sr
        g = sg
        b = sb
      } else if (d >= -1 || gy >= s.bar) {
        const fall = roundRect(gx, gy - lift, s.x0, s.y0, s.w, s.h, s.r)
        const dark = 1 - (fall <= 0 ? depth : fall >= reach ? 0 : depth * Math.exp(-(fall * fall) / spread))
        const cover = gy < s.bar ? clamp(0.5 - d) : 0
        const ring = (clamp(1.5 - d) - clamp(0.5 - d)) * edge
        r = sr * dark + (br - sr * dark) * cover
        g = sg * dark + (bg - sg * dark) * cover
        b = sb * dark + (bb - sb * dark) * cover
        r += (ir - r) * ring
        g += (ig - g) * ring
        b += (ib - b) * ring
      }

      if (lit) {
        for (const light of lights) {
          if (Math.abs(gx - light.x) < dot + 1.5) {
            const dl = Math.hypot(gx - light.x, gy - middle) - dot
            const fill = clamp(0.5 - dl)
            const rim = 1 - (fill - clamp(-0.5 - dl)) * 0.18
            r = (r + ((light.fill[0] as number) - r) * fill) * rim
            g = (g + ((light.fill[1] as number) - g) * fill) * rim
            b = (b + ((light.fill[2] as number) - b) * fill) * rim
          }
        }
      }

      const i = (y * width + x) * 4
      data[i] = Math.round(r)
      data[i + 1] = Math.round(g)
      data[i + 2] = Math.round(b)
      data[i + 3] = 255
    }
  }

  return image
}

function tabsPixels(mock: Mock, cell: Cell, box: Box): Rgba {
  const image = canvas(box.cols * cell.w, box.rows * cell.h)
  const at = (col: number) => (col - box.col) * cell.w
  const middle = (mock.frame.row + 1.5 - box.row) * cell.h
  const first = mock.tabs[0] as Box
  const last = mock.tabs.at(-1) as Box
  const chosen = mock.tabs[mock.active]
  const x0 = at(first.col) - 0.1 * cell.h
  const w = at(last.col + last.cols) + 0.1 * cell.h - x0
  const track = rgbaOf(mock.track)
  const lit = rgbaOf(mock.tab)

  const seps = mock.tabs.slice(1).flatMap((tab, i) => {
    const before = mock.tabs[i] as Box

    return i === mock.active || i + 1 === mock.active
      ? []
      : [Math.floor((at(before.col + before.cols) + at(tab.col)) / 2) + 0.5]
  })

  for (let y = 0; y < image.height; y++) {
    const gy = y + 0.5

    for (let x = 0; x < image.width; x++) {
      const gx = x + 0.5
      blend(
        image,
        x,
        y,
        track,
        clamp(0.5 - roundRect(gx, gy, x0, middle - 0.75 * cell.h, w, 1.5 * cell.h, 0.5 * cell.h)),
      )

      if (chosen) {
        const block = roundRect(
          gx,
          gy,
          at(chosen.col),
          middle - 0.65 * cell.h,
          chosen.cols * cell.w,
          1.3 * cell.h,
          0.4 * cell.h,
        )

        blend(image, x, y, lit, clamp(0.5 - block))
      }

      if (Math.abs(gy - middle) < 0.35 * cell.h) {
        for (const sx of seps) {
          blend(image, x, y, lit, clamp(1 - Math.abs(gx - sx)))
        }
      }
    }
  }

  return image
}

function bodyPixels(mock: Mock, cell: Cell, box: Box, rows: number): Rgba {
  const image = canvas(box.cols * cell.w, rows * cell.h)
  const { width, height, data } = image
  const s = outlineOf(mock, cell)
  const ox = (box.col - mock.panel.col) * cell.w
  const oy = (box.row - mock.panel.row) * cell.h
  const [r, g, b] = rgb(mock.body)

  for (let y = 0; y < height; y++) {
    const gy = oy + y + 0.5
    const below = clamp(gy - s.bar + 0.5)

    if (below <= 0) {
      continue
    }

    for (let x = 0; x < width; x++) {
      const cover = below * clamp(0.5 - roundRect(ox + x + 0.5, gy, s.x0, s.y0, s.w, s.h, s.r))
      const i = (y * width + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = Math.round(cover * 255)
    }
  }

  return image
}

function mockPieces(mock: Mock, cell: Cell): Piece[] {
  const { panel, frame } = mock
  const right = frame.col + frame.cols - 1
  const bottom = frame.row + frame.rows - 1
  const side = frame.rows - 4
  const size = `${cell.w}x${cell.h} ${panel.cols}x${panel.rows} ${frame.col},${frame.row} ${frame.cols}x${frame.rows}`
  const look = `${mock.stage} ${mock.bar} ${mock.ink} ${mock.dark}`

  const band = (name: Name, box: Box, cols: number, rows: number): Piece => ({
    name,
    key: `${size} ${look}`,
    box,
    z: STAGE_Z,
    paint: () => stagePixels(mock, cell, box, cols, rows),
  })

  const whole = (name: Name, box: Box) => band(name, box, box.cols, box.rows)

  const body = (name: Name, box: Box, rows: number): Piece => ({
    name,
    key: `${size} ${mock.body}`,
    box,
    z: BODY_Z,
    paint: () => bodyPixels(mock, cell, box, rows),
  })

  const top = frame.row + 3 - panel.row
  const foot = panel.row + panel.rows - bottom
  const end = panel.col + panel.cols
  const first = mock.tabs[0]
  const last = mock.tabs.at(-1)

  const strip = first &&
    last && { row: frame.row, col: first.col - 1, cols: last.col + last.cols - first.col + 2, rows: 3 }

  const spans = mock.tabs.map((tab) => `${tab.col}+${tab.cols}`).join(',')

  const tabs: Piece[] = strip
    ? [
        {
          name: 'tabs',
          key: `${cell.w}x${cell.h} ${mock.track} ${mock.tab} ${mock.active} ${spans}`,
          box: strip,
          z: TABS_Z,
          paint: () => tabsPixels(mock, cell, strip),
        },
      ]
    : []

  return [
    ...tabs,
    whole('stage-top-left', { row: panel.row, col: panel.col, cols: frame.col + 10 - panel.col, rows: top }),
    band('stage-top', { row: panel.row, col: frame.col + 10, cols: right - frame.col - 12, rows: top }, 1, top),
    whole('stage-top-right', { row: panel.row, col: right - 2, cols: end - right + 2, rows: top }),
    whole('stage-bottom-left', { row: bottom, col: panel.col, cols: frame.col + 3 - panel.col, rows: foot }),
    band('stage-bottom', { row: bottom, col: frame.col + 3, cols: right - frame.col - 5, rows: foot }, 1, foot),
    whole('stage-bottom-right', { row: bottom, col: right - 2, cols: end - right + 2, rows: foot }),
    band(
      'stage-left',
      { row: frame.row + 3, col: panel.col, cols: frame.col - panel.col + 1, rows: side },
      frame.col - panel.col + 1,
      1,
    ),
    band('stage-right', { row: frame.row + 3, col: right, cols: end - right, rows: side }, end - right, 1),
    body('body-seam', { row: frame.row + 2, col: frame.col, cols: frame.cols, rows: 1 }, 1),
    body('body-left', { row: frame.row + 3, col: frame.col, cols: 1, rows: side }, 1),
    body('body-right', { row: frame.row + 3, col: right, cols: 1, rows: side }, 1),
    body('body-bottom', { row: bottom, col: frame.col, cols: frame.cols, rows: 1 }, 1),
  ]
}

function inside(area: Rect): (x: number, y: number) => number {
  return (x, y) =>
    clamp(Math.min(x + 0.5, area.x + area.w) - Math.max(x - 0.5, area.x)) *
    clamp(Math.min(y + 0.5, area.y + area.h) - Math.max(y - 0.5, area.y))
}

function stamp(image: Rgba, area: Rect, color: Color, cover: (x: number, y: number) => number): void {
  const x1 = Math.min(image.width, Math.ceil(area.x + area.w))
  const y1 = Math.min(image.height, Math.ceil(area.y + area.h))

  for (let y = Math.max(0, Math.floor(area.y)); y < y1; y++) {
    for (let x = Math.max(0, Math.floor(area.x)); x < x1; x++) {
      blend(image, x, y, color, clamp(cover(x + 0.5, y + 0.5)))
    }
  }
}

function toSegment(x: number, y: number, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length === 0 ? 0 : clamp(((x - a.x) * dx + (y - a.y) * dy) / length)

  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy))
}

function hairOf(cell: Cell): number {
  return Math.max(1, Math.round(cell.h / 22))
}

function gridPixels(chart: Chart, cell: Cell): Rgba {
  const across = chart.ticks.length > 0 ? chart.box.cols : 1
  const down = chart.rules.length > 0 ? chart.box.rows : 1
  const image = canvas(across * cell.w, down * cell.h)
  const { width, height } = image
  const hair = hairOf(cell)
  const faint = rgbaOf(chart.ink, 0.14)

  for (const y of chart.rules) {
    const line = { x: 0, y: Math.min(height - hair, Math.floor(y * cell.h)), w: width, h: hair }
    stamp(image, line, faint, inside(line))
  }

  for (const x of chart.ticks) {
    const line = { x: Math.min(width - hair, Math.floor(x * cell.w)), y: 0, w: hair, h: height }
    stamp(image, line, faint, inside(line))
  }

  return image
}

function litPixels(lit: Chart['lit'], cols: number, rows: number, cell: Cell): Rgba {
  const image = canvas(cols * cell.w, rows * cell.h)

  for (const { x, w, color } of lit) {
    const band = { x: x * cell.w + 1, y: 1, w: w * cell.w - 2, h: image.height - 2 }
    const r = Math.min(cell.w * 0.45, band.h / 2)
    stamp(image, band, rgbaOf(color), (px, py) => 0.5 - roundRect(px, py, band.x, band.y, band.w, band.h, r))
  }

  return image
}

function markPixels(chart: Chart, cell: Cell): Rgba {
  const image = canvas(chart.box.cols * cell.w, chart.box.rows * cell.h)
  const at = (p: Point): Point => ({ x: p.x * cell.w, y: p.y * cell.h })
  const hair = hairOf(cell)
  const bar = Math.max(2, Math.round(cell.h * 0.18))
  const radius = Math.max(3, Math.min(cell.w * 0.42, cell.h * 0.21))
  const thick = Math.max(1.5, radius * 0.34)
  const edge = rgbaOf(chart.ink, 0.38)

  for (const { x0, x1, y, color } of chart.bars) {
    const area = { x: x0 * cell.w, y: y * cell.h - bar / 2, w: (x1 - x0) * cell.w, h: bar }
    stamp(image, area, rgbaOf(color), inside(area))
  }

  for (const { from, to, color, alpha } of chart.links) {
    const a = at(from)
    const b = at(to)

    const area = {
      x: Math.min(a.x, b.x) - 2,
      y: Math.min(a.y, b.y) - 2,
      w: Math.abs(a.x - b.x) + 4,
      h: Math.abs(a.y - b.y) + 4,
    }

    stamp(image, area, rgbaOf(color, alpha), (px, py) => hair / 2 + 0.5 - toSegment(px, py, a, b))
  }

  for (const dot of chart.dots) {
    const c = at(dot)
    const area = { x: c.x - radius - 3, y: c.y - radius - 3, w: 2 * radius + 6, h: 2 * radius + 6 }
    const from = (px: number, py: number) => Math.hypot(px - c.x, py - c.y)
    stamp(image, area, edge, (px, py) => clamp(radius + 1.5 - from(px, py)) - clamp(radius + 0.5 - from(px, py)))

    stamp(image, area, rgbaOf(dot.color), (px, py) => {
      const d = from(px, py)

      return dot.ring ? clamp(radius + 0.5 - d) - clamp(radius - thick + 0.5 - d) : radius + 0.5 - d
    })
  }

  return image
}

function chartPieces(charts: readonly Chart[], cell: Cell): Piece[] {
  const size = `${cell.w}x${cell.h}`

  return charts.flatMap((chart) => {
    const { box, name, ink } = chart

    const pieces: Piece[] = [
      {
        name: `chart-${name}`,
        key: `${size} ${box.cols}x${box.rows} ${ink} ${JSON.stringify([chart.bars, chart.links, chart.dots])}`,
        box,
        z: ORIGIN_Z,
        paint: () => markPixels(chart, cell),
      },
    ]

    if (chart.rules.length > 0 || chart.ticks.length > 0) {
      pieces.push({
        name: `chart-${name}-grid`,
        key: `${size} ${box.cols}x${box.rows} ${ink} ${chart.rules} ${chart.ticks}`,
        box,
        z: ART_Z,
        paint: () => gridPixels(chart, cell),
      })
    }

    if (chart.lit.length > 0) {
      const from = Math.min(...chart.lit.map((band) => band.x))
      const to = Math.max(...chart.lit.map((band) => band.x + band.w))
      const lit = chart.lit.map((band) => ({ ...band, x: band.x - from }))

      pieces.push({
        name: `chart-${name}-lit`,
        key: `${size} ${box.rows} ${JSON.stringify(lit)}`,
        box: { row: box.row, col: box.col + from, cols: to - from, rows: box.rows },
        z: PANEL_Z,
        paint: () => litPixels(lit, to - from, box.rows, cell),
      })
    }

    return pieces
  })
}

function transmit(id: number, png: Buffer): string {
  return graphic(`a=t,f=100,i=${id}`, png.toString('base64'))
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
  private stale = false

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

  resized(): void {
    this.stale = true
  }

  draw(art: Art | undefined, mock?: Mock, charts: readonly Chart[] = []): string {
    if (!this.ready) {
      return ''
    }

    const pieces = [
      ...(art ? piecesOf(art, this.cell) : []),
      ...(mock ? mockPieces(mock, this.cell) : []),
      ...chartPieces(charts, this.cell),
    ]

    const fresh = this.stale
    this.stale = false
    let out = ''

    for (const piece of pieces) {
      out += this.put(piece, fresh)
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
    const out = [...this.shown.values()].map((shown) => release(shown.id)).join('')
    this.shown.clear()

    return out
  }

  private put(piece: Piece, fresh: boolean): string {
    const at = `${piece.box.row};${piece.box.col};${piece.box.cols};${piece.box.rows}`
    const was = this.shown.get(piece.name)

    if (was && was.key === piece.key && !fresh) {
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
