import { contrast, type Hex, isHex, luminance, type Oklch, oklch, rgb } from './color.ts'
import {
  ACHROMATIC,
  BRIGHT_GAP,
  brightDrift,
  check,
  DISTINCT_HUE,
  DISTINCT_LIGHTNESS,
  exemptSlots,
  GATE_RULES,
  type Gated,
  hueGap,
  lookalikes,
  measure,
  offRole,
  ROLE_HUES,
  roleOf,
  type Violation,
} from './contrast.ts'
import { pastedRefs } from './find/attach.ts'
import type { Start } from './find/find.ts'
import { edgeChroma, fixGate, inGamut } from './fix.ts'
import { type Colors, grow, nudge, SEED_FIELDS, SEEDS, type Seeds } from './seeds.ts'
import { edit } from './tui/field.ts'

export const SLOT_COUNT = 20
export const SLOT_NAMES = [
  'background',
  'foreground',
  'cursor',
  'selection',
  ...Array.from({ length: 16 }, (_, i) => `ansi${i}`),
]
export const BASE = ['Background', 'Foreground', 'Cursor', 'Selection']
export const PAIRS = ['Black', 'Red', 'Green', 'Yellow', 'Blue', 'Magenta', 'Cyan', 'White']
export const ROWS = BASE.length + PAIRS.length

export interface Channel {
  key: keyof Oklch
  label: string
  min: number
  max: number
  step: number
  digits: number
  wraps?: true
}

export const CHANNELS: Channel[] = [
  { key: 'l', label: 'Lightness', min: 0, max: 1, step: 0.01, digits: 2 },
  { key: 'c', label: 'Chroma', min: 0, max: 0.37, step: 0.005, digits: 3 },
  { key: 'h', label: 'Hue', min: 0, max: 360, step: 1, digits: 0, wraps: true },
]

export const FAST = 5
export const CONTRAST = CHANNELS.length
export const SCOPES = ['this', 'pair', 'normals', 'brights', 'accents'] as const
export type Scope = (typeof SCOPES)[number]

const ACCENTS = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14]
const NORMALS = ACCENTS.filter((i) => i < 8).map((i) => BASE.length + i)
const BRIGHTS = ACCENTS.filter((i) => i > 8).map((i) => BASE.length + i)

export function scopeSlots(scope: Scope, slot: number): number[] {
  const ansi = slot - BASE.length
  if (ansi < 0 || scope === 'this') {
    return [slot]
  }
  if (scope === 'pair') {
    return [BASE.length + (ansi % 8), BASE.length + 8 + (ansi % 8)]
  }
  const set = scope === 'normals' ? NORMALS : scope === 'brights' ? BRIGHTS : [...NORMALS, ...BRIGHTS]
  return set.includes(slot) ? set : [slot]
}

export function gridOrder(): number[] {
  return Array.from({ length: ROWS }, (_, row) => (row < BASE.length ? [row] : [row, row + 8])).flat()
}

export interface Choice {
  name: string
  colors: Colors
}

export interface Edited {
  colors: Colors
  signature: string[]
}

export interface Found {
  note?: string
  count: number
}

export interface EditorOptions {
  title: string
  name: string
  colors?: Colors
  variant?: 'theme'
  original?: Colors
  signature: string[]
  waive?: string[]
  palettes?: Choice[]
  pictures?: number
  find?: (edited: Edited, start?: Start) => Promise<Found>
  check: (edited: Edited) => string | undefined
}

export function isPicture(text: string): boolean {
  const trimmed = text.trim()
  return /^https?:\/\/\S+$/i.test(trimmed) || pastedRefs(trimmed).length > 0
}

export type Mode = 'seeds' | 'list' | 'tune'

interface Snapshot {
  list: Hex[]
  lch: Oklch[]
  signature: string[]
}

export interface Check {
  ok: boolean | undefined
  text: string
}

export function listOf(c: Colors): Hex[] {
  return [c.background, c.foreground, c.cursor, c.selection, ...c.ansi]
}

export function colorsOf(list: Hex[]): Colors {
  const [background, foreground, cursor, selection, ...ansi] = list as [Hex, Hex, Hex, Hex, ...Hex[]]
  return { background, foreground, cursor, selection, ansi }
}

