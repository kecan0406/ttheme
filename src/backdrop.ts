import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { type Hex, luminance, rgb } from './color.ts'
import { checkReadability } from './contrast.ts'
import type { ProfileBackground } from './emit/iterm2.ts'
import { alphaBox, type Box, encodePng, type Rgba, resample, transparency } from './png.ts'

const FILL = { width: 2560, height: 1550 }
const FIGURE = 2560
const FAINT = 0.1
export const PLACEMENT = { tall: 1.15, reach: 0.4, widest: 0.95, headroom: 0.04, margin: 0.03, stands: 12 }
const PEAK = luminance(mix('#19161e', '#9b86c8', 0.2))
const SHELF = 'shelf'

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

function slotColor(colors: Colors, slot: string): Hex {
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
    checkReadability({
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

function figureBox(image: Rgba): Box {
  return alphaBox(image) ?? { x: 0, y: 0, w: image.width, h: image.height }
}

export function fillSize(width: number, height: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return FILL
  }
  const k = Math.min(1, FILL.width / Math.max(width, height))
  return { width: Math.round(width * k), height: Math.round(height * k) }
}

export function figure(image: Rgba, box: Box): Rgba {
  const k = Math.min(1, FIGURE / Math.max(box.w, box.h))
  return resample(image, box, Math.round(box.w * k), Math.round(box.h * k))
}

export interface Frame {
  crop: Box
  at: Box
  focus: number
}

export function fillFrame(box: Box, width: number, height: number, clear: number): Frame {
  if (clear < PLACEMENT.stands) {
    const crop =
      box.w * height > box.h * width
        ? { x: box.x + (box.w - (box.h * width) / height) / 2, y: box.y, w: (box.h * width) / height, h: box.h }
        : { x: box.x, y: box.y, w: box.w, h: (box.w * height) / width }
    return { crop, at: { x: 0, y: 0, w: width, h: height }, focus: (crop.y - box.y + crop.h / 2) / box.h }
  }
  let h = Math.max(PLACEMENT.tall * height, (PLACEMENT.reach * width * box.h) / box.w)
  let w = (h * box.w) / box.h
  if (w > PLACEMENT.widest * width) {
    w = PLACEMENT.widest * width
    h = (w * box.h) / box.w
  }
  const y = PLACEMENT.headroom * height
  const shown = Math.min(1, (height - y) / h)
  return {
    crop: { x: box.x, y: box.y, w: box.w, h: box.h * shown },
    at: { x: width * (1 - PLACEMENT.margin) - w, y, w, h: h * shown },
    focus: Math.min(1, (height / 2 - y) / h),
  }
}

function paint(image: Rgba, frame: Frame, width: number, height: number): Rgba {
  const w = Math.max(1, Math.round(frame.at.w))
  const h = Math.max(1, Math.round(frame.at.h))
  const cut = resample(image, frame.crop, w, h)
  const out = new Uint8Array(width * height * 4)
  const ox = Math.round(frame.at.x)
  const oy = Math.round(frame.at.y)
  for (let y = 0; y < h; y++) {
    const ty = oy + y
    const from = Math.max(0, -ox)
    const to = Math.min(w, width - ox)
    if (ty < 0 || ty >= height || to <= from) {
      continue
    }
    out.set(cut.data.subarray((y * w + from) * 4, (y * w + to) * 4), (ty * width + ox + from) * 4)
  }
  return { width, height, data: out }
}

export function tryOn(image: Rgba, colors: Colors, tone: Tone, width: number, height: number): Rgba {
  const box = figureBox(image)
  const shown = paint(image, fillFrame(box, width, height, transparency(image, box)), width, height)
  return composite(tint(shown, colors.background, tone.color), colors.background, tone.opacity)
}

export function backgroundsDir(configHome: string): string {
  return join(configHome, 'ttheme', 'backgrounds')
}

function backdropConf(name: string, fillPath: string, opacity: number, from?: string, key?: string): string {
  return [
    ...(from ? [`# from ${from}`] : []),
    ...(key ? [`# image ${key}`] : []),
    `background-image = ${fillPath}`,
    'background-image-fit = cover',
    'background-image-position = top-right',
    `background-image-opacity = ${opacity}`,
    `config-file = ?${name}.tune.conf`,
    `config-file = ?${name}.off.conf`,
    '',
  ].join('\n')
}

export function readBackdrop(dir: string, name: string, home: string): ProfileBackground | undefined {
  const set = new Map<string, string>()
  for (const file of [`${name}.conf`, `${name}.tune.conf`, `${name}.off.conf`]) {
    let text: string
    try {
      text = readFileSync(join(dir, file), 'utf8')
    } catch {
      if (file === `${name}.conf`) {
        return undefined
      }
      continue
    }
    for (const line of text.split('\n')) {
      const m = /^(background-image(?:-fit|-opacity)?)\s*=\s*(.*?)\s*$/.exec(line)
      if (m) {
        set.set(m[1] as string, m[2] as string)
      }
    }
  }
  const image = set.get('background-image') ?? ''
  if (image === '') {
    return undefined
  }
  const opacity = Number(set.get('background-image-opacity') ?? 1)
  return {
    image: image.startsWith('~/') ? join(home, image.slice(2)) : isAbsolute(image) ? image : join(dir, image),
    opacity: Number.isFinite(opacity) ? opacity : 1,
    cover: set.get('background-image-fit') === 'cover',
  }
}

export function clearBackdrop(dir: string, name: string): void {
  for (const file of readdirSync(dir)) {
    if (belongs(file, name)) {
      rmSync(join(dir, file))
    }
  }
}

export function imageKey(origin: Origin): string {
  return `${origin.site}_${origin.id}`
}

function shelfDir(dir: string, name: string): string {
  return join(dir, SHELF, name)
}

function belongs(file: string, name: string): boolean {
  const rest = file.slice(name.length)
  return (
    file.startsWith(name) &&
    (rest === '.conf' ||
      rest === '.tune.conf' ||
      rest === '.off.conf' ||
      /^(\.[0-9a-f]{8})?(@[a-z0-9-]+)?\.png$/.test(rest))
  )
}

function activeKey(dir: string, name: string): string | undefined {
  try {
    return /^# image (\S+)$/m.exec(readFileSync(join(dir, `${name}.conf`), 'utf8'))?.[1]
  } catch {
    return undefined
  }
}

function shelved(dir: string, name: string): string[] {
  try {
    return readdirSync(shelfDir(dir, name))
  } catch {
    return []
  }
}

export function imageKeys(dir: string, name: string): string[] {
  const active = activeKey(dir, name)
  return [...(active ? [active] : []), ...shelved(dir, name)].sort()
}

function shelve(dir: string, name: string): void {
  const key = activeKey(dir, name)
  if (!key) {
    return
  }
  const to = join(shelfDir(dir, name), key)
  rmSync(to, { recursive: true, force: true })
  mkdirSync(to, { recursive: true })
  for (const file of readdirSync(dir)) {
    if (belongs(file, name)) {
      renameSync(join(dir, file), join(to, file.slice(name.length)))
    }
  }
}

function unshelve(dir: string, name: string, key: string): void {
  const from = join(shelfDir(dir, name), key)
  for (const file of readdirSync(from)) {
    renameSync(join(from, file), join(dir, `${name}${file}`))
  }
  rmSync(from, { recursive: true })
}

function originalOf(dir: string, name: string, key: string): string | undefined {
  try {
    return readdirSync(join(dir, 'originals')).find((file) => file.startsWith(`${name}-${key}.`))
  } catch {
    return undefined
  }
}

function newest(dir: string, name: string, key: string): void {
  const file = originalOf(dir, name, key)
  if (file) {
    const now = new Date()
    utimesSync(join(dir, 'originals', file), now, now)
  }
}

export function switchImage(configHome: string, name: string, step: 1 | -1): { key: string; at: number; of: number } {
  const dir = backgroundsDir(configHome)
  const keys = imageKeys(dir, name)
  const now = activeKey(dir, name)
  if (!now || keys.length < 2) {
    throw new Error(`${name} has no other image`)
  }
  const at = (keys.indexOf(now) + step + keys.length) % keys.length
  const key = keys[at] as string
  shelve(dir, name)
  unshelve(dir, name, key)
  newest(dir, name, key)
  return { key, at: at + 1, of: keys.length }
}

export function dropImage(configHome: string, name: string): { key?: string; left: number } {
  const dir = backgroundsDir(configHome)
  const files = readdirSync(dir).filter((file) => belongs(file, name))
  if (files.length === 0) {
    throw new Error(`${name} has no image`)
  }
  const keys = imageKeys(dir, name)
  const now = activeKey(dir, name)
  const original = now && originalOf(dir, name, now)
  if (original) {
    rmSync(join(dir, 'originals', original))
  }
  for (const file of files) {
    rmSync(join(dir, file))
  }
  const rest = keys.filter((key) => key !== now)
  const next = rest[(now ? keys.indexOf(now) : 0) % rest.length]
  if (next) {
    unshelve(dir, name, next)
    newest(dir, name, next)
  }
  return { key: now, left: rest.length }
}

function retire(dir: string, name: string, key?: string): void {
  if (activeKey(dir, name) !== key) {
    shelve(dir, name)
  }
  if (key) {
    rmSync(join(shelfDir(dir, name), key), { recursive: true, force: true })
  }
  clearBackdrop(dir, name)
}

export function installBackdrop(
  configHome: string,
  colors: Colors,
  tone: Tone,
  image: Rgba,
  original: Original,
  window: { width: number; height: number },
): string[] {
  const dir = backgroundsDir(configHome)
  const name = colors.name
  const key = imageKey(original)
  mkdirSync(join(dir, 'originals'), { recursive: true })
  retire(dir, name, key)
  const box = figureBox(image)
  const { width, height } = fillSize(window.width, window.height)
  const frame = fillFrame(box, width, height, transparency(image, box))
  const figurePng = encodePng(tint(figure(image, box), colors.background, tone.color))
  const fillPng = encodePng(tint(paint(image, frame, width, height), colors.background, tone.color))
  const stem = join(dir, `${name}.${createHash('sha1').update(figurePng).update(fillPng).digest('hex').slice(0, 8)}`)
  const whole = `${stem}.png`
  const fillPath = `${stem}@fill-${Math.round(frame.focus * 100)}.png`
  const conf = join(dir, `${name}.conf`)
  const source = join(dir, 'originals', `${name}-${original.site}_${original.id}.${original.ext}`)
  writeFileSync(whole, figurePng)
  writeFileSync(fillPath, fillPng)
  writeFileSync(conf, backdropConf(name, fillPath, tone.opacity, original.from, key))
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
