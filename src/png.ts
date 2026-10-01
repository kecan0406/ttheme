import { constants, deflateSync, inflateSync } from 'node:zlib'
import { decode as decodeJpegData } from 'jpeg-js'
import { PNG } from 'pngjs'
import { type Hex, rgb } from './color.ts'

export interface Rgba {
  width: number
  height: number
  data: Uint8Array
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface Plane {
  width: number
  height: number
  data: Float32Array
}

export interface Mask {
  width: number
  height: number
  data: Uint8Array
}

export interface Rgb {
  width: number
  height: number
  data: Uint8Array
}

export interface Canvas {
  width: number
  height: number
  at: Box
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const CLEAR = 13
const INDEXED = 3

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= SIGNATURE.length && SIGNATURE.every((b, i) => bytes[i] === b)
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 }

interface Scan {
  width: number
  height: number
  type: number
  idat: Buffer[]
}

function scanned(bytes: Uint8Array): Scan | undefined {
  if (bytes.length < 33 || !isPng(bytes)) {
    return undefined
  }
  const png = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  const type = png[25] as number
  if (png[24] !== 8 || png[28] !== 0 || CHANNELS[type] === undefined) {
    return undefined
  }
  const idat: Buffer[] = []
  for (let at = 8; at + 12 <= png.length; ) {
    const size = png.readUInt32BE(at)
    const kind = png.toString('latin1', at + 4, at + 8)
    if (kind === 'IDAT') {
      idat.push(png.subarray(at + 8, at + 8 + size))
    } else if (kind === 'tRNS' || kind === 'IEND') {
      if (kind === 'tRNS' && type !== 4 && type !== 6) {
        return undefined
      }
      break
    }
    at += 12 + size
  }
  return idat.length > 0 ? { width, height, type, idat } : undefined
}

function unfilter(raw: Uint8Array, stride: number, height: number, bpp: number): void {
  const none = new Uint8Array(stride)
  for (let y = 0; y < height; y++) {
    const o = y * (stride + 1)
    const type = raw[o] as number
    const row = o + 1
    const up = y > 0 ? raw : none
    const above = y > 0 ? row - stride - 1 : 0
    if (type === 1) {
      for (let i = bpp; i < stride; i++) {
        raw[row + i] = (raw[row + i] as number) + (raw[row + i - bpp] as number)
      }
    } else if (type === 2) {
      for (let i = 0; i < stride; i++) {
        raw[row + i] = (raw[row + i] as number) + (up[above + i] as number)
      }
    } else if (type === 3) {
      for (let i = 0; i < bpp; i++) {
        raw[row + i] = (raw[row + i] as number) + ((up[above + i] as number) >> 1)
      }
      for (let i = bpp; i < stride; i++) {
        raw[row + i] = (raw[row + i] as number) + (((raw[row + i - bpp] as number) + (up[above + i] as number)) >> 1)
      }
    } else if (type === 4) {
      for (let i = 0; i < bpp; i++) {
        raw[row + i] = (raw[row + i] as number) + (up[above + i] as number)
      }
      for (let i = bpp; i < stride; i++) {
        const a = raw[row + i - bpp] as number
        const b = up[above + i] as number
        const c = up[above + i - bpp] as number
        const pa = Math.abs(b - c)
        const pb = Math.abs(a - c)
        const pc = Math.abs(a + b - 2 * c)
        raw[row + i] = (raw[row + i] as number) + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
      }
    } else if (type !== 0) {
      throw new Error(`bad PNG filter ${type}`)
    }
  }
}

function inflated(scan: Scan): Rgba {
  const { width, height, type } = scan
  const bpp = CHANNELS[type] as number
  const stride = width * bpp
  const raw = inflateSync(Buffer.concat(scan.idat), {
    chunkSize: Math.min(1 << 28, Math.max(1 << 16, height * (stride + 1))),
  })
  if (raw.length < height * (stride + 1)) {
    throw new Error('truncated PNG')
  }
  unfilter(raw, stride, height, bpp)
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    const from = y * (stride + 1) + 1
    const to = y * width * 4
    if (type === 6) {
      data.set(raw.subarray(from, from + stride), to)
    } else if (type === 2) {
      for (let x = 0, i = from, o = to; x < width; x++, i += 3, o += 4) {
        data[o] = raw[i] as number
        data[o + 1] = raw[i + 1] as number
        data[o + 2] = raw[i + 2] as number
        data[o + 3] = 255
      }
    } else if (type === 0) {
      for (let x = 0, o = to; x < width; x++, o += 4) {
        const v = raw[from + x] as number
        data[o] = v
        data[o + 1] = v
        data[o + 2] = v
        data[o + 3] = 255
      }
    } else {
      for (let x = 0, i = from, o = to; x < width; x++, i += 2, o += 4) {
        const v = raw[i] as number
        data[o] = v
        data[o + 1] = v
        data[o + 2] = v
        data[o + 3] = raw[i + 1] as number
      }
    }
  }
  return { width, height, data }
}