export function slotLabel(slot: number): { name: string; about: string } {
  if (slot < BASE.length) {
    return { name: BASE[slot] as string, about: SLOT_NAMES[slot] as string }
  }
  const ansi = slot - BASE.length
  const pair = PAIRS[ansi % 8] as string
  return ansi < 8
    ? { name: pair, about: `ansi ${ansi}` }
    : { name: `Bright ${pair.toLowerCase()}`, about: `ansi ${ansi}` }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function lowered(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key
}

function hexOf(n: number): string {
  return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
}

export function parseColor(text: string): Hex | undefined {
  const t = text.trim().toLowerCase()
  const hex = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/.exec(t)
  if (hex) {
    const h = hex[1] as string
    return `#${h.length === 3 ? [...h].map((c) => c + c).join('') : h}`
  }
  const rgb = /^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/.exec(t)
  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map((n) => hexOf(Number(n)))
      .join('')}`
  }
  const lch = /^oklch\(\s*([\d.]+)(%?)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:deg|°)?\s*\)$/.exec(t)
  if (lch) {
    const l = Number(lch[1]) / (lch[2] ? 100 : 1)
    return inGamut(clamp(l, 0, 1), Number(lch[3]), Number(lch[4]) % 360)
  }
  return undefined
}

function bound(rule: string): number {
  const found = GATE_RULES.find((r) => r.rule === rule)
  return found?.min ?? found?.max ?? 0
}

export function gatedOf(list: Hex[], signature: string[], waive: string[]): Gated {
  const c = colorsOf(list)
  return {
    name: 'draft',
    background: c.background,
    foreground: c.foreground,
    selectionBackground: c.selection,
    ansi: c.ansi,
    waive,
    signatureSlots: signature,
  }
}

export interface Partner {
  against: number
  floor: number | undefined
}

export function partnerOf(slot: number, waive: string[]): Partner {
  const ansi = slot - BASE.length
  const rule =
    slot <= 1
      ? 'foreground'
      : slot === 3
        ? 'selection'
        : ansi === 7 || ansi === 15
          ? 'light-ansi'
          : ansi === 8
            ? 'ansi8-visible'
            : ACCENTS.includes(ansi)
              ? 'accents'
              : undefined
  return {
    against: slot === 0 || slot === 3 ? 1 : 0,
    floor: rule === undefined || waive.includes(rule) ? undefined : bound(rule),
  }
}

export function ruleSlots(list: Hex[], signature: string[], waive: string[], rule: string): number[] {
  const theme = gatedOf(list, signature, waive)
  const { background: bg, foreground: fg, selection, ansi } = colorsOf(list)
  const under = (slot: number, color: Hex, against: Hex) => (contrast(color, against) < bound(rule) ? [slot] : [])
  if (rule === 'foreground') {
    return contrast(fg, bg) < bound(rule) ? [1, 0] : []
  }
  if (rule === 'selection') {
    return contrast(fg, selection) < bound(rule) ? [3, 1] : []
  }
  if (rule === 'accents') {
    return ACCENTS.flatMap((i) => under(BASE.length + i, ansi[i] as Hex, bg))
  }
  if (rule === 'light-ansi') {
    return [7, 15].flatMap((i) => under(BASE.length + i, ansi[i] as Hex, bg))
  }
  if (rule === 'ansi8-visible') {
    return under(BASE.length + 8, ansi[8] as Hex, bg)
  }
  if (rule === 'ansi0-dark') {
    return luminance(ansi[0] as Hex) > bound(rule) ? [BASE.length] : []
  }
  if (rule === 'ansi-role') {
    return offRole(theme).map(({ slot }) => BASE.length + slot)
  }
  if (rule === 'bright-follows') {
    return brightDrift(theme)
      .filter(({ gap }) => gap > BRIGHT_GAP)
      .flatMap(({ normal }) => [BASE.length + normal, BASE.length + normal + 8])
  }
  if (rule === 'distinct') {
    return lookalikes(theme).flatMap(([a, b]) => [BASE.length + a, BASE.length + b])
  }
  return []
}

export function misses(list: Hex[], signature: string[], waive: string[]): Set<number> {
  return new Set(
    SLOT_NAMES.flatMap((_, slot) =>
      slotChecks(list, signature, waive, slot).some((check) => check.ok === false) ? [slot] : [],
    ),
  )
}

function ratioCheck(color: Hex, against: Hex, rule: string, what: string, waive: string[]): Check {
  const ratio = contrast(color, against)
  const min = bound(rule)
  if (waive.includes(rule)) {
    return { ok: undefined, text: `${what} ${ratio.toFixed(2)}:1 · waived` }
  }
  return { ok: ratio >= min, text: `${what} ${ratio.toFixed(2)}:1 · ≥ ${min}` }
}

export function slotChecks(list: Hex[], signature: string[], waive: string[], slot: number): Check[] {
  const c = colorsOf(list)
  const theme = gatedOf(list, signature, waive)
  if (slot === 0) {
    const accents = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14]
    const weakest = accents.reduce((a, b) =>
      contrast(c.ansi[a] as Hex, c.background) <= contrast(c.ansi[b] as Hex, c.background) ? a : b,
    )
    return [
      ratioCheck(c.foreground, c.background, 'foreground', 'Foreground on it', waive),
      ratioCheck(c.ansi[weakest] as Hex, c.background, 'accents', `Weakest, ANSI ${weakest},`, waive),
      ratioCheck(c.ansi[8] as Hex, c.background, 'ansi8-visible', 'ANSI 8 on it', waive),
    ]
  }
  if (slot === 1) {
    return [
      ratioCheck(c.foreground, c.background, 'foreground', 'On background', waive),
      ratioCheck(c.foreground, c.selection, 'selection', 'On the selection', waive),
    ]
  }
  if (slot === 2) {
    return [{ ok: undefined, text: `On background ${contrast(c.cursor, c.background).toFixed(2)}:1` }]
  }
  if (slot === 3) {
    return [ratioCheck(c.foreground, c.selection, 'selection', 'Foreground on it', waive)]
  }
  const ansi = slot - BASE.length
  const color = c.ansi[ansi] as Hex
  if (ansi === 0) {
    const lum = luminance(color)
    const max = bound('ansi0-dark')
    return [
      waive.includes('ansi0-dark')
        ? { ok: undefined, text: `Luminance ${lum.toFixed(3)} · waived` }
        : { ok: lum <= max, text: `Luminance ${lum.toFixed(3)} · ≤ ${max}` },
    ]
  }
  if (ansi === 7 || ansi === 15) {
    return [ratioCheck(color, c.background, 'light-ansi', 'On background', waive)]
  }
  if (ansi === 8) {
    return [ratioCheck(color, c.background, 'ansi8-visible', 'On background', waive)]
  }
  const checks = [ratioCheck(color, c.background, 'accents', 'On background', waive)]
  const here = oklch(color)
  const role = roleOf(ansi)
  const band = ROLE_HUES[role] as { name: string; center: number; width: number }
  const range = `${band.name} ${band.center}±${band.width}°`
  if (here.c < ACHROMATIC) {
    checks.push({ ok: undefined, text: 'Too grey to have a hue' })
  } else if (exemptSlots(theme).has(ansi)) {
    checks.push({ ok: undefined, text: `Hue ${here.h.toFixed(0)}° · a signature, free of ${range}` })
  } else if (waive.includes('ansi-role')) {
    checks.push({ ok: undefined, text: `Hue ${here.h.toFixed(0)}° · ${range} waived` })
  } else {
    const over = hueGap(here.h, band.center) - band.width
    checks.push(
      over > 0
        ? { ok: false, text: `Hue ${here.h.toFixed(0)}° · ${over.toFixed(0)}° outside ${range}` }
        : { ok: true, text: `Hue ${here.h.toFixed(0)}° · in ${range}` },
    )
  }
  const twin = ansi < 8 ? ansi + 8 : ansi - 8
  const drift = brightDrift(theme).find((d) => d.normal === role)
  if (drift) {
    checks.push(
      waive.includes('bright-follows')
        ? { ok: undefined, text: `${drift.gap.toFixed(0)}° from ANSI ${twin} · waived` }
        : { ok: drift.gap <= BRIGHT_GAP, text: `${drift.gap.toFixed(0)}° from ANSI ${twin} · ≤ ${BRIGHT_GAP}°` },
    )
  }
  const alike = lookalikes(theme).flatMap(([a, b]) => (a === ansi ? [b] : b === ansi ? [a] : []))
  if (alike.length > 0 && !waive.includes('distinct')) {
    checks.push({
      ok: false,
      text: `Reads as ANSI ${alike.join(', ')} · within ${DISTINCT_HUE}° and ${DISTINCT_LIGHTNESS} lightness`,
    })
  }
  return checks
}

export interface GateRow {
  ok: boolean | undefined
  label: string
  value: string
  bound: string
  slots: number[]
}

export function gateRows(list: Hex[], signature: string[], waive: string[]): GateRow[] {
  const values = measure(gatedOf(list, signature, waive))
  return GATE_RULES.map((rule, i) => {
    const value = values[i] as number
    const waived = waive.includes(rule.rule)
    const ok =
      waived || Number.isNaN(value)
        ? undefined
        : (rule.min === undefined || value >= rule.min) && (rule.max === undefined || value <= rule.max)
    return {
      ok,
      label: rule.label,
      value: Number.isNaN(value) ? '—' : Number.isInteger(value) ? String(value) : value.toFixed(2),
      bound: waived
        ? 'waived'
        : rule.min !== undefined
          ? `≥ ${rule.min}`
          : rule.max !== undefined
            ? `≤ ${rule.max}`
            : '',
      slots: ok === false ? ruleSlots(list, signature, waive, rule.rule) : [],
    }
  })
}

const ALWAYS = new Set(['reset', 'reset-all', 'hex', 'paste', 'fix', 'open', 'tune', 'sig', 'follow'])

const C_MAX = (CHANNELS[1] as Channel).max

function grey(hex: Hex): boolean {
  const [r, g, b] = rgb(hex)
  return r === g && g === b
}

function edge(l: number, h: number): number {
  return Math.floor(edgeChroma(l, h, C_MAX) * 10_000) / 10_000
}

function alongside(range: { min: number; max: number; step: number; wraps?: boolean }, at: number): number {
  const top = range.wraps ? range.max - range.step : range.max
  return Math.min(top, Math.round((range.min + (range.max - range.min) * at) / range.step) * range.step)
}

export class PaletteEditor {
  mode: Mode
  seeds: Seeds = SEEDS
  field = 0
  list: Hex[]
  lch: Oklch[]
  start: Hex[]
  original: Hex[]
  signature: string[]
  row = 0
  col = 0
  channel = 0
  scope: Scope = 'this'
  view: 'slot' | 'relations' = 'slot'
  scene = 0
  typing: string | undefined
  overlay: 'keys' | 'open' | undefined
  quitting = false
  compare = false
  notice: string | undefined
  filter = ''
  pick = 0
  result: 'saved' | 'cancelled' | undefined
  act: 'save' | 'cancel' | 'above' | 'below' | undefined
  wants: { start?: Start } | undefined
  pictures: number
  readonly startPictures: number
  readonly options: EditorOptions
  readonly fresh: boolean
  readonly theme: boolean
  private readonly startSignature: string[]
  private seeded = false
  private tuneFrom: { list: Hex[]; lch: Oklch[] } | undefined
  private holds = new Map<number, number>()
  private clip: Hex | undefined
  private history: Snapshot[] = []
  private future: Snapshot[] = []
  private lastEdit: string | undefined

  constructor(options: EditorOptions) {
    this.options = options
    this.theme = options.variant === 'theme'
    this.fresh = options.colors === undefined
    this.mode = this.fresh ? 'seeds' : 'list'
    this.list = listOf(options.colors ?? grow(this.seeds))
    this.lch = this.lchs()
    this.start = [...this.list]
    this.original = options.original ? listOf(options.original) : [...this.list]
    this.signature = [...options.signature]
    this.startSignature = [...options.signature]
    this.pictures = options.pictures ?? 0
    this.startPictures = this.pictures
  }

  markSaved(): void {
    this.start = [...this.list]
    this.history = []
    this.future = []
    this.lastEdit = undefined
  }

  offDefault(slot: number): boolean {
    return this.list[slot] !== this.original[slot]
  }

  get added(): number {
    return Math.max(0, this.pictures - this.startPictures)
  }

  found(found: Found): void {
    this.pictures = found.count
    this.notice = found.note
  }

  get waive(): string[] {
    return this.options.waive ?? []
  }

  get held(): number | undefined {
    return this.holds.get(this.slot())
  }

  colors(): Colors {
    return colorsOf(this.list)
  }

  edited(): Edited {
    return { colors: this.colors(), signature: [...this.signature] }
  }

  shown(): Hex[] {
    return this.compare ? this.start : this.list
  }

  slot(): number {
    return this.row < BASE.length ? this.row : this.row + (this.col === 1 ? 8 : 0)
  }

  dirty(): boolean {
    return (
      this.seeded ||
      this.pictures !== this.startPictures ||
      this.list.some((c, i) => c !== this.start[i]) ||
      this.signature.join() !== this.startSignature.join()
    )
  }

  misses(): Set<number> {
    return misses(this.list, this.signature, this.waive)
  }

  failing(): Violation[] {
    return check(gatedOf(this.list, this.signature, this.waive))
  }

  choices(): Choice[] {
    const needle = this.filter.toLowerCase()
    return (this.options.palettes ?? []).filter((c) => c.name.toLowerCase().includes(needle))
  }

  paste(text: string): void {
    this.notice = undefined
    if (this.overlay === 'open') {
      this.filter += text.replace(/\s+/g, '').toLowerCase()
      this.pick = 0
      return
    }
    if (this.overlay) {
      return
    }
    if (text.trim() === '') {
      this.findPictures({ clipboard: true })
      return
    }
    if (isPicture(text)) {
      this.findPictures({ paste: text })
      return
    }
    if (this.mode === 'seeds') {
      return
    }
    const color = parseColor(text)
    if (!color) {
      this.notice = 'Not a color — #rrggbb, rgb(r g b) or oklch(l c h)'
      return
    }
    this.typing = undefined
    this.take(color, 'paste')
  }

  press(key: string): void {
    this.notice = undefined
    if (key === 'ctrl-c') {
      if (this.theme) {
        this.act = 'cancel'
      } else {
        this.result = 'cancelled'
      }
      return
    }
    if (this.quitting) {
      this.quitting = false
      if (key === 'y' || key === 'Y') {
        this.result = 'cancelled'
      }
      return
    }
    if (this.typing !== undefined) {
      this.type(key)
      return
    }
    if (this.overlay === 'keys') {
      this.overlay = undefined
      return
    }
    if (this.overlay === 'open') {
      this.openKey(key)
      return
    }
    if (key === '?') {
      this.overlay = 'keys'
      return
    }
    if (this.theme && (key === 'ctrl-v' || key === 'alt-v' || key === 'p')) {
      return
    }
    if (key === 'ctrl-v' || key === 'alt-v') {
      this.findPictures({ clipboard: true })
      return
    }
    if (key === 'p' && this.mode !== 'tune') {
      this.findPictures()
      return
    }
    if (key === ' ' && this.mode !== 'seeds') {
      this.compare = !this.compare
      return
    }
    if (this.compare && key === 'esc') {
      this.compare = false
      return
    }
    if (key === 'g' && this.mode !== 'seeds') {
      this.view = this.view === 'slot' ? 'relations' : 'slot'
      return
    }
    const step = key === 'j' ? 'down' : key === 'k' ? 'up' : key
    if (this.mode === 'seeds') {
      this.seedKey(step)
    } else if (this.mode === 'tune') {
      this.tuneKey(step)
    } else {
      this.listKey(step)
    }
  }

  select(slot: number): void {
    if (this.mode === 'seeds' || this.typing !== undefined || this.overlay || this.quitting) {
      return
    }
    if (this.mode === 'tune') {
      if (slot === this.slot()) {
        return
      }
      this.tuneKey('enter')
    }
    this.notice = undefined
    this.row = slot < BASE.length ? slot : BASE.length + ((slot - BASE.length) % 8)
    if (slot >= BASE.length) {
      this.col = slot - BASE.length >= 8 ? 1 : 0
    }
    this.lastEdit = undefined
  }

  grip(channel: number): boolean {
    if (this.mode === 'seeds' || this.typing !== undefined || this.overlay || this.quitting) {
      return false
    }
    this.notice = undefined
    if (this.mode === 'list') {
      this.tune()
    }
    this.channel = channel
    return true
  }

  slide(channel: number, fraction: number): void {
    if (!this.grip(channel)) {
      return
    }
    const at = Math.min(1, Math.max(0, fraction))
    if (channel === CONTRAST) {
      this.reach(21 ** at)
      return
    }
    this.put(alongside(CHANNELS[channel] as Channel, at))
  }

  sow(field: number, fraction: number): void {
    const seed = SEED_FIELDS[field]
    if (this.mode !== 'seeds' || this.overlay || this.quitting || !seed) {
      return
    }
    this.notice = undefined
    this.field = field
    const at = Math.min(1, Math.max(0, fraction))
    this.seeds = nudge({ ...this.seeds, [seed.key]: alongside(seed, at) }, seed, 0)
    this.list = listOf(grow(this.seeds))
    this.lch = this.lchs()
  }

  scroll(step: number): void {
    const clamp = (value: number, last: number) => Math.min(last, Math.max(0, value + step))
    if (this.overlay === 'open') {
      this.pick = clamp(this.pick, Math.max(0, this.choices().length - 1))
    } else if (this.overlay || this.quitting || this.typing !== undefined) {
      return
    } else if (this.mode === 'seeds') {
      this.field = clamp(this.field, SEED_FIELDS.length - 1)
    } else if (this.mode === 'tune') {
      this.channel = clamp(this.channel, CONTRAST)
    } else {
      this.row = clamp(this.row, ROWS - 1)
      this.lastEdit = undefined
    }
  }

  lchOf(hex: Hex): Oklch {
    const found = oklch(hex)
    return grey(hex) ? { ...found, h: this.neutralHue() } : found
  }

  private lchs(): Oklch[] {
    return this.list.map((hex) => this.lchOf(hex))
  }

  private neutralHue(): number {
    const tinted = [0, 1, 3, 2].map((slot) => this.list[slot] as Hex).find((hex) => !grey(hex))
    return tinted ? oklch(tinted).h : SEEDS.hue
  }

  private seedKey(key: string): void {
    const count = SEED_FIELDS.length
    if (key === 'up' || key === 'down') {
      this.field = (this.field + (key === 'up' ? count - 1 : 1)) % count
    } else if (key === 'home' || key === 'end') {
      this.field = key === 'home' ? 0 : count - 1
    } else if (key === 'left' || key === 'right' || key === 'shift-left' || key === 'shift-right') {
      const field = SEED_FIELDS[this.field] as (typeof SEED_FIELDS)[number]
      const steps = (key.endsWith('left') ? -1 : 1) * (key.startsWith('shift') ? (field.wraps ? 10 : FAST) : 1)
      this.seeds = nudge(this.seeds, field, steps)
      this.list = listOf(grow(this.seeds))
      this.lch = this.lchs()
    } else if (key === 'enter') {
      this.leaveSeeds()
    } else if (key === 'o') {
      this.openPalettes()
    } else if (key === 'esc') {
      this.leave()
    }
  }

  private leaveSeeds(): void {
    this.start = [...this.list]
    this.original = [...this.list]
    this.seeded = true
    this.mode = 'list'
  }

  private leave(): void {
    if (this.theme) {
      this.act = 'cancel'
    } else if (this.dirty()) {
      this.quitting = true
    } else {
      this.result = 'cancelled'
    }
  }

  private findPictures(start?: Start): void {
    if (!this.options.find) {
      this.notice = 'Pictures need Ghostty, iTerm2 or kitty, outside tmux'
      return
    }
    this.wants = start ? { start } : {}
  }

  private openPalettes(): void {
    if ((this.options.palettes ?? []).length > 0) {
      this.overlay = 'open'
      this.pick = 0
    } else {
      this.notice = 'No other palettes to take colors from'
    }
  }

  private listKey(key: string): void {
    if (key === 'up' || key === 'down') {
      if (this.theme && this.row === (key === 'up' ? 0 : ROWS - 1)) {
        this.act = key === 'up' ? 'above' : 'below'
      } else {
        this.row = (this.row + (key === 'up' ? ROWS - 1 : 1)) % ROWS
      }
      this.lastEdit = undefined
    } else if (key === 'home' || key === 'end') {
      this.row = key === 'home' ? 0 : ROWS - 1
    } else if (key === 'pgup' || key === 'pgdn') {
      this.row = key === 'pgup' ? 0 : BASE.length
    } else if (key === 'left' || key === 'right') {
      if (this.row >= BASE.length) {
        this.col = key === 'left' ? 0 : 1
        this.lastEdit = undefined
      }
    } else if ((key === 'shift-left' || key === 'shift-right') && !this.theme) {
      this.scene += key === 'shift-left' ? -1 : 1
    } else if (key === 'n' || key === 'N') {
      this.nextMiss(key === 'n' ? 1 : -1)
    } else if (key === 'enter' || key === 'tab') {
      this.tune()
    } else if (key === '#') {
      this.typing = ''
    } else if (key === 'c') {
      this.clip = this.list[this.slot()]
      this.notice = `Copied ${this.clip}`
    } else if (key === 'v') {
      if (this.clip) {
        this.set(this.slot(), this.clip, 'paste')
      } else {
        this.notice = 'Nothing copied yet — c copies a slot'
      }
    } else if (key === 'r') {
      this.set(this.slot(), this.original[this.slot()] as Hex, 'reset')
    } else if (key === 'R') {
      this.remember('reset-all')
      this.list = [...this.original]
      this.lch = this.lchs()
    } else if (key === '=') {
      this.follow()
    } else if (key === '*' && !this.theme) {
      this.mark()
    } else if (key === 'f') {
      this.fix()
    } else if (key === 'o' && !this.theme) {
      this.openPalettes()
    } else if (key === 'u') {
      this.undo()
    } else if (key === 'ctrl-r') {
      this.redo()
    } else if (key === 's' || key === 'ctrl-s') {
      if (this.theme) {
        this.act = 'save'
      } else {
        this.save()
      }
    } else if (key === 'esc') {
      this.leave()
    }
  }

  private nextMiss(way: number): void {
    const order = gridOrder()
    const bad = this.misses()
    if (bad.size === 0) {
      this.notice = 'The gate passes'
      return
    }
    const at = order.indexOf(this.slot())
    for (let i = 1; i <= order.length; i++) {
      const slot = order[(((at + way * i) % order.length) + order.length) % order.length] as number
      if (bad.has(slot)) {
        this.row = slot < BASE.length ? slot : BASE.length + ((slot - BASE.length) % 8)
        if (slot >= BASE.length) {
          this.col = slot - BASE.length >= 8 ? 1 : 0
        }
        return
      }
    }
  }

  private tune(): void {
    this.remember('tune')
    this.tuneFrom = { list: [...this.list], lch: [...this.lch] }
    this.holds = new Map()
    this.hold()
    this.mode = 'tune'
  }

  private hold(): void {
    for (const slot of this.scoped()) {
      if (!this.holds.has(slot)) {
        this.holds.set(slot, (this.lch[slot] as Oklch).c)
      }
    }
  }

  scoped(): number[] {
    return scopeSlots(this.scope, this.slot())
  }

  private tuneKey(key: string): void {
    const count = CHANNELS.length + 1
    const contrastOn = this.channel === CONTRAST
    if (key === 'up' || key === 'down' || key === 'tab' || key === 'shift-tab') {
      this.channel = (this.channel + (key === 'up' || key === 'shift-tab' ? count - 1 : 1)) % count
    } else if (key === 'left' || key === 'right' || key === 'shift-left' || key === 'shift-right') {
      const sign = key.endsWith('left') ? -1 : 1
      if (contrastOn) {
        this.reach(this.ratio() + sign * (key.startsWith('shift') ? 0.5 : 0.1))
      } else {
        const channel = CHANNELS[this.channel] as Channel
        this.step(sign * (key.startsWith('shift') ? (channel.wraps ? 10 : FAST) : 1))
      }
    } else if (key === 'home' || key === 'end') {
      if (contrastOn) {
        this.reach(key === 'home' ? (this.partner().floor ?? 1) : 21)
      } else {
        const channel = CHANNELS[this.channel] as Channel
        this.put(key === 'home' ? channel.min : channel.wraps ? channel.max - channel.step : channel.max)
      }
    } else if (/^[0-9]$/.test(key)) {
      if (contrastOn) {
        if (key !== '0') {
          this.reach(Number(key))
        }
      } else {
        const channel = CHANNELS[this.channel] as Channel
        this.put(channel.min + ((channel.max - channel.min) * Number(key)) / 10)
      }
    } else if (key === 'a') {
      this.rescope()
    } else if (key === '#') {
      this.typing = ''
    } else if (key === 'enter') {
      if (this.tuneFrom && this.list.every((c, i) => c === this.tuneFrom?.list[i])) {
        this.history.pop()
      }
      this.endTune()
    } else if (key === 'esc') {
      if (this.tuneFrom) {
        this.list = [...this.tuneFrom.list]
        this.lch = [...this.tuneFrom.lch]
        this.history.pop()
      }
      this.endTune()
    }
  }

  private rescope(): void {
    if (this.slot() < BASE.length) {
      this.notice = 'A base color moves alone'
      return
    }
    const at = SCOPES.indexOf(this.scope)
    for (let i = 1; i <= SCOPES.length; i++) {
      const next = SCOPES[(at + i) % SCOPES.length] as Scope
      if (next === 'this' || scopeSlots(next, this.slot()).length > 1) {
        this.scopeTo(next)
        return
      }
    }
  }

  scopeTo(scope: Scope): void {
    if (this.mode !== 'tune' || this.typing !== undefined || this.quitting || this.slot() < BASE.length) {
      return
    }
    if (scope !== 'this' && scopeSlots(scope, this.slot()).length <= 1) {
      return
    }
    this.scope = scope
    this.hold()
    const n = this.scoped().length
    this.notice = n > 1 ? `${n} slots move together` : 'This slot moves alone'
  }

  private endTune(): void {
    this.tuneFrom = undefined
    this.holds = new Map()
    this.mode = 'list'
  }

  partner(): Partner {
    return partnerOf(this.slot(), this.waive)
  }

  ratio(): number {
    return contrast(this.list[this.slot()] as Hex, this.list[this.partner().against] as Hex)
  }

  private reach(target: number): void {
    const slot = this.slot()
    const against = this.list[this.partner().against] as Hex
    const at = this.lch[slot] as Oklch
    const keep = this.holds.get(slot) ?? at.c
    const colorAt = (l: number) => inGamut(l, Math.min(keep, edge(l, at.h)), at.h)
    const ratioAt = (l: number) => contrast(colorAt(l), against)
    const up = luminance(this.list[slot] as Hex) >= luminance(against)
    const pivot = oklch(against).l
    const want = Math.max(1, Math.round(target * 100) / 100)
    const far = up ? 1 : 0
    let l: number
    if (ratioAt(far) < want) {
      l = far
      this.notice = `The ratio stops at ${ratioAt(far).toFixed(2)}:1 on this side of the color it is read against`
    } else {
      let near = pivot
      let away = far
      for (let i = 0; i < 24; i++) {
        const mid = (near + away) / 2
        if (ratioAt(mid) >= want) {
          away = mid
        } else {
          near = mid
        }
      }
      l = away
    }
    this.place(slot, l, keep, at.h)
    for (let i = 0; i < 40 && l !== far && contrast(this.list[slot] as Hex, against) < want; i++) {
      l = up ? Math.min(1, l + 0.001) : Math.max(0, l - 0.001)
      this.place(slot, l, keep, at.h)
    }
    this.lch[slot] = { ...(this.lch[slot] as Oklch), l: Math.round(l * 10_000) / 10_000 }
  }

  private step(steps: number): void {
    const channel = CHANNELS[this.channel] as Channel
    const was = (this.lch[this.slot()] as Oklch)[channel.key]
    this.put(was + channel.step * steps)
  }

  private put(raw: number): void {
    const slot = this.slot()
    const channel = CHANNELS[this.channel] as Channel
    const value = channel.wraps
      ? ((raw % channel.max) + channel.max) % channel.max
      : clamp(raw, channel.min, channel.max)
    const rounded = Math.round(value * 10_000) / 10_000
    const at = this.lch[slot] as Oklch
    const others = this.scoped().filter((s) => s !== slot)
    const round = (n: number) => Math.round(n * 10_000) / 10_000
    if (channel.key === 'c') {
      const room = edge(at.l, at.h)
      if (rounded > room) {
        this.notice = `Chroma stops at ${room.toFixed(3)}, the sRGB edge for this lightness and hue`
      }
      const next = Math.min(rounded, room)
      const delta = next - at.c
      this.holds.set(slot, next)
      this.place(slot, at.l, next, at.h)
      for (const s of others) {
        const o = this.lch[s] as Oklch
        const want = round(clamp((this.holds.get(s) ?? o.c) + delta, 0, C_MAX))
        this.holds.set(s, want)
        this.place(s, o.l, want, o.h)
      }
      return
    }
    const delta = channel.key === 'h' ? ((((rounded - at.h) % 360) + 540) % 360) - 180 : rounded - at.l
    this.place(
      slot,
      channel.key === 'l' ? rounded : at.l,
      this.holds.get(slot) ?? at.c,
      channel.key === 'h' ? rounded : at.h,
    )
    if (channel.key === 'h' && grey(this.list[slot] as Hex)) {
      this.notice = 'A grey shows no hue — raise its chroma first'
    }
    for (const s of others) {
      const o = this.lch[s] as Oklch
      this.place(
        s,
        channel.key === 'l' ? round(clamp(o.l + delta, 0, 1)) : o.l,
        this.holds.get(s) ?? o.c,
        channel.key === 'h' ? round((((o.h + delta) % 360) + 360) % 360) : o.h,
      )
    }
  }

  private place(slot: number, l: number, c: number, h: number): void {
    const fits = Math.min(c, edge(l, h))
    this.lch[slot] = { l, c: fits, h }
    this.list[slot] = inGamut(l, fits, h)
  }

  private take(color: Hex, edit: string): void {
    if (this.mode === 'tune') {
      this.list[this.slot()] = color
      this.lch[this.slot()] = this.lchOf(color)
      this.holds.set(this.slot(), (this.lch[this.slot()] as Oklch).c)
    } else {
      this.set(this.slot(), color, edit)
    }
  }

  private type(key: string): void {
    const typed = this.typing ?? ''
    if (key === 'esc') {
      this.typing = undefined
    } else if (key === 'enter') {
      const color = parseColor(typed)
      if (!color) {
        this.notice = 'Not a color — #rrggbb, rgb(r g b) or oklch(l c h)'
        return
      }
      this.typing = undefined
      this.take(color, 'hex')
    } else {
      const next = edit(typed, lowered(key), (ch) => /^[0-9a-z#(),.% ]$/.test(ch) && typed.length < 28)
      if (next !== undefined) {
        this.typing = next
      }
    }
  }

  private openKey(key: string): void {
    const choices = this.choices()
    if (key === 'esc') {
      this.overlay = undefined
      this.filter = ''
    } else if (key === 'up' || key === 'down') {
      const n = Math.max(1, choices.length)
      this.pick = (this.pick + (key === 'up' ? n - 1 : 1)) % n
    } else if (key === 'home' || key === 'end') {
      this.pick = key === 'home' ? 0 : Math.max(0, choices.length - 1)
    } else if (key === 'enter') {
      const choice = choices[this.pick]
      if (!choice) {
        return
      }
      this.remember('open')
      this.list = listOf(choice.colors)
      this.lch = this.lchs()
      this.overlay = undefined
      this.filter = ''
      this.notice = `Took the colors of ${choice.name}`
      if (this.mode === 'seeds') {
        this.leaveSeeds()
      }
    } else {
      const next = edit(this.filter, lowered(key), (ch) => /^[a-z0-9@/-]$/.test(ch))
      if (next !== undefined) {
        this.filter = next
        this.pick = 0
      }
    }
  }

  private remember(edit: string): void {
    if (edit !== this.lastEdit || ALWAYS.has(edit)) {
      this.history.push({ list: [...this.list], lch: [...this.lch], signature: [...this.signature] })
      this.future = []
    }
    this.lastEdit = edit
  }

  private set(slot: number, color: Hex, edit: string): void {
    if (!isHex(color) || this.list[slot] === color) {
      return
    }
    this.remember(edit)
    this.list[slot] = color
    this.lch[slot] = this.lchOf(color)
  }

  private follow(): void {
    if (this.row < BASE.length) {
      this.notice = '= works on an ANSI row — the bright takes its normal'
      return
    }
    const normal = this.row
    const bright = this.row + 8
    const from = this.lch[normal] as Oklch
    this.remember('follow')
    this.place(bright, clamp(from.l + 0.06, 0, 1), from.c, from.h)
    this.col = 1
    this.notice = `${slotLabel(bright).name} follows ${slotLabel(normal).name.toLowerCase()}`
  }

  private mark(): void {
    const name = SLOT_NAMES[this.slot()] as string
    this.remember('sig')
    const marked = this.signature.includes(name) ? this.signature.filter((s) => s !== name) : [...this.signature, name]
    const dropped = marked.length > 3 ? marked[0] : undefined
    this.signature = marked.slice(-3)
    this.notice =
      this.signature.length === 3
        ? `Signature: ${this.signature.join(', ')}${dropped ? ` — ${dropped} dropped` : ''}`
        : `The signature needs three slots — ${this.signature.length} marked`
  }

  private fix(): void {
    const theme = gatedOf(this.list, this.signature, this.waive)
    const {
      theme: fixed,
      moves,
      left,
    } = fixGate({
      ...theme,
      selectionBackground: theme.selectionBackground as Hex,
      signatureSlots: this.signature,
    })
    if (moves.length === 0) {
      this.notice = check(theme).length === 0 ? 'Already passes the gate' : 'No color change fixes it'
      return
    }
    this.remember('fix')
    const next = listOf({
      ...this.colors(),
      foreground: fixed.foreground,
      selection: fixed.selectionBackground,
      ansi: fixed.ansi,
    })
    const was = this.list
    this.list = next
    this.lch = next.map((c, i) => (c === was[i] ? (this.lch[i] as Oklch) : this.lchOf(c)))
    this.notice = `Moved ${moves.length} ${moves.length === 1 ? 'color' : 'colors'}${left.length === 0 ? ' — passes the gate' : ' closer to the gate'}`
  }

  private save(): void {
    const problem = this.options.check(this.edited())
    if (problem) {
      this.notice = problem
      return
    }
    this.result = 'saved'
  }

  private undo(): void {
    const last = this.history.pop()
    if (!last) {
      this.notice = 'Nothing to undo'
      return
    }
    this.future.push({ list: [...this.list], lch: [...this.lch], signature: [...this.signature] })
    this.restore(last)
  }

  private redo(): void {
    const next = this.future.pop()
    if (!next) {
      this.notice = 'Nothing to redo'
      return
    }
    this.history.push({ list: [...this.list], lch: [...this.lch], signature: [...this.signature] })
    this.restore(next)
  }

  private restore(snap: Snapshot): void {
    this.list = [...snap.list]
    this.lch = [...snap.lch]
    this.signature = [...snap.signature]
    this.lastEdit = undefined
  }
}
