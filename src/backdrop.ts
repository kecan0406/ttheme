import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Hex, luminance, rgb } from './color.ts'
import { check } from './contrast.ts'
import { alphaBox, type Box, encodePng, type Rgba, resample } from './png.ts'

export const FILL = { width: 2560, height: 1550 }
const FIGURE = 2560
const FAINT = 0.1
const HEADROOM = 0.15
const PEAK = luminance(mix('#19161e', '#9b86c8', 0.2))

export interface Colors {
  name: string
  background: Hex
  foreground: Hex
  cursor: Hex
  selection?: Hex
  ansi: Hex[]
  waived?: string[]
}

export interface Tone {
  slot: string
  color: Hex
  cap: number
  matched: number
  opacity: number
  reach: number
}

export interface Original {
  site: string
  id: number
  ext: string
  bytes: Uint8Array
  from?: string
}

export interface Origin {
  site: string
  id: number
}

export function mix(a: Hex, b: Hex, t: number): Hex {
  const from = rgb(a)
  const to = rgb(b)
  return `#${from
    .map((c, i) =>
      Math.round(c + ((to[i] ?? 0) - c) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

export function slotColor(colors: Colors, slot: string): Hex {
  if (slot === 'background' || slot === 'foreground' || slot === 'cursor') {
    return colors[slot]
  }
  if (slot === 'selection' && colors.selection) {
    return colors.selection
  }
  const match = /^ansi(\d|1[0-5])$/.exec(slot)
  const color = match ? colors.ansi[Number(match[1])] : undefined
  if (!color) {
    throw new Error(`${colors.name} has no slot ${slot}`)
  }
  return color
}

function highest(ok: (o: number) => boolean): number {
  if (ok(1)) {
    return 1
  }
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (ok(mid)) {
      lo = mid
    } else {
      hi = mid
    }
  }
  return lo
}

export function toneFor(colors: Colors, slot: string): Tone {
  const color = slotColor(colors, slot)
  const gated = (o: number) =>
    check({
      name: colors.name,
      background: mix(colors.background, color, o),
      foreground: colors.foreground,
      ansi: colors.ansi,
      waive: colors.waived ?? [],
    }).length === 0
  const cap = highest(gated)
  const matched = highest((o) => luminance(mix(colors.background, color, o)) <= PEAK)
  const opacity = Math.floor(Math.min(cap, matched) * 1000) / 1000
  const bg = rgb(colors.background)
  const reach = Math.hypot(...rgb(color).map((c, i) => (c - (bg[i] ?? 0)) * opacity))
  return { slot, color, cap, matched, opacity, reach }
}

export function backdropTone(colors: Colors, signature: string[]): Tone {
  const cursor = toneFor(colors, 'cursor')
  if (cursor.opacity >= FAINT) {
    return cursor
  }
  return signature
    .filter((slot) => slot !== 'cursor' && slot !== 'background')
    .map((slot) => toneFor(colors, slot))
    .reduce((best, tone) => (tone.reach > best.reach ? tone : best), cursor)
}

export function tint(image: Rgba, background: Hex, tone: Hex): Rgba {
  const bg = rgb(background)
  const to = rgb(tone)
  const d = image.data
  for (let i = 0; i < d.length; i += 4) {
    const gray = (0.299 * (d[i] ?? 0) + 0.587 * (d[i + 1] ?? 0) + 0.114 * (d[i + 2] ?? 0)) / 255
    for (let c = 0; c < 3; c++) {
      d[i + c] = Math.round((bg[c] ?? 0) + ((to[c] ?? 0) - (bg[c] ?? 0)) * gray)
    }
  }
  return image
}

export function composite(image: Rgba, background: Hex, opacity: number): Rgba {
  const bg = rgb(background)
  const d = image.data
  const out = new Uint8Array(d.length)
  for (let i = 0; i < d.length; i += 4) {
    const k = ((d[i + 3] ?? 0) / 255) * opacity
    for (let c = 0; c < 3; c++) {
      out[i + c] = Math.round((bg[c] ?? 0) * (1 - k) + (d[i + c] ?? 0) * k)
    }
    out[i + 3] = 255
  }
  return { width: image.width, height: image.height, data: out }
}

export function figureBox(image: Rgba): Box {
  return alphaBox(image) ?? { x: 0, y: 0, w: image.width, h: image.height }
}

export function headAnchor(box: Box): number {
  return Math.min(0.5, (HEADROOM + 0.5) * ((box.w * FILL.height) / FILL.width / box.h))
}

export function fillBox(box: Box, width: number, height: number, anchor: number): Box {
  const h = (box.w * height) / width
  if (h <= box.h) {
    const top = Math.min(Math.max(0, anchor * box.h - h / 2), box.h - h)
    return { x: box.x, y: box.y + top, w: box.w, h }
  }
  const w = (box.h * width) / height
  return { x: box.x + (box.w - w) / 2, y: box.y, w, h: box.h }
}

export function coverBox(box: Box, width: number, height: number): Box {
  if (box.w * height > box.h * width) {
    const w = (box.h * width) / height
    return { x: box.x + (box.w - w) / 2, y: box.y, w, h: box.h }
  }
  const h = (box.w * height) / width
  return { x: box.x, y: box.y + (box.h - h) / 2, w: box.w, h }
}

export function figure(image: Rgba, box: Box): Rgba {
  const k = Math.min(1, FIGURE / Math.max(box.w, box.h))
  return resample(image, box, Math.round(box.w * k), Math.round(box.h * k))
}

export function fill(image: Rgba, box: Box, anchor: number): Rgba {
  return resample(image, fillBox(box, FILL.width, FILL.height, anchor), FILL.width, FILL.height)
}

export function tryOn(image: Rgba, colors: Colors, tone: Tone, width: number, height: number): Rgba {
  const box = figureBox(image)
  const view = coverBox(fillBox(box, FILL.width, FILL.height, headAnchor(box)), width, height)
  return composite(
    tint(resample(image, view, width, height), colors.background, tone.color),
    colors.background,
    tone.opacity,
  )
}

export function backgroundsDir(configHome: string): string {
  return join(configHome, 'ttheme', 'backgrounds')
}

export function backdropConf(name: string, fillPath: string, opacity: number, from?: string): string {
  return [
    ...(from ? [`# from ${from}`] : []),
    `background-image = ${fillPath}`,
    'background-image-fit = cover',
    'background-image-position = center',
    `background-image-opacity = ${opacity}`,
    `config-file = ?${name}.tune.conf`,
    `config-file = ?${name}.off.conf`,
    '',
  ].join('\n')
}

