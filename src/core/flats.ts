import type { Hex } from './color.ts'
import { hctOf } from './hct.ts'
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
const PAIR_SHARE = 0.1
const SLOTS_FIRST = 1 << 12
const SPREAD = 0x9e3779b1

const hex = (r: number, g: number, b: number): Hex =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

const hueDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360

  return Math.min(d, 360 - d)
}

class Tally {
  slots = new Int32Array(SLOTS_FIRST)
  keys = new Int32Array(SLOTS_FIRST / 2)
  counts = new Float64Array(SLOTS_FIRST / 2)
  sums: Float64Array
  size = 0
  shift = 32 - Math.log2(SLOTS_FIRST)
  readonly summing: boolean

  constructor(summing: boolean) {
    this.summing = summing
    this.sums = new Float64Array(summing ? (SLOTS_FIRST / 2) * 3 : 0)
  }

  idOf(key: number): number {
    const mask = this.slots.length - 1
    let at = Math.imul(key, SPREAD) >>> this.shift

    for (let held = this.slots[at] as number; held !== 0; held = this.slots[at] as number) {
      if (this.keys[held - 1] === key) return held - 1

      at = (at + 1) & mask
    }

    const id = this.size++

    if (id === this.keys.length) this.widen()

    this.keys[id] = key
    this.slots[at] = id + 1

    if (this.size * 2 > this.slots.length) this.rehash()

    return id
  }

  widen(): void {
    const keys = new Int32Array(this.keys.length * 2)
    const counts = new Float64Array(this.counts.length * 2)
    keys.set(this.keys)
    counts.set(this.counts)
    this.keys = keys
    this.counts = counts

    if (this.summing) {
      const sums = new Float64Array(this.sums.length * 2)
      sums.set(this.sums)
      this.sums = sums
    }
  }

  rehash(): void {
    const slots = new Int32Array(this.slots.length * 2)
    const mask = slots.length - 1
    this.shift--

    for (let id = 0; id < this.size; id++) {
      let at = Math.imul(this.keys[id] as number, SPREAD) >>> this.shift

      while (slots[at] !== 0) at = (at + 1) & mask

      slots[at] = id + 1
    }

    this.slots = slots
  }

  top(most: number): number[] {
    const kept: number[] = []

    for (let id = 0; id < this.size; id++) {
      const count = this.counts[id] as number

      if (kept.length === most && count <= (this.counts[kept[most - 1] as number] as number)) continue

      let at = kept.length

      while (at > 0 && count > (this.counts[kept[at - 1] as number] as number)) at--

      kept.splice(at, 0, id)

      if (kept.length > most) kept.pop()
    }

    return kept
  }
}

function flat(color: Hex, count: number): Flat {
  const h = hctOf(color)

  return { hex: color, count, hue: h.hue, chroma: h.chroma, tone: h.tone, lit: false }
}

