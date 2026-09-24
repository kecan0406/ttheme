import { contrast, type Hex, luminance, type Oklch, oklch, ratio } from './color.ts'
import type { Theme } from './theme.ts'

const BODY_MIN = 7
const ACCENT_MIN = 3
const ANSI0_MAX_LUMINANCE = 0.15
const ANSI8_MIN = 1.6

const ACCENT_SLOTS = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14]
const LIGHT_SLOTS = [7, 15]
export const ROLES = [1, 2, 3, 4, 5, 6]

export const ROLE_HUES: Record<number, { name: string; center: number; width: number }> = {
  1: { name: 'red', center: 19, width: 25 },
  2: { name: 'green', center: 132, width: 35 },
  3: { name: 'yellow', center: 88, width: 35 },
  4: { name: 'blue', center: 250, width: 60 },
  5: { name: 'magenta', center: 329, width: 40 },
  6: { name: 'cyan', center: 197, width: 60 },
}
export const ACHROMATIC = 0.03
export const BRIGHT_GAP = 25
export const DISTINCT_HUE = 15
export const DISTINCT_LIGHTNESS = 0.08

export interface Violation {
  theme: string
  rule: string
  detail: string
}

export type Readable = Pick<Theme, 'name' | 'background' | 'foreground' | 'ansi' | 'waive'> &
  Partial<Pick<Theme, 'selectionBackground'>>

export type Gated = Readable & Pick<Theme, 'signatureSlots'>

export interface GateRule {
  rule: string
  label: string
  unit: 'ratio' | 'luminance' | 'degrees' | 'pairs'
  min?: number
  max?: number
}

interface Check<T extends Readable = Readable> extends GateRule {
  measure(theme: T): number
  check(theme: T): string[]
}

function at(theme: Readable, index: number): Hex {
  const color = theme.ansi[index]
  if (color === undefined) throw new Error(`${theme.name}: missing ANSI ${index}`)
  return color
}

function belowMin(theme: Readable, indices: number[], min: number): string[] {
  const bg = theme.background
  return indices.flatMap((i) => {
    const color = at(theme, i)
    return contrast(color, bg) < min ? [`ANSI ${i} ${color} on ${bg} is ${ratio(color, bg)}:1, needs ${min}:1`] : []
  })
}

function weakest(theme: Readable, indices: number[]): number {
  return Math.min(...indices.map((i) => contrast(at(theme, i), theme.background)))
}

const READABILITY: Check[] = [
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
  {
    rule: 'selection',
    label: 'foreground on selection',
    unit: 'ratio',
    min: BODY_MIN,
    measure: ({ foreground, selectionBackground }) =>
      selectionBackground === undefined ? Number.NaN : contrast(foreground, selectionBackground),
    check: ({ foreground, selectionBackground }) =>
      selectionBackground !== undefined && contrast(foreground, selectionBackground) < BODY_MIN
        ? [
            `foreground ${foreground} on selection ${selectionBackground} is ${ratio(foreground, selectionBackground)}:1, needs ${BODY_MIN}:1`,
          ]
        : [],
  },
]

export function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

export const roleOf = (slot: number) => (slot > 8 ? slot - 8 : slot)

export function exemptSlots(theme: Pick<Theme, 'signatureSlots'>): Set<number> {
  const own = theme.signatureSlots.filter((s) => s.startsWith('ansi')).map((s) => Number(s.slice(4)))
  return new Set(own.flatMap((s) => (ROLES.includes(roleOf(s)) ? [s, s > 8 ? s - 8 : s + 8] : [s])))
}

function chromatic(theme: Readable, slot: number): Oklch | undefined {
  const color = oklch(at(theme, slot))
  return color.c < ACHROMATIC ? undefined : color
}

