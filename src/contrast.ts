import { contrast, type Hex, luminance, ratio } from './color.ts'
import type { Theme } from './theme.ts'

const BODY_MIN = 7
const ACCENT_MIN = 3
const ANSI0_MAX_LUMINANCE = 0.15
const ANSI8_MIN = 1.6

const ACCENT_SLOTS = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14]
const LIGHT_SLOTS = [7, 15]

export interface Violation {
  theme: string
  rule: string
  detail: string
}

export type Gated = Pick<Theme, 'name' | 'background' | 'foreground' | 'ansi' | 'waive'>

export interface GateRule {
  rule: string
  label: string
  unit: 'ratio' | 'luminance'
  min?: number
  max?: number
}

interface Check extends GateRule {
  measure(theme: Gated): number
  check(theme: Gated): string[]
}

function at(theme: Gated, index: number): Hex {
  const color = theme.ansi[index]
  if (color === undefined) throw new Error(`${theme.name}: missing ANSI ${index}`)
  return color
}

function belowMin(theme: Gated, indices: number[], min: number): string[] {
  const bg = theme.background
  return indices.flatMap((i) => {
    const color = at(theme, i)
    return contrast(color, bg) < min ? [`ANSI ${i} ${color} on ${bg} is ${ratio(color, bg)}:1, needs ${min}:1`] : []
  })
}

function weakest(theme: Gated, indices: number[]): number {
  return Math.min(...indices.map((i) => contrast(at(theme, i), theme.background)))
}

const CHECKS: Check[] = [
  {
    rule: 'foreground',
    label: 'foreground on background',
    unit: 'ratio',
    min: BODY_MIN,
    measure: ({ foreground, background }) => contrast(foreground, background),
    check: ({ foreground, background }) =>
      contrast(foreground, background) < BODY_MIN
        ? [`foreground ${foreground} on ${background} is ${ratio(foreground, background)}:1, needs ${BODY_MIN}:1`]
        : [],
  },
  {
    rule: 'accents',
    label: 'weakest accent on background',
    unit: 'ratio',
    min: ACCENT_MIN,
    measure: (theme) => weakest(theme, ACCENT_SLOTS),
    check: (theme) => belowMin(theme, ACCENT_SLOTS, ACCENT_MIN),
  },
  {
    rule: 'ansi0-dark',
    label: 'ansi0 luminance',
    unit: 'luminance',
    max: ANSI0_MAX_LUMINANCE,
    measure: (theme) => luminance(at(theme, 0)),
    check: (theme) => {
      const ansi0 = at(theme, 0)
      return luminance(ansi0) > ANSI0_MAX_LUMINANCE
        ? [`ANSI 0 ${ansi0} has luminance ${luminance(ansi0).toFixed(3)}, needs <= ${ANSI0_MAX_LUMINANCE}`]
        : []
    },
  },
  {
    rule: 'light-ansi',
    label: 'ansi7 and ansi15 on background',
    unit: 'ratio',
    min: BODY_MIN,
    measure: (theme) => weakest(theme, LIGHT_SLOTS),
    check: (theme) => belowMin(theme, LIGHT_SLOTS, BODY_MIN),
  },
  {
    rule: 'ansi8-visible',
    label: 'ansi8 on background',
    unit: 'ratio',
    min: ANSI8_MIN,
    measure: (theme) => contrast(at(theme, 8), theme.background),
    check: (theme) => belowMin(theme, [8], ANSI8_MIN),
  },
]

export const RULES = CHECKS.map((c) => c.rule)

export const GATE_RULES: GateRule[] = CHECKS.map(({ rule, label, unit, min, max }) => ({
  rule,
  label,
  unit,
  ...(min === undefined ? {} : { min }),
  ...(max === undefined ? {} : { max }),
}))

export function measure(theme: Gated): number[] {
  return CHECKS.map((c) => Math.round(c.measure(theme) * 1000) / 1000)
}

export function check(theme: Gated): Violation[] {
  return CHECKS.filter((c) => !theme.waive.includes(c.rule)).flatMap((c) =>
    c.check(theme).map((detail) => ({ theme: theme.name, rule: c.rule, detail })),
  )
}

export function checkAll(themes: Theme[]): Violation[] {
  return themes.flatMap(check)
}
