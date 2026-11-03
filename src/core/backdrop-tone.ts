import { type Hex, luminance, luminanceOf, mix, mixOf, rgb, rgbOf } from './color.ts'
import { isLight, readabilityFails, sheetOf } from './contrast.ts'
import { FACE } from './slots.ts'

const FAINT = 0.1

const PEAK = luminance(mix('#19161e', '#9b86c8', 0.2))

const FLOOR = luminance(mix('#ede6f2', '#675491', 0.2))

export interface Colors {
  name: string
  background: Hex
  foreground: Hex
  cursor: Hex
  selection?: Hex
  ansi: Hex[]
}

export interface Tone {
  slot: string
  color: Hex
  cap: number
  matched: number
  opacity: number
  reach: number
}

export type Hue = Pick<Tone, 'color' | 'opacity'>

export type Coloring = 'tone' | 'original'

function slotColor(colors: Colors, slot: string): Hex {
  if (slot === 'background' || slot === 'foreground' || slot === 'cursor') {
    return colors[slot]
  }

  if (slot === 'selection' && colors.selection) {
    return colors.selection
  }

  const match = /^ansi(\d|1[0-5])$/.exec(slot)
  const color = match ? colors.ansi[Number(match[1])] : undefined

  if (!color) {
    throw new Error(`${colors.name} has no color ${slot}`)
  }

  return color
}

function highest(ok: (o: number) => boolean): number {
  if (ok(1)) {
    return 1
  }

  let lo = 0
  let hi = 1

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2

    if (ok(mid)) {
      lo = mid
    } else {
      hi = mid
    }
  }

  return lo
}

function fade(colors: Colors, color: Hex) {
  const sheet = sheetOf(
    { name: colors.name, background: colors.background, foreground: colors.foreground, ansi: colors.ansi },
    false,
  )

  const under = rgbOf(colors.background)
  const over = rgbOf(color)
  const misses = (o: number) => readabilityFails(sheet, luminanceOf(mixOf(under, over, o)))
  const already = misses(0)
  const cap = highest((o) => (misses(o) & ~already) === 0)
  const light = isLight(colors)

  const matched = highest((o) =>
    light ? luminanceOf(mixOf(under, over, o)) >= FLOOR : luminanceOf(mixOf(under, over, o)) <= PEAK,
  )

  return { cap, matched, opacity: Math.floor(Math.min(cap, matched) * 100) / 100 }
}

export function toneFor(colors: Colors, slot: string): Tone {
  const color = slotColor(colors, slot)
  const { cap, matched, opacity } = fade(colors, color)
  const bg = rgb(colors.background)
  const reach = Math.hypot(...rgb(color).map((c, i) => (c - (bg[i] ?? 0)) * opacity))

  return { slot, color, cap, matched, opacity, reach }
}

export function originalOpacity(colors: Colors, peak: Hex): number {
  return fade(colors, peak).opacity
}

export function backdropTone(colors: Colors): Tone {
  const cursor = toneFor(colors, 'cursor')

  if (cursor.opacity >= FAINT) {
    return cursor
  }

  return FACE.flatMap((slot) =>
    slot === 'cursor' || (slot === 'selection' && !colors.selection) ? [] : [toneFor(colors, slot)],
  ).reduce((best, tone) => (tone.reach > best.reach ? tone : best), cursor)
}
