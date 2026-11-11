import {
  firstSpot,
  type Layout,
  layoutOf,
  moveSpot,
  type Spot,
  slotsAt,
  TABS_COLS,
  TABS_ROWS,
  validSpot,
} from '../core/builder-layout.ts'
import { contrast, type Hex, isHex, type Oklch } from '../core/color.ts'
import { boundOf, check, GATE_RULES, measure, missedRules, ROLES, shownOf } from '../core/contrast.ts'
import { CODE } from '../core/draft.ts'
import { fixGate } from '../core/fix.ts'
import { PLANE_CHROMA } from '../core/plane.ts'
import { type Colors, grow, nudge, SEED_FIELDS, SEEDS, type Seeds } from '../core/seeds.ts'
import {
  BASE,
  colorsOf,
  type Format,
  gatedOf,
  grey,
  lchIn,
  listOf,
  misses,
  PAIRS,
  ruleSlots,
  slotLabel,
} from '../core/slots.ts'
import { inert } from '../core/text.ts'
import {
  brightLinks,
  following,
  offsetOf,
  type Partner,
  parseColor,
  partnerOf,
  placed,
  room,
  solveLightness,
} from '../core/tune.ts'
import type { Tone } from './bar.ts'
import { editorLegend, editorTopics } from './editor-topics.ts'
import { edit } from './field.ts'
import { pastedRefs, type Start } from './find/attach.ts'
import { Help } from './help.ts'
import { lineStep } from './keys.ts'

const ROWS = BASE.length + PAIRS.length

const UNBUILT = `The builder needs a window of at least ${TABS_COLS}×${TABS_ROWS}`

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
  { key: 'c', label: 'Chroma', min: 0, max: PLANE_CHROMA, step: 0.005, digits: 3 },
  { key: 'h', label: 'Hue', min: 0, max: 360, step: 1, digits: 0, wraps: true },
]

const FAST = 5
const HUE_STEP = 5
export const CONTRAST = CHANNELS.length
export const SCOPES = ['this', 'pair', 'normals', 'brights', 'accents'] as const

export type Scope = (typeof SCOPES)[number]

const NORMALS = ROLES.map((role) => BASE.length + role)
const BRIGHTS = ROLES.map((role) => BASE.length + 8 + role)

