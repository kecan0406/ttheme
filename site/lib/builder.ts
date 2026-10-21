import type { Hex } from '../../src/core/color.ts'
import type { Draft } from '../../src/core/draft.ts'
import { mirror } from '../../src/core/mirror.ts'
import { type Mode, modeOf, otherOf } from '../../src/core/mode.ts'
import { colorsOf, listOf, SLOT_NAMES } from '../../src/core/slots.ts'
import { marketplaceOf, nameProblem, type SharedPicture, slugOf } from '../../src/core/theme.ts'

export const STORE = 'ttheme-builder'

export const MOST_DRAFTS = 12

export const BLANK_NAME = 'my-palette'

export const BLANK_SIGNATURE = ['cursor', 'ansi5', 'ansi4']

export interface Meta {
  base?: string
  from?: string
  ansiSource?: string
  booru?: string
  booruSites?: Record<string, string[]>
  waive?: string[]
  reason?: string
  pictures?: SharedPicture[]
}

export interface Side {
  base: Hex[] | null
  tuned: Record<string, Hex>
}

export interface Edit {
  id: string
  name: string
  made: Hex[]
  other: Side
  signature: string[]
  meta: Meta
  keep: boolean
  origin: { made: Hex[]; other: Side }
  source: string | null
  at: number
}

export interface Start {
  name: string
  shelf: string
  native: string | null
  lead: boolean
  dots: Hex[]
  draft: Draft
}

export interface Stored {
  current: string | null
  drafts: Edit[]
}

export interface BuilderData {
  first: Start
  link: string | null
  panes: string[]
  uses: number[][]
  official: string[]
}

export type View = 'made' | 'other'

function sideOf(draft: Draft): Side {
  return { base: draft.other ? listOf(draft.other) : null, tuned: {} }
}

function copied(side: Side): Side {
  return { base: side.base ? [...side.base] : null, tuned: { ...side.tuned } }
}

export function metaOf(draft: Draft): Meta {
  return {
    ...(draft.base ? { base: draft.base } : {}),
    ...(draft.from ? { from: draft.from } : {}),
    ...(draft.ansiSource ? { ansiSource: draft.ansiSource } : {}),
    ...(draft.booru ? { booru: draft.booru } : {}),
    ...(draft.booruSites ? { booruSites: draft.booruSites } : {}),
    ...(draft.waive && draft.waive.length > 0 ? { waive: draft.waive, reason: draft.reason ?? '' } : {}),
    ...(draft.pictures && draft.pictures.length > 0 ? { pictures: draft.pictures } : {}),
  }
}

export function editOf(draft: Draft, source: string | null, own: boolean, id: string, at: number): Edit {
  const made = listOf(draft)
  const other = sideOf(draft)
  const meta = metaOf(draft)
  const copy = !own && source !== null
  const { ansiSource: _, base: __, ...rest } = meta
  const base = copy && !marketplaceOf(source) ? source : draft.base

  const kept: Meta = copy
    ? { ...rest, ...(base ? { base } : {}), ...(meta.waive ? { reason: `kept from ${source}` } : {}) }
    : meta

  return {
    id,
    name: copy ? `${slugOf(source)}-tuned` : slugOf(draft.name),
    made,
    other,
    signature: [...draft.signature],
    meta: structuredClone(kept),
    keep: true,
    origin: { made: [...made], other: copied(other) },
    source,
    at,
  }
}

export function blankEdit(colors: Hex[], id: string, at: number): Edit {
  return {
    id,
    name: BLANK_NAME,
    made: [...colors],
    other: { base: null, tuned: {} },
    signature: [...BLANK_SIGNATURE],
    meta: {},
    keep: true,
    origin: { made: [...colors], other: { base: null, tuned: {} } },
    source: null,
    at,
  }
}

export function madeMode(edit: Pick<Edit, 'made'>): Mode {
  return modeOf(colorsOf(edit.made))
}

export function modeOfView(edit: Pick<Edit, 'made'>, view: View): Mode {
  return view === 'made' ? madeMode(edit) : otherOf(madeMode(edit))
}

const mirrors = new Map<string, Hex[]>()

export function mirrored(edit: Pick<Edit, 'made' | 'signature' | 'meta' | 'name'>): Hex[] {
  const key = JSON.stringify([edit.made, edit.signature, edit.meta.waive ?? []])
  const known = mirrors.get(key)

  if (known) return known
  const c = colorsOf(edit.made)

  const shade = mirror({
    name: edit.name,
    background: c.background,
    foreground: c.foreground,
    cursor: c.cursor,
    selectionBackground: c.selection,
    ansi: c.ansi,
    signatureSlots: edit.signature,
    waive: edit.meta.waive ?? [],
  })

  const list = listOf({ ...shade, selection: shade.selectionBackground })

  if (mirrors.size > 64) mirrors.clear()
  mirrors.set(key, list)

  return list
}

