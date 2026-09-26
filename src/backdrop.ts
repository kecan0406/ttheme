import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { basename, isAbsolute, join } from 'node:path'
import { type Hex, luminance, rgb } from './color.ts'
import { checkReadability } from './contrast.ts'
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
  type Mask,
  type Plane,
  pngHead,
  quantize,
  type Rgba,
  resamplePlane,
  retone,
  transparency,
} from './png.ts'
import { stem as fileStem, POSITIONS, type SharedPicture } from './theme.ts'

const FILL = { width: 2560, height: 1550 }
const FIGURE = 2560
const FAINT = 0.1
const WHITE = 0.99
const LIFT = 2
export const PLACEMENT = { tall: 1.15, reach: 0.4, widest: 0.95, headroom: 0.04, margin: 0.03, stands: 12 }
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

export interface Original {
  site: string
  id: number
  ext: string
  bytes: Uint8Array
  from?: string
  cut?: boolean
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

function inkOf(image: Rgba, lift: number): Mask {
  const data = new Uint8Array(image.width * image.height)
  for (let i = 0; i < data.length; i++) {
    const at = i * 4
    data[i] = Math.round((Math.min(255, luma(image.data, at) * lift) * (image.data[at + 3] ?? 0)) / 255)
  }
  return { width: image.width, height: image.height, data }
}

function place(source: Mask | Plane, frame: Frame, width: number, height: number): Plane {
  const data = new Float32Array(width * height)
  const x0 = Math.max(0, Math.round(frame.at.x))
  const y0 = Math.max(0, Math.round(frame.at.y))
  const x1 = Math.min(width, Math.round(frame.at.x + frame.at.w))
  const y1 = Math.min(height, Math.round(frame.at.y + frame.at.h))
  if (x1 > x0 && y1 > y0) {
    const kx = frame.crop.w / frame.at.w
    const ky = frame.crop.h / frame.at.h
    const box = {
      x: frame.crop.x + (x0 - frame.at.x) * kx,
      y: frame.crop.y + (y0 - frame.at.y) * ky,
      w: (x1 - x0) * kx,
      h: (y1 - y0) * ky,
    }
    const part = resamplePlane(source, box, x1 - x0, y1 - y0)
    for (let y = y0; y < y1; y++) {
      data.set(part.data.subarray((y - y0) * (x1 - x0), (y - y0 + 1) * (x1 - x0)), y * width + x0)
    }
  }
  return { width, height, data }
}

function inked(image: Rgba): { box: Box; clear: number; ink: Mask } {
  const box = figureBox(image)
  return { box, clear: transparency(image, box), ink: inkOf(image, liftOf(image, box)) }
}

interface Drawing {
  figure: Mask
  fill: Mask
  focus: number
}

function draw(image: Rgba, width: number, height: number, blurring: number): Drawing {
  const { box, clear, ink } = inked(image)
  const frame = fillFrame(box, width, height, clear)
  const k = Math.min(1, FIGURE / Math.max(box.w, box.h))
  const at = { x: 0, y: 0, w: Math.round(box.w * k), h: Math.round(box.h * k) }
  const figure = place(ink, { crop: box, at, focus: frame.focus }, at.w, at.h)
  const fill = place(ink, frame, width, height)
  return {
    figure: quantize(blur(figure, (blurring * at.w * frame.crop.w) / (box.w * frame.at.w))),
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

export function tryOn(image: Rgba, colors: Colors, tone: Hue, width: number, height: number, blurring: number): Rgba {
  const { box, clear, ink } = inked(image)
  const fill = place(ink, fillFrame(box, width, height, clear), width, height)
  return shade(quantize(blur(fill, blurring)), colors.background, tone.color, tone.opacity)
}

export function backgroundsDir(configHome: string): string {
  return join(configHome, 'ttheme', 'backgrounds')
}

export interface Picture {
  key: string
  stem: string
  fill: string
  opacity: number
  tone?: Hex
  blur?: number
  window?: { width: number; height: number }
  from?: string
  original?: string
  cut?: string
}

interface Rack {
  active: string
  pictures: Picture[]
}

export interface Store {
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

function confText(dir: string, rack: Rack): string {
  const at = rack.pictures.findIndex((picture) => picture.key === rack.active)
  const picture = rack.pictures[at] as Picture
  return [
    ...(picture.from ? [`# from ${picture.from}`] : []),
    `# image ${picture.key} ${at + 1}/${rack.pictures.length}`,
    `background-image = ${join(dir, picture.fill)}`,
    'background-image-fit = cover',
    'background-image-position = top-right',
    `background-image-opacity = ${picture.opacity}`,
    `config-file = ?${picture.stem}.tune.conf`,
    `config-file = ?${picture.stem}.off.conf`,
    '',
  ].join('\n')
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
      } else if (m && /^background-image(?:-fit|-opacity)?$/.test(m[1] as string)) {
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
  }
}

export function imageKey(origin: Origin): string {
  return `${origin.site}_${origin.id}`
}

export function switchImage(configHome: string, name: string, step: 1 | -1): { key: string; at: number; of: number } {
  const dir = backgroundsDir(configHome)
  const store = readStore(dir)
  const rack = store.palettes[name]
  if (!rack || rack.pictures.length < 2) {
    throw new Error(`${name} has no other image`)
  }
  const of = rack.pictures.length
  const at = (rack.pictures.findIndex((picture) => picture.key === rack.active) + step + of) % of
  rack.active = (rack.pictures[at] as Picture).key
  save(dir, store, [name])
  return { key: rack.active, at: at + 1, of }
}

export function dropImage(configHome: string, name: string): { key: string; left: number } {
  const dir = backgroundsDir(configHome)
  const store = readStore(dir)
  const rack = store.palettes[name]
  if (!rack) {
    throw new Error(`${name} has no image`)
  }
  const at = rack.pictures.findIndex((picture) => picture.key === rack.active)
  const [gone] = rack.pictures.splice(at, 1) as [Picture]
  discard(dir, gone)
  const next = rack.pictures[at % Math.max(rack.pictures.length, 1)]
  if (next) {
    rack.active = next.key
  } else {
    delete store.palettes[name]
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
  const figure = encodeMask(drawing.figure, tone)
  const fill = encodeMask(drawing.fill, tone)
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
): string[] {
  const dir = backgroundsDir(configHome)
  const name = colors.name
  const key = imageKey(source)
  const store = readStore(dir)
  const rack = store.palettes[name] ?? { active: key, pictures: [] }
  const size = fillSize(window.width, window.height)
  const drawn = made(name, key, draw(image, size.width, size.height, blurring), tone.color)
  const original = kept(name, key)
  const picture: Picture = {
    key,
    stem: drawn.stem,
    fill: drawn.fill,
    opacity: tone.opacity,
    tone: tone.color,
    blur: blurring,
    window: size,
    ...(source.from ? { from: source.from } : {}),
    original: `${original}.${source.ext}`,
    ...(source.cut ? { cut: `${original}.cut.png` } : {}),
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

export function showImage(configHome: string, name: string, key: string): void {
  const dir = backgroundsDir(configHome)
  const store = readStore(dir)
  const rack = store.palettes[name]
  if (rack?.pictures.some((picture) => picture.key === key) && rack.active !== key) {
    rack.active = key
    save(dir, store, [name])
  }
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
    if (!picture.tone) {
      throw new Error(`${picture.stem} was drawn before pictures kept their tone — init draws it again`)
    }
    const figure = alphaOf(decodePng(new Uint8Array(readFileSync(figurePath))))
    const { width, height } = window ? FILL : figure
    const focus = window ? Number(/@fill-(\d+)\.png$/.exec(picture.fill)?.[1] ?? 50) : -1
    const box = frameAt(figure.width, figure.height, width, height, size, at, false, focus)
    image = join(dir, `${picture.stem}@${size}-${position}${window ? `-${width}x${height}` : ''}.png`)
    const crop = { x: 0, y: 0, w: figure.width, h: figure.height }
    writeAtomic(image, encodeMask(quantize(place(figure, { crop, at: box, focus }, width, height)), picture.tone))
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
  const found = new Map<string, Origin>()
  for (const [name, rack] of Object.entries(readStore(backgroundsDir(configHome)).palettes)) {
    const [, site, id] = /^([a-z.]+)_(\d+)$/.exec(rack.active) ?? []
    if (site && id) {
      found.set(name, { site, id: Number(id) })
    }
  }
  return found
}

function sizeOf(path: string): { width: number; height: number } | undefined {
  try {
    const head = pngHead(new Uint8Array(readFileSync(path)))
    return head ? { width: head.width, height: head.height } : undefined
  } catch {
    return undefined
  }
}

export function redrawn(
  configHome: string,
  name: string,
  picture: Picture,
  image: Rgba,
  hue: Hue,
  blurring: number,
  aligns: boolean,
  home: string,
  cut: boolean,
): Picture {
  const dir = backgroundsDir(configHome)
  const size = picture.window ?? sizeOf(join(dir, picture.fill)) ?? FILL
  const drawn = made(name, picture.key, draw(image, size.width, size.height, blurring), hue.color)
  const next: Picture = {
    ...picture,
    stem: drawn.stem,
    fill: drawn.fill,
    opacity: hue.opacity,
    tone: hue.color,
    blur: blurring,
    window: size,
    ...(cut ? { cut: `${kept(name, picture.key)}.cut.png` } : {}),
  }
  if (cut) {
    writeAtomic(join(dir, `${kept(name, picture.key)}.cut.png`), encodeGray(alphaOf(image)))
  }
  if (drawn.stem === picture.stem) {
    return next
  }
  lay(dir, drawn.files)
  writeTune(dir, next, tuneOf(dir, picture), aligns, home)
  const off = join(dir, `${picture.stem}.off.conf`)
  if (existsSync(off)) {
    copyFileSync(off, join(dir, `${next.stem}.off.conf`))
  }
  return next
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
  const follow = (text: string) =>
    text.replace(/^background-image-opacity = (\S+)$/m, (line, value: string) =>
      Number(value) === picture.opacity ? `background-image-opacity = ${hue.opacity}` : line,
    )
  if (picture.tone === hue.color) {
    const tune = join(dir, `${picture.stem}.tune.conf`)
    const text = readText(tune)
    if (text !== undefined) {
      writeAtomic(tune, follow(text))
    }
    return { ...picture, opacity: hue.opacity }
  }
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
      writeAtomic(join(dir, `${stem}.${kind}.conf`), follow(text.split(picture.stem).join(stem)))
    }
  }
  return {
    ...picture,
    stem,
    fill: stem + picture.fill.slice(picture.stem.length),
    opacity: hue.opacity,
    tone: hue.color,
  }
}

export function retint(configHome: string, hues: ReadonlyMap<string, Hue>): string[] {
  const dir = backgroundsDir(configHome)
  const store = readStore(dir)
  const names: string[] = []
  const stale: string[] = []
  for (const [name, rack] of Object.entries(store.palettes)) {
    const hue = hues.get(name)
    const due = rack.pictures.filter(
      (picture) => hue && picture.tone && (picture.tone !== hue.color || picture.opacity !== hue.opacity),
    )
    if (!hue || due.length === 0) {
      continue
    }
    rack.pictures = rack.pictures.map((picture) => {
      if (!due.includes(picture)) {
        return picture
      }
      const next = recolor(dir, name, picture, hue)
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