export function decodePng(bytes: Uint8Array): Rgba {
  const scan = scanned(bytes)
  if (scan) {
    return inflated(scan)
  }
  const png = PNG.sync.read(Buffer.from(bytes))
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) }
}

export function decodeImage(bytes: Uint8Array, limit: number): Rgba {
  if (isPng(bytes)) {
    const head = pngHead(bytes)
    if (head && head.width * head.height > limit) {
      throw new Error(`${head.width}×${head.height} is over ${limit / 1e6} megapixels`)
    }
    return decodePng(bytes)
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const jpeg = decodeJpegData(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: limit / 1e6,
      maxMemoryUsageInMB: 1024,
    })
    return { width: jpeg.width, height: jpeg.height, data: jpeg.data }
  }
  throw new Error('not a PNG or JPEG image')
}

interface Laid {
  part: Rgba
  box: Box
  dx: number
  dy: number
}

function region(image: Rgba, canvas: Canvas): Laid | undefined {
  const { width, height, at } = canvas
  const x0 = Math.max(0, at.x)
  const y0 = Math.max(0, at.y)
  const x1 = Math.min(width, at.x + at.w)
  const y1 = Math.min(height, at.y + at.h)
  if (x1 <= x0 || y1 <= y0) {
    return undefined
  }
  const box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  if (at.w === image.width && at.h === image.height) {
    return { part: image, box, dx: x0 - at.x, dy: y0 - at.y }
  }
  const from = {
    x: ((x0 - at.x) * image.width) / at.w,
    y: ((y0 - at.y) * image.height) / at.h,
    w: (box.w * image.width) / at.w,
    h: (box.h * image.height) / at.h,
  }
  return { part: resample(image, from, box.w, box.h), box, dx: 0, dy: 0 }
}

export function lay(image: Rgba, canvas: Canvas): Rgba {
  const data = new Uint8Array(canvas.width * canvas.height * 4)
  const laid = region(image, canvas)
  if (laid) {
    const { part, box, dx, dy } = laid
    for (let y = 0; y < box.h; y++) {
      const s = ((y + dy) * part.width + dx) * 4
      data.set(part.data.subarray(s, s + box.w * 4), ((box.y + y) * canvas.width + box.x) * 4)
    }
  }
  return { width: canvas.width, height: canvas.height, data }
}

export function flatten(
  image: Rgba,
  background: Hex,
  opacity: number,
  canvas: Canvas = { width: image.width, height: image.height, at: { x: 0, y: 0, w: image.width, h: image.height } },
): Rgb {
  const base = rgb(background)
  const { width, height } = canvas
  const data = new Uint8Array(width * height * 3)
  for (let i = 0; i < width * 3; i += 3) {
    data.set(base, i)
  }
  for (let y = 1; y < height; y++) {
    data.copyWithin(y * width * 3, 0, width * 3)
  }
  const laid = region(image, canvas)
  if (!laid) {
    return { width, height, data }
  }
  const { part, box, dx, dy } = laid
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const s = ((y + dy) * part.width + x + dx) * 4
      const o = ((box.y + y) * width + box.x + x) * 3
      const a = ((part.data[s + 3] as number) / 255) * opacity
      for (let c = 0; c < 3; c++) {
        data[o + c] = Math.round((base[c] as number) * (1 - a) + (part.data[s + c] as number) * a)
      }
    }
  }
  return { width, height, data }
}

