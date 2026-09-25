import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { basename, isAbsolute, join } from 'node:path'
import { type Hex, luminance, rgb } from './color.ts'
import { checkReadability } from './contrast.ts'
import { writeAtomic } from './edits.ts'
import type { ProfileBackground } from './emit/iterm2.ts'
import { alphaBox, type Box, encodePng, type Rgba, resample, transparency } from './png.ts'

const FILL = { width: 2560, height: 1550 }
const FIGURE = 2560
const FAINT = 0.1
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

export interface Picture {
  key: string
  stem: string
  fill: string
  opacity: number
  from?: string
  original?: string
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
    const conf = join(dir, `${name}.conf`)
    if (rack) {
      writeAtomic(conf, confText(dir, rack))
    } else {
      rmSync(conf, { force: true })
    }
  }
}

function discard(dir: string, picture: Picture): void {
  for (const file of listing(dir)) {
    if (file.startsWith(`${picture.stem}.`) || file.startsWith(`${picture.stem}@`)) {
      rmSync(join(dir, file), { force: true })
    }
  }
  if (picture.original) {
    rmSync(join(dir, picture.original), { force: true })
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
  if (!read(join(dir, `${name}.conf`), 0)) {
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
  const store = readStore(dir)
  const rack = store.palettes[name] ?? { active: key, pictures: [] }
  const box = figureBox(image)
  const { width, height } = fillSize(window.width, window.height)
  const frame = fillFrame(box, width, height, transparency(image, box))
  const figurePng = encodePng(tint(figure(image, box), colors.background, tone.color))
  const fillPng = encodePng(tint(paint(image, frame, width, height), colors.background, tone.color))
  const stem = `${name}.${createHash('sha1').update(figurePng).update(fillPng).digest('hex').slice(0, 8)}`
  const picture: Picture = {
    key,
    stem,
    fill: `${stem}@fill-${Math.round(frame.focus * 100)}.png`,
    opacity: tone.opacity,
    ...(original.from ? { from: original.from } : {}),
    original: join(ORIGINALS, `${name}-${key}.${original.ext}`),
  }
  const old = rack.pictures.find((kept) => kept.key === key)
  if (old) {
    discard(dir, old)
  }
  const written = [join(dir, `${stem}.png`), join(dir, picture.fill), join(dir, picture.original as string)]
  mkdirSync(join(dir, ORIGINALS), { recursive: true })
  writeAtomic(written[0] as string, figurePng)
  writeAtomic(written[1] as string, fillPng)
  writeAtomic(written[2] as string, original.bytes)
  rack.pictures = old ? rack.pictures.map((kept) => (kept === old ? picture : kept)) : [...rack.pictures, picture]
  rack.active = key
  store.palettes[name] = rack
  save(dir, store, [name])
  return [...written, join(dir, `${name}.conf`)]
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
