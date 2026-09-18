import { readFileSync, writeFileSync } from 'node:fs'
import { decode as decodeJpegData } from 'jpeg-js'
import { PNG } from 'pngjs'

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

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const CLEAR = 13

const LINEAR = Array.from({ length: 256 }, (_, i) => {
  const c = i / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
})

export function luma(r: number, g: number, b: number): number {
  return 0.2126 * (LINEAR[r] ?? 0) + 0.7152 * (LINEAR[g] ?? 0) + 0.0722 * (LINEAR[b] ?? 0)
}

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= SIGNATURE.length && SIGNATURE.every((b, i) => bytes[i] === b)
}

export function decodePng(bytes: Uint8Array): Rgba {
  const png = PNG.sync.read(Buffer.from(bytes))
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) }
}

export function decodeImage(bytes: Uint8Array): Rgba {
  if (isPng(bytes)) {
    return decodePng(bytes)
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const jpeg = decodeJpegData(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 })
    return { width: jpeg.width, height: jpeg.height, data: jpeg.data }
  }
  throw new Error('not a PNG or JPEG image')
}

export function encodePng(image: Rgba): Buffer {
  const png = new PNG({ width: image.width, height: image.height })
  png.data = Buffer.from(image.data)
  return PNG.sync.write(png)
}

export function readPng(path: string): Rgba {
  return decodePng(readFileSync(path))
}

export function writePng(path: string, image: Rgba): void {
  writeFileSync(path, encodePng(image))
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
  const trns = find(bytes, 'tRNS')
  const idat = find(bytes, 'IDAT')
  return { width, height, alpha: trns !== -1 && (idat === -1 || trns < idat) }
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

export function transparency(image: Rgba): number {
  let clear = 0
  for (let i = 3; i < image.data.length; i += 4) {
    if ((image.data[i] ?? 0) < CLEAR) {
      clear++
    }
  }
  return Math.round((clear * 100) / (image.width * image.height))
}

export function shrinkBy(image: Rgba, k: number): Rgba {
  if (k <= 1) {
    return image
  }
  const width = Math.max(1, Math.floor(image.width / k))
  const height = Math.max(1, Math.floor(image.height / k))
  const out = new Uint8Array(width * height * 4)
  const d = image.data
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let dy = 0; dy < k; dy++) {
        for (let dx = 0; dx < k; dx++) {
          const i = ((y * k + dy) * image.width + x * k + dx) * 4
          const weight = d[i + 3] ?? 0
          r += (d[i] ?? 0) * weight
          g += (d[i + 1] ?? 0) * weight
          b += (d[i + 2] ?? 0) * weight
          a += weight
        }
      }
      const o = (y * width + x) * 4
      if (a > 0) {
        out[o] = Math.round(r / a)
        out[o + 1] = Math.round(g / a)
        out[o + 2] = Math.round(b / a)
      }
      out[o + 3] = Math.round(a / (k * k))
    }
  }
  return { width, height, data: out }
}

export function shrink(image: Rgba, maxSide: number): Rgba {
  return shrinkBy(image, Math.ceil(Math.max(image.width, image.height) / maxSide))
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

export function resample(image: Rgba, box: Box, width: number, height: number): Rgba {
  const k = Math.max(1, Math.floor(Math.min(box.w / width, box.h / height)))
  const src = shrinkBy(image, k)
  const d = src.data
  const out = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    const fy = Math.min(src.height - 1, Math.max(0, box.y / k + ((y + 0.5) * box.h) / k / height - 0.5))
    const y0 = Math.floor(fy)
    const y1 = Math.min(src.height - 1, y0 + 1)
    const ty = fy - y0
    for (let x = 0; x < width; x++) {
      const fx = Math.min(src.width - 1, Math.max(0, box.x / k + ((x + 0.5) * box.w) / k / width - 0.5))
      const x0 = Math.floor(fx)
      const x1 = Math.min(src.width - 1, x0 + 1)
      const tx = fx - x0
      const i00 = (y0 * src.width + x0) * 4
      const i10 = (y0 * src.width + x1) * 4
      const i01 = (y1 * src.width + x0) * 4
      const i11 = (y1 * src.width + x1) * 4
      const a00 = (d[i00 + 3] ?? 0) * (1 - tx) * (1 - ty)
      const a10 = (d[i10 + 3] ?? 0) * tx * (1 - ty)
      const a01 = (d[i01 + 3] ?? 0) * (1 - tx) * ty
      const a11 = (d[i11 + 3] ?? 0) * tx * ty
      const a = a00 + a10 + a01 + a11
      const o = (y * width + x) * 4
      if (a > 0) {
        for (let c = 0; c < 3; c++) {
          const sum =
            (d[i00 + c] ?? 0) * a00 + (d[i10 + c] ?? 0) * a10 + (d[i01 + c] ?? 0) * a01 + (d[i11 + c] ?? 0) * a11
          out[o + c] = Math.round(sum / a)
        }
      }
      out[o + 3] = Math.round(a)
    }
  }
  return { width, height, data: out }
}