function find(bytes: Uint8Array, word: string): number {
  for (let i = 0; i + word.length <= bytes.length; i++) {
    let hit = true
    for (let j = 0; j < word.length && hit; j++) {
      hit = bytes[i + j] === word.charCodeAt(j)
    }
    if (hit) {
      return i
    }
  }
  return -1
}

export function pngHead(bytes: Uint8Array): { width: number; height: number; alpha: boolean } | null {
  if (bytes.length < 33 || !isPng(bytes)) {
    return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  if (bytes[25] === 4 || bytes[25] === 6) {
    return { width, height, alpha: true }
  }
  const idat = find(bytes, 'IDAT')
  return { width, height, alpha: find(idat === -1 ? bytes : bytes.subarray(0, idat), 'tRNS') !== -1 }
}

export function alphaBox(image: Rgba, threshold = CLEAR): Box | null {
  const { width, height, data } = image
  const filled = (y: number): boolean => {
    for (let at = y * width * 4 + 3, end = at + width * 4; at < end; at += 4) {
      if ((data[at] as number) >= threshold) {
        return true
      }
    }
    return false
  }
  let y0 = 0
  while (y0 < height && !filled(y0)) {
    y0++
  }
  if (y0 === height) {
    return null
  }
  let y1 = height - 1
  while (!filled(y1)) {
    y1--
  }
  let x0 = width
  let x1 = -1
  for (let y = y0; y <= y1; y++) {
    const row = y * width * 4 + 3
    for (let x = 0; x < x0; x++) {
      if ((data[row + x * 4] as number) >= threshold) {
        x0 = x
        break
      }
    }
    for (let x = width - 1; x > x1; x--) {
      if ((data[row + x * 4] as number) >= threshold) {
        x1 = x
        break
      }
    }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

export function transparency(image: Rgba, box: Box = { x: 0, y: 0, w: image.width, h: image.height }): number {
  let clear = 0
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      if ((image.data[(y * image.width + x) * 4 + 3] ?? 0) < CLEAR) {
        clear++
      }
    }
  }
  return Math.round((clear * 100) / (box.w * box.h))
}

export function contain(image: Rgba, width: number, height: number): Rgba {
  const k = Math.min(width / image.width, height / image.height)
  const w = Math.max(1, Math.round(image.width * k))
  const h = Math.max(1, Math.round(image.height * k))
  const fitted = resample(image, { x: 0, y: 0, w: image.width, h: image.height }, w, h)
  const out = new Uint8Array(width * height * 4)
  const ox = Math.floor((width - w) / 2)
  const oy = Math.floor((height - h) / 2)
  for (let y = 0; y < h; y++) {
    out.set(fitted.data.subarray(y * w * 4, (y + 1) * w * 4), ((oy + y) * width + ox) * 4)
  }
  return { width, height, data: out }
}

function mitchell(x: number): number {
  const t = Math.abs(x)
  if (t < 1) {
    return (7 * t * t * t - 12 * t * t + 16 / 3) / 6
  }
  if (t < 2) {
    return ((-7 / 3) * t * t * t + 12 * t * t - 20 * t + 32 / 3) / 6
  }
  return 0
}

interface Taps {
  first: Int32Array
  size: number
  weights: Float32Array
}

function taps(length: number, start: number, span: number, out: number): Taps {
  if (span === out && Number.isInteger(start) && start >= 0 && start + out <= length) {
    return {
      first: Int32Array.from({ length: out }, (_, i) => start + i),
      size: 1,
      weights: new Float32Array(out).fill(1),
    }
  }
  const scale = span / out
  const stretch = Math.max(1, scale)
  const reach = 2 * stretch
  const size = Math.min(length, Math.ceil(2 * reach) + 2)
  const first = new Int32Array(out)
  const weights = new Float32Array(out * size)
  for (let i = 0; i < out; i++) {
    const center = start + (i + 0.5) * scale
    const lo = Math.floor(center - reach - 0.5)
    const from = Math.max(0, Math.min(length - size, lo))
    first[i] = from
    let sum = 0
    for (let j = lo; j <= Math.ceil(center + reach - 0.5); j++) {
      const w = mitchell((j + 0.5 - center) / stretch)
      const at = i * size + Math.min(length - 1, Math.max(0, j)) - from
      weights[at] = (weights[at] ?? 0) + w
      sum += w
    }
    for (let k = i * size; k < (i + 1) * size; k++) {
      weights[k] = (weights[k] ?? 0) / sum
    }
  }
  return { first, size, weights }
}

function sweep(
  sourceHeight: number,
  box: Box,
  width: number,
  height: number,
  channels: number,
  across: (y: number, into: Float32Array) => void,
  emit: (y: number, sums: Float32Array) => void,
): void {
  const ty = taps(sourceHeight, box.y, box.h, height)
  const span = width * channels
  const ring = ty.size + 1
  const rows = Array.from({ length: ring }, () => new Float32Array(span))
  const held = new Int32Array(ring).fill(-1)
  const sums = new Float32Array(span)
  const slots: Float32Array[] = []
  const weights: number[] = []
  for (let y = 0; y < height; y++) {
    slots.length = 0
    weights.length = 0
    const from = ty.first[y] as number
    for (let k = 0; k < ty.size; k++) {
      const w = ty.weights[y * ty.size + k] as number
      if (w === 0) {
        continue
      }
      const at = from + k
      const slot = at % ring
      const row = rows[slot] as Float32Array
      if (held[slot] !== at) {
        across(at, row)
        held[slot] = at
      }
      slots.push(row)
      weights.push(w)
    }
    let k = 0
    while (k < slots.length) {
      const r0 = slots[k] as Float32Array
      const w0 = weights[k] as number
      if (slots.length - k >= 4) {
        const r1 = slots[k + 1] as Float32Array
        const r2 = slots[k + 2] as Float32Array
        const r3 = slots[k + 3] as Float32Array
        const w1 = weights[k + 1] as number
        const w2 = weights[k + 2] as number
        const w3 = weights[k + 3] as number
        if (k === 0) {
          for (let x = 0; x < span; x++) {
            sums[x] = (r0[x] as number) * w0 + (r1[x] as number) * w1 + (r2[x] as number) * w2 + (r3[x] as number) * w3
          }
        } else {
          for (let x = 0; x < span; x++) {
            sums[x] =
              (sums[x] as number) +
              ((r0[x] as number) * w0 + (r1[x] as number) * w1 + (r2[x] as number) * w2 + (r3[x] as number) * w3)
          }
        }
        k += 4
      } else {
        if (k === 0) {
          for (let x = 0; x < span; x++) {
            sums[x] = (r0[x] as number) * w0
          }
        } else {
          for (let x = 0; x < span; x++) {
            sums[x] = (sums[x] as number) + (r0[x] as number) * w0
          }
        }
        k += 1
      }
    }
    if (slots.length === 0) {
      sums.fill(0)
    }
    emit(y, sums)
  }
}

function reached(first: Int32Array, size: number, count: number, low: number, high: number): [number, number] {
  let a = 0
  let b = count
  while (a < b) {
    const mid = (a + b) >> 1
    if ((first[mid] as number) + size - 1 < low) {
      a = mid + 1
    } else {
      b = mid
    }
  }
  const from = a
  b = count
  while (a < b) {
    const mid = (a + b) >> 1
    if ((first[mid] as number) <= high) {
      a = mid + 1
    } else {
      b = mid
    }
  }
  return [from, a]
}

export function resample(image: Rgba, box: Box, width: number, height: number): Rgba {
  const tx = taps(image.width, box.x, box.w, width)
  const d = image.data
  const sw = image.width
  const pre = new Float32Array(sw * 4)
  const out = new Uint8Array(width * height * 4)
  sweep(
    image.height,
    box,
    width,
    height,
    4,
    (y, into) => {
      const row = y * sw * 4
      let low = sw
      let high = -1
      for (let i = 0, px = 0; i < sw * 4; i += 4, px++) {
        const a = d[row + i + 3] as number
        if (a === 0) {
          pre[i] = 0
          pre[i + 1] = 0
          pre[i + 2] = 0
          pre[i + 3] = 0
          continue
        }
        if (px < low) {
          low = px
        }
        high = px
        pre[i] = (d[row + i] as number) * a
        pre[i + 1] = (d[row + i + 1] as number) * a
        pre[i + 2] = (d[row + i + 2] as number) * a
        pre[i + 3] = a
      }
      into.fill(0)
      if (high < 0) {
        return
      }
      const [from, to] = reached(tx.first, tx.size, width, low, high)
      for (let x = from; x < to; x++) {
        const f = (tx.first[x] as number) * 4
        const wi = x * tx.size
        let r = 0
        let g = 0
        let b = 0
        let a = 0
        for (let k = 0; k < tx.size; k++) {
          const w = tx.weights[wi + k] as number
          const p = f + k * 4
          r += (pre[p] as number) * w
          g += (pre[p + 1] as number) * w
          b += (pre[p + 2] as number) * w
          a += (pre[p + 3] as number) * w
        }
        into[x * 4] = r
        into[x * 4 + 1] = g
        into[x * 4 + 2] = b
        into[x * 4 + 3] = a
      }
    },
    (y, sums) => {
      const o = y * width * 4
      for (let x = 0; x < width; x++) {
        const i = x * 4
        const a = sums[i + 3] as number
        if (a <= 0) {
          continue
        }
        let v = (sums[i] as number) / a
        out[o + i] = (v < 0 ? 0 : v > 255 ? 255 : v) + 0.5
        v = (sums[i + 1] as number) / a
        out[o + i + 1] = (v < 0 ? 0 : v > 255 ? 255 : v) + 0.5
        v = (sums[i + 2] as number) / a
        out[o + i + 2] = (v < 0 ? 0 : v > 255 ? 255 : v) + 0.5
        out[o + i + 3] = (a > 255 ? 255 : a) + 0.5
      }
    },
  )
  return { width, height, data: out }
}

export function resamplePlane(source: Plane | Mask, box: Box, width: number, height: number): Plane {
  const tx = taps(source.width, box.x, box.w, width)
  const d = source.data
  const sw = source.width
  const data = new Float32Array(width * height)
  sweep(
    source.height,
    box,
    width,
    height,
    1,
    (y, into) => {
      const row = y * sw
      let low = sw
      let high = -1
      for (let x = 0; x < sw; x++) {
        if ((d[row + x] as number) !== 0) {
          if (x < low) {
            low = x
          }
          high = x
        }
      }
      into.fill(0)
      if (high < 0) {
        return
      }
      const [from, to] = reached(tx.first, tx.size, width, low, high)
      for (let x = from; x < to; x++) {
        const f = row + (tx.first[x] as number)
        const wi = x * tx.size
        let acc = 0
        for (let k = 0; k < tx.size; k++) {
          acc += (d[f + k] as number) * (tx.weights[wi + k] as number)
        }
        into[x] = acc
      }
    },
    (y, sums) => {
      data.set(sums, y * width)
    },
  )
  return { width, height, data }
}

export function blur(plane: Plane, sigma: number): Plane {
  if (sigma <= 0) {
    return plane
  }
  const reach = Math.max(1, Math.ceil(sigma * 3))
  const kernel = Array.from({ length: 2 * reach + 1 }, (_, i) => Math.exp(-((i - reach) ** 2) / (2 * sigma * sigma)))
  const total = kernel.reduce((sum, w) => sum + w, 0)
  const { width, height, data } = plane
  const across = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const o = y * width
    for (let x = 0; x < width; x++) {
      let acc = 0
      for (let i = -reach; i <= reach; i++) {
        acc += (data[o + Math.min(width - 1, Math.max(0, x + i))] ?? 0) * (kernel[i + reach] ?? 0)
      }
      across[o + x] = acc / total
    }
  }
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const o = y * width
    for (let i = -reach; i <= reach; i++) {
      const w = (kernel[i + reach] ?? 0) / total
      const from = Math.min(height - 1, Math.max(0, y + i)) * width
      for (let x = 0; x < width; x++) {
        out[o + x] = (out[o + x] ?? 0) + (across[from + x] ?? 0) * w
      }
    }
  }
  return { width, height, data: out }
}

