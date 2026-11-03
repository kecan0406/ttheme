import { contrastOf, deuteranopeInto, type Hex, labInto, luminanceOf, oklchInto, rgbOf } from './color.ts'
import type { Theme } from './theme.ts'

export const BODY_MIN = 7
export const ACCENT_MIN = 4.5
export const ANSI0_MAX_LUMINANCE = 0.15
export const ANSI8_MIN = 3
export const ON_ACCENT_MIN = 4.5
export const CURSOR_MIN = 4.5
export const ANSI7_ON_ANSI8_MIN = 3

export const ACCENT_SLOTS = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14]
const LIGHT_SLOTS = [7, 15]
export const ROLES = [1, 2, 3, 4, 5, 6]

export const ROLE_HUES = new Map([
  [1, { name: 'red', center: 19, width: 25 }],
  [2, { name: 'green', center: 132, width: 35 }],
  [3, { name: 'yellow', center: 88, width: 35 }],
  [4, { name: 'blue', center: 250, width: 60 }],
  [5, { name: 'magenta', center: 329, width: 40 }],
  [6, { name: 'cyan', center: 197, width: 60 }],
])

export const ACHROMATIC = 0.03
export const BRIGHT_GAP = 25

const TEXT_DEGREES = 1 / 3
const OBSERVERS = 0.5

const NOTICEABLE = {
  l: OBSERVERS * (10.16 + 1.5 / TEXT_DEGREES),
  a: OBSERVERS * (10.68 + 3.08 / TEXT_DEGREES),
  b: OBSERVERS * (10.7 + 5.74 / TEXT_DEGREES),
}

const RED_GREEN: [number, number][] = [
  [1, 2],
  [9, 10],
]

interface Violation {
  theme: string
  rule: string
  detail: string
}

export type Readable = Pick<Theme, 'name' | 'background' | 'foreground' | 'ansi'> &
  Partial<Pick<Theme, 'selectionBackground' | 'cursor'>>

export interface GateRule {
  rule: string
  label: string
  unit: 'ratio' | 'luminance' | 'degrees' | 'pairs'
  min?: number
  max?: number
}

const BG = 16
const FG = 17
const CURSOR = 18
const SELECTION = 19

export interface Sheet {
  rgb: Int32Array
  lum: Float64Array
  ok: Float64Array
  lab: Float64Array
  deut: Float64Array
}

export function sheetOf(theme: Readable, full = true): Sheet {
  const rgb = new Int32Array(20)
  const lum = new Float64Array(20)
  const ok = new Float64Array(48)
  const lab = new Float64Array(48)
  const deut = new Float64Array(48)

  for (let i = 0; i < 16; i++) {
    const color = theme.ansi[i]

    if (color === undefined) throw new Error(`${theme.name}: missing ANSI ${i}`)

    const n = rgbOf(color)
    rgb[i] = n
    lum[i] = luminanceOf(n)

    if (full) {
      oklchInto(n, ok, i * 3)
      labInto(n, lab, i * 3)
    }
  }

  if (full) {
    for (const [red, green] of RED_GREEN) {
      deuteranopeInto(rgb[red] as number, deut, red * 3)
      deuteranopeInto(rgb[green] as number, deut, green * 3)
    }
  }

  const named = [theme.background, theme.foreground, theme.cursor, theme.selectionBackground]

  for (let k = 0; k < 4; k++) {
    const color = named[k]

    if (color === undefined) {
      rgb[BG + k] = -1
      lum[BG + k] = Number.NaN
    } else {
      const n = rgbOf(color)
      rgb[BG + k] = n
      lum[BG + k] = luminanceOf(n)
    }
  }

  return { rgb, lum, ok, lab, deut }
}

const ratioOf = (s: Sheet, a: number, b: number) => contrastOf(s.lum[a] as number, s.lum[b] as number)

const shownRatio = (s: Sheet, a: number, b: number) => Math.round(ratioOf(s, a, b) * 100) / 100

const lightSheet = (s: Sheet) => (s.lum[BG] as number) > (s.lum[FG] as number)

function weakestOf(s: Sheet, indices: readonly number[]): number {
  let weakest = Number.POSITIVE_INFINITY

  for (const i of indices) {
    const r = ratioOf(s, i, BG)

    if (r < weakest) weakest = r
  }

  return weakest
}

