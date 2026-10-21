import {
  draftFrom,
  type Edit,
  listIn,
  madeMode,
  nameTrouble,
  signatureTrouble,
  type View,
  writesOther,
} from '@/lib/builder'
import type { Mode } from '@/lib/mode'
import { pictureOf } from '@/lib/pictures'
import { gateLinesOf, slotViewOf } from '@/lib/slot-view'
import type { GateLine, Picture, SlotFormat, SlotView } from '@/lib/view-types'
import { contrast, type Hex, mix } from '../../src/core/color.ts'
import { paletteToml, readOwnText } from '../../src/core/draft.ts'
import { marksOf } from '../../src/core/mark.ts'
import { otherOf } from '../../src/core/mode.ts'
import { PLANE_BOTTOM, PLANE_TOP, shareOf } from '../../src/core/plane.ts'
import { repoFor } from '../../src/core/scaffold.ts'
import { SEED_FIELDS, type Seeds } from '../../src/core/seeds.ts'
import { lchIn, lchTight, PAIRS, SLOT_NAMES, slotLabel } from '../../src/core/slots.ts'
import { nameProblem } from '../../src/core/theme.ts'
import { partnerOf } from '../../src/core/tune.ts'

export type RowFormat = 'hex' | 'oklch'

export type Link = 'on' | 'off'

export interface RowView {
  slot: number
  key: string
  name: string
  hex: Hex
  value: string
  signature: boolean
  miss: boolean
  changed: boolean
  open: boolean
}

export interface PairView {
  label: string
  normal: RowView
  bright: RowView
  link: Link
}

export interface Rows {
  base: RowView[]
  pairs: PairView[]
  empty: boolean
}

export interface Gate {
  lines: GateLine[]
  passed: number
  waived: number
}

export interface Tick {
  at: number
  label: string
  floor: boolean
}

export interface Partnered {
  name: string
  ratio: number
  floor: number | undefined
  at: number
  ticks: Tick[]
}

export interface Origin {
  hex: Hex
  x: number
  y: number
  along: number
}

export interface PickerView {
  slot: number
  s: SlotView
  about: string
  partner: Partnered
  origin: Origin | null
  link: Link | null
  format: SlotFormat
  where: boolean
}

const MOST_RATIO = 21

const TICKS = [3, 4.5, 7]

export const ratioAt = (at: number) => MOST_RATIO ** Math.min(1, Math.max(0, at))

export const atRatio = (ratio: number) => Math.log(Math.max(1, ratio)) / Math.log(MOST_RATIO)

const round = (value: number) => Math.round(value * 10_000) / 10_000

export function rowOf(
  list: Hex[],
  slot: number,
  signature: string[],
  missed: ReadonlySet<number>,
  changed: ReadonlySet<number>,
  format: RowFormat,
  open: number | null,
): RowView {
  const hex = list[slot] as Hex
  const key = SLOT_NAMES[slot] as string

  return {
    slot,
    key,
    name: slotLabel(slot).name,
    hex,
    value: format === 'hex' ? hex : lchTight(lchIn(list, hex)).trim(),
    signature: signature.includes(key),
    miss: missed.has(slot),
    changed: changed.has(slot),
    open: open === slot,
  }
}

export function rowsOf(
  list: Hex[],
  signature: string[],
  missed: ReadonlySet<number>,
  changed: ReadonlySet<number>,
  format: RowFormat,
  open: number | null,
  linked: ReadonlySet<number>,
  only: boolean,
): Rows {
  const row = (slot: number) => rowOf(list, slot, signature, missed, changed, format, open)
  const shown = (slot: number) => !only || changed.has(slot) || open === slot
  const base = [0, 1, 2, 3].flatMap((slot) => (shown(slot) ? [row(slot)] : []))

  const pairs = PAIRS.map(
    (label, k): PairView => ({
      label,
      normal: row(4 + k),
      bright: row(12 + k),
      link: linked.has(12 + k) ? 'on' : 'off',
    }),
  ).filter((pair) => shown(pair.normal.slot) || shown(pair.bright.slot))

  return { base, pairs, empty: base.length === 0 && pairs.length === 0 }
}

export function gateOf(list: Hex[], signature: string[], waive: string[]): Gate {
  const lines = gateLinesOf(list, signature, waive)

  return {
    lines,
    passed: lines.filter((line) => line.ok !== false).length,
    waived: lines.filter((line) => line.ok === null).length,
  }
}

export function partnered(list: Hex[], slot: number, waive: string[]): Partnered {
  const partner = partnerOf(list, slot, waive)
  const ratio = contrast(list[slot] as Hex, list[partner.against] as Hex)

  return {
    name: slotLabel(partner.against).name.toLowerCase(),
    ratio,
    floor: partner.floor,
    at: atRatio(ratio),
    ticks: [...new Set([...TICKS, ...(partner.floor === undefined ? [] : [partner.floor])])]
      .sort((a, b) => a - b)
      .map((tick) => ({ at: atRatio(tick), label: String(tick), floor: tick === partner.floor })),
  }
}

export function pickerOf(
  list: Hex[],
  origin: Hex[],
  slot: number,
  signature: string[],
  waive: string[],
  missed: ReadonlySet<number>,
  uses: number[],
  link: Link | null,
  format: SlotFormat,
  where: boolean,
): PickerView {
  const from = origin[slot] as Hex
  const at = from === list[slot] ? null : lchIn(origin, from)

  return {
    slot,
    s: slotViewOf(list, signature, waive, missed, slot, uses),
    about: slotLabel(slot).about,
    partner: partnered(list, slot, waive),
    origin: at
      ? {
          hex: from,
          x: round(shareOf(at.l, at.c, at.h)),
          y: round(Math.min(1, Math.max(0, (PLANE_TOP - at.l) / (PLANE_TOP - PLANE_BOTTOM)))),
          along: round(at.h / 360),
        }
      : null,
    link,
    format,
    where,
  }
}

