import { type Hex, luminance } from './color.ts'
import { alphaOf, type Box, blur, type Plane, type Rgba, resample, resamplePlane } from './png.ts'

export const STICKERING = 1

export interface Sides {
  top: boolean
  right: boolean
  bottom: boolean
}

export const CLOSED: Sides = { top: false, right: false, bottom: false }

export interface Look {
  paper: number
  erase: boolean
}

interface Margins {
  left: number
  top: number
  right: number
  bottom: number
}

const LARGEST = 2560
const WORK = 10
const SOLID = 102
const FAINT = 13
const MOSTLY = 0.5
const CONTACT = 0.04
const INSET = 0.004
const PAPER = 250
const RIM = 20
const SHADE = 0.18

const LENGTHS = {
  thin: 0.375,
  taper: 5,
  body: 0.5,
  close: 1.17,
  smooth: 0.29,
  shade: 0.33,
  edge: 0.13,
  margin: 0.17,
  pad: 2.5,
  hole: 12.5,
}

const SPECK = 0.002
const STEEP = 2.1
const STEEPEST = 3
const OPEN_HOLE = 16

const clamp = (value: number) => Math.min(1, Math.max(0, value))

export function paperOf(peak: Hex): number {
  const y = luminance(peak)
  const level = y <= 0.0031308 ? y * 12.92 : 1.055 * y ** (1 / 2.4) - 0.055

  return Math.min(PAPER, Math.round(level * 255))
}

function solidAlong(image: Rgba, x: number, y: number, across: boolean, length: number): number {
  let held = 0

  for (let i = 0; i < length; i++) {
    const at = across ? y * image.width + x + i : (y + i) * image.width + x

    if ((image.data[at * 4 + 3] ?? 0) >= 128) {
      held++
    }
  }

  return held
}

export function sidesOf(image: Rgba, box: Box): Sides {
  const inset = Math.max(2, Math.round(Math.max(box.w, box.h) * INSET))
  const bottom = box.y + box.h
  const top = box.y <= 1 && solidAlong(image, box.x, box.y + inset, true, box.w) / box.w >= CONTACT

  return {
    top,
    right:
      box.x + box.w >= image.width - 1 &&
      solidAlong(image, box.x + box.w - 1 - inset, box.y, false, box.h) / box.h >= CONTACT,
    bottom:
      !top &&
      bottom >= image.height - 1 &&
      solidAlong(image, box.x, bottom - 1 - inset, true, box.w) / box.w >= CONTACT,
  }
}

function distances(seed: Uint8Array, width: number, height: number): Float32Array {
  const far = 1e10
  const field = new Float32Array(width * height)

  for (let i = 0; i < field.length; i++) {
    field[i] = seed[i] ? 0 : far
  }

  const longest = Math.max(width, height)
  const roots = new Int32Array(longest)
  const bounds = new Float64Array(longest + 1)
  const line = new Float64Array(longest)

  const sweep = (length: number, start: number, stride: number) => {
    let any = false

    for (let q = 0; q < length; q++) {
      const value = field[start + q * stride] as number
      line[q] = value
      any ||= value < far
    }

    if (!any) {
      return
    }

    let k = 0
    roots[0] = 0
    bounds[0] = -Infinity
    bounds[1] = Infinity

    for (let q = 1; q < length; q++) {
      const here = (line[q] as number) + q * q
      let root = roots[k] as number
      let s = (here - (line[root] as number) - root * root) / (2 * (q - root))

      while (s <= (bounds[k] as number)) {
        k--
        root = roots[k] as number
        s = (here - (line[root] as number) - root * root) / (2 * (q - root))
      }

      k++
      roots[k] = q
      bounds[k] = s
      bounds[k + 1] = Infinity
    }

    k = 0

    for (let q = 0; q < length; q++) {
      while ((bounds[k + 1] as number) < q) {
        k++
      }

      const root = roots[k] as number
      field[start + q * stride] = (q - root) * (q - root) + (line[root] as number)
    }
  }

  for (let x = 0; x < width; x++) {
    sweep(height, x, width)
  }

  for (let y = 0; y < height; y++) {
    sweep(width, y * width, 1)
  }

  for (let i = 0; i < field.length; i++) {
    field[i] = Math.sqrt(field[i] as number)
  }

  return field
}

function within(field: Float32Array, reach: number): Uint8Array {
  const out = new Uint8Array(field.length)

  for (let i = 0; i < field.length; i++) {
    out[i] = (field[i] as number) <= reach ? 1 : 0
  }

  return out
}

function beyond(field: Float32Array, reach: number): Uint8Array {
  const out = new Uint8Array(field.length)

  for (let i = 0; i < field.length; i++) {
    out[i] = (field[i] as number) > reach ? 1 : 0
  }

  return out
}

function inverted(mask: Uint8Array): Uint8Array {
  const out = new Uint8Array(mask.length)

  for (let i = 0; i < mask.length; i++) {
    out[i] = mask[i] ? 0 : 1
  }

  return out
}

