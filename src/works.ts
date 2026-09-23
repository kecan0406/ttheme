import type { Post, Site } from './booru.ts'
import type { Rgba } from './png.ts'

const NEAR = 2
const RATIO = 0.01
const MD5 = /(?:^|[^0-9a-f])([0-9a-f]{32})(?:[^0-9a-f]|$)/i
const REFS: [RegExp, string][] = [
  [/yande\.re\/post\/show\/(\d+)/, 'yande'],
  [/konachan\.(?:com|net)\/post\/show\/(\d+)/, 'konachan'],
  [/danbooru\.donmai\.us\/(?:posts|post\/show)\/(\d+)/, 'danbooru'],
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
  const credit = a.owner || a.artist
  return credit !== '' && credit === (b.owner || b.artist) && a.width === b.width && a.height === b.height
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