export function quantize(plane: Plane): Mask {
  const data = new Uint8Array(plane.data.length)
  for (let i = 0; i < data.length; i++) {
    const v = plane.data[i] as number
    data[i] = (v < 0 ? 0 : v > 255 ? 255 : v) + 0.5
  }
  return { width: plane.width, height: plane.height, data }
}

export function alphaOf(image: Rgba): Mask {
  const data = new Uint8Array(image.width * image.height)
  for (let i = 0; i < data.length; i++) {
    data[i] = image.data[i * 4 + 3] ?? 0
  }
  return { width: image.width, height: image.height, data }
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return c >>> 0
})

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) {
    c = (CRC[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'latin1')
  out.set(data, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function rows(data: Uint8Array, stride: number, height: number): Uint8Array {
  const raw = new Uint8Array(height * (stride + 1))
  raw.set(data.subarray(0, stride), 1)
  for (let y = 1; y < height; y++) {
    const o = y * (stride + 1)
    const cur = y * stride
    const up = cur - stride
    raw[o] = 2
    for (let x = 0; x < stride; x++) {
      raw[o + 1 + x] = (data[cur + x] as number) - (data[up + x] as number)
    }
  }
  return raw
}

function squeeze(raw: Uint8Array): Buffer {
  return deflateSync(raw, { level: 1, strategy: constants.Z_RLE })
}

function pngOf(mask: Mask, colorType: number, extra: Buffer[]): Buffer {
  const head = Buffer.alloc(13)
  head.writeUInt32BE(mask.width, 0)
  head.writeUInt32BE(mask.height, 4)
  head[8] = 8
  head[9] = colorType
  return Buffer.concat([
    Buffer.from(SIGNATURE),
    chunk('IHDR', head),
    ...extra,
    chunk('IDAT', squeeze(rows(mask.data, mask.width, mask.height))),
    chunk('IEND', new Uint8Array()),
  ])
}

function tonePalette(tone: Hex): Buffer {
  const [r, g, b] = rgb(tone)
  const plte = new Uint8Array(768)
  for (let i = 0; i < 256; i++) {
    plte.set([r, g, b], i * 3)
  }
  return chunk('PLTE', plte)
}

function packed(width: number, height: number, colorType: number, channels: number, data: Uint8Array): Buffer {
  const head = Buffer.alloc(13)
  head.writeUInt32BE(width, 0)
  head.writeUInt32BE(height, 4)
  head[8] = 8
  head[9] = colorType
  return Buffer.concat([
    Buffer.from(SIGNATURE),
    chunk('IHDR', head),
    chunk('IDAT', squeeze(rows(data, width * channels, height))),
    chunk('IEND', new Uint8Array()),
  ])
}

export function encodeRgb(image: Rgb): Buffer {
  return packed(image.width, image.height, 2, 3, image.data)
}

export function encodeRgba(image: Rgba): Buffer {
  return packed(image.width, image.height, 6, 4, image.data)
}

export function encodeMask(mask: Mask, tone: Hex): Buffer {
  return pngOf(mask, INDEXED, [
    tonePalette(tone),
    chunk(
      'tRNS',
      Uint8Array.from({ length: 256 }, (_, i) => i),
    ),
  ])
}

export function encodeGray(mask: Mask): Buffer {
  return pngOf(mask, 0, [])
}

export function retone(bytes: Uint8Array, tone: Hex): Buffer | undefined {
  if (!isPng(bytes) || bytes[25] !== INDEXED) {
    return undefined
  }
  const png = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const parts: Uint8Array[] = [Buffer.from(SIGNATURE)]
  let at = SIGNATURE.length
  while (at + 8 <= png.length) {
    const end = at + 12 + png.readUInt32BE(at)
    parts.push(png.toString('latin1', at + 4, at + 8) === 'PLTE' ? tonePalette(tone) : png.subarray(at, end))
    at = end
  }
  return Buffer.concat(parts)
}
