import { pastedRefs } from './attach.ts'
import { contrast, type Hex, isHex, luminance, type Oklch, oklch } from './color.ts'
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
import type { Start } from './find.ts'
import { fixGate, inGamut } from './fix.ts'
import { type Colors, grow, nudge, SEED_FIELDS, SEEDS, type Seeds } from './seeds.ts'

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

export function misses(list: Hex[], signature: string[], waive: string[]): Set<number> {
  const theme = gatedOf(list, signature, waive)
  const on = (rule: string) => !waive.includes(rule)
  const { background: bg, foreground: fg, selection, ansi } = colorsOf(list)
  const bad = new Set<number>()
  const low = (slot: number, color: Hex, against: Hex, rule: string) => {
    if (on(rule) && contrast(color, against) < bound(rule)) {
      bad.add(slot)
    }
  }
  low(1, fg, bg, 'foreground')
  low(3, fg, selection, 'selection')
  for (const i of [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14]) {
    low(4 + i, ansi[i] as Hex, bg, 'accents')
  }
  for (const i of [7, 15]) {
    low(4 + i, ansi[i] as Hex, bg, 'light-ansi')
  }
  low(12, ansi[8] as Hex, bg, 'ansi8-visible')
  if (on('ansi0-dark') && luminance(ansi[0] as Hex) > bound('ansi0-dark')) {
    bad.add(4)
  }
  if (on('ansi-role')) {
    for (const { slot } of offRole(theme)) {
      bad.add(4 + slot)
    }
  }
  if (on('bright-follows')) {
    for (const { normal, gap } of brightDrift(theme)) {
      if (gap > BRIGHT_GAP) {
        bad.add(4 + normal + 8)
      }
    }
  }
  if (on('distinct')) {
    for (const [a, b] of lookalikes(theme)) {
      bad.add(4 + a).add(4 + b)
    }
  }
  return bad
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
    }
  })
}

const ALWAYS = new Set(['reset', 'reset-all', 'hex', 'paste', 'fix', 'open', 'seeds', 'tune', 'sig', 'follow'])

export class PaletteEditor {
  mode: Mode
  seeds: Seeds = SEEDS
  field = 0
  list: Hex[]
  lch: Oklch[]
  start: Hex[]
  signature: string[]
  row = 0
  col = 0
  channel = 0
  typing: string | undefined
  overlay: 'keys' | 'open' | undefined
  quitting = false
  compare = false
  notice: string | undefined
  filter = ''
  pick = 0
  result: 'saved' | 'cancelled' | undefined
  act: 'save' | 'apply' | 'cancel' | undefined
  wants: { start?: Start } | undefined
  pictures: number
  readonly startPictures: number
  readonly options: EditorOptions
  readonly fresh: boolean
  readonly theme: boolean
  readonly original: Hex[]
  private readonly startSignature: string[]
  private seeded = false
  private seedsBack = false
  private tuneFrom: { hex: Hex; lch: Oklch } | undefined
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
    this.lch = this.list.map(oklch)
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