function swept(
  mask: Uint8Array,
  width: number,
  height: number,
  open: Sides,
  smallest: number,
  hole: number,
): Uint8Array {
  const seen = new Uint8Array(mask.length)
  const stack = new Int32Array(mask.length)
  const out = mask.slice()

  for (let start = 0; start < mask.length; start++) {
    if (seen[start]) {
      continue
    }

    const kind = mask[start]
    const members: number[] = []
    const keep = Math.max(smallest, hole)
    let top = 0
    let area = 0
    let outside = false
    let cutOff = false
    stack[top++] = start
    seen[start] = 1

    while (top > 0) {
      const p = stack[--top] as number
      const x = p % width
      const y = (p - x) / width
      area++

      if (area <= keep) {
        members.push(p)
      }

      outside ||=
        x === 0 || (x === width - 1 && !open.right) || (y === 0 && !open.top) || (y === height - 1 && !open.bottom)
      cutOff ||= (x === width - 1 && open.right) || (y === 0 && open.top) || (y === height - 1 && open.bottom)

      if (x > 0 && !seen[p - 1] && mask[p - 1] === kind) {
        seen[p - 1] = 1
        stack[top++] = p - 1
      }

      if (x < width - 1 && !seen[p + 1] && mask[p + 1] === kind) {
        seen[p + 1] = 1
        stack[top++] = p + 1
      }

      if (y > 0 && !seen[p - width] && mask[p - width] === kind) {
        seen[p - width] = 1
        stack[top++] = p - width
      }

      if (y < height - 1 && !seen[p + width] && mask[p + width] === kind) {
        seen[p + width] = 1
        stack[top++] = p + width
      }
    }

    if ((kind && area < smallest) || (!kind && !outside && area < (cutOff ? hole / OPEN_HOLE : hole))) {
      for (const p of members) {
        out[p] = kind ? 0 : 1
      }
    }
  }

  return out
}

function cropped(image: Rgba, box: Box, scale: number): Rgba {
  if (scale < 1) {
    return resample(image, box, Math.max(1, Math.round(box.w * scale)), Math.max(1, Math.round(box.h * scale)))
  }

  const data = new Uint8Array(box.w * box.h * 4)

  for (let y = 0; y < box.h; y++) {
    const from = ((box.y + y) * image.width + box.x) * 4
    data.set(image.data.subarray(from, from + box.w * 4), y * box.w * 4)
  }

  return { width: box.w, height: box.h, data }
}

function strays(
  faint: Uint8Array,
  tidy: Uint8Array,
  width: number,
  height: number,
  limit: number,
): Uint8Array | undefined {
  const seen = new Uint8Array(faint.length)
  const stack = new Int32Array(faint.length)
  const out = new Uint8Array(faint.length)
  let any = false

  for (let start = 0; start < faint.length; start++) {
    if (seen[start] || !faint[start]) {
      continue
    }

    const members: number[] = []
    let top = 0
    let area = 0
    let attached = false
    stack[top++] = start
    seen[start] = 1

    while (top > 0) {
      const p = stack[--top] as number
      const x = p % width
      const y = (p - x) / width
      area++
      attached ||= tidy[p] === 1

      if (area <= limit) {
        members.push(p)
      }

      if (x > 0 && !seen[p - 1] && faint[p - 1]) {
        seen[p - 1] = 1
        stack[top++] = p - 1
      }

      if (x < width - 1 && !seen[p + 1] && faint[p + 1]) {
        seen[p + 1] = 1
        stack[top++] = p + 1
      }

      if (y > 0 && !seen[p - width] && faint[p - width]) {
        seen[p - width] = 1
        stack[top++] = p - width
      }

      if (y < height - 1 && !seen[p + width] && faint[p + width]) {
        seen[p + width] = 1
        stack[top++] = p + width
      }
    }

    if (!attached && area < limit) {
      any = true

      for (const p of members) {
        out[p] = 1
      }
    }
  }

  return any ? out : undefined
}

interface Layers {
  soft: Plane
  shade: Plane
  keep: Plane | undefined
}

