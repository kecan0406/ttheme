import {
  draftFrom,
  type Edit,
  listIn,
  MOST_DRAFTS,
  madeMode,
  nameTrouble,
  subjectTrouble,
  type View,
  writesOther,
} from '@/lib/builder'
import type { Mode } from '@/lib/mode'
import { pictureOf } from '@/lib/pictures'
import { gateLinesOf, slotViewOf } from '@/lib/slot-view'
import type { GateLine, Picture, SlotFormat, SlotView } from '@/lib/view-types'
import { contrast, type Hex, mix } from '../../src/core/color.ts'
import { type Draft, paletteToml } from '../../src/core/draft.ts'
import { marksOf } from '../../src/core/mark.ts'
import { otherOf } from '../../src/core/mode.ts'
import { PLANE_BOTTOM, PLANE_TOP, shareOf } from '../../src/core/plane.ts'
import { repoFor } from '../../src/core/scaffold.ts'
import { SEED_FIELDS, type Seeds } from '../../src/core/seeds.ts'
import { readSet, setNameOf, setText } from '../../src/core/sets.ts'
import { FACE, lchIn, lchTight, PAIRS, SLOT_NAMES, slotLabel } from '../../src/core/slots.ts'
import { ago } from '../../src/core/text.ts'
import { nameProblem, themeOf } from '../../src/core/theme.ts'
import { partnerOf } from '../../src/core/tune.ts'

export type RowFormat = 'hex' | 'oklch'

export type Link = 'on' | 'off'

export interface RowView {
  slot: number
  name: string
  hex: Hex
  value: string
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
  missed: ReadonlySet<number>,
  changed: ReadonlySet<number>,
  format: RowFormat,
  open: number | null,
): RowView {
  const hex = list[slot] as Hex

  return {
    slot,
    name: slotLabel(slot).name,
    hex,
    value: format === 'hex' ? hex : lchTight(lchIn(list, hex)).trim(),
    miss: missed.has(slot),
    changed: changed.has(slot),
    open: open === slot,
  }
}