export function offRole(theme: Gated): { slot: number; hue: number; over: number }[] {
  const exempt = exemptSlots(theme)
  return ACCENT_SLOTS.flatMap((slot) => {
    const color = chromatic(theme, slot)
    const band = ROLE_HUES[roleOf(slot)]
    if (color === undefined || band === undefined || exempt.has(slot)) return []
    const over = hueGap(color.h, band.center) - band.width
    return over > 0 ? [{ slot, hue: color.h, over }] : []
  })
}

export function brightDrift(theme: Gated): { normal: number; gap: number }[] {
  const own = new Set(theme.signatureSlots)
  return ROLES.flatMap((normal) => {
    const n = chromatic(theme, normal)
    const b = chromatic(theme, normal + 8)
    if (n === undefined || b === undefined || (own.has(`ansi${normal}`) && own.has(`ansi${normal + 8}`))) return []
    return [{ normal, gap: hueGap(n.h, b.h) }]
  })
}

export function lookalikes(theme: Gated): [number, number][] {
  const exempt = exemptSlots(theme)
  return [0, 8].flatMap((base) =>
    ROLES.flatMap((i) =>
      ROLES.filter((j) => j > i).flatMap((j): [number, number][] => {
        const [a, b] = [base + i, base + j]
        const x = chromatic(theme, a)
        const y = chromatic(theme, b)
        if (x === undefined || y === undefined || (exempt.has(a) && exempt.has(b))) return []
        return hueGap(x.h, y.h) < DISTINCT_HUE && Math.abs(x.l - y.l) < DISTINCT_LIGHTNESS ? [[a, b]] : []
      }),
    ),
  )
}

const ROLE_CHECKS: Check<Gated>[] = [
  {
    rule: 'ansi-role',
    label: 'accent hue outside its ANSI role',
    unit: 'degrees',
    max: 0,
    measure: (theme) => Math.max(0, ...offRole(theme).map((o) => o.over)),
    check: (theme) =>
      offRole(theme).map(({ slot, hue, over }) => {
        const band = ROLE_HUES[roleOf(slot)] as { name: string; center: number; width: number }
        return `ANSI ${slot} ${at(theme, slot)} has hue ${hue.toFixed(0)}°, ${over.toFixed(0)}° outside ${band.name} (${band.center}±${band.width}°)`
      }),
  },
  {
    rule: 'bright-follows',
    label: 'widest normal to bright hue gap',
    unit: 'degrees',
    max: BRIGHT_GAP,
    measure: (theme) => Math.max(0, ...brightDrift(theme).map((d) => d.gap)),
    check: (theme) =>
      brightDrift(theme)
        .filter((d) => d.gap > BRIGHT_GAP)
        .map(
          ({ normal, gap }) => `ANSI ${normal + 8} is ${gap.toFixed(0)}° from ANSI ${normal}, needs <= ${BRIGHT_GAP}°`,
        ),
  },
  {
    rule: 'distinct',
    label: 'accent pairs that read as one color',
    unit: 'pairs',
    max: 0,
    measure: (theme) => lookalikes(theme).length,
    check: (theme) =>
      lookalikes(theme).map(
        ([a, b]) =>
          `ANSI ${a} ${at(theme, a)} and ANSI ${b} ${at(theme, b)} are within ${DISTINCT_HUE}° hue and ${DISTINCT_LIGHTNESS} lightness`,
      ),
  },
]

const CHECKS: Check<Gated>[] = [...READABILITY, ...ROLE_CHECKS]

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

function run<T extends Readable>(checks: Check<T>[], theme: T): Violation[] {
  return checks
    .filter((c) => !theme.waive.includes(c.rule))
    .flatMap((c) => c.check(theme).map((detail) => ({ theme: theme.name, rule: c.rule, detail })))
}

export function check(theme: Gated): Violation[] {
  return run(CHECKS, theme)
}

export function checkReadability(theme: Readable): Violation[] {
  return run(READABILITY, theme)
}

export function checkAll(themes: Theme[]): Violation[] {
  return themes.flatMap(check)
}