function belowMin(theme: Readable, s: Sheet, indices: readonly number[], min: number): string[] {
  const bg = theme.background

  return indices.flatMap((i) => {
    const color = theme.ansi[i] as Hex

    return ratioOf(s, i, BG) < min ? [`ANSI ${i} ${color} on ${bg} is ${shownRatio(s, i, BG)}:1, needs ${min}:1`] : []
  })
}

export function isLight(theme: Pick<Readable, 'background' | 'foreground'>): boolean {
  return luminanceOf(rgbOf(theme.background)) > luminanceOf(rgbOf(theme.foreground))
}

export function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360

  return Math.min(d, 360 - d)
}

export const roleOf = (slot: number) => (slot > 8 ? slot - 8 : slot)

const chromaticAt = (s: Sheet, slot: number) => (s.ok[slot * 3 + 1] as number) >= ACHROMATIC

function offRoleOf(s: Sheet): { slot: number; hue: number; over: number }[] {
  const found: { slot: number; hue: number; over: number }[] = []

  for (const slot of ACCENT_SLOTS) {
    const band = ROLE_HUES.get(roleOf(slot))

    if (!chromaticAt(s, slot) || band === undefined) continue

    const hue = s.ok[slot * 3 + 2] as number
    const over = hueGap(hue, band.center) - band.width

    if (over > 0) found.push({ slot, hue, over })
  }

  return found
}

function brightDriftOf(s: Sheet): { normal: number; gap: number }[] {
  const found: { normal: number; gap: number }[] = []

  for (const normal of ROLES) {
    if (chromaticAt(s, normal) && chromaticAt(s, normal + 8)) {
      found.push({ normal, gap: hueGap(s.ok[normal * 3 + 2] as number, s.ok[(normal + 8) * 3 + 2] as number) })
    }
  }

  return found
}

export function apartAt(x: Float64Array, i: number, y: Float64Array, j: number): number {
  return Math.max(
    Math.abs((x[i] as number) - (y[j] as number)) / NOTICEABLE.l,
    Math.abs((x[i + 1] as number) - (y[j + 1] as number)) / NOTICEABLE.a,
    Math.abs((x[i + 2] as number) - (y[j + 2] as number)) / NOTICEABLE.b,
  )
}

export function apart(x: { l: number; a: number; b: number }, y: { l: number; a: number; b: number }): number {
  return Math.max(
    Math.abs(x.l - y.l) / NOTICEABLE.l,
    Math.abs(x.a - y.a) / NOTICEABLE.a,
    Math.abs(x.b - y.b) / NOTICEABLE.b,
  )
}

function lookalikesOf(s: Sheet): [number, number][] {
  const found: [number, number][] = []

  for (const base of [0, 8]) {
    for (const i of ROLES) {
      for (const j of ROLES) {
        if (j > i && apartAt(s.lab, (base + i) * 3, s.lab, (base + j) * 3) < 1) found.push([base + i, base + j])
      }
    }
  }

  return found
}

function confusionsOf(s: Sheet): [number, number][] {
  return RED_GREEN.filter(([red, green]) => apartAt(s.deut, red * 3, s.deut, green * 3) < 1)
}

export const offRole = (theme: Readable) => offRoleOf(sheetOf(theme))

export const brightDrift = (theme: Readable) => brightDriftOf(sheetOf(theme))

export const lookalikes = (theme: Readable) => lookalikesOf(sheetOf(theme))

export const confusions = (theme: Readable) => confusionsOf(sheetOf(theme))

interface Check extends GateRule {
  measure(s: Sheet): number
  fails(s: Sheet): boolean
  details(theme: Readable, s: Sheet): string[]
}

