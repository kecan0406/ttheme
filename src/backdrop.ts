import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs'
import { basename, isAbsolute, join } from 'node:path'
import { artworkOf, creditLine, linksOf } from './artists.ts'
import { type Hex, luminance, mix, rgb } from './color.ts'
import { checkReadability } from './contrast.ts'
import { MATTING, matte } from './cutout.ts'
import { keyOf, known, recall, remember } from './drawn.ts'
import { writeAtomic } from './edits.ts'
import type { ProfileBackground } from './emit/iterm2.ts'
import {
  alphaBox,
  alphaOf,
  type Box,
  blur,
  decodePng,
  encodeGray,
  encodeMask,
  encodeRgba,
  type Mask,
  type Plane,
  pngHead,
  quantize,
  type Rgba,
  resample,
  resamplePlane,
  retone,
  transparency,
} from './png.ts'
import { stem as fileStem, POSITIONS, type SharedPicture } from './theme.ts'

const FILL = { width: 2560, height: 1550 }
const DRAWING = 2
const FIGURE = 2560
const FAINT = 0.1
const WHITE = 0.99
const LIFT = 2
const PLACEMENT = { tall: 1.15, reach: 0.4, widest: 0.95, headroom: 0.04, margin: 0.03, stands: 12 }
const PEAK = luminance(mix('#19161e', '#9b86c8', 0.2))
const SHELF = 'shelf'
const ORIGINALS = 'originals'
const STORE = 'images.json'
const VERSION = 1

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

export type Hue = Pick<Tone, 'color' | 'opacity'>

export type Coloring = 'tone' | 'original'

export interface Paint {
  hue: Hue
  colors: Colors
}

interface Original {
  site: string
  id: number
  ext: string
  bytes: Uint8Array
  from?: string
  artist?: string[]
  profiles?: Record<string, string[]>
  source?: string
  cut?: boolean
}