export interface SeedRow {
  key: string
  label: string
  min: number
  max: number
  step: number
  value: number
  shown: string
}

export interface AboutView {
  name: string
  file: string
  base: string | null
  from: string | null
  signature: string[]
  slots: string[]
  colors: string[]
  marks: string[]
  background: string
  trouble: boolean
  ansiSource: string
  booru: string
  pictures: Picture[]
  keep: boolean
}

export interface ModesView {
  made: Mode
  other: Mode
  own: boolean
  tuned: number
}

export interface StatusView {
  ok: boolean
  text: string
}

export interface FileView {
  name: string
  file: string
  text: string
  problem: string | undefined
  other: string
}

export interface LinkView {
  name: string
  link: string | null
  code: string | null
  failed: string | null
  clash: string | null
}

export interface MarketView {
  owner: string
  name: string
  repo: string
  zip: string
  problem: string | undefined
}

export interface StartItem {
  name: string
  label: string
  dots: string[]
  lead: boolean
}

export interface StartGroup {
  title: string
  native: string | null
  lang: string | undefined
  palettes: StartItem[]
}

export interface DraftItem {
  id: string
  name: string
  when: string
  dots: string[]
  current: boolean
}

export type StartList =
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'ready'; drafts: DraftItem[]; groups: StartGroup[]; query: string }

export function dotsOf(list: Hex[], signature: string[]): Hex[] {
  return signature.map((slot) => list[SLOT_NAMES.indexOf(slot)] ?? (list[0] as Hex))
}

export function seedRowsOf(seeds: Seeds): SeedRow[] {
  return SEED_FIELDS.map((field) => ({
    key: field.key,
    label: field.label.toLowerCase(),
    min: field.min,
    max: field.max,
    step: field.step,
    value: seeds[field.key],
    shown: seeds[field.key].toFixed(field.digits),
  }))
}

export function modesOf(edit: Edit): ModesView {
  const made = madeMode(edit)

  return { made, other: otherOf(made), own: edit.other.base !== null, tuned: Object.keys(edit.other.tuned).length }
}

export function aboutOf(edit: Edit, view: View): AboutView {
  const list = listIn(edit, view)
  const colors = dotsOf(list, edit.signature)

  return {
    name: edit.name,
    file: `${edit.name}.toml`,
    base: edit.meta.base ?? null,
    from: edit.meta.from ?? null,
    signature: edit.signature,
    slots: SLOT_NAMES,
    colors,
    marks: marksOf(list[0] as Hex, list[1] as Hex, colors),
    background: list[0] as Hex,
    trouble: signatureTrouble(edit) !== undefined,
    ansiSource: edit.meta.ansiSource ?? '',
    booru: edit.meta.booru ?? '',
    pictures: (edit.meta.pictures ?? []).map(pictureOf),
    keep: edit.keep,
  }
}

function otherLine(edit: Edit): string {
  const { made, other, own, tuned } = modesOf(edit)

  if (own)
    return `It keeps [colors.${other}], its own ${other} colors${tuned > 0 ? `, ${tuned} of them tuned here` : ''}.`

  return tuned > 0
    ? `It writes [colors.${other}]: the mirror of your ${made} colors, with ${tuned} slots you tuned.`
    : `It holds your ${made} colors alone — ttheme mirrors the ${other} mode as it installs.`
}

export function exportProblem(edit: Edit): string | undefined {
  const named = nameTrouble(edit.name)

  if (named) return `The name ${named} — fix it in the bar first.`
  const signed = signatureTrouble(edit)

  return signed ? `The signature ${signed} — pick them in the about tab.` : undefined
}

export function fileOf(edit: Edit): FileView {
  const problem = exportProblem(edit)
  const text = problem ? '' : paletteToml(draftFrom(edit))
  let read = problem

  if (!read) {
    try {
      readOwnText(edit.name, text, [])
    } catch (error) {
      read = `It would not read back — ${(error as Error).message}`
    }
  }

  return { name: edit.name, file: `${edit.name}.toml`, text: read ? '' : text, problem: read, other: otherLine(edit) }
}

export function marketOf(owner: string, name: string): MarketView {
  const repo = repoFor({ owner, name })
  const missing = !owner || !name

  const problem = missing
    ? 'Fill in your GitHub handle and a name for the marketplace.'
    : nameProblem(`${owner}@x/x`)
      ? 'A GitHub handle takes letters, digits and single hyphens, 39 at most.'
      : nameProblem(`x@${name}/x`)
        ? 'The marketplace name takes lowercase letters, digits and single hyphens.'
        : undefined

  return { owner, name, repo, zip: `${repo}.zip`, problem }
}

export function statusOf(edit: Edit, kept: boolean, saved: boolean): StatusView {
  const named = nameTrouble(edit.name)

  if (!kept) return { ok: false, text: 'this browser keeps no drafts — export before you leave' }

  if (!saved) return { ok: true, text: `${edit.name} · a change keeps it in this browser` }

  return named
    ? { ok: false, text: `kept in this browser · the name ${named}` }
    : { ok: true, text: `kept in this browser as ${edit.name}${writesOther(edit) ? ' · both modes' : ''}` }
}

const SLOT_VARS = ['--bg', '--fg', '--cu', '--se', ...Array.from({ length: 16 }, (_, i) => `--a${i}`)]

export function slotVars(list: Hex[]): string {
  return [
    ...list.map((hex, slot) => `${SLOT_VARS[slot]}:${hex}`),
    `--faint:${mix(list[1] as Hex, list[0] as Hex, 0.45)}`,
  ].join(';')
}
