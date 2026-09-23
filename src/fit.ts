import type { Post, Site } from './booru.ts'
import { type Hex, rgb } from './color.ts'
import type { Rgba } from './png.ts'

const FLAT = new Set(['comic', '4koma', 'monochrome', 'greyscale', 'sketch', 'lineart', 'speech_bubble'])
const SCENERY = new Set(['scenery', 'landscape', 'scenic', 'no_humans', 'wide_shot', 'very_wide_shot'])
const CHROMA = 0.04
const NEAR = 0.1
const FULL = 0.05
const SAMPLES = 4096

export interface Frame {
  w: number
  h: number
}

export interface Pick {
  site: Site
  post: Post
}

function cutoutTags(site: Site): Set<string> {
  return new Set(
    site.cutouts
      .split(/\s+/)
      .map((tag) => tag.replace(/^~/, ''))
      .filter(Boolean),
  )
}

export function fitScore(pick: Pick, frame: Frame, best: number, match = 0): number {
  const { site, post } = pick
  const tags = new Set(post.tags)
  const cut = [...cutoutTags(site)].some((tag) => tags.has(tag))
  const short = Math.min(post.width, post.height)
  const aspect = post.width > 0 && post.height > 0 ? post.width / post.height / (frame.w / frame.h) : 1
  return (
    (post.solo ? 2 : 0) +
    ([...FLAT].some((tag) => tags.has(tag)) ? -3 : 0) +
    ([...SCENERY].some((tag) => tags.has(tag)) ? -1.5 : 0) +
    2 * Math.min(1, short / frame.h) +
    (cut ? 1.5 : -Math.min(1.5, Math.abs(Math.log(aspect)))) +
    (best > 0 ? (1.5 * Math.log1p(Math.max(0, post.score))) / Math.log1p(best) : 0) +
    2 * match
  )
}

export function fitOrder(picks: Pick[], frame: Frame, matches: ReadonlyMap<Post, number> = new Map()): Pick[] {
  const best = new Map<Site, number>()
  for (const { site, post } of picks) {
    best.set(site, Math.max(best.get(site) ?? 0, post.score))
  }
  return picks
    .map((pick, at) => ({ pick, at, score: fitScore(pick, frame, best.get(pick.site) ?? 0, matches.get(pick.post)) }))
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .map(({ pick }) => pick)
}

export function interleave(picks: Pick[]): Pick[] {
  const lanes = new Map<Site, Pick[]>()
  for (const pick of picks) {
    lanes.set(pick.site, [...(lanes.get(pick.site) ?? []), pick])
  }
  const out: Pick[] = []
  for (let i = 0; out.length < picks.length; i++) {
    for (const lane of lanes.values()) {
      const pick = lane[i]
      if (pick) {
        out.push(pick)
      }
    }
  }
  return out
}

function linear(channel: number): number {
  const v = channel / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function oklab(r: number, g: number, b: number): [number, number, number] {
  const [R, G, B] = [linear(r), linear(g), linear(b)]
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

export function paletteMatch(image: Rgba, colors: Hex[]): number {
  const targets = colors.map((hex) => oklab(...rgb(hex))).filter(([, a, b]) => Math.hypot(a, b) >= CHROMA)
  if (targets.length === 0) {
    return 0
  }
  const step = Math.max(1, Math.floor(Math.sqrt((image.width * image.height) / SAMPLES)))
  const hits = targets.map(() => 0)
  let seen = 0
  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) {
      const at = (y * image.width + x) * 4
      if ((image.data[at + 3] as number) < 128) {
        continue
      }
      seen++
      const [L, a, b] = oklab(image.data[at] as number, image.data[at + 1] as number, image.data[at + 2] as number)
      targets.forEach(([tL, ta, tb], i) => {
        if (Math.hypot(L - tL, a - ta, b - tb) < NEAR) {
          hits[i] = (hits[i] as number) + 1
        }
      })
    }
  }
  if (seen === 0) {
    return 0
  }
  return hits.reduce((sum, hit) => sum + Math.min(1, hit / seen / FULL), 0) / targets.length
}