function scopeSlots(scope: Scope, slot: number): number[] {
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

function gridOrder(): number[] {
  return Array.from({ length: ROWS }, (_, row) => (row < BASE.length ? [row] : [row, row + 8])).flat()
}

export interface Choice {
  name: string
  colors: Colors
}

export interface Edited {
  colors: Colors
}

export interface Found {
  note?: string
  count: number
}

export interface Exports {
  code: (edited: Edited) => string
  toml: (edited: Edited) => string
  command: string
}

type Menu = 'export' | 'import'

export interface EditorOptions {
  title: string
  name: string
  colors?: Colors
  tone?: true
  original?: Colors
  against?: string
  notice?: string
  palettes?: Choice[]
  pictures?: number
  exports?: Exports
  decode?: (text: string) => Colors | undefined
  find?: (edited: Edited, start?: Start) => Promise<Found>
  check: (edited: Edited) => string | undefined
  help?: boolean
}

function isPicture(text: string): boolean {
  const trimmed = text.trim()

  return /^https?:\/\/\S+$/i.test(trimmed) || pastedRefs(trimmed).length > 0
}

type Mode = 'seeds' | 'list' | 'tune'

type Base = Mode | 'inspect'

export type Modal =
  | { readonly kind: 'help'; readonly help: Help }
  | { readonly kind: 'quit'; readonly focus: 'yes' | 'no' }
  | { readonly kind: 'type'; readonly text: string }
  | { readonly kind: 'open'; readonly filter: string; readonly pick: number }
  | { readonly kind: 'menu'; readonly menu: Menu; readonly entry: number }

export type Layer = Modal['kind'] | 'before' | Base

type Links = ReadonlyMap<number, Oklch>

interface Snapshot {
  list: Hex[]
  lch: Oklch[]
  links: Links
}

interface Step extends Snapshot {
  holds: Map<number, number>
}

interface Tuning {
  readonly from: Snapshot
  holds: Map<number, number>
  steps: Step[]
  redos: Step[]
  last: string | undefined
}

function sameLinks(one: Links, other: Links): boolean {
  return (
    one.size === other.size &&
    one.entries().every(([bright, by]) => {
      const there = other.get(bright)

      return there !== undefined && there.l === by.l && there.c === by.c && there.h === by.h
    })
  )
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function lowered(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key
}

interface GateRow {
  ok: boolean | undefined
  label: string
  value: string
  bound: string
  slots: number[]
}

export function gateRows(list: Hex[]): GateRow[] {
  const theme = gatedOf(list)
  const values = measure(theme)
  const missed = new Set(missedRules(theme).map((rule) => rule.rule))

  return GATE_RULES.map((rule, i) => {
    const value = values[i] as number
    const ok = Number.isNaN(value) ? undefined : !missed.has(rule.rule)

    return {
      ok,
      label: rule.label,
      value: shownOf(value),
      bound: boundOf(rule),
      slots: ok === false ? ruleSlots(list, rule.rule) : [],
    }
  })
}

const ALWAYS = new Set(['reset', 'reset-all', 'hex', 'paste', 'fix', 'open', 'follow'])

const JUMPS = new Set(['jump', 'hex', 'paste', 'reset'])

const NAME_CHAR = /^[a-z0-9@/-]$/

const C_MAX = (CHANNELS[1] as Channel).max

function handleOf(key: string, contrast: boolean): string | undefined {
  if (key === 'up' || key === 'down' || key === 'pgup' || key === 'pgdn') {
    return 'l'
  }

  if (key === 'left' || key === 'right' || key === 'shift-left' || key === 'shift-right') {
    return contrast ? 'ratio' : key.startsWith('shift') ? 'h' : 'c'
  }

  if (key === ',' || key === '.') {
    return contrast ? undefined : 'h'
  }

  return key === 'home' || key === 'end' || /^[0-9]$/.test(key) ? 'jump' : undefined
}

function alongside(range: { min: number; max: number; step: number; wraps?: boolean }, at: number): number {
  const top = range.wraps ? range.max - range.step : range.max

  return Math.min(top, Math.round((range.min + (range.max - range.min) * at) / range.step) * range.step)
}

export type Editing = Readonly<PaletteEditor>

export class PaletteEditor {
  seeds: Seeds = SEEDS
  field = 0
  list: Hex[]
  lch: Oklch[]
  start: Hex[]
  original: Hex[]
  row = 0
  col = 0
  channel = 0
  scope: Scope = 'this'
  view: 'slot' | 'relations' = 'slot'
  scene = 0
  modal: Modal | undefined
  inspect: { readonly spot: Spot | undefined } | undefined
  compare = false
  notice: string | undefined
  noticeTone: Tone = 'info'
  result: 'saved' | 'cancelled' | undefined
  wants: { start?: Start } | undefined
  pictures: number
  format: Format = 'hex'
  pic = true
  changedOnly = false
  where = false
  size: { cols: number; rows: number } | undefined
  copied: string | undefined
  readonly startPictures: number
  readonly options: EditorOptions
  readonly fresh: boolean
  readonly tone: boolean
  private seeded = false
  private tuning: Tuning | undefined
  private clip: Hex | undefined
  private history: Snapshot[] = []
  private future: Snapshot[] = []
  private lastEdit: string | undefined
  private links: Links

  constructor(options: EditorOptions) {
    this.options = options
    this.tone = options.tone === true
    this.fresh = options.colors === undefined
    this.list = listOf(options.colors ?? grow(this.seeds))
    this.lch = this.lchs()
    this.start = this.list
    this.original = options.original ? listOf(options.original) : this.list
    this.pictures = options.pictures ?? 0
    this.startPictures = this.pictures
    this.links = brightLinks(this.original)

    if (options.notice) {
      this.say(options.notice)
    }
  }

  get mode(): Mode {
    return this.tuning ? 'tune' : this.fresh && !this.seeded ? 'seeds' : 'list'
  }

  base(): Base {
    return this.mode === 'list' && this.inspect ? 'inspect' : this.mode
  }

  under(): 'before' | Base {
    return this.compare ? 'before' : this.base()
  }

  layer(): Layer {
    return this.modal?.kind ?? this.under()
  }

  pair(slot: number): { normal: number; bright: number; on: boolean; lift: number } | undefined {
    if (slot < BASE.length) {
      return undefined
    }

    const normal = BASE.length + ((slot - BASE.length) % 8)
    const bright = normal + 8

    return {
      normal,
      bright,
      on: this.links.has(bright),
      lift: (this.lch[bright] as Oklch).l - (this.lch[normal] as Oklch).l,
    }
  }

  linkOf(slot: number): number | undefined {
    return this.links.has(slot) ? slot - 8 : undefined
  }

  changed(slot: number): boolean {
    return this.list[slot] !== this.original[slot]
  }

  based(): string {
    return this.tone
      ? 'as the marketplace gives it'
      : this.options.against
        ? `as ${this.options.against} has it`
        : 'as it opened'
  }

  visible(slot: number): boolean {
    return !this.changedOnly || this.changed(slot)
  }

  changes(): number {
    return this.list.filter((_, slot) => this.changed(slot)).length
  }

  unsaved(): number {
    return this.list.filter((hex, slot) => hex !== this.start[slot]).length
  }

  private slotAt(row: number, col: number): number {
    return row < BASE.length ? row : row + (col === 1 ? 8 : 0)
  }

  get added(): number {
    return Math.max(0, this.pictures - this.startPictures)
  }

  found(found: Found): void {
    this.pictures = found.count
    this.say(found.note, 'ok')
  }

  say(text: string | undefined, tone: Tone = 'info'): void {
    this.notice = text === undefined ? undefined : inert(text)
    this.noticeTone = tone
  }

  get held(): number | undefined {
    return this.tuning?.holds.get(this.slot())
  }

  colors(): Colors {
    return colorsOf(this.list)
  }

  edited(): Edited {
    return { colors: this.colors() }
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
      this.options.against !== undefined ||
      this.pictures !== this.startPictures ||
      this.list.some((c, i) => c !== this.start[i])
    )
  }

  resettable(): boolean {
    return this.dirty() || (this.tone && this.list.some((c, i) => c !== this.original[i]))
  }

  misses(): Set<number> {
    return misses(this.list)
  }

  choices(): Choice[] {
    const needle = this.modal?.kind === 'open' ? this.modal.filter.toLowerCase() : ''

    return (this.options.palettes ?? []).filter((c) => c.name.toLowerCase().includes(needle))
  }

  paste(text: string): void {
    this.notice = undefined
    const modal = this.modal

    switch (modal?.kind) {
      case 'help':
        modal.help.paste(text)

        return
      case 'open': {
        const typed = [...text.toLowerCase()].filter((ch) => NAME_CHAR.test(ch)).join('')
        this.modal = { kind: 'open', filter: modal.filter + typed, pick: 0 }

        return
      }

      case 'quit':
      case 'menu':
        return
      default:
        this.pasted(text)
    }
  }

  private pasted(text: string): void {
    if (!this.tone && text.trim() === '') {
      this.findPictures({ clipboard: true })

      return
    }

    if (!this.tone && isPicture(text)) {
      this.findPictures({ paste: text })

      return
    }

    if (this.mode === 'seeds') {
      return
    }

    const drawn = this.options.decode?.(text)

    if (drawn) {
      this.remember('open')
      this.list = listOf(drawn)
      this.lch = this.lchs()
      this.links = brightLinks(this.list)
      this.say('Took the colors of the share code', 'ok')

      return
    }

    const color = parseColor(text)

    if (!color) {
      this.say('Not a color — #rrggbb, rgb(r g b) or oklch(l c h)', 'error')

      return
    }

    this.modal = undefined
    this.take(color, 'paste')
  }

  press(key: string): void {
    this.notice = undefined

    if (key === 'ctrl-c') {
      this.interrupt()

      return
    }

    const modal = this.modal

    switch (modal?.kind) {
      case 'help': {
        const answer = modal.help.key(key)

        if (answer !== 'stay') {
          const run = answer === 'run' ? modal.help.chosen()?.run : undefined
          this.modal = undefined
          run?.()
        }

        return
      }

      case 'quit':
        this.quitKey(modal.focus, key)

        return
      case 'type':
        this.type(modal.text, key)

        return
      case 'open':
        this.openKey(modal, key)

        return
      case 'menu':
        this.menuKey(modal, key)

        return
      default:
        this.baseKey(key)
    }
  }

  private baseKey(key: string): void {
    if (key === '?') {
      this.modal = { kind: 'help', help: new Help(editorTopics(this), editorLegend(this)) }

      return
    }

    if (this.compare && key === 'esc') {
      this.compare = false

      return
    }

    if (this.base() === 'inspect' && this.inspectKey(key)) {
      return
    }

    if (this.tone && (key === 'ctrl-v' || key === 'alt-v' || key === 'p')) {
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

    if (key === 'g' && this.mode !== 'seeds') {
      this.view = this.view === 'slot' ? 'relations' : 'slot'
      this.inspect = undefined

      return
    }

    const line = lineStep(key, true)
    const step = line === undefined ? key : line < 0 ? 'up' : 'down'

    if (this.tuning) {
      this.tuneKey(this.tuning, step)
    } else if (this.mode === 'seeds') {
      this.seedKey(step)
    } else {
      this.listKey(step)
    }
  }

  select(slot: number): void {
    if (this.mode === 'seeds' || this.modal) {
      return
    }

    if (this.tuning) {
      if (slot === this.slot()) {
        return
      }

      this.keep(this.tuning)
    }

    this.notice = undefined
    this.seat(slot)
    this.lastEdit = undefined
  }

  private seat(slot: number): void {
    this.row = slot < BASE.length ? slot : BASE.length + ((slot - BASE.length) % 8)

    if (slot >= BASE.length) {
      this.col = slot - BASE.length >= 8 ? 1 : 0
    }
  }

  grip(channel: number): void {
    this.grasp(channel)
  }

  private grasp(channel: number): Tuning | undefined {
    if (this.mode === 'seeds' || this.modal) {
      return undefined
    }

    this.notice = undefined
    const tuning = this.tuning ?? this.tune()
    this.channel = channel

    return tuning
  }

  slide(channel: number, fraction: number): void {
    const tuning = this.grasp(channel)

    if (!tuning) {
      return
    }

    const at = Math.min(1, Math.max(0, fraction))

    this.stepped(tuning, 'point', () => {
      if (channel === CONTRAST) {
        this.reach(tuning, 21 ** at)
      } else {
        this.put(tuning, alongside(CHANNELS[channel] as Channel, at))
      }
    })
  }

  touch(): void {
    if (this.tuning) {
      this.tuning.last = undefined
    }
  }

  sow(field: number, fraction: number): void {
    const seed = SEED_FIELDS[field]

    if (this.mode !== 'seeds' || this.modal || !seed) {
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

    const modal = this.modal
    const tuning = this.tuning

    if (modal?.kind === 'open') {
      this.modal = { ...modal, pick: clamp(modal.pick, Math.max(0, this.choices().length - 1)) }
    } else if (modal) {
      return
    } else if (tuning) {
      this.channel = 0
      this.stepped(tuning, 'l', () => this.step(tuning, -step))
    } else if (this.mode === 'seeds') {
      this.field = clamp(this.field, SEED_FIELDS.length - 1)
    } else {
      this.row = clamp(this.row, ROWS - 1)
      this.lastEdit = undefined
    }
  }

  lchOf(hex: Hex): Oklch {
    return lchIn(this.list, hex)
  }

  private lchs(): Oklch[] {
    return this.list.map((hex) => this.lchOf(hex))
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
    this.start = this.list
    this.original = this.list
    this.links = brightLinks(this.original)
    this.seeded = true
  }

  private leave(): void {
    if (this.dirty()) {
      this.modal = { kind: 'quit', focus: 'yes' }
    } else {
      this.result = 'cancelled'
    }
  }

  private interrupt(): void {
    const asked = this.modal?.kind === 'quit'
    this.modal = undefined

    if (asked) {
      this.result = 'cancelled'

      return
    }

    this.inspect = undefined
    this.compare = false

    if (this.tuning) {
      this.keep(this.tuning)
    }

    this.leave()
  }

  private quitKey(focus: 'yes' | 'no', key: string): void {
    if (key === 'esc') {
      this.modal = undefined
    } else if (['left', 'right', 'h', 'l', 'tab', 'shift-tab'].includes(key)) {
      this.modal = { kind: 'quit', focus: focus === 'yes' ? 'no' : 'yes' }
    } else if (key === 'y' || key === 'Y' || key === 'n' || key === 'N' || key === 'enter') {
      const yes = key === 'enter' ? focus === 'yes' : key === 'y' || key === 'Y'
      this.modal = undefined

      if (yes) {
        this.save()
      } else {
        this.result = 'cancelled'
      }
    }
  }

  private findPictures(start?: Start): void {
    if (!this.options.find) {
      this.say('Pictures need Ghostty, iTerm2 or kitty, outside tmux', 'warn')

      return
    }

    this.wants = start ? { start } : {}
  }

  private openPalettes(): void {
    if ((this.options.palettes ?? []).length > 0) {
      this.modal = { kind: 'open', filter: '', pick: 0 }
    } else {
      this.say('No other palettes to take colors from')
    }
  }

  private listKey(key: string): void {
    if (key === 'up' || key === 'down') {
      const step = key === 'up' ? -1 : 1
      this.land(this.row + step, step)
      this.lastEdit = undefined
    } else if (key === 'home' || key === 'end') {
      this.land(key === 'home' ? 0 : ROWS - 1, key === 'home' ? 1 : -1)
    } else if (key === 'pgup' || key === 'pgdn') {
      this.land(key === 'pgup' ? 0 : BASE.length, 1)
    } else if (key === 'left' || key === 'right') {
      const col = key === 'left' ? 0 : 1

      if (this.row >= BASE.length && this.visible(this.slotAt(this.row, col))) {
        this.col = col
        this.lastEdit = undefined
      }
    } else if (this.builderKey(key)) {
      return
    } else if (key === 'shift-left' || key === 'shift-right') {
      this.scene += key === 'shift-left' ? -1 : 1
    } else if (key === 'n' || key === 'N') {
      this.nextMiss(key === 'n' ? 1 : -1)
    } else if (key === 'enter' || key === 'tab') {
      this.tune()
    } else if (key === '#') {
      this.modal = { kind: 'type', text: '' }
    } else if (key === 'c') {
      this.clip = this.list[this.slot()]
      this.say(`Copied ${this.clip}`, 'ok')
    } else if (key === 'v') {
      if (this.clip) {
        this.set(this.slot(), this.clip, 'paste')
      } else {
        this.say('Nothing copied yet — c copies a color')
      }
    } else if (key === 'r') {
      this.set(this.slot(), this.original[this.slot()] as Hex, 'reset')
    } else if (key === 'R') {
      this.remember('reset-all')
      this.list = this.original
      this.lch = this.lchs()
    } else if (key === '=') {
      this.follow()
    } else if (key === 'f') {
      this.fix()
    } else if (key === 'o' && !this.tone) {
      this.openPalettes()
    } else if (key === 'u') {
      this.undo()
    } else if (key === 'ctrl-r') {
      this.redo()
    } else if (key === 's' || key === 'ctrl-s') {
      this.save()
    } else if (key === 'esc') {
      this.leave()
    }
  }

  viewport(cols: number, rows: number): void {
    this.size = { cols, rows }
  }

  private layout(): Layout | undefined {
    return this.size && this.view === 'slot' ? layoutOf(this.size.cols, this.size.rows, this.scene) : undefined
  }

  get roomy(): boolean {
    return this.layout() !== undefined
  }

  private reseat(): void {
    if (!this.visible(this.slot())) {
      this.land(this.row, 1)
    }
  }

  private rowShown(row: number): boolean {
    return this.visible(this.slotAt(row, 0)) || (row >= BASE.length && this.visible(this.slotAt(row, 1)))
  }

  private land(row: number, step: number): void {
    for (let i = 0; i < ROWS; i++) {
      const at = (((row + step * i) % ROWS) + ROWS) % ROWS

      if (this.rowShown(at)) {
        this.row = at

        if (at >= BASE.length && !this.visible(this.slotAt(at, this.col))) {
          this.col = 1 - this.col
        }

        return
      }
    }
  }

  private builderKey(key: string): boolean {
    if (['i', 'm', 'w', 'x', 'I'].includes(key) && !this.roomy) {
      this.say(this.view === 'relations' ? 'g goes back to the builder' : UNBUILT, 'warn')

      return true
    }

    if (key === 'i') {
      this.startInspect()
    } else if (key === 'l') {
      this.linkKey()
    } else if (key === 'm') {
      this.changedOnly = !this.changedOnly
      this.reseat()
      this.say(this.changedOnly && this.changes() === 0 ? 'Nothing changed yet' : undefined)
    } else if (key === 'b') {
      this.pic = !this.pic
    } else if (key === 'w') {
      this.where = !this.where
    } else if (key === 'x' && this.options.exports) {
      this.modal = { kind: 'menu', menu: 'export', entry: 0 }
    } else if (key === 'I') {
      this.modal = { kind: 'menu', menu: 'import', entry: 0 }
    } else {
      return false
    }

    return true
  }

  private menuKey(modal: Modal & { kind: 'menu' }, key: string): void {
    const count = modal.menu === 'export' ? 3 : 2
    const line = lineStep(key, true)

    if (key === 'esc') {
      this.modal = undefined
    } else if (line !== undefined) {
      this.modal = { ...modal, entry: (modal.entry + (line < 0 ? count - 1 : 1)) % count }
    } else if (key === 'enter') {
      this.choose(modal.entry)
    }
  }

  choose(entry: number): void {
    if (this.modal?.kind !== 'menu') {
      return
    }

    const menu = this.modal.menu
    this.modal = undefined

    if (menu === 'import') {
      if (entry === 0) {
        this.openPalettes()
      } else {
        this.say(
          this.options.decode
            ? `Paste a share link or a ${CODE} code into this window`
            : 'Share codes are not read here',
          this.options.decode ? 'info' : 'warn',
        )
      }

      return
    }

    const exports = this.options.exports

    if (!exports) {
      return
    }

    try {
      const edited = this.edited()
      const code = exports.code(edited)
      this.copied = entry === 0 ? code : entry === 1 ? `${exports.command} ${code}` : exports.toml(edited)
      this.say(
        `Copied ${entry === 0 ? 'the share code' : entry === 1 ? 'the add command' : 'the set file'} — paste it where you need it`,
        'ok',
      )
    } catch (error) {
      this.say(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  private startInspect(): void {
    const layout = this.layout()

    if (!layout) {
      this.say(UNBUILT, 'warn')

      return
    }

    this.inspect = { spot: firstSpot(layout, this.slot()) }
  }

  private inspectKey(key: string): boolean {
    const layout = this.layout()

    if (!layout) {
      this.inspect = undefined

      return false
    }

    const ways = new Map<string, 'left' | 'right' | 'up' | 'down' | 'next' | 'previous'>([
      ['left', 'left'],
      ['right', 'right'],
      ['tab', 'next'],
      ['shift-tab', 'previous'],
    ])

    const line = lineStep(key, true)
    const way = line === undefined ? ways.get(key) : line < 0 ? 'up' : 'down'

    if (key === 'i' || key === 'esc') {
      this.inspect = undefined
    } else if (way) {
      this.inspect = { spot: moveSpot(layout, validSpot(layout, this.inspect?.spot), way) }
    } else if (key === 'shift-left' || key === 'shift-right') {
      this.scene += key === 'shift-left' ? -1 : 1
      this.inspect = { spot: undefined }
    } else if (key === 'enter') {
      this.jump()
    } else {
      return false
    }

    return true
  }

  point(spot: Spot): void {
    if (this.mode !== 'seeds' && !this.modal && this.layout()) {
      this.inspect = { spot }
    }
  }

  slotsHere(): { text: number; ground: number } | undefined {
    const layout = this.layout()
    const spot = this.inspect?.spot

    return layout && spot ? slotsAt(layout, spot) : undefined
  }

  private jump(): void {
    const here = this.slotsHere()

    if (!here) {
      return
    }

    const slot = here.ground !== 0 ? here.ground : here.text
    this.inspect = undefined
    this.show(slot)
    this.select(slot)
  }

  private show(slot: number): void {
    if (!this.visible(slot)) {
      this.changedOnly = false
    }
  }

  openSlot(slot: number): void {
    if (this.mode === 'seeds' || this.modal) {
      return
    }

    const tuning = this.tuning
    const same = tuning !== undefined && slot === this.slot()

    if (tuning) {
      this.keep(tuning)
    }

    if (same) {
      return
    }

    this.show(slot)
    this.select(slot)
    this.tune()
  }

  dismiss(): void {
    const tuning = this.tuning

    if (!tuning || (this.modal && this.modal.kind !== 'type')) {
      return
    }

    this.modal = undefined
    this.keep(tuning)
  }

  plane(lightness: number, chroma: number): void {
    const tuning = this.grasp(0)

    if (!tuning) {
      return
    }

    this.stepped(tuning, 'point', () => {
      this.channel = 0
      this.put(tuning, lightness)
      this.channel = 1
      this.put(tuning, chroma)
    })
  }

  private linkKey(): void {
    const slot = this.slot()

    if (slot < BASE.length) {
      this.say('l links a bright to its normal — pick an ANSI row', 'warn')

      return
    }

    const normal = BASE.length + ((slot - BASE.length) % 8)
    const bright = normal + 8
    const names = `${slotLabel(bright).name} and ${slotLabel(normal).name.toLowerCase()}`

    if (!this.tuning) {
      this.remember('link')
    }

    if (this.links.has(bright)) {
      this.unlink(bright)
      this.say(`${names} move apart`)

      return
    }

    this.link(normal, bright)
    this.say(`${names} move together`)
  }

  private link(normal: number, bright: number): void {
    this.links = new Map(this.links).set(bright, offsetOf(this.lch[normal] as Oklch, this.lch[bright] as Oklch))
  }

  private unlink(bright: number): void {
    this.links = new Map(this.links.entries().filter(([slot]) => slot !== bright))
  }

  private nextMiss(way: number): void {
    const order = gridOrder()
    const bad = this.misses()

    if (bad.size === 0) {
      this.say('Passes every contrast check', 'ok')

      return
    }

    const at = order.indexOf(this.slot())

    for (let i = 1; i <= order.length; i++) {
      const slot = order[(((at + way * i) % order.length) + order.length) % order.length] as number

      if (bad.has(slot)) {
        this.seat(slot)

        return
      }
    }
  }

  private tune(): Tuning {
    const tuning: Tuning = { from: this.record(), holds: new Map(), steps: [], redos: [], last: undefined }
    this.lastEdit = 'tune'
    this.tuning = tuning
    this.hold(tuning)

    return tuning
  }

  private keep(tuning: Tuning): void {
    const { from } = tuning

    if (this.list.every((c, i) => c === from.list[i]) && sameLinks(this.links, from.links)) {
      this.history = this.history.filter((snap) => snap !== from)
    }

    this.tuning = undefined
  }

  private cancel(tuning: Tuning): void {
    const { from } = tuning
    const at = this.history.lastIndexOf(from)

    if (at >= 0) {
      this.history = this.history.slice(0, at)
    }

    this.restore(from)
    this.tuning = undefined
  }

  private hold(tuning: Tuning): void {
    for (const slot of this.scoped()) {
      if (!tuning.holds.has(slot)) {
        tuning.holds.set(slot, (this.lch[slot] as Oklch).c)
      }
    }
  }

  scoped(): number[] {
    return scopeSlots(this.scope, this.slot())
  }

  private tuneKey(tuning: Tuning, key: string): void {
    const handle = handleOf(key, this.channel === CONTRAST)

    if (handle) {
      this.stepped(tuning, handle, () => this.move(tuning, key))
    } else if (key === 'tab' || key === 'shift-tab') {
      this.channel = this.channel === CONTRAST ? 0 : CONTRAST
    } else if (key === 'a') {
      this.rescope()
    } else if (key === '#') {
      this.modal = { kind: 'type', text: '' }
    } else if (key === 'l') {
      this.linkKey()
    } else if (key === 'r') {
      this.take(this.original[this.slot()] as Hex, 'reset')
    } else if (key === 'u') {
      this.unstep(tuning)
    } else if (key === 'ctrl-r') {
      this.restep(tuning)
    } else if (key === 's' || key === 'ctrl-s') {
      this.keep(tuning)
      this.save()
    } else if (key === 'enter') {
      this.keep(tuning)
    } else if (key === 'esc') {
      this.cancel(tuning)
    }
  }

  private stepped(tuning: Tuning, handle: string, change: () => void): void {
    const before: Step = { ...this.snapshot(), holds: new Map(tuning.holds) }

    change()

    if (this.list.every((c, i) => c === before.list[i])) {
      return
    }

    if (handle !== tuning.last || JUMPS.has(handle)) {
      tuning.steps.push(before)
      tuning.redos = []
    }

    tuning.last = handle
  }

  private unstep(tuning: Tuning): void {
    const last = tuning.steps.pop()

    if (!last) {
      this.say('Nothing to undo')

      return
    }

    tuning.redos.push({ ...this.snapshot(), holds: tuning.holds })
    this.lay(tuning, last)
  }

  private restep(tuning: Tuning): void {
    const next = tuning.redos.pop()

    if (!next) {
      this.say('Nothing to redo')

      return
    }

    tuning.steps.push({ ...this.snapshot(), holds: tuning.holds })
    this.lay(tuning, next)
  }

  private lay(tuning: Tuning, step: Step): void {
    this.list = step.list
    this.lch = step.lch
    this.links = step.links
    tuning.holds = step.holds
    tuning.last = undefined
  }

  private move(tuning: Tuning, key: string): void {
    const contrastOn = this.channel === CONTRAST

    if (key === 'up' || key === 'down' || key === 'pgup' || key === 'pgdn') {
      this.channel = 0
      this.step(tuning, (key === 'up' || key === 'pgup' ? 1 : -1) * (key.startsWith('pg') ? FAST : 1))
    } else if (key === 'left' || key === 'right') {
      const sign = key === 'left' ? -1 : 1

      if (contrastOn) {
        this.reach(tuning, this.ratio() + sign * 0.1)
      } else {
        this.channel = 1
        this.step(tuning, sign)
      }
    } else if (key === 'shift-left' || key === 'shift-right') {
      const sign = key === 'shift-left' ? -1 : 1

      if (contrastOn) {
        this.reach(tuning, this.ratio() + sign * 0.5)
      } else {
        this.channel = 2
        this.step(tuning, sign * HUE_STEP)
      }
    } else if ((key === ',' || key === '.') && !contrastOn) {
      this.channel = 2
      this.step(tuning, key === ',' ? -1 : 1)
    } else if (key === 'home' || key === 'end') {
      if (contrastOn) {
        this.reach(tuning, key === 'home' ? (this.partner().floor ?? 1) : 21)
      } else {
        const channel = CHANNELS[this.channel] as Channel
        this.put(tuning, key === 'home' ? channel.min : channel.wraps ? channel.max - channel.step : channel.max)
      }
    } else if (/^[0-9]$/.test(key)) {
      if (contrastOn) {
        if (key !== '0') {
          this.reach(tuning, Number(key))
        }
      } else {
        const channel = CHANNELS[this.channel] as Channel
        this.put(tuning, channel.min + ((channel.max - channel.min) * Number(key)) / 10)
      }
    }
  }

  private rescope(): void {
    if (this.slot() < BASE.length) {
      this.say('A base color moves alone', 'warn')

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
    const tuning = this.tuning

    if (!tuning || this.modal || this.slot() < BASE.length) {
      return
    }

    if (scope !== 'this' && scopeSlots(scope, this.slot()).length <= 1) {
      return
    }

    this.scope = scope
    this.hold(tuning)
    const n = this.scoped().length
    this.say(n > 1 ? `${n} colors move together` : 'This color moves alone')
  }

  entryTo(entry: number): void {
    if (this.modal?.kind === 'menu') {
      this.modal = { ...this.modal, entry }
    }
  }

  formatTo(format: Format): void {
    this.format = format
  }

  pickTo(pick: number): void {
    if (this.modal?.kind === 'open') {
      this.modal = { ...this.modal, pick }
    }
  }

  fieldTo(field: number): void {
    if (!this.modal && this.mode === 'seeds') {
      this.field = field
    }
  }

  viewTo(view: PaletteEditor['view']): void {
    if (!this.modal && this.mode !== 'seeds') {
      this.view = view
    }
  }

  sceneTo(scene: number): void {
    if (!this.modal) {
      this.scene = scene
    }
  }

  closeHelp(): void {
    if (this.modal?.kind === 'help') {
      this.modal = undefined
    }
  }

  takeCopied(): string | undefined {
    const copied = this.copied
    this.copied = undefined

    return copied
  }

  takeWants(): { start?: Start } | undefined {
    const wants = this.wants
    this.wants = undefined

    return wants
  }

  partner(): Partner {
    return partnerOf(this.list, this.slot())
  }

  ratio(): number {
    return contrast(this.list[this.slot()] as Hex, this.list[this.partner().against] as Hex)
  }

  origin(): { hex: Hex; lch: Oklch; ratio: number } | undefined {
    const slot = this.slot()
    const hex = this.original[slot] as Hex

    if (hex === this.list[slot]) {
      return undefined
    }

    return { hex, lch: this.lchOf(hex), ratio: contrast(hex, this.original[this.partner().against] as Hex) }
  }

  private reach(tuning: Tuning, target: number): void {
    const slot = this.slot()
    const at = this.lch[slot] as Oklch
    const against = this.list[this.partner().against] as Hex
    const solved = solveLightness(this.list[slot] as Hex, at, tuning.holds.get(slot) ?? at.c, against, target)

    if (solved.stops !== undefined) {
      this.say(`The ratio stops at ${solved.stops.toFixed(2)}:1 on this side of the color it is read against`, 'warn')
    }

    this.lch = this.lch.with(slot, solved.lch)
    this.list = this.list.with(slot, solved.hex)
  }

  private step(tuning: Tuning, steps: number): void {
    const channel = CHANNELS[this.channel] as Channel
    const was = (this.lch[this.slot()] as Oklch)[channel.key]
    this.put(tuning, was + channel.step * steps)
  }

  private put({ holds }: Tuning, raw: number): void {
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
      const most = room(at.l, at.h)

      if (rounded > most) {
        this.say(`Chroma stops at ${most.toFixed(3)}, the sRGB edge for this lightness and hue`, 'warn')
      }

      const next = Math.min(rounded, most)
      const delta = next - at.c
      holds.set(slot, next)
      this.place(slot, at.l, next, at.h)

      for (const s of others) {
        const o = this.lch[s] as Oklch
        const want = round(clamp((holds.get(s) ?? o.c) + delta, 0, C_MAX))
        holds.set(s, want)
        this.place(s, o.l, want, o.h)
      }

      this.trail([slot, ...others])

      return
    }

    const delta = channel.key === 'h' ? ((((rounded - at.h) % 360) + 540) % 360) - 180 : rounded - at.l
    this.place(
      slot,
      channel.key === 'l' ? rounded : at.l,
      holds.get(slot) ?? at.c,
      channel.key === 'h' ? rounded : at.h,
    )

    if (channel.key === 'h' && grey(this.list[slot] as Hex)) {
      this.say('A grey shows no hue — raise its chroma first', 'warn')
    }

    for (const s of others) {
      const o = this.lch[s] as Oklch
      this.place(
        s,
        channel.key === 'l' ? round(clamp(o.l + delta, 0, 1)) : o.l,
        holds.get(s) ?? o.c,
        channel.key === 'h' ? round((((o.h + delta) % 360) + 360) % 360) : o.h,
      )
    }

    this.trail([slot, ...others])
  }

  private trail(moved: number[]): void {
    const among = new Set(moved)

    for (const [bright, by] of this.links) {
      const normal = bright - 8

      if (among.has(bright) && !among.has(normal)) {
        this.unlink(bright)
      } else if (among.has(normal) && !among.has(bright)) {
        const moved = following(this.lch[normal] as Oklch, by)
        this.lch = this.lch.with(bright, moved.lch)
        this.list = this.list.with(bright, moved.hex)
      }
    }
  }

  private place(slot: number, l: number, c: number, h: number): void {
    const at = placed(l, c, h)
    this.lch = this.lch.with(slot, at.lch)
    this.list = this.list.with(slot, at.hex)
  }

  private take(color: Hex, edit: string): void {
    const tuning = this.tuning
    const slot = this.slot()

    if (!tuning) {
      this.set(slot, color, edit)

      return
    }

    this.stepped(tuning, edit, () => {
      this.list = this.list.with(slot, color)
      this.lch = this.lch.with(slot, this.lchOf(color))
      tuning.holds.set(slot, (this.lch[slot] as Oklch).c)
      this.trail([slot])
    })
  }

  private type(typed: string, key: string): void {
    if (key === 'esc') {
      this.modal = undefined
    } else if (key === 'enter') {
      const color = parseColor(typed)

      if (!color) {
        this.say('Not a color — #rrggbb, rgb(r g b) or oklch(l c h)', 'error')

        return
      }

      this.modal = undefined
      this.take(color, 'hex')
    } else {
      const next = edit(typed, lowered(key), (ch) => /^[0-9a-z#(),.% ]$/.test(ch) && typed.length < 28)

      if (next !== undefined) {
        this.modal = { kind: 'type', text: next }
      }
    }
  }

  private openKey(modal: Modal & { kind: 'open' }, key: string): void {
    const choices = this.choices()
    const line = lineStep(key)

    if (key === 'esc') {
      this.modal = undefined
    } else if (line !== undefined) {
      const n = Math.max(1, choices.length)
      this.modal = { ...modal, pick: (modal.pick + (line < 0 ? n - 1 : 1)) % n }
    } else if (key === 'home' || key === 'end') {
      this.modal = { ...modal, pick: key === 'home' ? 0 : Math.max(0, choices.length - 1) }
    } else if (key === 'enter') {
      const choice = choices[modal.pick]

      if (!choice) {
        return
      }

      this.remember('open')
      this.list = listOf(choice.colors)
      this.lch = this.lchs()
      this.links = brightLinks(this.list)
      this.modal = undefined
      this.say(`Took the colors of ${choice.name}`, 'ok')

      if (this.mode === 'seeds') {
        this.leaveSeeds()
      }
    } else {
      const next = edit(modal.filter, lowered(key), (ch) => NAME_CHAR.test(ch))

      if (next !== undefined) {
        this.modal = { kind: 'open', filter: next, pick: 0 }
      }
    }
  }

  private snapshot(): Snapshot {
    return { list: this.list, lch: this.lch, links: this.links }
  }

  private record(): Snapshot {
    const now = this.snapshot()
    this.history.push(now)
    this.future = []

    return now
  }

  private remember(edit: string): void {
    if (edit !== this.lastEdit || ALWAYS.has(edit)) {
      this.record()
    }

    this.lastEdit = edit
  }

  private set(slot: number, color: Hex, edit: string): void {
    if (!isHex(color) || this.list[slot] === color) {
      return
    }

    this.remember(edit)
    this.list = this.list.with(slot, color)
    this.lch = this.lch.with(slot, this.lchOf(color))
    this.trail([slot])
  }

  private follow(): void {
    if (this.row < BASE.length) {
      this.say('= works on an ANSI row — the bright takes its normal', 'warn')

      return
    }

    const normal = this.row
    const bright = this.row + 8
    const from = this.lch[normal] as Oklch
    this.remember('follow')
    this.place(bright, clamp(from.l + 0.06, 0, 1), from.c, from.h)
    this.link(normal, bright)
    this.seat(bright)
    this.say(`${slotLabel(bright).name} follows ${slotLabel(normal).name.toLowerCase()}`, 'ok')
  }

  private fix(): void {
    const theme = gatedOf(this.list)

    const { theme: fixed, moves, left } = fixGate({ ...theme, selectionBackground: theme.selectionBackground as Hex })

    if (moves.length === 0) {
      const passes = check(theme).length === 0
      this.say(passes ? 'Already passes every contrast check' : 'No color change fixes it', passes ? 'ok' : 'warn')

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
    this.say(
      `Moved ${moves.length} ${moves.length === 1 ? 'color' : 'colors'}${left.length === 0 ? ', and every check passes' : ', closer to passing'}`,
      left.length === 0 ? 'ok' : 'info',
    )
  }

  private save(): void {
    const problem = this.options.check(this.edited())

    if (problem) {
      this.say(problem, 'error')

      return
    }

    this.result = 'saved'
  }

  private undo(): void {
    const last = this.history.pop()

    if (!last) {
      this.say('Nothing to undo')

      return
    }

    this.future.push(this.snapshot())
    this.restore(last)
  }

  private redo(): void {
    const next = this.future.pop()

    if (!next) {
      this.say('Nothing to redo')

      return
    }

    this.history.push(this.snapshot())
    this.restore(next)
  }

  private restore(snap: Snapshot): void {
    this.list = snap.list
    this.lch = snap.lch
    this.links = snap.links
    this.lastEdit = undefined
  }
}
