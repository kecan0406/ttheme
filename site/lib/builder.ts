import type { WorkRef } from '@/lib/themes'
import type { Hex } from '../../src/core/color.ts'
import type { Draft } from '../../src/core/draft.ts'
import type { UpstreamEntry } from '../../src/core/manifest.ts'
import { mirror } from '../../src/core/mirror.ts'
import { type Mode, modeOf, otherOf } from '../../src/core/mode.ts'
import { colorsOf, listOf, SLOT_NAMES } from '../../src/core/slots.ts'
import { type SharedPicture, slugOf, slugProblem, subjectProblem } from '../../src/core/theme.ts'

export const STORE = 'ttheme-builder'

export const TAB_KEY = 'ttheme-builder-tab'

export const MOST_DRAFTS = 30

export const RETURNS = ['reload', 'back_forward']

export const BLANK_NAME = 'my-palette'

export const BLANK_SIGNATURE = ['cursor', 'ansi5', 'ansi4']

export interface Meta {
  subject?: string
  upstream?: UpstreamEntry
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
  start: Draft
  source: string | null
  at: number
}

export interface Opening {
  name: string
  draft: Draft
}

export interface Start extends Opening {
  shelf: string
  work: Pick<WorkRef, 'name' | 'native' | 'lang'> | null
  publisher: string
  lead: boolean
  words: string
  dots: Hex[]
}

export interface Stored {
  drafts: Edit[]
}

export interface BuilderData {
  first: Opening
  link: string | null
  panes: string[]
  uses: number[][]
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
    ...(draft.subject ? { subject: draft.subject } : {}),
    ...(draft.upstream ? { upstream: draft.upstream } : {}),
    ...(draft.pictures && draft.pictures.length > 0 ? { pictures: draft.pictures } : {}),
  }
}

export function editOf(draft: Draft, source: string | null, own: boolean, id: string, at: number): Edit {
  const made = listOf(draft)
  const other = sideOf(draft)
  const meta = metaOf(draft)
  const copy = !own && source !== null

  const kept: Meta = copy
    ? {
        ...meta,
        upstream: {
          palette: source,
          colors: colorsOf(made),
          ...(other.base ? { other: colorsOf(other.base) } : {}),
        },
      }
    : meta

  return started({
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
  })
}

export function blankEdit(colors: Hex[], id: string, at: number): Edit {
  return started({
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
  })
}

function started(edit: Omit<Edit, 'start'>): Edit {
  return { ...edit, start: structuredClone(draftFrom(edit)) }
}

export function madeMode(edit: Pick<Edit, 'made'>): Mode {
  return modeOf(colorsOf(edit.made))
}

export function modeOfView(edit: Pick<Edit, 'made'>, view: View): Mode {
  return view === 'made' ? madeMode(edit) : otherOf(madeMode(edit))
}

const mirrors = new Map<string, Hex[]>()

export function mirrored(edit: Pick<Edit, 'made' | 'signature' | 'meta' | 'name'>): Hex[] {
  const key = JSON.stringify([edit.made, edit.signature])
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
  })

  const list = listOf({ ...shade, selection: shade.selectionBackground })

  if (mirrors.size > 64) mirrors.clear()
  mirrors.set(key, list)

  return list
}

type Body = Pick<Edit, 'name' | 'made' | 'other' | 'signature' | 'meta' | 'keep'>

export function otherBase(edit: Body): Hex[] {
  return edit.other.base ?? mirrored(edit)
}

export function otherList(edit: Body): Hex[] {
  return otherBase(edit).map((hex, slot) => edit.other.tuned[slot] ?? hex)
}

export function writesOther(edit: Pick<Edit, 'other'>): boolean {
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
  return slugProblem(name)
}

export function subjectTrouble(subject: string | undefined): string | undefined {
  return subject === undefined ? undefined : subjectProblem(subject)
}

export function draftFrom(edit: Body): Draft {
  const made = colorsOf(edit.made)
  const { meta } = edit
  const pictures = edit.keep ? (meta.pictures ?? []) : []

  return {
    name: edit.name,
    ...(meta.subject ? { subject: meta.subject } : {}),
    ...(meta.upstream ? { upstream: meta.upstream } : {}),
    signature: [...edit.signature],
    ...made,
    ...(writesOther(edit) ? { other: colorsOf(otherList(edit)) } : {}),
    ...(pictures.length > 0 ? { pictures } : {}),
  }
}

export function signatureTrouble(edit: Edit): string | undefined {
  const colors = edit.signature.map((slot) => edit.made[SLOT_NAMES.indexOf(slot)])

  if (edit.signature.length !== 3 || colors.some((hex) => hex === undefined)) return 'needs three colors'

  return new Set(colors).size === 3 ? undefined : 'needs three different colors'
}

export function dirty(edit: Edit): boolean {
  return JSON.stringify(draftFrom(edit)) !== JSON.stringify(edit.start)
}

export function storedOf(text: string | null): Stored {
  try {
    const value = JSON.parse(text ?? 'null') as Stored | null

    if (value && Array.isArray(value.drafts)) return { drafts: value.drafts }
  } catch {}

  return { drafts: [] }
}

export function kept(stored: Stored, edit: Edit): Stored {
  const others = stored.drafts.filter((draft) => draft.id !== edit.id)

  if (dirty(edit)) return { drafts: [edit, ...others].slice(0, MOST_DRAFTS) }

  return others.length === stored.drafts.length ? stored : { drafts: others }
}

export function dropped(stored: Stored, id: string): Stored {
  return { drafts: stored.drafts.filter((draft) => draft.id !== id) }
}

export function restored(stored: Stored, at: number, edit: Edit): Stored {
  const drafts = stored.drafts.filter((draft) => draft.id !== edit.id)

  return { drafts: drafts.toSpliced(Math.min(at, drafts.length), 0, edit).slice(0, MOST_DRAFTS) }
}

const RETURNING = RETURNS.map((type) => `n.type==='${type}'`).join('||')

export const RESTORE_SCRIPT = `(()=>{try{const n=performance.getEntriesByType('navigation')[0],i=sessionStorage.getItem('${TAB_KEY}'),s=JSON.parse(localStorage.getItem('${STORE}')||'null');if(n&&(${RETURNING})&&i&&s&&Array.isArray(s.drafts)&&s.drafts.some((d)=>d&&d.id===i))document.documentElement.dataset.restoring=''}catch{}})()`