export function otherBase(edit: Edit): Hex[] {
  return edit.other.base ?? mirrored(edit)
}

export function otherList(edit: Edit): Hex[] {
  return otherBase(edit).map((hex, slot) => edit.other.tuned[slot] ?? hex)
}

export function writesOther(edit: Edit): boolean {
  return edit.other.base !== null || Object.keys(edit.other.tuned).length > 0
}

export function listIn(edit: Edit, view: View): Hex[] {
  return view === 'made' ? edit.made : otherList(edit)
}

export function originIn(edit: Edit, view: View): Hex[] {
  return view === 'made' ? edit.origin.made : otherBase(edit)
}

export function changedIn(edit: Edit, view: View): Set<number> {
  if (view === 'other') return new Set(Object.keys(edit.other.tuned).map(Number))

  return new Set(edit.made.flatMap((hex, slot) => (hex === edit.origin.made[slot] ? [] : [slot])))
}

export function changes(edit: Edit): number {
  return changedIn(edit, 'made').size + Object.keys(edit.other.tuned).length
}

export function withSlot(edit: Edit, view: View, slot: number, hex: Hex): Edit {
  if (view === 'made') {
    const made = edit.made.with(slot, hex)
    const flipped = madeMode({ made }) !== madeMode(edit)

    return { ...edit, made, ...(flipped ? { other: { base: null, tuned: {} } } : {}) }
  }

  const tuned = { ...edit.other.tuned }

  if (hex === otherBase(edit)[slot]) delete tuned[slot]
  else tuned[slot] = hex

  return { ...edit, other: { base: edit.other.base, tuned } }
}

export function followMirror(edit: Edit): Edit {
  return { ...edit, other: { base: null, tuned: {} } }
}

export function resetAll(edit: Edit): Edit {
  return { ...edit, made: [...edit.origin.made], other: copied(edit.origin.other) }
}

export function nameTrouble(name: string): string | undefined {
  if (name.includes('/') || name.includes('@')) return 'takes lowercase letters, digits and single hyphens'

  return nameProblem(name)
}

export function draftFrom(edit: Edit): Draft {
  const made = colorsOf(edit.made)
  const { meta } = edit
  const pictures = edit.keep ? (meta.pictures ?? []) : []

  return {
    name: edit.name,
    ...(meta.base ? { base: meta.base } : {}),
    ...(meta.from ? { from: meta.from } : {}),
    ...(meta.ansiSource ? { ansiSource: meta.ansiSource } : {}),
    ...(meta.booru ? { booru: meta.booru } : {}),
    ...(meta.booru && meta.booruSites ? { booruSites: meta.booruSites } : {}),
    signature: [...edit.signature],
    ...made,
    ...(writesOther(edit) ? { other: colorsOf(otherList(edit)) } : {}),
    ...(meta.waive && meta.waive.length > 0 ? { waive: meta.waive, reason: meta.reason ?? '' } : {}),
    ...(pictures.length > 0 ? { pictures } : {}),
  }
}

export function signatureTrouble(edit: Edit): string | undefined {
  const colors = edit.signature.map((slot) => edit.made[SLOT_NAMES.indexOf(slot)])

  if (edit.signature.length !== 3 || colors.some((hex) => hex === undefined)) return 'needs three slots'

  return new Set(colors).size === 3 ? undefined : 'needs three slots of three different colors'
}

export function storedOf(text: string | null): Stored {
  try {
    const value = JSON.parse(text ?? 'null') as Stored | null

    if (value && Array.isArray(value.drafts)) return { current: value.current ?? null, drafts: value.drafts }
  } catch {}

  return { current: null, drafts: [] }
}

export function kept(stored: Stored, edit: Edit): Stored {
  return {
    current: edit.id,
    drafts: [edit, ...stored.drafts.filter((d) => d.id !== edit.id)].slice(0, MOST_DRAFTS),
  }
}

export const RESTORE_SCRIPT = `(()=>{try{const s=JSON.parse(localStorage.getItem('${STORE}')||'null');if(s&&s.current&&Array.isArray(s.drafts)&&s.drafts.some((d)=>d&&d.id===s.current))document.documentElement.dataset.restoring=''}catch{}})()`
