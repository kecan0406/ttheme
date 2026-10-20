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
import { contrast, type Hex, isHex, luminance, type Oklch, oklch } from '../core/color.ts'
import {
  ACCENT_SLOTS,
  ACHROMATIC,
  boundOf,
  check,
  GATE_RULES,
  hueGap,
  measure,
  meets,
  ROLES,
  shownOf,
} from '../core/contrast.ts'
import { edgeChroma, fixGate, inGamut } from '../core/fix.ts'
import { type Colors, grow, nudge, SEED_FIELDS, SEEDS, type Seeds } from '../core/seeds.ts'
import {
  BASE,
  bound,
  colorsOf,
  type Format,
  gatedOf,
  grey,
  lchIn,
  listOf,
  misses,
  PAIRS,
  ruleSlots,
  SLOT_NAMES,
  slotLabel,
  weakestUnder,
} from '../core/slots.ts'
import { inert } from '../core/text.ts'
import type { Tone } from './bar.ts'
import { edit } from './field.ts'
import { pastedRefs, type Start } from './find/attach.ts'
import { Help, type Legend, type Topic } from './help.ts'
import { MARKS } from './style.ts'

const ROWS = BASE.length + PAIRS.length

const LEAVE =
  'esc  ctrl+c  leaves, asking first when something changed: y saves, n discards, esc keeps editing  ·  ctrl+c  again discards'

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
  { key: 'c', label: 'Chroma', min: 0, max: 0.37, step: 0.005, digits: 3 },
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
  signature: string[]
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
  signature: string[]
  waive?: string[]
  palettes?: Choice[]
  pictures?: number
  exports?: Exports
  decode?: (text: string) => Colors | undefined
  find?: (edited: Edited, start?: Start) => Promise<Found>
  check: (edited: Edited) => string | undefined
}

function isPicture(text: string): boolean {
  const trimmed = text.trim()

  return /^https?:\/\/\S+$/i.test(trimmed) || pastedRefs(trimmed).length > 0
}

type Mode = 'seeds' | 'list' | 'tune'

interface Snapshot {
  list: Hex[]
  lch: Oklch[]
  signature: string[]
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

interface Partner {
  against: number
  floor: number | undefined
}

function partnerOf(list: Hex[], slot: number, waive: string[]): Partner {
  const ansi = slot - BASE.length

  const rule =
    slot <= 1
      ? 'foreground'
      : slot === 3
        ? 'selection'
        : ansi === 0
          ? 'ansi0-on-accents'
          : ansi === 7 || ansi === 15
            ? 'light-ansi'
            : ansi === 8
              ? 'ansi8-visible'
              : ACCENT_SLOTS.includes(ansi)
                ? 'accents'
                : undefined

  return {
    against: ansi === 0 ? BASE.length + weakestUnder(list) : slot === 0 || slot === 3 ? 1 : 0,
    floor: rule === undefined || waive.includes(rule) ? undefined : bound(rule),
  }
}

interface GateRow {
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

    const ok = waived || Number.isNaN(value) ? undefined : meets(rule, value)

    return {
      ok,
      label: rule.label,
      value: shownOf(value),
      bound: waived ? 'waived' : boundOf(rule),
      slots: ok === false ? ruleSlots(list, signature, waive, rule.rule) : [],
    }
  })
}

const ALWAYS = new Set(['reset', 'reset-all', 'hex', 'paste', 'fix', 'open', 'tune', 'sig', 'follow'])

const NAME_CHAR = /^[a-z0-9@/-]$/

const C_MAX = (CHANNELS[1] as Channel).max

function edge(l: number, h: number): number {
  return Math.floor(edgeChroma(l, h, C_MAX) * 10_000) / 10_000
}