  get tuned(): Hex | undefined {
    return this.tuneFrom?.hex
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
    if (this.mode === 'tune') {
      this.list[this.slot()] = color
      this.lch[this.slot()] = oklch(color)
    } else {
      this.set(this.slot(), color, 'paste')
    }
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
    if (this.mode === 'seeds') {
      this.seedKey(key)
    } else if (this.mode === 'tune') {
      this.tuneKey(key)
    } else {
      this.listKey(key)
    }
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
      this.lch = this.list.map(oklch)
    } else if (key === 'enter') {
      this.leaveSeeds()
    } else if (key === 'o') {
      this.openPalettes()
    } else if (key === 'esc') {
      if (this.seedsBack) {
        const back = this.history.pop()
        if (back) {
          this.restore(back)
        }
        this.mode = 'list'
        this.seedsBack = false
      } else {
        this.result = 'cancelled'
      }
    }
  }

  private leaveSeeds(): void {
    if (this.fresh && !this.seeded) {
      this.start = [...this.list]
    }
    this.seeded = true
    this.seedsBack = false
    this.mode = 'list'
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

  private themeKey(key: string): boolean {
    if (key === 's' || key === '\x13') {
      this.act = 'save'
    } else if (key === 'enter') {
      this.act = 'apply'
    } else if (key === 'esc') {
      this.act = 'cancel'
    } else if (key === 'r') {
      this.set(this.slot(), this.original[this.slot()] as Hex, 'reset')
    } else if (key === 'R') {
      this.remember('reset-all')
      this.list = [...this.original]
      this.lch = this.list.map(oklch)
    } else if (key === '*' || key === 'o' || key === '?') {
      return true
    } else {
      return false
    }
    return true
  }

  private listKey(key: string): void {
    if (this.theme && this.themeKey(key)) {
      return
    }
    if (key === 'up' || key === 'down') {
      this.row = (this.row + (key === 'up' ? ROWS - 1 : 1)) % ROWS
      this.lastEdit = undefined
    } else if (key === 'home' || key === 'end') {
      this.row = key === 'home' ? 0 : ROWS - 1
    } else if (key === 'pgup' || key === 'pgdn') {
      this.row = key === 'pgup' ? 0 : BASE.length
    } else if (key === 'left' || key === 'right') {
      this.col = key === 'left' ? 0 : 1
      this.lastEdit = undefined
    } else if (key === 'tab') {
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
      this.set(this.slot(), this.start[this.slot()] as Hex, 'reset')
    } else if (key === '=') {
      this.follow()
    } else if (key === '*') {
      this.mark()
    } else if (key === 'f') {
      this.fix()
    } else if (key === 's') {
      this.remember('seeds')
      this.mode = 'seeds'
      this.seedsBack = true
    } else if (key === 'o') {
      this.openPalettes()
    } else if (key === 'u') {
      this.undo()
    } else if (key === '\x12') {
      this.redo()
    } else if (key === 'enter' || key === '\x13') {
      this.save()
    } else if (key === 'esc') {
      if (this.dirty()) {
        this.quitting = true
      } else {
        this.result = 'cancelled'
      }
    }
  }

  private tune(): void {
    const slot = this.slot()
    this.remember('tune')
    this.tuneFrom = { hex: this.list[slot] as Hex, lch: this.lch[slot] as Oklch }
    this.mode = 'tune'
  }

  private tuneKey(key: string): void {
    const count = CHANNELS.length
    if (key === 'up' || key === 'down' || key === 'tab' || key === 'shift-tab') {
      this.channel = (this.channel + (key === 'up' || key === 'shift-tab' ? count - 1 : 1)) % count
    } else if (key === 'left' || key === 'right' || key === 'shift-left' || key === 'shift-right') {
      const channel = CHANNELS[this.channel] as Channel
      this.step((key.endsWith('left') ? -1 : 1) * (key.startsWith('shift') ? (channel.wraps ? 10 : FAST) : 1))
    } else if (/^[0-9]$/.test(key)) {
      const channel = CHANNELS[this.channel] as Channel
      this.put(channel.min + ((channel.max - channel.min) * Number(key)) / 10)
    } else if (key === '#') {
      this.typing = ''
    } else if (key === 'enter') {
      if (this.tuneFrom && this.list[this.slot()] === this.tuneFrom.hex) {
        this.history.pop()
      }
      this.tuneFrom = undefined
      this.mode = 'list'
    } else if (key === 'esc') {
      const slot = this.slot()
      if (this.tuneFrom) {
        this.list[slot] = this.tuneFrom.hex
        this.lch[slot] = this.tuneFrom.lch
        this.history.pop()
      }
      this.tuneFrom = undefined
      this.mode = 'list'
    }
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
    const next = { ...(this.lch[slot] as Oklch), [channel.key]: Math.round(value * 10_000) / 10_000 }
    this.lch[slot] = next
    this.list[slot] = inGamut(next.l, next.c, next.h)
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
      if (this.mode === 'tune') {
        this.list[this.slot()] = color
        this.lch[this.slot()] = oklch(color)
      } else {
        this.set(this.slot(), color, 'hex')
      }
    } else if (key === 'backspace') {
      this.typing = typed.slice(0, -1)
    } else if (key === '\x15') {
      this.typing = ''
    } else if (key.length === 1 && /^[0-9a-z#(),.% ]$/i.test(key) && typed.length < 28) {
      this.typing = typed + key.toLowerCase()
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
    } else if (key === 'backspace') {
      this.filter = this.filter.slice(0, -1)
      this.pick = 0
    } else if (key === '\x15') {
      this.filter = ''
      this.pick = 0
    } else if (key === 'enter') {
      const choice = choices[this.pick]
      if (!choice) {
        return
      }
      this.remember('open')
      this.list = listOf(choice.colors)
      this.lch = this.list.map(oklch)
      this.overlay = undefined
      this.filter = ''
      this.notice = `Took the colors of ${choice.name}`
      if (this.mode === 'seeds') {
        this.leaveSeeds()
      }
    } else if (key.length === 1 && /^[a-z0-9@/-]$/i.test(key)) {
      this.filter += key.toLowerCase()
      this.pick = 0
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
    this.lch[slot] = oklch(color)
  }

  private follow(): void {
    if (this.row < BASE.length) {
      this.notice = '= works on an ANSI row — the bright takes its normal'
      return
    }
    const normal = this.row
    const bright = this.row + 8
    const from = this.lch[normal] as Oklch
    const want = { l: clamp(from.l + 0.06, 0, 1), c: from.c, h: from.h }
    this.remember('follow')
    this.lch[bright] = want
    this.list[bright] = inGamut(want.l, want.c, want.h)
    this.col = 1
    this.notice = `${slotLabel(bright).name} follows ${slotLabel(normal).name.toLowerCase()}`
  }

  private mark(): void {
    const name = SLOT_NAMES[this.slot()] as string
    this.remember('sig')
    this.signature = this.signature.includes(name)
      ? this.signature.filter((s) => s !== name)
      : [...this.signature, name].slice(-3)
    this.notice =
      this.signature.length === 3
        ? `Signature: ${this.signature.join(', ')}`
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
    this.lch = next.map((c, i) => (c === this.list[i] ? (this.lch[i] as Oklch) : oklch(c)))
    this.list = next
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