function paired(a: Flat, b: Flat): boolean {
  const tone = Math.abs(a.tone - b.tone)

  return (
    hueDiff(a.hue, b.hue) <= PAIR_HUE &&
    Math.abs(a.chroma - b.chroma) <= PAIR_CHROMA &&
    tone >= PAIR_TONE.min &&
    tone <= PAIR_TONE.max &&
    Math.min(a.count, b.count) >= PAIR_SHARE * Math.max(a.count, b.count)
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

const levelsOf = (quant: number) => {
  const step = 256 / quant

  return Uint8Array.from({ length: 256 }, (_, v) => Math.floor(v / step))
}

function spread(tally: Tally, channels: readonly [Uint32Array, Uint32Array, Uint32Array]): void {
  for (let at = 0; at < tally.size; at++) {
    const key = tally.keys[at] as number
    const count = tally.counts[at] as number
    channels[0][key >> 16] = (channels[0][key >> 16] as number) + count
    channels[1][(key >> 8) & 255] = (channels[1][(key >> 8) & 255] as number) + count
    channels[2][key & 255] = (channels[2][key & 255] as number) + count
  }
}

function countColors(image: Rgba, crop: Crop, tally: Tally): number {
  const { data } = image
  let counts = tally.counts
  let opaque = 0
  let last = -1
  let id = -1

  for (let row = crop.y; row < crop.y + crop.height; row++) {
    for (let at = (row * image.width + crop.x) * 4, end = at + crop.width * 4; at < end; at += 4) {
      if ((data[at + 3] as number) < OPAQUE) continue

      const key = ((data[at] as number) << 16) | ((data[at + 1] as number) << 8) | (data[at + 2] as number)

      opaque++

      if (key !== last) {
        id = tally.idOf(key)
        last = key
        counts = tally.counts
      }

      counts[id] = (counts[id] as number) + 1
    }
  }

  return opaque
}

function countLevels(
  image: Rgba,
  crop: Crop,
  tally: Tally,
  level: Uint8Array,
  channels: readonly [Uint32Array, Uint32Array, Uint32Array],
): number {
  const { data } = image
  let opaque = 0
  let last = -1
  let id = -1

  for (let row = crop.y; row < crop.y + crop.height; row++) {
    for (let at = (row * image.width + crop.x) * 4, end = at + crop.width * 4; at < end; at += 4) {
      if ((data[at + 3] as number) < OPAQUE) continue

      const r = data[at] as number
      const g = data[at + 1] as number
      const b = data[at + 2] as number

      opaque++
      channels[0][r] = (channels[0][r] as number) + 1
      channels[1][g] = (channels[1][g] as number) + 1
      channels[2][b] = (channels[2][b] as number) + 1

      const key = ((level[r] as number) << 16) | ((level[g] as number) << 8) | (level[b] as number)

      if (key !== last) {
        id = tally.idOf(key)
        last = key
      }

      tally.counts[id] = (tally.counts[id] as number) + 1
      tally.sums[id * 3] = (tally.sums[id * 3] as number) + r
      tally.sums[id * 3 + 1] = (tally.sums[id * 3 + 1] as number) + g
      tally.sums[id * 3 + 2] = (tally.sums[id * 3 + 2] as number) + b
    }
  }

  return opaque
}

export function cropProblem(image: Pick<Rgba, 'width' | 'height'>, crop: Crop): string | undefined {
  const { x, y, width, height } = crop

  if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 || width < 1 || height < 1)
    return `a crop is four whole numbers x,y,w,h with w and h above 0`

  if (x + width > image.width || y + height > image.height)
    return `the crop ${width}×${height} at ${x},${y} runs past the ${image.width}×${image.height} picture`

  return undefined
}

export function flatsOf(image: Rgba, counting: Counting = {}): Flats {
  const crop = counting.crop ?? { x: 0, y: 0, width: image.width, height: image.height }
  const problem = cropProblem(image, crop)

  if (problem !== undefined) throw new Error(problem)

  const quant = counting.quant ?? 0
  const tally = new Tally(quant > 0)
  const channels = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)] as const

  const opaque =
    quant > 0 ? countLevels(image, crop, tally, levelsOf(quant), channels) : countColors(image, crop, tally)

  if (quant === 0) spread(tally, channels)

  const color = (at: number, count: number) => {
    const key = tally.keys[at] as number

    if (quant === 0) return hex(key >> 16, (key >> 8) & 255, key & 255)

    return hex(
      (tally.sums[at * 3] as number) / count,
      (tally.sums[at * 3 + 1] as number) / count,
      (tally.sums[at * 3 + 2] as number) / count,
    )
  }

  const flats = tally.top(TOP).map((at) => {
    const count = tally.counts[at] as number

    return flat(color(at, count), count)
  })

  return {
    pixels: crop.width * crop.height,
    opaque,
    distinct: tally.size,
    flats: labelled(flats),
    median: hex(...(channels.map((c) => median(c, opaque)) as [number, number, number])),
  }
}