function offsetOf(from: Oklch, to: Oklch): Oklch {
  return { l: to.l - from.l, c: to.c - from.c, h: ((((to.h - from.h) % 360) + 540) % 360) - 180 }
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
  overlay: 'open' | undefined
  help: Help | undefined
  quitting = false
  quitFocus: 'yes' | 'no' = 'yes'
  compare = false
  notice: string | undefined
  noticeTone: Tone = 'info'
  filter = ''
  pick = 0
  result: 'saved' | 'cancelled' | undefined
  wants: { start?: Start } | undefined
  pictures: number
  inspect = false
  spot: Spot | undefined
  format: Format = 'hex'
  pic = true
  menu: Menu | undefined
  entry = 0
  changedOnly = false
  where = false
  size: { cols: number; rows: number } | undefined
  copied: string | undefined
  readonly startPictures: number
  readonly options: EditorOptions
  readonly fresh: boolean
  readonly tone: boolean
  private readonly startSignature: string[]
  private seeded = false
  private tuneFrom: { list: Hex[]; lch: Oklch[] } | undefined
  private holds = new Map<number, number>()
  private clip: Hex | undefined
  private history: Snapshot[] = []
  private future: Snapshot[] = []
  private lastEdit: string | undefined
  private links = new Map<number, number>()
  private unlinked = new Set<number>()
  private offsets = new Map<number, Oklch>()

  constructor(options: EditorOptions) {
    this.options = options
    this.tone = options.tone === true
    this.fresh = options.colors === undefined
    this.mode = this.fresh ? 'seeds' : 'list'
    this.list = listOf(options.colors ?? grow(this.seeds))
    this.lch = this.lchs()
    this.start = this.list
    this.original = options.original ? listOf(options.original) : this.list
    this.signature = [...options.signature]
    this.startSignature = [...options.signature]
    this.pictures = options.pictures ?? 0
    this.startPictures = this.pictures
    this.chain(this.original)
  }

  private chain(list: Hex[]): void {
    this.links = new Map()
    this.unlinked = new Set()
    this.offsets = new Map()

    for (let k = 0; k < 8; k++) {
      const normal = BASE.length + k
      const bright = normal + 8
      const a = this.lchOf(list[normal] as Hex)
      const b = this.lchOf(list[bright] as Hex)

      if (a.c >= ACHROMATIC && b.c >= ACHROMATIC && hueGap(a.h, b.h) <= 3) {
        this.links.set(bright, normal)
        this.offsets.set(bright, offsetOf(a, b))
      }
    }
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
      on: this.linkOf(bright) !== undefined,
      lift: (this.lch[bright] as Oklch).l - (this.lch[normal] as Oklch).l,
    }
  }

  linkOf(slot: number): number | undefined {
    const normal = this.links.get(slot)

    return normal !== undefined && !this.unlinked.has(slot) ? normal : undefined
  }

  changed(slot: number): boolean {
    return this.list[slot] !== this.original[slot]
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

  resettable(): boolean {
    return this.dirty() || (this.tone && this.list.some((c, i) => c !== this.original[i]))
  }

  misses(): Set<number> {
    return misses(this.list, this.signature, this.waive)
  }

  choices(): Choice[] {
    const needle = this.filter.toLowerCase()

    return (this.options.palettes ?? []).filter((c) => c.name.toLowerCase().includes(needle))
  }

  private topics(): Topic[] {
    const list = this.mode === 'list'
    const plain = list && !this.inspect
    const tuning = this.mode === 'tune'
    const ansi = this.slot() >= BASE.length
    const others = (this.options.palettes ?? []).length > 0
    const roomy = list && this.roomy
    const when = (on: boolean, key: string) => (on ? { run: () => this.press(key) } : {})
    const close: Topic = { label: 'Close', text: '?  esc', run: () => {} }

    const pictures: Topic[] = this.options.find
      ? [
          {
            label: 'Pictures',
            text: 'p  finds one on the boorus, tried on in these colors',
            ...when(this.mode !== 'tune', 'p'),
          },
          { label: '', text: 'b  shows or hides it behind the editor', ...when(list, 'b') },
          {
            label: '',
            text: 'Drop a picture on the window, or paste one, its path or its link  ·  ctrl+v  takes the clipboard’s',
          },
        ]
      : []

    if (this.mode === 'seeds') {
      return [
        { label: 'Seeds', text: '↑↓  a seed  ·  ←→  a step  ·  ⇧←→  five steps, ten on the hue  ·  home  end' },
        { label: 'Slots', text: 'enter  keeps these seeds and tunes the slots one by one', ...when(true, 'enter') },
        { label: 'Open', text: 'o  starts from another palette’s colors', ...when(others, 'o') },
        ...pictures,
        { label: 'Leave', text: LEAVE, ...when(true, 'esc') },
        close,
      ]
    }

    return [
      {
        label: 'Move',
        text: '↑↓  a slot  ·  ←→  normal or bright  ·  home  end  ·  pgup  the base colors  ·  pgdn  the ANSI ones',
      },
      {
        label: 'Misses',
        text: 'n  N  the next and last slot the gate misses',
        ...when(list && this.misses().size > 0, 'n'),
      },
      { label: 'Tune', text: 'enter  tab  opens the picker under the slot', ...when(plain, 'enter') },
      {
        label: '',
        text: '↑↓  lightness  ·  ←→  chroma  ·  ⇧←→  hue by 5  ·  ,  .  hue by 1  ·  pgup  pgdn  lightness ×5  ·  home  end  the ends  ·  0-9  jump',
      },
      { label: '', text: 'enter  keeps  ·  a click outside the picker keeps', ...when(tuning, 'enter') },
      { label: '', text: 'esc  undoes every slot the tune moved', ...when(tuning && !this.compare, 'esc') },
      {
        label: 'Contrast',
        text: `tab  while tuning  ·  ${MARKS.contrast} moves lightness until the ratio to the color it is read against changes  ·  home  the gate’s floor  ·  1-9  that ratio`,
        ...when(tuning, 'tab'),
      },
      {
        label: 'Chroma',
        text: `Stops at the sRGB edge  ·  what lightness or hue takes away comes back while you tune, where it fits again (${MARKS.off})`,
      },
      {
        label: 'Scope',
        text: 'a  while tuning  ·  this, pair, normals, brights or accents  ·  the slots in it move by the same step, each keeping its own color',
        ...when(tuning && ansi, 'a'),
      },
      {
        label: 'Relations',
        text: 'g  the lightness, chroma and hue of every ANSI color at once, and the relations the gate checks',
        ...when(true, 'g'),
      },
      { label: 'Sample', text: '⇧←→  another tab  ·  the slot under the cursor is underlined where it is used' },
      { label: 'Where', text: 'w  dims every part of the sample that does not use the slot', ...when(roomy, 'w') },
      {
        label: 'Inspect',
        text: 'i  or a click on the sample finds the slots a spot uses  ·  ←→↑↓  move  ·  enter  goes to the slot  ·  esc  leaves',
        ...when(roomy && !this.inspect, 'i'),
      },
      {
        label: 'Link',
        text: 'l  makes a bright follow its normal: tuning the normal moves it, tuning the bright alone unlinks it  ·  =  snaps it to its normal',
        ...when(ansi, 'l'),
      },
      { label: 'Changed', text: 'm  shows only the slots that changed', ...when(roomy, 'm') },
      { label: 'Type', text: '#  then #rrggbb, rgb(r g b) or oklch(l c h)  ·  a paste works too', ...when(true, '#') },
      {
        label: 'Slot',
        text: `c  copies  ·  v  pastes  ·  r  puts it back as it opened, R all of them${this.tone ? '' : '  ·  *  marks it a signature color'}`,
      },
      { label: 'Fix', text: 'f  moves the colors the gate misses', ...when(list, 'f') },
      ...(this.tone
        ? []
        : [{ label: 'Open', text: 'o  takes another palette’s colors', ...when(list && others, 'o') }]),
      ...(this.options.exports
        ? [
            {
              label: 'Export',
              text: 'x  copies the share code, an add command or the palette file',
              ...when(roomy, 'x'),
            },
          ]
        : []),
      ...(this.tone
        ? []
        : [{ label: 'Import', text: 'I  takes colors from another palette or a share code', ...when(roomy, 'I') }]),
      { label: 'Gate', text: `${MARKS.miss}  marks every slot whose own checks miss, and each miss names its slots` },
      { label: 'History', text: 'u  undo', ...when(list, 'u') },
      { label: '', text: 'ctrl+r  redo', ...when(list, 'ctrl-r') },
      ...pictures,
      { label: 'Compare', text: 'space  shows the colors you started from, on the terminal too', ...when(true, ' ') },
      { label: 'Save', text: 's  saves', ...when(true, 's') },
      { label: 'Leave', text: LEAVE, ...when(plain && !this.compare, 'esc') },
      close,
    ]
  }

  private legend(): Legend {
    if (this.mode === 'seeds') {
      return []
    }

    return [
      ...(this.tone ? [] : ([[MARKS.signature, 'signature color']] as Legend)),
      [MARKS.miss, 'misses the gate'],
      [MARKS.on, 'changed'],
      [MARKS.linked, 'follows its normal'],
      [MARKS.off, 'where it was'],
      [MARKS.contrast, 'contrast'],
    ]
  }

  paste(text: string): void {
    this.notice = undefined

    if (this.help) {
      this.help.paste(text)

      return
    }

    if (this.overlay === 'open') {
      this.filter += [...text.toLowerCase()].filter((ch) => NAME_CHAR.test(ch)).join('')
      this.pick = 0

      return
    }

    if (this.quitting || this.menu) {
      return
    }

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
      this.chain(this.list)
      this.say('Took the colors of the share code', 'ok')

      return
    }

    const color = parseColor(text)

    if (!color) {
      this.say('Not a color — #rrggbb, rgb(r g b) or oklch(l c h)', 'error')

      return
    }

    this.typing = undefined
    this.take(color, 'paste')
  }

  press(key: string): void {
    this.notice = undefined

    if (key === 'ctrl-c') {
      this.interrupt()

      return
    }

    if (this.help) {
      const answer = this.help.key(key)

      if (answer !== 'stay') {
        const run = answer === 'run' ? this.help.chosen()?.run : undefined
        this.help = undefined
        run?.()
      }

      return
    }

    if (this.quitting) {
      this.quitKey(key)

      return
    }

    if (this.typing !== undefined) {
      this.type(key)

      return
    }

    if (this.overlay === 'open') {
      this.openKey(key)

      return
    }

    if (this.menu) {
      this.menuKey(key)

      return
    }

    if (key === '?') {
      this.help = new Help(this.topics(), this.legend())

      return
    }

    if (this.inspect && this.mode === 'list' && this.inspectKey(key)) {
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

    if (this.compare && key === 'esc') {
      this.compare = false

      return
    }

    if (key === 'g' && this.mode !== 'seeds') {
      this.view = this.view === 'slot' ? 'relations' : 'slot'
      this.inspect = false
      this.spot = undefined

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
    this.seat(slot)
    this.lastEdit = undefined
  }

  private seat(slot: number): void {
    this.row = slot < BASE.length ? slot : BASE.length + ((slot - BASE.length) % 8)

    if (slot >= BASE.length) {
      this.col = slot - BASE.length >= 8 ? 1 : 0
    }
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
    } else if (this.quitting || this.typing !== undefined) {
      return
    } else if (this.mode === 'seeds') {
      this.field = clamp(this.field, SEED_FIELDS.length - 1)
    } else if (this.mode === 'tune') {
      this.channel = 0
      this.step(-step)
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
    this.chain(this.original)
    this.seeded = true
    this.mode = 'list'
  }

  private leave(): void {
    if (this.dirty()) {
      this.quitting = true
      this.quitFocus = 'yes'
    } else {
      this.result = 'cancelled'
    }
  }

  private interrupt(): void {
    if (this.quitting) {
      this.quitting = false
      this.result = 'cancelled'

      return
    }

    this.help = undefined
    this.overlay = undefined
    this.filter = ''
    this.menu = undefined
    this.typing = undefined
    this.inspect = false
    this.spot = undefined
    this.compare = false

    if (this.mode === 'tune') {
      this.tuneKey('enter')
    }

    this.leave()
  }

  private quitKey(key: string): void {
    if (key === 'esc') {
      this.quitting = false
    } else if (['left', 'right', 'h', 'l', 'tab', 'shift-tab'].includes(key)) {
      this.quitFocus = this.quitFocus === 'yes' ? 'no' : 'yes'
    } else if (key === 'y' || key === 'Y' || key === 'n' || key === 'N' || key === 'enter') {
      const yes = key === 'enter' ? this.quitFocus === 'yes' : key === 'y' || key === 'Y'
      this.quitting = false

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
      this.overlay = 'open'
      this.pick = 0
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
      this.typing = ''
    } else if (key === 'c') {
      this.clip = this.list[this.slot()]
      this.say(`Copied ${this.clip}`, 'ok')
    } else if (key === 'v') {
      if (this.clip) {
        this.set(this.slot(), this.clip, 'paste')
      } else {
        this.say('Nothing copied yet — c copies a slot')
      }
    } else if (key === 'r') {
      this.set(this.slot(), this.original[this.slot()] as Hex, 'reset')
    } else if (key === 'R') {
      this.remember('reset-all')
      this.list = this.original
      this.lch = this.lchs()
    } else if (key === '=') {
      this.follow()
    } else if (key === '*' && !this.tone) {
      this.mark()
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
      this.menu = 'export'
      this.entry = 0
    } else if (key === 'I') {
      this.menu = 'import'
      this.entry = 0
    } else {
      return false
    }

    return true
  }

  private menuKey(key: string): void {
    const count = this.menu === 'export' ? 3 : 2

    if (key === 'esc') {
      this.menu = undefined
    } else if (key === 'up' || key === 'down' || key === 'k' || key === 'j') {
      this.entry = (this.entry + (key === 'up' || key === 'k' ? count - 1 : 1)) % count
    } else if (key === 'enter') {
      this.choose(this.entry)
    }
  }

  choose(entry: number): void {
    const menu = this.menu
    this.menu = undefined

    if (menu === 'import') {
      if (entry === 0) {
        this.openPalettes()
      } else {
        this.say(
          this.options.decode ? 'Paste a share link or a tt4: code into this window' : 'Share codes are not read here',
          this.options.decode ? 'info' : 'warn',
        )
      }

      return
    }

    const exports = this.options.exports

    if (menu !== 'export' || !exports) {
      return
    }

    try {
      const edited = this.edited()
      const code = exports.code(edited)
      this.copied = entry === 0 ? code : entry === 1 ? `${exports.command} ${code}` : exports.toml(edited)
      this.say(
        `Copied ${entry === 0 ? 'the share code' : entry === 1 ? 'the add command' : 'the palette file'} — paste it where you need it`,
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

    this.inspect = true
    this.spot = firstSpot(layout, this.slot())
  }

  private inspectKey(key: string): boolean {
    const layout = this.layout()

    if (!layout) {
      this.inspect = false

      return false
    }

    const ways = new Map<string, 'left' | 'right' | 'up' | 'down' | 'next' | 'previous'>([
      ['left', 'left'],
      ['right', 'right'],
      ['up', 'up'],
      ['k', 'up'],
      ['down', 'down'],
      ['j', 'down'],
      ['tab', 'next'],
      ['shift-tab', 'previous'],
    ])

    const way = ways.get(key)

    if (key === 'i' || key === 'esc') {
      this.inspect = false
      this.spot = undefined
    } else if (way) {
      this.spot = moveSpot(layout, validSpot(layout, this.spot), way)
    } else if (key === 'shift-left' || key === 'shift-right') {
      this.scene += key === 'shift-left' ? -1 : 1
      this.spot = undefined
    } else if (key === 'enter') {
      this.jump()
    } else {
      return false
    }

    return true
  }

  point(spot: Spot): void {
    if (this.mode !== 'seeds' && !this.overlay && !this.quitting && this.typing === undefined && this.layout()) {
      this.inspect = true
      this.spot = spot
    }
  }

  slotsHere(): { text: number; ground: number } | undefined {
    const layout = this.layout()

    return layout && this.spot ? slotsAt(layout, this.spot) : undefined
  }

  private jump(): void {
    const here = this.slotsHere()

    if (!here) {
      return
    }

    const slot = here.ground !== 0 ? here.ground : here.text
    this.inspect = false
    this.spot = undefined
    this.show(slot)
    this.select(slot)
  }

  private show(slot: number): void {
    if (!this.visible(slot)) {
      this.changedOnly = false
    }
  }

  openSlot(slot: number): void {
    if (this.mode === 'seeds' || this.typing !== undefined || this.overlay || this.quitting) {
      return
    }

    const same = this.mode === 'tune' && slot === this.slot()

    if (this.mode === 'tune') {
      this.tuneKey('enter')
    }

    if (same) {
      return
    }

    this.show(slot)
    this.select(slot)

    if (this.mode === 'list') {
      this.tune()
    }
  }

  dismiss(): void {
    if (this.mode !== 'tune' || this.overlay || this.quitting) {
      return
    }

    this.typing = undefined
    this.tuneKey('enter')
  }

  plane(lightness: number, chroma: number): void {
    if (!this.grip(0)) {
      return
    }

    this.channel = 0
    this.put(lightness)
    this.channel = 1
    this.put(chroma)
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

    if (this.mode !== 'tune') {
      this.remember('link')
    }

    if (this.linkOf(bright) !== undefined) {
      this.unlinked.add(bright)
      this.say(`${names} move apart`)

      return
    }

    this.links.set(bright, normal)
    this.unlinked.delete(bright)
    this.offsets.set(bright, offsetOf(this.lch[normal] as Oklch, this.lch[bright] as Oklch))
    this.say(`${names} move together`)
  }

  private nextMiss(way: number): void {
    const order = gridOrder()
    const bad = this.misses()

    if (bad.size === 0) {
      this.say('The gate passes', 'ok')

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

  private tune(): void {
    this.remember('tune')
    this.tuneFrom = { list: this.list, lch: this.lch }
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
    const contrastOn = this.channel === CONTRAST

    if (key === 'tab' || key === 'shift-tab') {
      this.channel = contrastOn ? 0 : CONTRAST
    } else if (key === 'up' || key === 'down' || key === 'pgup' || key === 'pgdn') {
      this.channel = 0
      this.step((key === 'up' || key === 'pgup' ? 1 : -1) * (key.startsWith('pg') ? FAST : 1))
    } else if (key === 'left' || key === 'right') {
      const sign = key === 'left' ? -1 : 1

      if (contrastOn) {
        this.reach(this.ratio() + sign * 0.1)
      } else {
        this.channel = 1
        this.step(sign)
      }
    } else if (key === 'shift-left' || key === 'shift-right') {
      const sign = key === 'shift-left' ? -1 : 1

      if (contrastOn) {
        this.reach(this.ratio() + sign * 0.5)
      } else {
        this.channel = 2
        this.step(sign * HUE_STEP)
      }
    } else if ((key === ',' || key === '.') && !contrastOn) {
      this.channel = 2
      this.step(key === ',' ? -1 : 1)
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
    } else if (key === 'l') {
      this.linkKey()
    } else if (key === 's' || key === 'ctrl-s') {
      this.tuneKey('enter')
      this.save()
    } else if (key === 'enter') {
      if (this.tuneFrom && this.list.every((c, i) => c === this.tuneFrom?.list[i])) {
        this.history.pop()
      }

      this.endTune()
    } else if (key === 'esc') {
      if (this.tuneFrom) {
        this.list = this.tuneFrom.list
        this.lch = this.tuneFrom.lch
        this.history.pop()
      }

      this.endTune()
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
    if (this.mode !== 'tune' || this.typing !== undefined || this.quitting || this.slot() < BASE.length) {
      return
    }

    if (scope !== 'this' && scopeSlots(scope, this.slot()).length <= 1) {
      return
    }

    this.scope = scope
    this.hold()
    const n = this.scoped().length
    this.say(n > 1 ? `${n} slots move together` : 'This slot moves alone')
  }

  private endTune(): void {
    this.tuneFrom = undefined
    this.holds = new Map()
    this.mode = 'list'
  }

  partner(): Partner {
    return partnerOf(this.list, this.slot(), this.waive)
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
      this.say(`The ratio stops at ${ratioAt(far).toFixed(2)}:1 on this side of the color it is read against`, 'warn')
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

    this.lch = this.lch.with(slot, { ...(this.lch[slot] as Oklch), l: Math.round(l * 10_000) / 10_000 })
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
        this.say(`Chroma stops at ${room.toFixed(3)}, the sRGB edge for this lightness and hue`, 'warn')
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

      this.trail([slot, ...others])

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
      this.say('A grey shows no hue — raise its chroma first', 'warn')
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

    this.trail([slot, ...others])
  }

  private trail(moved: number[]): void {
    const among = new Set(moved)

    for (const [bright, normal] of this.links) {
      if (this.unlinked.has(bright)) {
        continue
      }

      if (among.has(bright) && !among.has(normal)) {
        this.unlinked.add(bright)
      } else if (among.has(normal) && !among.has(bright)) {
        const at = this.lch[normal] as Oklch
        const by = this.offsets.get(bright) as Oklch
        this.place(bright, clamp(at.l + by.l, 0, 1), Math.max(0, at.c + by.c), (((at.h + by.h) % 360) + 360) % 360)
      }
    }
  }

  private place(slot: number, l: number, c: number, h: number): void {
    const fits = Math.min(c, edge(l, h))
    this.lch = this.lch.with(slot, { l, c: fits, h })
    this.list = this.list.with(slot, inGamut(l, fits, h))
  }

  private take(color: Hex, edit: string): void {
    if (this.mode === 'tune') {
      const slot = this.slot()
      this.list = this.list.with(slot, color)
      this.lch = this.lch.with(slot, this.lchOf(color))
      this.holds.set(slot, (this.lch[slot] as Oklch).c)
      this.trail([slot])
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
        this.say('Not a color — #rrggbb, rgb(r g b) or oklch(l c h)', 'error')

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
      this.chain(this.list)
      this.overlay = undefined
      this.filter = ''
      this.say(`Took the colors of ${choice.name}`, 'ok')

      if (this.mode === 'seeds') {
        this.leaveSeeds()
      }
    } else {
      const next = edit(this.filter, lowered(key), (ch) => NAME_CHAR.test(ch))

      if (next !== undefined) {
        this.filter = next
        this.pick = 0
      }
    }
  }

  private snapshot(): Snapshot {
    return { list: this.list, lch: this.lch, signature: this.signature }
  }

  private remember(edit: string): void {
    if (edit !== this.lastEdit || ALWAYS.has(edit)) {
      this.history.push(this.snapshot())
      this.future = []
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
    this.links.set(bright, normal)
    this.unlinked.delete(bright)
    this.offsets.set(bright, offsetOf(from, this.lch[bright] as Oklch))
    this.seat(bright)
    this.say(`${slotLabel(bright).name} follows ${slotLabel(normal).name.toLowerCase()}`, 'ok')
  }

  private mark(): void {
    const name = SLOT_NAMES[this.slot()] as string
    this.remember('sig')
    const marked = this.signature.includes(name) ? this.signature.filter((s) => s !== name) : [...this.signature, name]
    const dropped = marked.length > 3 ? marked[0] : undefined
    this.signature = marked.slice(-3)
    const whole = this.signature.length === 3

    this.say(
      whole
        ? `Signature: ${this.signature.join(', ')}${dropped ? ` — ${dropped} dropped` : ''}`
        : `The signature needs three slots — ${this.signature.length} marked`,
      whole ? 'ok' : 'warn',
    )
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
      const passes = check(theme).length === 0
      this.say(passes ? 'Already passes the gate' : 'No color change fixes it', passes ? 'ok' : 'warn')

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
      `Moved ${moves.length} ${moves.length === 1 ? 'color' : 'colors'}${left.length === 0 ? ' — passes the gate' : ' closer to the gate'}`,
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
    this.signature = snap.signature
    this.lastEdit = undefined
  }
}