function layers(
  figure: Rgba,
  wide: number,
  pad: Margins,
  width: number,
  height: number,
  open: Sides,
  erase: boolean,
): Layers | undefined {
  const k = Math.min(1, WORK / wide)
  const band = wide * k
  const w = Math.max(1, Math.round(width * k))
  const h = Math.max(1, Math.round(height * k))
  const x0 = Math.round(pad.left * k)
  const y0 = Math.round(pad.top * k)
  const fw = Math.max(1, Math.round(figure.width * k))
  const fh = Math.max(1, Math.round(figure.height * k))
  const small = resamplePlane(alphaOf(figure), { x: 0, y: 0, w: figure.width, h: figure.height }, fw, fh)
  const raw = new Uint8Array(w * h)
  const faint = new Uint8Array(w * h)
  let area = 0
  let seen = 0

  for (let y = 0; y < fh && y + y0 < h; y++) {
    for (let x = 0; x < fw && x + x0 < w; x++) {
      const alpha = small.data[y * fw + x] as number
      const at = (y + y0) * w + x + x0

      if (alpha >= FAINT) {
        faint[at] = 1
        seen++
      }

      if (alpha >= SOLID) {
        raw[at] = 1
        area++
      }
    }
  }

  if (area === 0 || area < seen * MOSTLY) {
    return undefined
  }

  const smallest = Math.max(band * band * 0.7, area * SPECK)
  const tidy = swept(raw, w, h, open, smallest, 0)
  const fromFigure = distances(tidy, w, h)

  const body = within(
    distances(beyond(distances(inverted(tidy), w, h), band * LENGTHS.body), w, h),
    band * LENGTHS.body,
  )

  const fromBody = distances(body, w, h)
  const reached = new Uint8Array(w * h)
  const thin = band * LENGTHS.thin
  const taper = band * LENGTHS.taper

  for (let i = 0; i < reached.length; i++) {
    const away = Math.max(0, (fromBody[i] as number) - band)
    const reach = thin + (band - thin) * Math.max(0, 1 - away / taper)
    reached[i] = (fromFigure[i] as number) <= reach ? 1 : 0
  }

  const close = band * LENGTHS.close
  const closed = beyond(distances(inverted(within(distances(reached, w, h), close)), w, h), close)
  const filled = swept(closed, w, h, open, 0, (band * LENGTHS.hole) ** 2)
  const solid = new Float32Array(w * h)
  const shade = new Float32Array(w * h)
  const reachShade = band * LENGTHS.shade

  for (let i = 0; i < solid.length; i++) {
    const d = fromFigure[i] as number
    solid[i] = filled[i] || tidy[i] ? 1 : 0
    shade[i] = d < reachShade * 3 ? SHADE * Math.exp(-((d / reachShade) ** 2)) : 0
  }

  const whole = { x: 0, y: 0, w, h }
  const up = (plane: Plane) => resamplePlane(plane, whole, width, height)
  const planeOf = (data: Float32Array): Plane => ({ width: w, height: h, data })
  const dropped = erase ? strays(faint, tidy, w, h, smallest) : undefined

  if (!dropped) {
    return { soft: up(blur(planeOf(solid), band * LENGTHS.smooth)), shade: up(planeOf(shade)), keep: undefined }
  }

  const fromDropped = distances(dropped, w, h)
  const margin = band * LENGTHS.margin
  const keep = new Float32Array(w * h)

  for (let i = 0; i < keep.length; i++) {
    keep[i] = clamp((fromDropped[i] as number) - margin)
  }

  return { soft: up(blur(planeOf(solid), band * LENGTHS.smooth)), shade: up(planeOf(shade)), keep: up(planeOf(keep)) }
}

export function stickered(image: Rgba, box: Box, wide: number, open: Sides, look: Look): Rgba | undefined {
  const scale = Math.min(1, LARGEST / Math.max(box.w, box.h))
  const figure = cropped(image, box, scale)
  const band = wide * scale
  const room = Math.ceil(band * LENGTHS.pad)

  const pad: Margins = {
    left: room,
    top: open.top ? 0 : room,
    right: open.right ? 0 : room,
    bottom: open.bottom ? 0 : room,
  }

  const width = figure.width + pad.left + pad.right
  const height = figure.height + pad.top + pad.bottom
  const drawn = layers(figure, band, pad, width, height, open, look.erase)

  if (!drawn) {
    return undefined
  }

  const { soft, shade, keep } = drawn
  const sigma = band * LENGTHS.smooth
  const steep = Math.max(STEEPEST, STEEP * sigma)
  const reach = (band * LENGTHS.edge * 0.4) / sigma
  const data = new Uint8Array(width * height * 4)
  const f = figure.data

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const s = soft.data[i] as number
      const paper = clamp((s - 0.5) * steep + 0.5)
      const edge = clamp((s - 0.5 + reach) * steep + 0.5)
      const shaded = 1 - (shade.data[i] as number)
      const fx = x - pad.left
      const fy = y - pad.top
      const inside = fx >= 0 && fy >= 0 && fx < figure.width && fy < figure.height
      const at = (fy * figure.width + fx) * 4
      const kept = keep ? clamp(keep.data[i] as number) : 1
      const fa = inside ? ((f[at + 3] as number) / 255) * kept : 0
      const under = edge - edge * paper + paper
      const glue = 1 - fa
      const alpha = Math.min(1, fa + under * glue)

      if (alpha <= 0) {
        continue
      }

      const ground = RIM * edge * (1 - paper) + look.paper * shaded * paper

      for (let c = 0; c < 3; c++) {
        const top = inside ? (f[at + c] as number) * fa : 0
        data[i * 4 + c] = Math.min(255, Math.round((top + ground * glue) / alpha))
      }

      data[i * 4 + 3] = Math.round(alpha * 255)
    }
  }

  return { width, height, data }
}
