import { argbFromHex, Hct } from '@material/material-color-utilities'
import type { Hex } from './color.ts'
import type { Rgba } from './png.ts'

export interface Crop {
  x: number
  y: number
  width: number
  height: number
}

export interface Flat {
  hex: Hex
  count: number
  hue: number
  chroma: number
  tone: number
  lit: boolean
  shadowOf?: Hex
}

export interface Counting {
  crop?: Crop
  quant?: number
  top?: number
  extremes?: boolean
}

export interface Flats {
  pixels: number
  opaque: number
  distinct: number
  flats: Flat[]
  median: Hex
}

const OPAQUE = 250
const TOP = 12
const PAIR_HUE = 20
const PAIR_CHROMA = 12
const PAIR_TONE = { min: 3, max: 30 }
const EXTREME = { min: 3, max: 97 }

const hex = (r: number, g: number, b: number): Hex =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

const hueDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360

  return Math.min(d, 360 - d)
}

function flat(color: Hex, count: number): Flat {
  const h = Hct.fromInt(argbFromHex(color))

  return { hex: color, count, hue: h.hue, chroma: h.chroma, tone: h.tone, lit: false }
}

function paired(a: Flat, b: Flat): boolean {
  const tone = Math.abs(a.tone - b.tone)

  return (
    hueDiff(a.hue, b.hue) <= PAIR_HUE &&
    Math.abs(a.chroma - b.chroma) <= PAIR_CHROMA &&
    tone >= PAIR_TONE.min &&
    tone <= PAIR_TONE.max
  )
}

function labelled(flats: Flat[]): Flat[] {
  return flats.map((f) => {
    const above = flats.filter((o) => o !== f && paired(f, o) && o.tone > f.tone)

    if (above.length > 0) return { ...f, shadowOf: above.reduce((best, o) => (o.tone > best.tone ? o : best)).hex }

    return flats.some((o) => o !== f && paired(f, o)) ? { ...f, lit: true } : f
  })
}

function median(histogram: Uint32Array, total: number): number {
  let seen = 0

  for (let v = 0; v < 256; v++) {
    seen += histogram[v] as number

    if (seen * 2 >= total) return v
  }

  return 255
}

export function cropProblem(image: Pick<Rgba, 'width' | 'height'>, crop: Crop): string | undefined {
  const { x, y, width, height } = crop

  if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 || width < 1 || height < 1)
    return `a crop is four whole numbers x,y,w,h with w and h above 0`

  if (x + width > image.width || y + height > image.height)
    return `the crop ${width}×${height} at ${x},${y} runs past the ${image.width}×${image.height} image`

  return undefined
}

export function flatsOf(image: Rgba, counting: Counting = {}): Flats {
  const crop = counting.crop ?? { x: 0, y: 0, width: image.width, height: image.height }
  const problem = cropProblem(image, crop)

  if (problem !== undefined) throw new Error(problem)

  const quant = counting.quant ?? 0
  const step = quant > 0 ? 256 / quant : 1
  const counts = new Map<number, number>()
  const sums = new Map<number, [number, number, number]>()
  const channels = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)] as const
  let opaque = 0

  for (let row = crop.y; row < crop.y + crop.height; row++) {
    for (let at = (row * image.width + crop.x) * 4, end = at + crop.width * 4; at < end; at += 4) {
      if ((image.data[at + 3] as number) < OPAQUE) continue

      const r = image.data[at] as number
      const g = image.data[at + 1] as number
      const b = image.data[at + 2] as number

      opaque++
      channels[0][r] = (channels[0][r] as number) + 1
      channels[1][g] = (channels[1][g] as number) + 1
      channels[2][b] = (channels[2][b] as number) + 1

      const key =
        quant > 0
          ? (Math.floor(r / step) << 16) | (Math.floor(g / step) << 8) | Math.floor(b / step)
          : (r << 16) | (g << 8) | b

      counts.set(key, (counts.get(key) ?? 0) + 1)

      if (quant > 0) {
        const sum = sums.get(key) ?? [0, 0, 0]

        sum[0] += r
        sum[1] += g
        sum[2] += b
        sums.set(key, sum)
      }
    }
  }

  const color = (key: number, count: number) => {
    if (quant === 0) return hex(key >> 16, (key >> 8) & 255, key & 255)

    const [r, g, b] = sums.get(key) as [number, number, number]

    return hex(r / count, g / count, b / count)
  }

  const top = counting.top ?? TOP
  const flats: Flat[] = []

  for (const [key, count] of [...counts].sort((a, b) => b[1] - a[1])) {
    if (flats.length === top) break

    const f = flat(color(key, count), count)

    if (counting.extremes === false && (f.tone > EXTREME.max || f.tone < EXTREME.min)) continue

    flats.push(f)
  }

  return {
    pixels: crop.width * crop.height,
    opaque,
    distinct: counts.size,
    flats: labelled(flats),
    median: hex(...(channels.map((c) => median(c, opaque)) as [number, number, number])),
  }
}
