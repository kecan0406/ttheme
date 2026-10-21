import { argbFromHex, Hct } from '@material/material-color-utilities'
import { deltaE, type Hex } from './color.ts'
import { check, ROLE_HUES } from './contrast.ts'
import { fixRoles, inGamut, type Move } from './fix.ts'
import { type Anchored, harmonized } from './harmonize.ts'
import { slotOf, withSlot } from './mirror.ts'
import type { Shade } from './theme.ts'

export interface Ranked {
  name: string
  score: number
  worst: number
  worstSlot: number
  mean: number
  collision: number
  pair: [number, number]
  shade: Shade
  moves: Move[]
}

export interface Ranking {
  ranked: Ranked[]
  dropped: Map<string, string>
  dark: number
}

export const FUNCTION_HUE = new Map([
  [1, 22],
  [2, 143],
  [3, 90],
  [4, 253],
  [5, 332],
  [6, 200],
])

export const COLLISION_WEIGHT = 4

const GROUPS = [
  [1, 2, 3, 4, 5, 6],
  [9, 10, 11, 12, 13, 14],
]

const LIGHT = 50

export const ROLE_BASE = 'role centers'

const NEUTRAL = { dark: 0.25, light: 0.85 }
const ACCENT = { lightness: 0.7, chroma: 0.12 }

const hueDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360

  return Math.min(d, 360 - d)
}

const hueOf = (hex: Hex) => Hct.fromInt(argbFromHex(hex)).hue

export function parseScheme(text: string): Shade | undefined {
  const values = new Map<string, Hex>()
  const ansi: Hex[] = []

  for (const line of text.split('\n')) {
    const entry = line.match(/^palette\s*=\s*(\d+)\s*=\s*#?([0-9a-f]{6})\s*$/i)

    if (entry) ansi[Number(entry[1])] = `#${(entry[2] as string).toLowerCase()}`

    const pair = line.match(/^([a-z-]+)\s*=\s*#?([0-9a-f]{6})\s*$/i)

    if (pair) values.set(pair[1] as string, `#${(pair[2] as string).toLowerCase()}`)
  }

  const background = values.get('background')
  const foreground = values.get('foreground')
  const ramp = Array.from({ length: 16 }, (_, i) => ansi[i])

  if (!background || !foreground || ramp.some((c) => c === undefined)) return undefined

  return {
    background,
    foreground,
    cursor: values.get('cursor-color') ?? foreground,
    selectionBackground: values.get('selection-background') ?? background,
    ansi: ramp as Hex[],
  }
}

export function seeded(theme: Anchored, scheme: Shade): Anchored {
  const shade = theme.signatureSlots.reduce((out, slot) => withSlot(out, slot, slotOf(theme, slot)), scheme)

  return { name: theme.name, signatureSlots: theme.signatureSlots, ...shade, ansi: [...shade.ansi] }
}

export function gateOf(theme: Anchored, shade: Shade): string[] {
  return check({ ...shade, name: theme.name, signatureSlots: theme.signatureSlots, waive: [] }).map(
    (v) => `${v.rule} — ${v.detail}`,
  )
}

function scored(name: string, held: ReadonlySet<number>, shade: Shade): Omit<Ranked, 'shade' | 'moves'> {
  const drifts = GROUPS.flat()
    .filter((i) => !held.has(i))
    .map((i) => ({ slot: i, drift: hueDiff(hueOf(shade.ansi[i] as Hex), FUNCTION_HUE.get(i % 8) as number) }))

  const worst = drifts.reduce((a, b) => (b.drift > a.drift ? b : a))
  const mean = drifts.reduce((sum, d) => sum + d.drift, 0) / drifts.length
  let collision = Number.POSITIVE_INFINITY
  let pair: [number, number] = [0, 0]

  for (const group of GROUPS)
    for (const a of group)
      for (const b of group) {
        if (a >= b) continue

        const delta = deltaE(shade.ansi[a] as Hex, shade.ansi[b] as Hex)

        if (delta < collision) {
          collision = delta
          pair = [a, b]
        }
      }

  return {
    name,
    score: worst.drift + mean - COLLISION_WEIGHT * collision,
    worst: worst.drift,
    worstSlot: worst.slot,
    mean,
    collision,
    pair,
  }
}

export function finished(theme: Anchored, shade: Shade) {
  const { theme: fixed, moves } = fixRoles({
    ...shade,
    name: theme.name,
    signatureSlots: theme.signatureSlots,
    waive: [],
  })

  return { shade: { ...shade, ansi: fixed.ansi }, moves }
}

export function roleBase(): Shade {
  const accent = (role: number) => inGamut(ACCENT.lightness, ACCENT.chroma, ROLE_HUES.get(role)?.center as number)

  return {
    background: inGamut(NEUTRAL.dark / 2, 0, 0),
    foreground: inGamut(NEUTRAL.light, 0, 0),
    cursor: inGamut(NEUTRAL.light, 0, 0),
    selectionBackground: inGamut(NEUTRAL.dark, 0, 0),
    ansi: Array.from({ length: 16 }, (_, i) =>
      i % 8 === 0 ? inGamut(NEUTRAL.dark, 0, 0) : i % 8 === 7 ? inGamut(NEUTRAL.light, 0, 0) : accent(i % 8),
    ),
  }
}

export function rankBases(theme: Anchored, schemes: Iterable<readonly [string, Shade | undefined]>): Ranking {
  const held = new Set(theme.signatureSlots.filter((s) => s.startsWith('ansi')).map((s) => Number(s.slice(4))))
  const ranked: Ranked[] = []
  const dropped = new Map<string, string>()
  let dark = 0

  for (const [name, scheme] of schemes) {
    if (!scheme) {
      dropped.set(name, 'fewer than 16 palette entries')
      continue
    }

    if (Hct.fromInt(argbFromHex(scheme.background)).tone >= LIGHT) {
      dropped.set(name, 'light background')
      continue
    }

    dark++

    let raw: Shade

    try {
      raw = harmonized(seeded(theme, scheme))
    } catch (error) {
      dropped.set(name, `harmonizer: ${(error as Error).message}`)
      continue
    }

    const { shade, moves } = finished(theme, raw)
    const problems = gateOf(theme, shade)

    if (problems.length > 0) dropped.set(name, `gate: ${problems.join('; ')}`)
    else ranked.push({ ...scored(name, held, raw), shade, moves })
  }

  ranked.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))

  return { ranked, dropped, dark }
}