const READABILITY: Check[] = [
  {
    rule: 'foreground',
    label: 'foreground on background',
    unit: 'ratio',
    min: BODY_MIN,
    measure: (s) => ratioOf(s, FG, BG),
    fails: (s) => ratioOf(s, FG, BG) < BODY_MIN,
    details: ({ foreground, background }, s) =>
      ratioOf(s, FG, BG) < BODY_MIN
        ? [`foreground ${foreground} on ${background} is ${shownRatio(s, FG, BG)}:1, needs ${BODY_MIN}:1`]
        : [],
  },
  {
    rule: 'accents',
    label: 'weakest accent on background',
    unit: 'ratio',
    min: ACCENT_MIN,
    measure: (s) => weakestOf(s, ACCENT_SLOTS),
    fails: (s) => weakestOf(s, ACCENT_SLOTS) < ACCENT_MIN,
    details: (theme, s) => belowMin(theme, s, ACCENT_SLOTS, ACCENT_MIN),
  },
  {
    rule: 'ansi0-dark',
    label: 'ansi0 luminance',
    unit: 'luminance',
    max: ANSI0_MAX_LUMINANCE,
    measure: (s) => (lightSheet(s) ? Number.NaN : (s.lum[0] as number)),
    fails: (s) => !lightSheet(s) && (s.lum[0] as number) > ANSI0_MAX_LUMINANCE,
    details: (theme, s) =>
      !lightSheet(s) && (s.lum[0] as number) > ANSI0_MAX_LUMINANCE
        ? [`ANSI 0 ${theme.ansi[0]} has luminance ${(s.lum[0] as number).toFixed(3)}, needs <= ${ANSI0_MAX_LUMINANCE}`]
        : [],
  },
  {
    rule: 'light-ansi',
    label: 'ansi7 and ansi15 on background',
    unit: 'ratio',
    min: BODY_MIN,
    measure: (s) => weakestOf(s, LIGHT_SLOTS),
    fails: (s) => weakestOf(s, LIGHT_SLOTS) < BODY_MIN,
    details: (theme, s) => belowMin(theme, s, LIGHT_SLOTS, BODY_MIN),
  },
  {
    rule: 'ansi8-visible',
    label: 'ansi8 on background',
    unit: 'ratio',
    min: ANSI8_MIN,
    measure: (s) => ratioOf(s, 8, BG),
    fails: (s) => ratioOf(s, 8, BG) < ANSI8_MIN,
    details: (theme, s) => belowMin(theme, s, [8], ANSI8_MIN),
  },
  {
    rule: 'selection',
    label: 'foreground on selection',
    unit: 'ratio',
    min: BODY_MIN,
    measure: (s) => ((s.rgb[SELECTION] as number) < 0 ? Number.NaN : ratioOf(s, FG, SELECTION)),
    fails: (s) => (s.rgb[SELECTION] as number) >= 0 && ratioOf(s, FG, SELECTION) < BODY_MIN,
    details: ({ foreground, selectionBackground }, s) =>
      selectionBackground !== undefined && ratioOf(s, FG, SELECTION) < BODY_MIN
        ? [
            `foreground ${foreground} on selection ${selectionBackground} is ${shownRatio(s, FG, SELECTION)}:1, needs ${BODY_MIN}:1`,
          ]
        : [],
  },
]

const ROLE_CHECKS: Check[] = [
  {
    rule: 'ansi-role',
    label: 'accent hue outside its ANSI role',
    unit: 'degrees',
    max: 0,
    measure: (s) => Math.max(0, ...offRoleOf(s).map((o) => o.over)),
    fails: (s) => offRoleOf(s).length > 0,
    details: (theme, s) =>
      offRoleOf(s).map(({ slot, hue, over }) => {
        const band = ROLE_HUES.get(roleOf(slot)) as { name: string; center: number; width: number }

        return `ANSI ${slot} ${theme.ansi[slot]} has hue ${hue.toFixed(0)}°, ${over.toFixed(0)}° outside ${band.name} (${band.center}±${band.width}°)`
      }),
  },
  {
    rule: 'bright-follows',
    label: 'widest normal to bright hue gap',
    unit: 'degrees',
    max: BRIGHT_GAP,
    measure: (s) => Math.max(0, ...brightDriftOf(s).map((d) => d.gap)),
    fails: (s) => brightDriftOf(s).some((d) => d.gap > BRIGHT_GAP),
    details: (_, s) =>
      brightDriftOf(s)
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
    measure: (s) => lookalikesOf(s).length,
    fails: (s) => lookalikesOf(s).length > 0,
    details: (theme, s) =>
      lookalikesOf(s).map(
        ([a, b]) => `ANSI ${a} ${theme.ansi[a]} and ANSI ${b} ${theme.ansi[b]} read as one color at text size`,
      ),
  },
]

function onAccents(s: Sheet): number {
  let weakest = Number.POSITIVE_INFINITY

  for (const i of ROLES) {
    const r = ratioOf(s, 0, i)

    if (r < weakest) weakest = r
  }

  return weakest
}

