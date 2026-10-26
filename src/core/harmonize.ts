import { deltaE, type Hex } from './color.ts'
import { ROLE_HUES } from './contrast.ts'
import { type Hued, hctHex, hctOf } from './hct.ts'
import {
  CONTAINER_TONE,
  CURSOR_TONE,
  SELECTION_CHROMA,
  SELECTION_TONE,
  SIGNATURE_TEXT_CHROMA,
  SURFACE_CHROMA,
  SURFACE_TONE,
  separated,
  slotOf,
  TEXT_CHROMA,
  TEXT_TONE,
  TONES,
  withSlot,
} from './mirror.ts'
import type { Mode } from './mode.ts'
import type { Shade, Theme } from './theme.ts'

export type Anchored = Pick<Theme, 'name' | 'signatureSlots'> & Shade

export interface Departure {
  slot: string
  part: string
  measured: Hex
  final: Hex
  delta: number
  shift: number | undefined
  far: boolean
  turned: boolean
}

const HARMONY = 0.4
const THRESHOLD = 60
const CHROMA = { min: 32, max: 64 }
const GREY_CHROMA = 10
const OWN_CHROMA = 16
const DARK_ANCHOR_TONE = 53.5
const DEPARTURE_MAX = 10
const HUE_MAX = 12
const ACHROMATIC = 5
const HELD = new Set(['cursor', 'selection'])

const clamp = (v: number, band: { min: number; max: number }) => Math.max(band.min, Math.min(band.max, v))

const hueDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360

  return Math.min(d, 360 - d)
}

function toward(hue: number, seed: number): number {
  const rotation = Math.min(hueDiff(hue, seed) * HARMONY, THRESHOLD)
  const direction = (seed - hue + 360) % 360 <= 180 ? 1 : -1

  return (hue + rotation * direction + 360) % 360
}

function accent(value: Hex, index: number, seed: number, mode: Mode, rotate: boolean): Hex {
  const o = hctOf(value)
  const hue = o.chroma < GREY_CHROMA ? (ROLE_HUES.get(index % 8)?.center as number) : o.hue

  return hctHex(rotate ? toward(hue, seed) : hue, clamp(o.chroma, CHROMA), TONES[mode][index] as number)
}

function cursor(value: Hex, mode: Mode): Hex {
  const o = hctOf(value)

  return hctHex(o.hue, o.chroma < OWN_CHROMA ? o.chroma : clamp(o.chroma, CHROMA), clamp(o.tone, CURSOR_TONE[mode]))
}

function signatureColor(theme: Anchored, slot: string, mode: Mode, seed: Hued): Hex {
  const value = slotOf(theme, slot)
  const o = hctOf(value)

  if (slot === 'background') return hctHex(o.hue, Math.min(seed.chroma, SURFACE_CHROMA), SURFACE_TONE[mode])

  if (slot === 'foreground') return hctHex(o.hue, Math.min(o.chroma, SIGNATURE_TEXT_CHROMA), TEXT_TONE[mode])

  if (slot === 'cursor') return cursor(value, mode)

  if (slot === 'selection') return hctHex(o.hue, o.chroma, clamp(o.tone, CONTAINER_TONE[mode]))

  return accent(value, Number(slot.slice(4)), seed.hue, mode, false)
}

export function harmonized(theme: Anchored): Shade {
  const first = theme.signatureSlots[0]

  if (first === undefined) throw new Error(`${theme.name}: signature is empty`)

  const seed = hctOf(slotOf(theme, first))
  const mode: Mode = hctOf(theme.background).tone > 50 ? 'light' : 'dark'

  const dark =
    mode === 'light' || theme.signatureSlots.includes('selection')
      ? []
      : theme.signatureSlots.filter(
          (slot) => slot.startsWith('ansi') && hctOf(slotOf(theme, slot)).tone < DARK_ANCHOR_TONE,
        )

  if (dark.length > 0) {
    throw new Error(
      `${theme.name}: ${dark.join(', ')} hold${dark.length === 1 ? 's' : ''} an anchor darker than T${DARK_ANCHOR_TONE}, which a text color can only show as a pastel — put the darkest identity color in selection_background and name selection in meta.signature`,
    )
  }

  const rotate = seed.chroma >= GREY_CHROMA
  const surface = (tone: number) => hctHex(seed.hue, Math.min(seed.chroma, SURFACE_CHROMA), tone)
  const text = (tone: number) => hctHex(seed.hue, Math.min(seed.chroma, TEXT_CHROMA), tone)
  const tones = TONES[mode]
  const selection = hctOf(theme.selectionBackground)

  const base: Shade = {
    background: surface(SURFACE_TONE[mode]),
    foreground: text(TEXT_TONE[mode]),
    cursor: cursor(theme.cursor, mode),
    selectionBackground: hctHex(selection.hue, Math.min(selection.chroma, SELECTION_CHROMA), SELECTION_TONE[mode]),
    ansi: theme.ansi.map((value, i) =>
      i === 0 || i === 7 || i === 8
        ? surface(tones[i] as number)
        : i === 15
          ? text(tones[i] as number)
          : accent(value, i, seed.hue, mode, rotate),
    ),
  }

  const signed = theme.signatureSlots.reduce(
    (shade, slot) => withSlot(shade, slot, signatureColor(theme, slot, mode, seed)),
    base,
  )

  return separated({ name: theme.name, signatureSlots: theme.signatureSlots, waive: [] }, signed)
}

function hueShift(from: Hex, to: Hex): number | undefined {
  const a = hctOf(from)
  const b = hctOf(to)

  if (a.chroma < ACHROMATIC && b.chroma < ACHROMATIC) return undefined

  return ((b.hue - a.hue + 540) % 360) - 180
}

export function departures(
  anchors: Readonly<Record<string, readonly [string, Hex]>>,
  signatureSlots: readonly string[],
  shade: Shade,
): Departure[] {
  return signatureSlots.flatMap((slot) => {
    const anchor = Object.hasOwn(anchors, slot) ? anchors[slot] : undefined

    if (anchor === undefined) return []

    const [part, value] = anchor
    const measured = value.toLowerCase()
    const final = slotOf(shade, slot)
    const delta = deltaE(measured, final)
    const shift = hueShift(measured, final)

    return [
      {
        slot,
        part,
        measured,
        final,
        delta,
        shift,
        far: HELD.has(slot) && delta > DEPARTURE_MAX,
        turned: shift !== undefined && Math.abs(shift) > HUE_MAX,
      },
    ]
  })
}