export function clearBackdrop(dir: string, name: string): void {
  for (const file of readdirSync(dir)) {
    if (
      (file.startsWith(`${name}@`) && file.endsWith('.png')) ||
      file === `${name}.tune.conf` ||
      file === `${name}.off.conf`
    ) {
      rmSync(join(dir, file))
    }
  }
}

export function installBackdrop(
  configHome: string,
  colors: Colors,
  tone: Tone,
  image: Rgba,
  original: Original,
): string[] {
  const dir = backgroundsDir(configHome)
  const name = colors.name
  mkdirSync(join(dir, 'originals'), { recursive: true })
  clearBackdrop(dir, name)
  const box = figureBox(image)
  const anchor = headAnchor(box)
  const whole = join(dir, `${name}.png`)
  const fillPath = join(dir, `${name}@fill-${Math.round(anchor * 100)}.png`)
  const conf = join(dir, `${name}.conf`)
  const source = join(dir, 'originals', `${name}-${original.site}_${original.id}.${original.ext}`)
  writeFileSync(whole, encodePng(tint(figure(image, box), colors.background, tone.color)))
  writeFileSync(fillPath, encodePng(tint(fill(image, box, anchor), colors.background, tone.color)))
  writeFileSync(conf, backdropConf(name, fillPath, tone.opacity, original.from))
  writeFileSync(source, original.bytes)
  return [whole, fillPath, conf, source]
}

export function origins(configHome: string): Map<string, Origin> {
  const dir = join(backgroundsDir(configHome), 'originals')
  const newest = new Map<string, Origin & { at: number }>()
  let files: string[]
  try {
    files = readdirSync(dir)
  } catch {
    return new Map()
  }
  for (const file of files) {
    const match = /^(.+)-([a-z.]+)_(\d+)\.[a-z]+$/.exec(file)
    const [, name, site, id] = match ?? []
    if (!name || !site || !id) {
      continue
    }
    const at = statSync(join(dir, file)).mtimeMs
    const known = newest.get(name)
    if (!known || at > known.at) {
      newest.set(name, { site, id: Number(id), at })
    }
  }
  return new Map([...newest].map(([name, { site, id }]) => [name, { site, id }]))
}
