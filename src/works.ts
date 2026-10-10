import type { Post, Site } from './booru.ts'
import { type Rgba, resample } from './png.ts'

const NEAR = 2
const RATIO = 0.01
const TWIN = {
  coarse: 64,
  fine: 192,
  solid: 230,
  far: 48,
  score: 15,
  outliers: 0.03,
  least: 0.03,
  most: 0.97,
  smallest: 0.25,
  largest: 4,
  step: 1.19,
  overhang: 1.04,
  tiny: 8,
  guesses: 3,
  nudges: [0.97, 1, 1.03],
  reach: 5,
}
const MD5 = /(?:^|[^0-9a-f])([0-9a-f]{32})(?:[^0-9a-f]|$)/i
const REFS: [RegExp, string][] = [
  [/yande\.re\/post\/show\/(\d+)/, 'yande'],
  [/konachan\.(?:com|net)\/post\/show\/(\d+)/, 'konachan'],
  [/danbooru\.donmai\.us\/(?:posts|post\/show)\/(\d+)/, 'danbooru'],
  [/zerochan\.net\/(\d+)(?:[?#\s]|$)/, 'zerochan'],
]

export interface Shape {
  hash: string
  width: number
  height: number
}

export function sameKeys(post: Post): string[] {
  const pixiv = /(\d+)_p(\d+)/.exec(post.source)
  return [
    ...(post.md5 ? [`md5:${post.md5}`] : []),
    ...(pixiv && post.source.includes('pximg') ? [`pixiv:${pixiv[1]}_p${pixiv[2]}`] : []),
  ]
}

export function kinKeys(site: Site, post: Post): string[] {
  const cited = MD5.exec(post.source)?.[1]?.toLowerCase()
  return [
    `post:${site.key}:${post.id}`,
    ...(post.md5 ? [`md5:${post.md5}`] : []),
    ...(cited && cited !== post.md5 ? [`md5:${cited}`] : []),
    ...REFS.flatMap(([pattern, key]) => {
      const id = pattern.exec(post.source)?.[1]
      return id ? [`post:${key}:${Number(id)}`] : []
    }),
    ...(post.family ? [`family:${site.key}:${post.family}`] : []),
  ]
}

export function sameSet(a: Post, b: Post): boolean {
  const credit = a.owner || a.named.artist[0] || ''
  return (
    credit !== '' && credit === (b.owner || b.named.artist[0] || '') && a.width === b.width && a.height === b.height
  )
}

export function shape(image: Rgba): string {
  const W = 9
  const H = 8
  const grey: number[] = []
  for (let y = 0; y < H; y++) {
    const y0 = Math.floor((y * image.height) / H)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * image.height) / H))
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor((x * image.width) / W)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * image.width) / W))
      let sum = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const at = (yy * image.width + xx) * 4
          const alpha = (image.data[at + 3] as number) / 255
          const luma =
            0.299 * (image.data[at] as number) +
            0.587 * (image.data[at + 1] as number) +
            0.114 * (image.data[at + 2] as number)
          sum += luma * alpha + 255 * (1 - alpha)
        }
      }
      grey.push(sum / ((x1 - x0) * (y1 - y0)))
    }
  }
  let hash = 0n
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 1; x++) {
      hash = (hash << 1n) | ((grey[y * W + x] as number) > (grey[y * W + x + 1] as number) ? 1n : 0n)
    }
  }
  return hash.toString(16).padStart(16, '0')
}

export function distance(a: string, b: string): number {
  let rest = BigInt(`0x${a}`) ^ BigInt(`0x${b}`)
  let bits = 0
  while (rest > 0n) {
    bits += Number(rest & 1n)
    rest >>= 1n
  }
  return bits
}

export function near(a: Shape, b: Shape): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) {
    return false
  }
  const skew = Math.abs(Math.log(a.width / a.height / (b.width / b.height)))
  return skew < RATIO && distance(a.hash, b.hash) <= NEAR
}

