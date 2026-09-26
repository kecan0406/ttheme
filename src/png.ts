import { deflateSync } from 'node:zlib'
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

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const CLEAR = 13
const INDEXED = 3

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= SIGNATURE.length && SIGNATURE.every((b, i) => bytes[i] === b)
}

export function decodePng(bytes: Uint8Array): Rgba {
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

export function encodePng(image: Rgba): Buffer {
  const png = new PNG({ width: image.width, height: image.height })
  png.data = Buffer.from(image.data)
  return PNG.sync.write(png)
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
  let x0 = image.width
  let y0 = image.height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if ((image.data[(y * image.width + x) * 4 + 3] ?? 0) >= threshold) {
        x0 = Math.min(x0, x)
        x1 = Math.max(x1, x)
        y0 = Math.min(y0, y)
        y1 = Math.max(y1, y)
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
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
): Float32Array {
  const ty = taps(sourceHeight, box.y, box.h, height)
  const span = width * channels
  const out = new Float32Array(span * height)
  const rows = new Map<number, Float32Array>()
  for (let y = 0; y < height; y++) {
    const from = ty.first[y] ?? 0
    for (const kept of rows.keys()) {
      if (kept < from) {
        rows.delete(kept)
      }
    }
    const o = y * span
    for (let k = 0; k < ty.size; k++) {
      const w = ty.weights[y * ty.size + k] ?? 0
      if (w === 0) {
        continue
      }
      let row = rows.get(from + k)
      if (!row) {
        row = new Float32Array(span)
        across(from + k, row)
        rows.set(from + k, row)
      }
      for (let x = 0; x < span; x++) {
        out[o + x] = (out[o + x] ?? 0) + (row[x] ?? 0) * w
      }
    }
  }
  return out
}

export function resample(image: Rgba, box: Box, width: number, height: number): Rgba {
  const tx = taps(image.width, box.x, box.w, width)
  const d = image.data
  const sums = sweep(image.height, box, width, height, 4, (y, into) => {
    const row = y * image.width
    for (let x = 0; x < width; x++) {
      const f = row + (tx.first[x] ?? 0)
      const wi = x * tx.size
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let k = 0; k < tx.size; k++) {
        const p = (f + k) * 4
        const w = (tx.weights[wi + k] ?? 0) * (d[p + 3] ?? 0)
        r += (d[p] ?? 0) * w
        g += (d[p + 1] ?? 0) * w
        b += (d[p + 2] ?? 0) * w
        a += w
      }
      into[x * 4] = r
      into[x * 4 + 1] = g
      into[x * 4 + 2] = b
      into[x * 4 + 3] = a
    }
  })
  const out = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const a = sums[i * 4 + 3] ?? 0
    if (a <= 0) {
      continue
    }
    for (let c = 0; c < 3; c++) {
      out[i * 4 + c] = Math.min(255, Math.max(0, Math.round((sums[i * 4 + c] ?? 0) / a)))
    }
    out[i * 4 + 3] = Math.min(255, Math.round(a))
  }
  return { width, height, data: out }
}

export function resamplePlane(source: Plane | Mask, box: Box, width: number, height: number): Plane {
  const tx = taps(source.width, box.x, box.w, width)
  const d = source.data
  const data = sweep(source.height, box, width, height, 1, (y, into) => {
    const row = y * source.width
    for (let x = 0; x < width; x++) {
      const f = row + (tx.first[x] ?? 0)
      const wi = x * tx.size
      let acc = 0
      for (let k = 0; k < tx.size; k++) {
        acc += (d[f + k] ?? 0) * (tx.weights[wi + k] ?? 0)
      }
      into[x] = acc
    }
  })
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
    data[i] = Math.min(255, Math.max(0, Math.round(plane.data[i] ?? 0)))
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

function scanlines(data: Uint8Array, width: number, height: number): Uint8Array {
  const stride = width + 1
  const raw = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    const o = y * stride
    const cur = y * width
    const up = cur - width
    raw[o] = 4
    for (let x = 0; x < width; x++) {
      const a = x > 0 ? (data[cur + x - 1] ?? 0) : 0
      const b = y > 0 ? (data[up + x] ?? 0) : 0
      const c = x > 0 && y > 0 ? (data[up + x - 1] ?? 0) : 0
      const pa = Math.abs(b - c)
      const pb = Math.abs(a - c)
      const pc = Math.abs(a + b - 2 * c)
      raw[o + 1 + x] = ((data[cur + x] ?? 0) - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff
    }
  }
  return raw
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
    chunk('IDAT', deflateSync(scanlines(mask.data, mask.width, mask.height))),
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
