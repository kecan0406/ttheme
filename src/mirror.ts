import { argbFromHex, Hct, hexFromArgb } from '@material/material-color-utilities'
import type { Hex } from './color.ts'
import { check, isLight } from './contrast.ts'
import { fixRoles, type Move } from './fix.ts'
import type { Theme } from './theme.ts'

export type Mode = 'dark' | 'light'

export const MODES: readonly Mode[] = ['dark', 'light']

export type Shade = Pick<Theme, 'background' | 'foreground' | 'cursor' | 'selectionBackground' | 'ansi'>

type Mirrored = Shade & Pick<Theme, 'name' | 'signatureSlots' | 'waive'>

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

export const CURSOR_TONE: Record<Mode, { min: number; max: number }> = {
  dark: { min: 43, max: 84 },
  light: { min: 36, max: 56 },
}

export const CONTAINER_TONE: Record<Mode, { min: number; max: number }> = {
  dark: { min: 16, max: 30 },
  light: { min: 70, max: 90 },
}

export const SURFACE_CHROMA = 8
export const TEXT_CHROMA = 12
export const SELECTION_CHROMA = 24
export const SIGNATURE_TEXT_CHROMA = 24

const NEUTRALS = new Set([0, 7, 8])

const hct = (hex: Hex) => Hct.fromInt(argbFromHex(hex))

const make = (hue: number, chroma: number, tone: number): Hex =>
  hexFromArgb(Hct.from(hue, chroma, tone).toInt()).toLowerCase()

const clamp = (v: number, band: { min: number; max: number }) => Math.max(band.min, Math.min(band.max, v))

export const modeOf = (shade: Pick<Theme, 'background' | 'foreground'>): Mode => (isLight(shade) ? 'light' : 'dark')

export const otherOf = (mode: Mode): Mode => (mode === 'dark' ? 'light' : 'dark')

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

function flip(theme: Mirrored): Shade {
  const to = otherOf(modeOf(theme))
  const seed = hct(slotOf(theme, theme.signatureSlots[0] as string))
  const surface = (tone: number) => make(seed.hue, Math.min(seed.chroma, SURFACE_CHROMA), tone)
  const text = (tone: number) => make(seed.hue, Math.min(seed.chroma, TEXT_CHROMA), tone)

  const own = (value: Hex, tone: number, chroma = Number.POSITIVE_INFINITY) => {
    const o = hct(value)

    return make(o.hue, Math.min(o.chroma, chroma), tone)
  }

  const flipped = (value: Hex) => 100 - hct(value).tone

  return {
    background: surface(SURFACE_TONE[to]),
    foreground: theme.signatureSlots.includes('foreground')
      ? own(theme.foreground, TEXT_TONE[to], SIGNATURE_TEXT_CHROMA)
      : text(TEXT_TONE[to]),
    cursor: own(theme.cursor, clamp(flipped(theme.cursor), CURSOR_TONE[to])),
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

export function mirrored(theme: Mirrored): Mirroring {
  const shade = flip(theme)
  const gated = { ...theme, ...shade }

  if (check(gated).length === 0) return { shade, moves: [] }

  const { theme: fixed, moves } = fixRoles(gated)

  return { shade: { ...shade, ansi: fixed.ansi }, moves }
}

export const mirror = (theme: Mirrored): Shade => mirrored(theme).shade