interface Origin {
  site: string
  id: number
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

function fade(colors: Colors, color: Hex): { cap: number; matched: number; opacity: number } {
  const misses = (o: number) =>
    checkReadability({
      name: colors.name,
      background: mix(colors.background, color, o),
      foreground: colors.foreground,
      ansi: colors.ansi,
      waive: colors.waived ?? [],
    }).map((miss) => miss.rule)
  const already = new Set(misses(0))
  const cap = highest((o) => misses(o).every((rule) => already.has(rule)))
  const matched = highest((o) => luminance(mix(colors.background, color, o)) <= PEAK)
  return { cap, matched, opacity: Math.floor(Math.min(cap, matched) * 100) / 100 }
}

export function toneFor(colors: Colors, slot: string): Tone {
  const color = slotColor(colors, slot)
  const { cap, matched, opacity } = fade(colors, color)
  const bg = rgb(colors.background)
  const reach = Math.hypot(...rgb(color).map((c, i) => (c - (bg[i] ?? 0)) * opacity))
  return { slot, color, cap, matched, opacity, reach }
}

export function originalOpacity(colors: Colors, peak: Hex): number {
  return fade(colors, peak).opacity
}

export function backdropTone(colors: Colors, signature: string[]): Tone {
  const cursor = toneFor(colors, 'cursor')
  if (cursor.opacity >= FAINT) {
    return cursor
  }
  return signature
    .values()
    .filter((slot) => slot !== 'cursor' && slot !== 'background')
    .map((slot) => toneFor(colors, slot))
    .reduce((best, tone) => (tone.reach > best.reach ? tone : best), cursor)
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

interface Frame {
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

function luma(data: Uint8Array, at: number): number {
  return 0.299 * (data[at] ?? 0) + 0.587 * (data[at + 1] ?? 0) + 0.114 * (data[at + 2] ?? 0)
}

export function liftOf(image: Rgba, box: Box): number {
  const counts = new Uint32Array(256)
  const step = Math.max(1, Math.floor((box.w * box.h) / 400_000))
  let seen = 0
  for (let i = 0; i < box.w * box.h; i += step) {
    const at = ((box.y + Math.floor(i / box.w)) * image.width + box.x + (i % box.w)) * 4
    if ((image.data[at + 3] ?? 0) >= 128) {
      const level = Math.round(luma(image.data, at))
      counts[level] = (counts[level] ?? 0) + 1
      seen++
    }
  }
  let below = 0
  for (let level = 0; level < 256 && seen > 0; level++) {
    below += counts[level] ?? 0
    if (below >= seen * WHITE) {
      return Math.min(LIFT, Math.max(1, 255 / Math.max(1, level)))
    }
  }
  return 1
}

const LINEAR = Float64Array.from({ length: 256 }, (_, level) => {
  const s = level / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
})

function hexOf(r: number, g: number, b: number): Hex {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`
}

export function peakOf(image: Rgba, box: Box): Hex {
  const counts = new Uint32Array(256)
  const sums = new Float64Array(256 * 3)
  const step = Math.max(1, Math.floor((box.w * box.h) / 400_000))
  let seen = 0
  for (let i = 0; i < box.w * box.h; i += step) {
    const at = ((box.y + Math.floor(i / box.w)) * image.width + box.x + (i % box.w)) * 4
    if ((image.data[at + 3] ?? 0) >= 128) {
      const r = image.data[at] ?? 0
      const g = image.data[at + 1] ?? 0
      const b = image.data[at + 2] ?? 0
      const level = Math.round(
        255 * Math.sqrt(0.2126 * (LINEAR[r] ?? 0) + 0.7152 * (LINEAR[g] ?? 0) + 0.0722 * (LINEAR[b] ?? 0)),
      )
      counts[level] = (counts[level] ?? 0) + 1
      sums[level * 3] = (sums[level * 3] ?? 0) + r
      sums[level * 3 + 1] = (sums[level * 3 + 1] ?? 0) + g
      sums[level * 3 + 2] = (sums[level * 3 + 2] ?? 0) + b
      seen++
    }
  }
  let below = 0
  for (let level = 0; level < 256 && seen > 0; level++) {
    below += counts[level] ?? 0
    if (below >= seen * WHITE) {
      const n = Math.max(1, counts[level] ?? 1)
      return hexOf((sums[level * 3] ?? 0) / n, (sums[level * 3 + 1] ?? 0) / n, (sums[level * 3 + 2] ?? 0) / n)
    }
  }
  return '#ffffff'
}

function inkOf(image: Rgba, lift: number): Mask {
  const src = image.data
  const data = new Uint8Array(image.width * image.height)
  for (let i = 0, at = 0; i < data.length; i++, at += 4) {
    const a = src[at + 3] as number
    if (a === 0) {
      continue
    }
    const level =
      (0.299 * (src[at] as number) + 0.587 * (src[at + 1] as number) + 0.114 * (src[at + 2] as number)) * lift
    data[i] = ((level > 255 ? 255 : level) * a) / 255 + 0.5
  }
  return { width: image.width, height: image.height, data }
}

interface Window {
  x0: number
  y0: number
  x1: number
  y1: number
  box: Box
}

function windowOf(frame: Frame, width: number, height: number): Window | undefined {
  const x0 = Math.max(0, Math.round(frame.at.x))
  const y0 = Math.max(0, Math.round(frame.at.y))
  const x1 = Math.min(width, Math.round(frame.at.x + frame.at.w))
  const y1 = Math.min(height, Math.round(frame.at.y + frame.at.h))
  if (x1 <= x0 || y1 <= y0) {
    return undefined
  }
  const kx = frame.crop.w / frame.at.w
  const ky = frame.crop.h / frame.at.h
  return {
    x0,
    y0,
    x1,
    y1,
    box: {
      x: frame.crop.x + (x0 - frame.at.x) * kx,
      y: frame.crop.y + (y0 - frame.at.y) * ky,
      w: (x1 - x0) * kx,
      h: (y1 - y0) * ky,
    },
  }
}

function place(source: Mask | Plane, frame: Frame, width: number, height: number): Plane {
  const data = new Float32Array(width * height)
  const at = windowOf(frame, width, height)
  if (at) {
    const part = resamplePlane(source, at.box, at.x1 - at.x0, at.y1 - at.y0)
    for (let y = at.y0; y < at.y1; y++) {
      data.set(part.data.subarray((y - at.y0) * (at.x1 - at.x0), (y - at.y0 + 1) * (at.x1 - at.x0)), y * width + at.x0)
    }
  }
  return { width, height, data }
}

function placeColors(source: Rgba, frame: Frame, width: number, height: number): Rgba {
  const data = new Uint8Array(width * height * 4)
  const at = windowOf(frame, width, height)
  if (at) {
    const w = at.x1 - at.x0
    const part = resample(source, at.box, w, at.y1 - at.y0)
    for (let y = at.y0; y < at.y1; y++) {
      data.set(part.data.subarray((y - at.y0) * w * 4, (y - at.y0 + 1) * w * 4), (y * width + at.x0) * 4)
    }
  }
  return { width, height, data }
}

function blurColors(image: Rgba, sigma: number): Rgba {
  if (sigma <= 0) {
    return image
  }
  const { width, height } = image
  const planes = [0, 1, 2, 3].map(() => ({ width, height, data: new Float32Array(width * height) }))
  for (let i = 0; i < width * height; i++) {
    const a = image.data[i * 4 + 3] ?? 0
    for (let c = 0; c < 3; c++) {
      ;(planes[c] as Plane).data[i] = ((image.data[i * 4 + c] ?? 0) * a) / 255
    }
    ;(planes[3] as Plane).data[i] = a
  }
  const blurred = planes.map((plane) => blur(plane, sigma).data)
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const a = blurred[3]?.[i] ?? 0
    if (a <= 0) {
      continue
    }
    for (let c = 0; c < 3; c++) {
      data[i * 4 + c] = Math.min(255, Math.max(0, Math.round(((blurred[c]?.[i] ?? 0) * 255) / a)))
    }
    data[i * 4 + 3] = Math.min(255, Math.round(a))
  }
  return { width, height, data }
}

export interface Inked {
  box: Box
  clear: number
  ink: Mask
  image: Rgba
  peak: Hex
}

export function inked(source: Rgba, cut = false): Inked {
  const image = cut ? matte(source) : source
  const box = figureBox(image)
  let ink: Mask | undefined
  let peak: Hex | undefined
  return {
    box,
    clear: transparency(image, box),
    get ink() {
      ink ??= inkOf(image, liftOf(image, box))
      return ink
    },
    image,
    get peak() {
      peak ??= peakOf(image, box)
      return peak
    },
  }
}

type Drawing =
  | { coloring: 'tone'; figure: Mask; fill: Mask; focus: number }
  | { coloring: 'original'; figure: Rgba; fill: Rgba; focus: number; peak: Hex }

function draw(
  source: Rgba,
  width: number,
  height: number,
  blurring: number,
  coloring: Coloring,
  cut: boolean,
): Drawing {
  const held = inked(source, cut)
  const { box, clear, ink, image } = held
  const frame = fillFrame(box, width, height, clear)
  const k = Math.min(1, FIGURE / Math.max(box.w, box.h))
  const at = { x: 0, y: 0, w: Math.round(box.w * k), h: Math.round(box.h * k) }
  const across = (blurring * at.w * frame.crop.w) / (box.w * frame.at.w)
  if (coloring === 'original') {
    return {
      coloring,
      figure: blurColors(resample(image, box, at.w, at.h), across),
      fill: blurColors(placeColors(image, frame, width, height), blurring),
      focus: frame.focus,
      peak: held.peak,
    }
  }
  const figure = place(ink, { crop: box, at, focus: frame.focus }, at.w, at.h)
  const fill = place(ink, frame, width, height)
  return {
    coloring,
    figure: quantize(blur(figure, across)),
    fill: quantize(blur(fill, blurring)),
    focus: frame.focus,
  }
}

function shade(mask: Mask, background: Hex, tone: Hex, opacity: number): Rgba {
  const bg = rgb(background)
  const to = rgb(tone)
  const data = new Uint8Array(mask.width * mask.height * 4)
  for (let i = 0; i < mask.data.length; i++) {
    const k = ((mask.data[i] ?? 0) / 255) * opacity
    for (let c = 0; c < 3; c++) {
      data[i * 4 + c] = Math.round((bg[c] ?? 0) + ((to[c] ?? 0) - (bg[c] ?? 0)) * k)
    }
    data[i * 4 + 3] = 255
  }
  return { width: mask.width, height: mask.height, data }
}

function veil(image: Rgba, background: Hex, opacity: number): Rgba {
  const bg = rgb(background)
  const data = new Uint8Array(image.width * image.height * 4)
  for (let i = 0; i < image.width * image.height; i++) {
    const k = ((image.data[i * 4 + 3] ?? 0) / 255) * opacity
    for (let c = 0; c < 3; c++) {
      data[i * 4 + c] = Math.round((bg[c] ?? 0) + ((image.data[i * 4 + c] ?? 0) - (bg[c] ?? 0)) * k)
    }
    data[i * 4 + 3] = 255
  }
  return { width: image.width, height: image.height, data }
}

export interface Framing {
  size: 'fill' | number
  at: number
  opacity: number
}

export function tryOn(
  held: Inked,
  colors: Colors,
  tone: Hue,
  width: number,
  height: number,
  blurring: number,
  framing?: Partial<Framing>,
  coloring: Coloring = 'tone',
): { image: Rgba; fill: number; opacity: number } {
  const { box, clear, ink } = held
  const frame = fillFrame(box, width, height, clear)
  const fill = Math.round((100 * frame.at.w) / frame.crop.w / Math.min(width / box.w, height / box.h))
  const size = framing?.size ?? 'fill'
  const placed =
    size === 'fill'
      ? frame
      : {
          crop: box,
          at: frameAt(
            box.w,
            box.h,
            width,
            height,
            size,
            framing?.at ?? 5,
            false,
            size > 100 ? Math.round(frame.focus * 100) : -1,
          ),
          focus: frame.focus,
        }
  const fallback = coloring === 'original' ? originalOpacity(colors, held.peak) : tone.opacity
  const opacity = framing?.opacity ?? fallback
  return {
    image:
      coloring === 'original'
        ? veil(blurColors(placeColors(held.image, placed, width, height), blurring), colors.background, opacity)
        : shade(quantize(blur(place(ink, placed, width, height), blurring)), colors.background, tone.color, opacity),
    fill,
    opacity: fallback,
  }
}

export function backgroundsDir(configHome: string): string {
  return join(configHome, 'ttheme', 'backgrounds')
}

export interface Picture {
  key: string
  stem: string
  fill: string
  opacity: number
  coloring?: Coloring
  tone?: Hex
  peak?: Hex
  blur?: number
  window?: { width: number; height: number }
  from?: string
  artist?: string[]
  profiles?: Record<string, string[]>
  source?: string
  original?: string
  cut?: string
  matte?: number
}

interface Rack {
  active: string
  pictures: Picture[]
}

interface Store {
  version: number
  palettes: Record<string, Rack>
}

function storePath(dir: string): string {
  return join(dir, STORE)
}

function readText(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}

function listing(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

export function readStore(dir: string): Store {
  const text = readText(storePath(dir))
  if (text === undefined) {
    return migrate(dir)
  }
  const store = JSON.parse(text) as Store
  if (store.version !== VERSION) {
    throw new Error(`${storePath(dir)} is version ${store.version} — this ttheme reads version ${VERSION}`)
  }
  return store
}

export function coloringOf(picture: Picture): Coloring {
  return picture.coloring ?? 'tone'
}

export function colorsOf(entry: Colors): Colors {
  return {
    name: entry.name,
    background: entry.background,
    foreground: entry.foreground,
    cursor: entry.cursor,
    ...(entry.selection ? { selection: entry.selection } : {}),
    ansi: entry.ansi,
    ...(entry.waived ? { waived: entry.waived } : {}),
  }
}

export function paintFor(entry: Colors & { backdrop: Hue }): Paint {
  return { hue: { color: entry.backdrop.color, opacity: entry.backdrop.opacity }, colors: colorsOf(entry) }
}

export function undrawn(picture: Picture): boolean {
  return picture.tone === undefined && coloringOf(picture) === 'tone'
}

function word(name: string): string {
  return name.replace(/[\s,\p{Cc}]+/gu, '_')
}

function byline(picture: Picture): string {
  return (picture.artist ?? []).map(word).join(',')
}

function creditLines(held: Picture): string[] {
  const page = artworkOf(held)
  const line = creditLine(held)?.replace(/\p{Cc}+/gu, '')
  return [
    ...(line ? [`# credit ${held.key} ${line}`] : []),
    ...(page ? [`# source ${held.key} ${page.label} ${page.url}`] : []),
    ...(held.artist ?? []).flatMap((name) => {
      const links = linksOf(held.profiles?.[name])
      return links.length > 0
        ? [`# profile ${held.key} ${word(name)} ${links.map((link) => `${link.kind} ${link.url}`).join(' ')}`]
        : []
    }),
  ]
}

function confText(dir: string, rack: Rack): string {
  const at = rack.pictures.findIndex((picture) => picture.key === rack.active)
  const picture = rack.pictures[at] as Picture
  return [
    ...(picture.artist?.length ? [`# by ${byline(picture)}`] : []),
    ...(picture.from ? [`# from ${picture.from}`] : []),
    `# image ${picture.key} ${at + 1}/${rack.pictures.length}`,
    ...rack.pictures.map((held) =>
      [
        `# picture ${held.key} ${held.stem} ${held.fill} ${held.opacity} ${held.artist?.length ? byline(held) : '-'}`,
        ...(held.from ? [held.from] : []),
      ].join(' '),
    ),
    ...rack.pictures.filter((held) => coloringOf(held) === 'original').map((held) => `# colors ${held.key} original`),
    ...rack.pictures.flatMap(creditLines),
    `background-image = ${join(dir, picture.fill)}`,
    'background-image-fit = cover',
    'background-image-position = top-right',
    `background-image-opacity = ${picture.opacity}`,
    `config-file = ?${picture.stem}.tune.conf`,
    `config-file = ?${picture.stem}.off.conf`,
    '',
  ].join('\n')
}

export function freshenConfs(configHome: string): void {
  const dir = backgroundsDir(configHome)
  for (const [name, rack] of Object.entries(readStore(dir).palettes)) {
    const conf = join(dir, `${fileStem(name)}.conf`)
    const text = confText(dir, rack)
    if (readText(conf) !== text) {
      writeAtomic(conf, text)
    }
  }
}

function save(dir: string, store: Store, names: string[]): void {
  writeAtomic(storePath(dir), `${JSON.stringify(store, null, 2)}\n`)
  for (const name of names) {
    const rack = store.palettes[name]
    const conf = join(dir, `${fileStem(name)}.conf`)
    if (rack) {
      writeAtomic(conf, confText(dir, rack))
    } else {
      rmSync(conf, { force: true })
    }
  }
}

export function moveRacks(configHome: string, renamed: ReadonlyMap<string, string>): void {
  const dir = backgroundsDir(configHome)
  const store = readStore(dir)
  const names: string[] = []
  for (const [from, to] of renamed) {
    const rack = store.palettes[from]
    if (rack && !store.palettes[to]) {
      store.palettes[to] = rack
      delete store.palettes[from]
      names.push(from, to)
    }
  }
  if (names.length > 0) {
    save(dir, store, names)
  }
}

function stemFiles(dir: string, stem: string): string[] {
  return listing(dir).filter((file) => file.startsWith(`${stem}.`) || file.startsWith(`${stem}@`))
}

function forget(dir: string, stem: string): void {
  for (const file of stemFiles(dir, stem)) {
    rmSync(join(dir, file), { force: true })
  }
}

function discard(dir: string, picture: Picture): void {
  forget(dir, picture.stem)
  for (const kept of [picture.original, picture.cut]) {
    if (kept) {
      rmSync(join(dir, kept), { force: true })
    }
  }
}

function legacyPicture(name: string, text: string | undefined, originals: string[], key?: string): Picture | undefined {
  const fill = basename(/^background-image\s*=\s*(.*?)\s*$/m.exec(text ?? '')?.[1] ?? '')
  if (!fill.startsWith(`${name}.`) || !/^\.[0-9a-f]{8}@fill-\d+\.png$/.test(fill.slice(name.length))) {
    return undefined
  }
  const stem = fill.slice(0, fill.indexOf('@'))
  const known = key ?? /^# image (\S+)$/m.exec(text ?? '')?.[1] ?? `picture_${stem.slice(name.length + 1)}`
  const from = /^# from (.+)$/m.exec(text ?? '')?.[1]
  const opacity = Number(/^background-image-opacity\s*=\s*(\S+)/m.exec(text ?? '')?.[1] ?? 1)
  const original = originals.find((file) => file.startsWith(`${name}-${known}.`))
  return {
    key: known,
    stem,
    fill,
    opacity: Number.isFinite(opacity) ? opacity : 1,
    ...(from ? { from } : {}),
    ...(original ? { original: join(ORIGINALS, original) } : {}),
  }
}

function adopt(from: string, to: string): void {
  if (existsSync(from)) {
    renameSync(from, to)
  }
}

function migrate(dir: string): Store {
  const store: Store = { version: VERSION, palettes: {} }
  if (!existsSync(dir)) {
    return store
  }
  const originals = listing(join(dir, ORIGINALS))
  const confs = listing(dir)
    .filter((file) => file.endsWith('.conf') && file !== 'shown.conf' && !/\.(tune|off)\.conf$/.test(file))
    .map((file) => file.slice(0, -'.conf'.length))
  const shelf = join(dir, SHELF)
  for (const name of new Set([...confs, ...listing(shelf)])) {
    const pictures: Picture[] = []
    const shown = legacyPicture(name, readText(join(dir, `${name}.conf`)), originals)
    if (shown) {
      adopt(join(dir, `${name}.tune.conf`), join(dir, `${shown.stem}.tune.conf`))
      adopt(join(dir, `${name}.off.conf`), join(dir, `${shown.stem}.off.conf`))
      pictures.push(shown)
    }
    for (const key of listing(join(shelf, name))) {
      const from = join(shelf, name, key)
      const picture = legacyPicture(name, readText(join(from, '.conf')), originals, key)
      if (!picture) {
        continue
      }
      for (const file of listing(from)) {
        const to = file === '.tune.conf' || file === '.off.conf' ? `${picture.stem}${file}` : `${name}${file}`
        if (file !== '.conf') {
          renameSync(join(from, file), join(dir, to))
        }
      }
      rmSync(from, { recursive: true })
      pictures.push(picture)
    }
    if (listing(join(shelf, name)).length === 0) {
      rmSync(join(shelf, name), { recursive: true, force: true })
    }
    if (pictures.length > 0) {
      pictures.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      store.palettes[name] = { active: (shown ?? (pictures[0] as Picture)).key, pictures }
    }
  }
  if (listing(shelf).length === 0) {
    rmSync(shelf, { recursive: true, force: true })
  }
  save(dir, store, Object.keys(store.palettes))
  return store
}

function locate(dir: string, path: string, home: string): string {
  return path.startsWith('~/') ? join(home, path.slice(2)) : isAbsolute(path) ? path : join(dir, path)
}

export function readBackdrop(dir: string, name: string, home: string): ProfileBackground | undefined {
  const set = new Map<string, string>()
  const read = (file: string, depth: number): boolean => {
    const text = readText(file)
    if (text === undefined) {
      return false
    }
    for (const line of text.split('\n')) {
      const m = /^([a-z-]+)\s*=\s*(.*?)\s*$/.exec(line)
      if (m?.[1] === 'config-file' && depth < 4) {
        read(locate(dir, (m[2] as string).replace(/^\?/, ''), home), depth + 1)
      } else if (m && /^background-image(?:-fit|-opacity|-position)?$/.test(m[1] as string)) {
        set.set(m[1] as string, m[2] as string)
      }
    }
    return true
  }
  if (!read(join(dir, `${fileStem(name)}.conf`), 0)) {
    return undefined
  }
  const image = set.get('background-image') ?? ''
  if (image === '') {
    return undefined
  }
  const opacity = Number(set.get('background-image-opacity') ?? 1)
  return {
    image: locate(dir, image, home),
    opacity: Number.isFinite(opacity) ? opacity : 1,
    cover: set.get('background-image-fit') === 'cover',
    position: set.get('background-image-position') ?? 'center',
  }
}

export function imageKey(origin: Origin): string {
  return `${origin.site}_${origin.id}`
}

export function dropImage(configHome: string, name: string, key?: string): { key: string; left: number } {
  const dir = backgroundsDir(configHome)
  const store = readStore(dir)
  const rack = store.palettes[name]
  if (!rack) {
    throw new Error(`${name} has no image`)
  }
  const at = rack.pictures.findIndex((picture) => picture.key === (key ?? rack.active))
  if (at === -1) {
    throw new Error(`${name} has no picture ${key}`)
  }
  const [gone] = rack.pictures.splice(at, 1) as [Picture]
  discard(dir, gone)
  const next = rack.pictures[at % Math.max(rack.pictures.length, 1)]
  if (!next) {
    delete store.palettes[name]
  } else if (gone.key === rack.active) {
    rack.active = next.key
  }
  save(dir, store, [name])
  return { key: gone.key, left: rack.pictures.length }
}

interface Made {
  stem: string
  fill: string
  files: [string, Buffer][]
}

function made(name: string, key: string, drawing: Drawing, tone: Hex): Made {
  const figure = drawing.coloring === 'original' ? encodeRgba(drawing.figure) : encodeMask(drawing.figure, tone)
  const fill = drawing.coloring === 'original' ? encodeRgba(drawing.fill) : encodeMask(drawing.fill, tone)
  const stem = `${fileStem(name)}.${createHash('sha1').update(key).update(figure).update(fill).digest('hex').slice(0, 8)}`
  const named = `${stem}@fill-${Math.round(drawing.focus * 100)}.png`
  return {
    stem,
    fill: named,
    files: [
      [`${stem}.png`, figure],
      [named, fill],
    ],
  }
}

function paintOf(
  colors: Colors,
  hue: Hue,
  coloring: Coloring,
  peak: Hex | undefined,
): Pick<Picture, 'coloring' | 'opacity' | 'tone' | 'peak'> {
  return coloring === 'original' && peak
    ? { coloring: 'original', opacity: originalOpacity(colors, peak), peak }
    : { coloring: 'tone', opacity: hue.opacity, tone: hue.color }
}

function kept(name: string, key: string): string {
  return join(ORIGINALS, `${fileStem(name)}-${key}`)
}

function lay(dir: string, files: [string, Uint8Array][]): string[] {
  return files.map(([file, bytes]) => {
    const path = join(dir, file)
    writeAtomic(path, bytes)
    return path
  })
}

export function installBackdrop(
  configHome: string,
  colors: Colors,
  tone: Hue,
  image: Rgba,
  source: Original,
  window: { width: number; height: number },
  blurring: number,
  coloring: Coloring = 'tone',
): string[] {
  const dir = backgroundsDir(configHome)
  const name = colors.name
  const key = imageKey(source)
  const store = readStore(dir)
  const rack = store.palettes[name] ?? { active: key, pictures: [] }
  const size = fillSize(window.width, window.height)
  const drawing = draw(image, size.width, size.height, blurring, coloring, source.cut === true)
  const drawn = made(name, key, drawing, tone.color)
  const original = kept(name, key)
  const picture: Picture = {
    key,
    stem: drawn.stem,
    fill: drawn.fill,
    ...paintOf(colors, tone, drawing.coloring, drawing.coloring === 'original' ? drawing.peak : undefined),
    blur: blurring,
    window: size,
    ...(source.from ? { from: source.from } : {}),
    ...(source.artist?.length ? { artist: source.artist } : {}),
    ...(source.profiles && Object.keys(source.profiles).length > 0 ? { profiles: source.profiles } : {}),
    ...(source.source ? { source: source.source } : {}),
    original: `${original}.${source.ext}`,
    ...(source.cut ? { cut: `${original}.cut.png`, matte: MATTING } : {}),
  }
  const old = rack.pictures.find((held) => held.key === key)
  if (old) {
    discard(dir, old)
  }
  mkdirSync(join(dir, ORIGINALS), { recursive: true })
  const written = lay(dir, [
    ...drawn.files,
    [picture.original as string, source.bytes],
    ...(picture.cut ? [[picture.cut, encodeGray(alphaOf(image))] as [string, Uint8Array]] : []),
  ])
  rack.pictures = old ? rack.pictures.map((held) => (held === old ? picture : held)) : [...rack.pictures, picture]
  rack.active = key
  store.palettes[name] = rack
  save(dir, store, [name])
  return [...written, join(dir, `${fileStem(name)}.conf`)]
}

export function showImage(configHome: string, name: string, key: string): { at: number; of: number } {
  const dir = backgroundsDir(configHome)
  const store = readStore(dir)
  const rack = store.palettes[name]
  const at = rack ? rack.pictures.findIndex((picture) => picture.key === key) : -1
  if (!rack || at === -1) {
    throw new Error(`${name} has no picture ${key}`)
  }
  if (rack.active !== key) {
    rack.active = key
    save(dir, store, [name])
  }
  return { at: at + 1, of: rack.pictures.length }
}

export function rackOf(configHome: string, name: string): Picture[] {
  const rack = readStore(backgroundsDir(configHome)).palettes[name]
  if (!rack) {
    return []
  }
  const active = rack.pictures.filter((picture) => picture.key === rack.active)
  return [...active, ...rack.pictures.filter((picture) => picture.key !== rack.active)]
}

export type Tune = Pick<SharedPicture, 'size' | 'position' | 'opacity'>

const DEFAULT_POSITION = 'top-right'

export function frameAt(
  iw: number,
  ih: number,
  W: number,
  H: number,
  size: number,
  at: number,
  cover: boolean,
  focus = -1,
): Box {
  const t = Math.trunc
  const ax = (at - 1) % 3
  const ay = t((at - 1) / 3)
  const wide = W * ih >= H * iw !== !cover
  const dw = wide ? t((size * W) / 100) : t((size * H * iw) / (100 * ih))
  const dh = wide ? t((size * W * ih) / (100 * iw)) : t((size * H) / 100)
  let x = t((ax * (W - dw)) / 2)
  let y = t((ay * (H - dh)) / 2)
  if (focus >= 0) {
    if (dw > W) {
      x = t((W - dw) / 2)
    }
    if (dh > H) {
      y = Math.max(H - dh, Math.min(0, t(H / 2) - t((focus * dh) / 100)))
    }
  }
  return { x, y, w: dw, h: dh }
}

export function tuneOf(dir: string, picture: Picture): Tune {
  const text = readText(join(dir, `${picture.stem}.tune.conf`))
  if (text === undefined) {
    return {}
  }
  const value = (key: string) => new RegExp(`^${key}\\s*=\\s*(.*?)\\s*$`, 'm').exec(text)?.[1] ?? ''
  const image = basename(value('background-image'))
  const scaled = /@(\d+)-/.exec(image)?.[1]
  const size = /@fill-\d+\.png$/.test(image)
    ? 'fill'
    : scaled
      ? Number(scaled)
      : value('background-image-fit') === 'cover'
        ? 'fill'
        : 100
  const position = value('background-image-position').replace('center-center', 'center') || 'center'
  const opacity = Number(value('background-image-opacity') || 1)
  return {
    ...(size !== 'fill' ? { size } : {}),
    ...(position !== DEFAULT_POSITION ? { position } : {}),
    ...(Number.isFinite(opacity) && opacity !== picture.opacity ? { opacity } : {}),
  }
}

export function writeTune(
  dir: string,
  picture: Picture,
  tune: Tune,
  aligns: boolean,
  home: string,
): string | undefined {
  const size = tune.size ?? 'fill'
  const position = tune.position ?? DEFAULT_POSITION
  const opacity = tune.opacity ?? picture.opacity
  if (size === 'fill' && position === DEFAULT_POSITION && opacity === picture.opacity) {
    return undefined
  }
  const at = (POSITIONS as readonly string[]).indexOf(position) + 1
  const figurePath = join(dir, `${picture.stem}.png`)
  let image = join(dir, picture.fill)
  let cover = true
  const window = typeof size === 'number' && (size > 100 || (!aligns && position !== 'center'))
  if (size === 100 && !window) {
    image = figurePath
    cover = false
  } else if (typeof size === 'number') {
    if (undrawn(picture)) {
      throw new Error(`${picture.stem} was drawn before pictures kept their tone — init draws it again`)
    }
    const source = decodePng(new Uint8Array(readFileSync(figurePath)))
    const { width, height } = window ? FILL : source
    const focus = window ? Number(/@fill-(\d+)\.png$/.exec(picture.fill)?.[1] ?? 50) : -1
    const box = frameAt(source.width, source.height, width, height, size, at, false, focus)
    image = join(dir, `${picture.stem}@${size}-${position}${window ? `-${width}x${height}` : ''}.png`)
    const crop = { x: 0, y: 0, w: source.width, h: source.height }
    const frame = { crop, at: box, focus }
    writeAtomic(
      image,
      picture.tone
        ? encodeMask(quantize(place(alphaOf(source), frame, width, height)), picture.tone)
        : encodeRgba(placeColors(source, frame, width, height)),
    )
    cover = window
  }
  const conf = join(dir, `${picture.stem}.tune.conf`)
  writeAtomic(
    conf,
    [
      `background-image = ${image.startsWith(`${home}/`) ? `~${image.slice(home.length)}` : image}`,
      `background-image-fit = ${cover ? 'cover' : 'contain'}`,
      `background-image-position = ${position}`,
      `background-image-opacity = ${opacity}`,
      '',
    ].join('\n'),
  )
  return conf
}

export function origins(configHome: string): Map<string, Origin> {
  return new Map(
    Object.entries(readStore(backgroundsDir(configHome)).palettes).flatMap(([name, rack]): [string, Origin][] => {
      const [, site, id] = /^([a-z.]+)_(\d+)$/.exec(rack.active) ?? []
      return site && id ? [[name, { site, id: Number(id) }]] : []
    }),
  )
}

function sizeOf(path: string): { width: number; height: number } | undefined {
  try {
    const head = pngHead(new Uint8Array(readFileSync(path)))
    return head ? { width: head.width, height: head.height } : undefined
  } catch {
    return undefined
  }
}

function drawnKey(
  dir: string,
  name: string,
  picture: Picture,
  size: { width: number; height: number },
  blurring: number,
  coloring: Coloring,
  tone: string,
): string | undefined {
  const files = [picture.original, picture.cut].map((file) => {
    if (!file) {
      return ''
    }
    try {
      const { size: bytes, mtimeMs } = statSync(join(dir, file))
      return `${file}:${bytes}:${mtimeMs}`
    } catch {
      return undefined
    }
  })
  if (!picture.original || files.includes(undefined)) {
    return undefined
  }
  return keyOf([
    DRAWING,
    fileStem(name),
    picture.key,
    ...(files as string[]),
    size.width,
    size.height,
    blurring,
    coloring,
    coloring === 'tone' ? tone : '',
  ])
}

function remembered(dir: string, name: string, picture: Picture): void {
  if (!picture.window || picture.blur === undefined) {
    return
  }
  const key = drawnKey(dir, name, picture, picture.window, picture.blur, coloringOf(picture), picture.tone ?? '')
  if (!key || known(key)) {
    return
  }
  try {
    remember(key, {
      stem: picture.stem,
      fill: picture.fill,
      ...(picture.peak ? { peak: picture.peak } : {}),
      figure: readFileSync(join(dir, `${picture.stem}.png`)),
      picture: readFileSync(join(dir, picture.fill)),
    })
  } catch {}
}

interface Drawn {
  made: Made
  peak: Hex | undefined
  image: Rgba | undefined
}

function drawnFor(
  dir: string,
  name: string,
  picture: Picture,
  size: { width: number; height: number },
  load: () => Rgba | null,
  paint: Paint,
  blurring: number,
  coloring: Coloring,
  cut: boolean,
): Drawn | null {
  const key = cut ? undefined : drawnKey(dir, name, picture, size, blurring, coloring, paint.hue.color)
  const held = key ? recall(key) : undefined
  if (held) {
    return {
      made: {
        stem: held.stem,
        fill: held.fill,
        files: [
          [`${held.stem}.png`, held.figure],
          [held.fill, held.picture],
        ],
      },
      peak: held.peak,
      image: undefined,
    }
  }
  const image = load()
  if (!image) {
    return null
  }
  const drawing = draw(image, size.width, size.height, blurring, coloring, cut || picture.cut !== undefined)
  const result = made(name, picture.key, drawing, paint.hue.color)
  const peak = drawing.coloring === 'original' ? drawing.peak : undefined
  if (key) {
    remember(key, {
      stem: result.stem,
      fill: result.fill,
      ...(peak ? { peak } : {}),
      figure: result.files[0]?.[1] as Buffer,
      picture: result.files[1]?.[1] as Buffer,
    })
  }
  return { made: result, peak, image }
}

export function redrawn(
  configHome: string,
  name: string,
  picture: Picture,
  load: () => Rgba | null,
  paint: Paint,
  blurring: number,
  aligns: boolean,
  home: string,
  cut: boolean,
  coloring: Coloring = coloringOf(picture),
): Picture | null {
  const dir = backgroundsDir(configHome)
  const size = picture.window ?? sizeOf(join(dir, picture.fill)) ?? FILL
  const got = drawnFor(dir, name, picture, size, load, paint, blurring, coloring, cut)
  if (!got) {
    return null
  }
  const { made: drawn, peak, image } = got
  const next: Picture = {
    ...picture,
    stem: drawn.stem,
    fill: drawn.fill,
    ...paintOf(paint.colors, paint.hue, coloring, peak),
    blur: blurring,
    window: size,
    ...(cut ? { cut: `${kept(name, picture.key)}.cut.png` } : {}),
    ...(cut || picture.cut ? { matte: MATTING } : {}),
  }
  if (coloring === 'original') {
    delete next.tone
  } else {
    delete next.peak
  }
  if (cut && image) {
    writeAtomic(join(dir, `${kept(name, picture.key)}.cut.png`), encodeGray(alphaOf(image)))
  }
  if (drawn.stem === picture.stem) {
    return next
  }
  if (coloringOf(picture) !== coloring) {
    remembered(dir, name, picture)
  }
  lay(dir, drawn.files)
  const tune = tuneOf(dir, picture)
  writeTune(dir, next, coloringOf(picture) === coloring ? tune : { ...tune, opacity: undefined }, aligns, home)
  const off = join(dir, `${picture.stem}.off.conf`)
  if (existsSync(off)) {
    copyFileSync(off, join(dir, `${next.stem}.off.conf`))
  }
  return next
}

export function prepared(
  configHome: string,
  name: string,
  picture: Picture,
  load: () => Rgba | null,
  paint: Paint,
  blurring: number,
  coloring: Coloring,
): boolean {
  const dir = backgroundsDir(configHome)
  const size = picture.window ?? sizeOf(join(dir, picture.fill)) ?? FILL
  return drawnFor(dir, name, picture, size, load, paint, blurring, coloring, false) !== null
}

export function applyRedraw(configHome: string, drawn: { name: string; picture: Picture }[]): void {
  const dir = backgroundsDir(configHome)
  const store = readStore(dir)
  const names = new Set<string>()
  const stale: string[] = []
  for (const { name, picture } of drawn) {
    const rack = store.palettes[name]
    const at = rack?.pictures.findIndex((held) => held.key === picture.key) ?? -1
    const old = rack?.pictures[at]
    if (!rack || !old) {
      continue
    }
    rack.pictures[at] = picture
    names.add(name)
    if (old.stem !== picture.stem) {
      stale.push(old.stem)
    }
  }
  if (names.size === 0) {
    return
  }
  save(dir, store, [...names])
  for (const stem of stale) {
    forget(dir, stem)
  }
}

function recolor(dir: string, name: string, picture: Picture, hue: Hue): Picture {
  const painted = stemFiles(dir, picture.stem)
    .filter((file) => file.endsWith('.png'))
    .map((file): [string, Uint8Array] => {
      const bytes = new Uint8Array(readFileSync(join(dir, file)))
      return [file, retone(bytes, hue.color) ?? encodeMask(alphaOf(decodePng(bytes)), hue.color)]
    })
  const bytesOf = (file: string) => painted.find(([held]) => held === file)?.[1] ?? new Uint8Array()
  const stem = `${fileStem(name)}.${createHash('sha1')
    .update(picture.key)
    .update(bytesOf(`${picture.stem}.png`))
    .update(bytesOf(picture.fill))
    .digest('hex')
    .slice(0, 8)}`
  lay(
    dir,
    painted.map(([file, bytes]) => [stem + file.slice(picture.stem.length), bytes]),
  )
  for (const kind of ['tune', 'off']) {
    const text = readText(join(dir, `${picture.stem}.${kind}.conf`))
    if (text !== undefined) {
      writeAtomic(join(dir, `${stem}.${kind}.conf`), text.split(picture.stem).join(stem))
    }
  }
  return {
    ...picture,
    stem,
    fill: stem + picture.fill.slice(picture.stem.length),
    tone: hue.color,
  }
}

function due(picture: Picture, paint: Paint): boolean {
  return coloringOf(picture) !== 'original' && picture.tone !== undefined && picture.tone !== paint.hue.color
}

export function retint(configHome: string, paints: ReadonlyMap<string, Paint>): string[] {
  const dir = backgroundsDir(configHome)
  const store = readStore(dir)
  const names: string[] = []
  const stale: string[] = []
  for (const [name, rack] of Object.entries(store.palettes)) {
    const paint = paints.get(name)
    if (!paint || !rack.pictures.some((picture) => due(picture, paint))) {
      continue
    }
    rack.pictures = rack.pictures.map((picture) => {
      if (!due(picture, paint)) {
        return picture
      }
      const next = recolor(dir, name, picture, paint.hue)
      if (next.stem !== picture.stem) {
        stale.push(picture.stem)
      }
      return next
    })
    names.push(name)
  }
  if (names.length > 0) {
    save(dir, store, names)
    for (const stem of stale) {
      forget(dir, stem)
    }
  }
  return names
}