export function rowsOf(
  list: Hex[],
  missed: ReadonlySet<number>,
  changed: ReadonlySet<number>,
  format: RowFormat,
  open: number | null,
  linked: ReadonlySet<number>,
  only: boolean,
): Rows {
  const row = (slot: number) => rowOf(list, slot, missed, changed, format, open)
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

export function gateOf(list: Hex[]): Gate {
  const lines = gateLinesOf(list)

  return {
    lines,
    passed: lines.filter((line) => line.ok).length,
  }
}

export function partnered(list: Hex[], slot: number): Partnered {
  const partner = partnerOf(list, slot)
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
    s: slotViewOf(list, missed, slot, uses),
    partner: partnered(list, slot),
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
  from: string | null
  marks: string[]
  background: string
  subject: string
  unread: boolean
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
  others: string[]
  left: string[]
}

export interface SetMembers {
  members: Edit[]
  left: string[]
}

export interface LinkView {
  name: string
  link: string | null
  code: string | null
  failed: string | null
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
  publisher: string | null
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

export interface DraftGroup {
  title: string
  drafts: DraftItem[]
}

export interface DraftList {
  count: number
  most: number
  query: string
  groups: DraftGroup[]
  deleted: string | null
}

export type StartList =
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'ready'; groups: StartGroup[]; query: string }

const DAY = 86_400_000

const WHEN = [
  { title: 'today', days: 0 },
  { title: 'yesterday', days: 1 },
  { title: 'this week', days: 6 },
]

export function draftListOf(
  drafts: Edit[],
  current: string,
  query: string,
  deleted: string | null,
  now: number,
): DraftList {
  const midnight = new Date(now).setHours(0, 0, 0, 0)
  const q = query.trim().toLowerCase()
  const shown = drafts.filter((draft) => !q || draft.name.includes(q)).toSorted((a, b) => b.at - a.at)
  const titleOf = (at: number) => WHEN.find((when) => at >= midnight - when.days * DAY)?.title ?? 'older'

  const groups = [...Map.groupBy(shown, (draft) => titleOf(draft.at))].map(([title, list]) => ({
    title,
    drafts: list.map((draft) => ({
      id: draft.id,
      name: draft.name,
      when: ago(draft.at, now),
      dots: dotsOf(draft.made, FACE),
      current: draft.id === current,
    })),
  }))

  return { count: drafts.length, most: MOST_DRAFTS, query, groups, deleted }
}

export function dotsOf(list: Hex[], slots: readonly string[]): Hex[] {
  return slots.map((slot) => list[SLOT_NAMES.indexOf(slot)] ?? (list[0] as Hex))
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

function setFileOf(edit: Edit): string {
  return `${setNameOf(edit.meta.subject)}.toml`
}

export function aboutOf(edit: Edit, view: View): AboutView {
  const list = listIn(edit, view)

  return {
    name: edit.name,
    file: setFileOf(edit),
    from: edit.meta.upstream?.palette ?? null,
    marks: marksOf(list[0] as Hex, list[1] as Hex, list[2] as Hex, list[3] as Hex),
    background: list[0] as Hex,
    subject: edit.meta.subject ?? '',
    unread: subjectTrouble(edit.meta.subject) !== undefined,
    pictures: (edit.meta.pictures ?? []).map(pictureOf),
    keep: edit.keep,
  }
}

export function exportProblem(edit: Edit): string | undefined {
  const named = nameTrouble(edit.name)

  if (named) return `The name ${named} — fix it in the bar first.`
  const subject = subjectTrouble(edit.meta.subject)

  return subject ? `The subject ${subject} — fix it in the about tab.` : undefined
}

export function setMembersOf(edit: Edit, drafts: readonly Edit[]): SetMembers {
  const set = setNameOf(edit.meta.subject)
  const seen = new Set([edit.name])
  const members: Edit[] = [edit]
  const left: string[] = []

  for (const draft of drafts) {
    if (draft.id === edit.id || setNameOf(draft.meta.subject) !== set || seen.has(draft.name)) continue
    seen.add(draft.name)

    if (exportProblem(draft)) left.push(draft.name)
    else members.push(draft)
  }

  return { members: members.toSorted((a, b) => (a.name < b.name ? -1 : 1)), left }
}

export function setDrafts(edit: Edit, drafts: readonly Edit[]): Draft[] | null {
  return exportProblem(edit) ? null : setMembersOf(edit, drafts).members.map(draftFrom)
}

export function fileOf(edit: Edit, drafts: readonly Edit[] = []): FileView {
  const file = setFileOf(edit)
  const problem = exportProblem(edit)
  const { members, left } = setMembersOf(edit, drafts)
  const others = members.flatMap((member) => (member.id === edit.id ? [] : [member.name]))
  const text = problem ? '' : setText(members.map((m) => ({ slug: m.name, text: paletteToml(draftFrom(m)) })))
  let read = problem

  if (!read) {
    try {
      for (const { slug, doc } of readSet(file, text)) {
        themeOf(slug, doc, { name: slug })
      }
    } catch (error) {
      read = `It would not read back — ${(error as Error).message}`
    }
  }

  return { name: edit.name, file, text: read ? '' : text, problem: read, others, left }
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

  if (!saved) return { ok: true, text: `${edit.name} — a change keeps it in this browser` }

  return named
    ? { ok: false, text: `kept in this browser, but the name ${named}` }
    : { ok: true, text: `kept in this browser as ${edit.name}${writesOther(edit) ? ' · both modes' : ''}` }
}

const SLOT_VARS = ['--bg', '--fg', '--cu', '--se', ...Array.from({ length: 16 }, (_, i) => `--a${i}`)]

export function slotVars(list: Hex[]): string {
  return [
    ...list.map((hex, slot) => `${SLOT_VARS[slot]}:${hex}`),
    `--faint:${mix(list[1] as Hex, list[0] as Hex, 0.45)}`,
  ].join(';')
}