const PAIR_CHECKS: Check[] = [
  {
    rule: 'ansi0-on-accents',
    label: 'ansi0 on the weakest accent',
    unit: 'ratio',
    min: ON_ACCENT_MIN,
    measure: onAccents,
    fails: (s) => onAccents(s) < ON_ACCENT_MIN,
    details: (theme, s) =>
      ROLES.flatMap((i) =>
        ratioOf(s, 0, i) < ON_ACCENT_MIN
          ? [
              `ANSI 0 ${theme.ansi[0]} on ANSI ${i} ${theme.ansi[i]} is ${shownRatio(s, 0, i)}:1, needs ${ON_ACCENT_MIN}:1`,
            ]
          : [],
      ),
  },
  {
    rule: 'ansi7-on-ansi8',
    label: 'ansi7 on ansi8',
    unit: 'ratio',
    min: ANSI7_ON_ANSI8_MIN,
    measure: (s) => ratioOf(s, 7, 8),
    fails: (s) => ratioOf(s, 7, 8) < ANSI7_ON_ANSI8_MIN,
    details: (theme, s) =>
      ratioOf(s, 7, 8) < ANSI7_ON_ANSI8_MIN
        ? [
            `ANSI 7 ${theme.ansi[7]} on ANSI 8 ${theme.ansi[8]} is ${shownRatio(s, 7, 8)}:1, needs ${ANSI7_ON_ANSI8_MIN}:1`,
          ]
        : [],
  },
  {
    rule: 'cvd-red-green',
    label: 'red and green a deuteranope confuses',
    unit: 'pairs',
    max: 0,
    measure: (s) => confusionsOf(s).length,
    fails: (s) => confusionsOf(s).length > 0,
    details: (theme, s) =>
      confusionsOf(s).map(
        ([red, green]) =>
          `ANSI ${red} ${theme.ansi[red]} and ANSI ${green} ${theme.ansi[green]} read as one color to a deuteranope at text size`,
      ),
  },
  {
    rule: 'cursor',
    label: 'cursor on background',
    unit: 'ratio',
    min: CURSOR_MIN,
    measure: (s) => ((s.rgb[CURSOR] as number) < 0 ? Number.NaN : ratioOf(s, CURSOR, BG)),
    fails: (s) => (s.rgb[CURSOR] as number) >= 0 && ratioOf(s, CURSOR, BG) < CURSOR_MIN,
    details: ({ cursor, background }, s) =>
      cursor !== undefined && ratioOf(s, CURSOR, BG) < CURSOR_MIN
        ? [`cursor ${cursor} on ${background} is ${shownRatio(s, CURSOR, BG)}:1, needs ${CURSOR_MIN}:1`]
        : [],
  },
]

const CHECKS: Check[] = [...READABILITY, ...ROLE_CHECKS, ...PAIR_CHECKS]

export const GATE_RULES: GateRule[] = CHECKS.map(({ rule, label, unit, min, max }) => ({
  rule,
  label,
  unit,
  ...(min === undefined ? {} : { min }),
  ...(max === undefined ? {} : { max }),
}))

export function readabilityFails(s: Sheet, background: number): number {
  s.lum[BG] = background
  let mask = 0

  for (let i = 0; i < READABILITY.length; i++) {
    if ((READABILITY[i] as Check).fails(s)) mask |= 1 << i
  }

  return mask
}

export function measureSheet(s: Sheet): number[] {
  return CHECKS.map((c) => Math.round(c.measure(s) * 1000) / 1000)
}

export function measure(theme: Readable): number[] {
  return measureSheet(sheetOf(theme))
}

export function passesSheet(s: Sheet): boolean {
  return CHECKS.every((c) => !c.fails(s))
}

export function passes(theme: Readable): boolean {
  return passesSheet(sheetOf(theme))
}

export function missedRules(theme: Readable): GateRule[] {
  const s = sheetOf(theme)

  return GATE_RULES.filter((_, i) => (CHECKS[i] as Check).fails(s))
}

export function shownOf(value: number): string {
  return Number.isNaN(value) ? '—' : Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export function boundOf(rule: GateRule): string {
  return rule.min !== undefined ? `≥ ${rule.min}` : rule.max !== undefined ? `≤ ${rule.max}` : ''
}

function run(checks: Check[], theme: Readable): Violation[] {
  const s = sheetOf(theme)

  return checks.flatMap((c) => c.details(theme, s).map((detail) => ({ theme: theme.name, rule: c.rule, detail })))
}

export function check(theme: Readable): Violation[] {
  return run(CHECKS, theme)
}

export function checkReadability(theme: Readable): Violation[] {
  return run(READABILITY, theme)
}

export function checkAll(themes: Theme[]): Violation[] {
  return themes.flatMap(check)
}
