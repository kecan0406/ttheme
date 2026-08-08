import { contrast, type Hex, luminance, ratio } from './color.ts'
import type { Theme } from './theme.ts'

const BODY_MIN = 7
const ACCENT_MIN = 3
const ANSI0_MAX_LUMINANCE = 0.15
const ANSI8_MIN = 1.6

export interface Violation {
  theme: string
  rule: string
  detail: string
}

function at(theme: Theme, index: number): Hex {
  const color = theme.ansi[index]
  if (color === undefined) throw new Error(`${theme.name}: missing ANSI ${index}`)
  return color
}

function belowMin(theme: Theme, indices: number[], min: number): string[] {
  const bg = theme.background
  return indices.flatMap((i) => {
    const color = at(theme, i)
    return contrast(color, bg) < min ? [`ANSI ${i} ${color} on ${bg} is ${ratio(color, bg)}:1, needs ${min}:1`] : []
  })
}

const CHECKS: { rule: string; check(theme: Theme): string[] }[] = [
  {
    rule: 'foreground',
    check: ({ foreground, background }) =>
      contrast(foreground, background) < BODY_MIN
        ? [`foreground ${foreground} on ${background} is ${ratio(foreground, background)}:1, needs ${BODY_MIN}:1`]
        : [],
  },
  {
    rule: 'accents',
    check: (theme) => belowMin(theme, [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14], ACCENT_MIN),
  },
  {
    rule: 'ansi0-dark',
    check: (theme) => {
      const ansi0 = at(theme, 0)
      return luminance(ansi0) > ANSI0_MAX_LUMINANCE
        ? [`ANSI 0 ${ansi0} has luminance ${luminance(ansi0).toFixed(3)}, needs <= ${ANSI0_MAX_LUMINANCE}`]
        : []
    },
  },
  {
    rule: 'light-ansi',
    check: (theme) => belowMin(theme, [7, 15], BODY_MIN),
  },
  {
    rule: 'ansi8-visible',
    check: (theme) => belowMin(theme, [8], ANSI8_MIN),
  },
]

export const RULES = CHECKS.map((c) => c.rule)

export function check(theme: Theme): Violation[] {
  return CHECKS.filter((c) => !theme.waive.includes(c.rule)).flatMap((c) =>
    c.check(theme).map((detail) => ({ theme: theme.name, rule: c.rule, detail })),
  )
}

export function checkAll(themes: Theme[]): Violation[] {
  return themes.flatMap(check)
}
