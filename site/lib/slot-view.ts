import type { GateRule } from '@/lib/themes'
import type { GateLine, SlotView } from '@/lib/view-types'
import type { Hex } from '../../src/core/color.ts'
import { GATE_RULES, measure, missedRules } from '../../src/core/contrast.ts'
import { inGamut } from '../../src/core/fix.ts'
import { PLANE_BOTTOM, PLANE_TOP, RAINBOW_C, RAINBOW_L, reach, shareOf } from '../../src/core/plane.ts'
import {
  colorText,
  gatedOf,
  lchIn,
  lchTight,
  ruleSlots,
  SLOT_NAMES,
  slotChecks,
  slotLabel,
  slotUse,
} from '../../src/core/slots.ts'

export const PLANE_ROWS = 40

const HUE_STOPS = 24

export const RULES: GateRule[] = GATE_RULES

const round = (value: number, digits: number) => Number(value.toFixed(digits))

export function hueTrack(): string {
  const stops = Array.from({ length: HUE_STOPS + 1 }, (_, i) => {
    const along = i / HUE_STOPS

    return `${inGamut(RAINBOW_L, RAINBOW_C, along * 360)} ${round(along * 100, 2)}%`
  })

  return `linear-gradient(90deg, ${stops.join(', ')})`
}

const LEVELS = Array.from(
  { length: PLANE_ROWS },
  (_, row) => PLANE_TOP - (row / (PLANE_ROWS - 1)) * (PLANE_TOP - PLANE_BOTTOM),
)

export function slotViewOf(list: Hex[], missed: ReadonlySet<number>, slot: number, uses: number[]): SlotView {
  const hex = list[slot] as Hex
  const at = lchIn(list, hex)
  const key = SLOT_NAMES[slot] as string
  const [l = '', c = '', h = ''] = lchTight(at).trim().split(/\s+/)

  return {
    key,
    name: slotLabel(slot).name,
    hex,
    formats: { hex, rgb: colorText('rgb', hex, at), oklch: colorText('oklch', hex, at) },
    lch: [l, c, h],
    hue: round(at.h, 1),
    edges: LEVELS.map((level) => round(reach(level, at.h), 4)),
    x: round(shareOf(at.l, at.c, at.h), 4),
    y: round(Math.min(1, Math.max(0, (PLANE_TOP - at.l) / (PLANE_TOP - PLANE_BOTTOM))), 4),
    along: round(at.h / 360, 4),
    checks: slotChecks(list, slot).map((check) => ({ ok: check.ok ?? null, text: check.text })),
    use: slotUse(slot),
    uses,
    miss: missed.has(slot),
  }
}

export function gateLinesOf(list: Hex[]): GateLine[] {
  const theme = gatedOf(list)
  const values = measure(theme)
  const missed = new Set(missedRules(theme).map((rule) => rule.rule))

  return RULES.map((rule, i): GateLine => {
    const value = values[i] ?? Number.NaN
    const ok = !missed.has(rule.rule)

    return { rule, value, ok, slots: ok ? [] : ruleSlots(list, rule.rule) }
  })
}
