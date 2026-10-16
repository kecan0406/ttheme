import { argbFromHex, Hct, hexFromArgb } from '@material/material-color-utilities'
import { type Hex, lab } from './color.ts'
import { apart, check } from './contrast.ts'
import { fixRoles, type Move } from './fix.ts'
import { type Mode, modeOf, otherOf } from './mode.ts'
import type { Shade, Theme } from './theme.ts'

type Mirrored = Shade & Pick<Theme, 'name' | 'signatureSlots' | 'waive'>

type Band = { min: number; max: number }

export interface Mirroring {
  shade: Shade
  moves: Move[]
}

export const TONES: Record<Mode, readonly number[]> = {
  dark: [14, 62, 78, 76, 62, 72, 70, 85, 50, 74, 88, 88, 70, 84, 80, 94],
  light: [96, 42, 34, 42, 42, 34, 34, 18, 50, 36, 28, 36, 36, 28, 28, 12],
}

export const SURFACE_TONE: Record<Mode, number> = { dark: 8, light: 98 }
export const TEXT_TONE: Record<Mode, number> = { dark: 90, light: 12 }
export const SELECTION_TONE: Record<Mode, number> = { dark: 26, light: 86 }

export const CURSOR_TONE: Record<Mode, Band> = {
  dark: { min: 43, max: 84 },
  light: { min: 36, max: 56 },
}

export const CONTAINER_TONE: Record<Mode, Band> = {
  dark: { min: 16, max: 30 },
  light: { min: 70, max: 90 },
}

export const SURFACE_CHROMA = 8
export const TEXT_CHROMA = 12
export const SELECTION_CHROMA = 24
export const SIGNATURE_TEXT_CHROMA = 24

const NEUTRALS = new Set([0, 7, 8])

const STEP = 0.5

const hct = (hex: Hex) => Hct.fromInt(argbFromHex(hex))

const make = (hue: number, chroma: number, tone: number): Hex =>
  hexFromArgb(Hct.from(hue, chroma, tone).toInt()).toLowerCase()

const clamp = (v: number, band: Band) => Math.max(band.min, Math.min(band.max, v))

const across = (tone: number, from: Band, to: Band) =>
  to.max - ((clamp(tone, from) - from.min) * (to.max - to.min)) / (from.max - from.min)

const own = (value: Hex, tone: number, chroma = Number.POSITIVE_INFINITY) => {
  const o = hct(value)

  return make(o.hue, Math.min(o.chroma, chroma), tone)
}

const NAMED = new Map<string, Exclude<keyof Shade, 'ansi'>>([
  ['background', 'background'],
  ['foreground', 'foreground'],
  ['cursor', 'cursor'],
  ['selection', 'selectionBackground'],
])

function slotOf(shade: Shade, slot: string): Hex {
  const named = NAMED.get(slot)

  return named === undefined ? (shade.ansi[Number(slot.slice(4))] as Hex) : shade[named]
}

function crossed(theme: Mirrored) {
  const from = modeOf(theme)
  const band = CURSOR_TONE[otherOf(from)]

  return { band, tone: across(hct(theme.cursor).tone, CURSOR_TONE[from], band) }
}

function flip(theme: Mirrored): Shade {
  const to = otherOf(modeOf(theme))
  const seed = hct(slotOf(theme, theme.signatureSlots[0] as string))
  const surface = (tone: number) => make(seed.hue, Math.min(seed.chroma, SURFACE_CHROMA), tone)
  const text = (tone: number) => make(seed.hue, Math.min(seed.chroma, TEXT_CHROMA), tone)

  const flipped = (value: Hex) => 100 - hct(value).tone

  return {
    background: surface(SURFACE_TONE[to]),
    foreground: theme.signatureSlots.includes('foreground')
      ? own(theme.foreground, TEXT_TONE[to], SIGNATURE_TEXT_CHROMA)
      : text(TEXT_TONE[to]),
    cursor: own(theme.cursor, crossed(theme).tone),
    selectionBackground: theme.signatureSlots.includes('selection')
      ? own(theme.selectionBackground, clamp(flipped(theme.selectionBackground), CONTAINER_TONE[to]))
      : own(theme.selectionBackground, SELECTION_TONE[to], SELECTION_CHROMA),
    ansi: theme.ansi.map((value, i) => {
      const tone = TONES[to][i] as number

      if (NEUTRALS.has(i)) return surface(tone)

      if (i === 15) return text(tone)

      return own(value, tone)
    }),
  }
}

function placed(theme: Mirrored, shade: Shade): Hex {
  const others = theme.signatureSlots.flatMap((slot) => (slot === 'cursor' ? [] : [lab(slotOf(shade, slot))]))
  const reads = (color: Hex) => others.every((other) => apart(lab(color), other) >= 1)

  if (!theme.signatureSlots.includes('cursor') || reads(shade.cursor)) return shade.cursor

  const { band, tone: start } = crossed(theme)

  for (let k = 1; k * STEP <= band.max - band.min; k++) {
    for (const tone of [start - k * STEP, start + k * STEP]) {
      const color = own(theme.cursor, tone)

      if (tone >= band.min && tone <= band.max && reads(color)) return color
    }
  }

  return shade.cursor
}

function fixed(theme: Mirrored, shade: Shade): Mirroring {
  const gated = { ...theme, ...shade }

  if (check(gated).length === 0) return { shade, moves: [] }

  const { theme: turned, moves } = fixRoles(gated)

  return { shade: { ...shade, ansi: turned.ansi }, moves }
}

export function mirrored(theme: Mirrored): Mirroring {
  const { shade, moves } = fixed(theme, flip(theme))

  return { shade: { ...shade, cursor: placed(theme, shade) }, moves }
}

export const mirror = (theme: Mirrored): Shade => mirrored(theme).shade