interface Fit {
  score: number
  far: number
  x: number
  y: number
  scale: number
}

const MISS: Fit = { score: Number.POSITIVE_INFINITY, far: 1, x: 0, y: 0, scale: 0 }

function shrunk(image: Rgba, k: number): Rgba {
  const width = Math.max(1, Math.round(image.width * k))
  const height = Math.max(1, Math.round(image.height * k))
  return resample(image, { x: 0, y: 0, w: image.width, h: image.height }, width, height)
}

function slid(cut: Rgba, whole: Rgba, x0: number, x1: number, y0: number, y1: number, scale: number): Fit {
  const solid: number[] = []
  for (let i = 0; i < cut.width * cut.height; i++) {
    if ((cut.data[i * 4 + 3] as number) >= TWIN.solid) {
      solid.push(i)
    }
  }
  let best = MISS
  if (solid.length === 0) {
    return best
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let sum = 0
      let far = 0
      for (const i of solid) {
        const cx = i % cut.width
        const px = x + cx
        const py = y + (i - cx) / cut.width
        let d = 255
        if (px >= 0 && py >= 0 && px < whole.width && py < whole.height) {
          const a = i * 4
          const b = (py * whole.width + px) * 4
          d = Math.max(
            Math.abs((cut.data[a] as number) - (whole.data[b] as number)),
            Math.abs((cut.data[a + 1] as number) - (whole.data[b + 1] as number)),
            Math.abs((cut.data[a + 2] as number) - (whole.data[b + 2] as number)),
          )
        }
        sum += d
        if (d > TWIN.far) {
          far++
        }
        if (sum > best.score * solid.length) {
          break
        }
      }
      if (sum / solid.length < best.score) {
        best = { score: sum / solid.length, far: far / solid.length, x, y, scale }
      }
    }
  }
  return best
}

export function sameArtwork(cut: Rgba, whole: Rgba): boolean {
  let solid = 0
  for (let at = 3; at < cut.data.length; at += 4) {
    if ((cut.data[at] as number) >= TWIN.solid) {
      solid++
    }
  }
  const share = solid / (cut.width * cut.height)
  if (share < TWIN.least || share > TWIN.most) {
    return false
  }
  const long = Math.max(whole.width, whole.height)
  const scales = new Set([1, whole.width / cut.width, whole.height / cut.height])
  for (let scale = TWIN.smallest; scale <= TWIN.largest; scale *= TWIN.step) {
    scales.add(scale)
  }
  const coarse = shrunk(whole, TWIN.coarse / long)
  const tried: Fit[] = []
  for (const scale of scales) {
    const k = (TWIN.coarse / long) * scale
    if (cut.width * scale > whole.width * TWIN.overhang || cut.height * scale > whole.height * TWIN.overhang) {
      continue
    }
    if (cut.width * k < TWIN.tiny || cut.height * k < TWIN.tiny) {
      continue
    }
    const small = shrunk(cut, k)
    tried.push(slid(small, coarse, -1, coarse.width - small.width + 1, -1, coarse.height - small.height + 1, scale))
  }
  tried.sort((a, b) => a.score - b.score)
  const fine = shrunk(whole, TWIN.fine / long)
  let best = MISS
  for (const guess of tried.slice(0, TWIN.guesses)) {
    for (const nudge of TWIN.nudges) {
      const scale = guess.scale * nudge
      const small = shrunk(cut, (TWIN.fine / long) * scale)
      const x = Math.round((guess.x * TWIN.fine) / TWIN.coarse)
      const y = Math.round((guess.y * TWIN.fine) / TWIN.coarse)
      const fit = slid(small, fine, x - TWIN.reach, x + TWIN.reach, y - TWIN.reach, y + TWIN.reach, scale)
      if (fit.score < best.score) {
        best = fit
      }
    }
  }
  return best.score <= TWIN.score && best.far <= TWIN.outliers
}
