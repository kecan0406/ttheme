import type { Hex } from './color.ts'
import { ROLE_HUES, ROLES } from './contrast.ts'
import { inGamut } from './fix.ts'

export interface Colors {
  background: Hex
  foreground: Hex
  cursor: Hex
  selection: Hex
  ansi: Hex[]
}

export interface Seeds {
  background: number
  foreground: number
  hue: number
  tint: number
  lightness: number
  chroma: number
  brights: number
}

interface SeedField {
  key: keyof Seeds
  label: string
  min: number
  max: number
  step: number
  digits: number
  wraps?: true
}

export const SEED_FIELDS: SeedField[] = [
  { key: 'background', label: 'Background', min: 0, max: 0.5, step: 0.01, digits: 2 },
  { key: 'foreground', label: 'Foreground', min: 0.5, max: 1, step: 0.01, digits: 2 },
  { key: 'hue', label: 'Hue', min: 0, max: 360, step: 1, digits: 0, wraps: true },
  { key: 'tint', label: 'Tint', min: 0, max: 0.1, step: 0.005, digits: 3 },
  { key: 'lightness', label: 'Accent lightness', min: 0.4, max: 0.95, step: 0.01, digits: 2 },
  { key: 'chroma', label: 'Accent chroma', min: 0, max: 0.3, step: 0.005, digits: 3 },
  { key: 'brights', label: 'Brights', min: -0.2, max: 0.2, step: 0.01, digits: 2 },
]

export const SEEDS: Seeds = {
  background: 0.21,
  foreground: 0.88,
  hue: 265,
  tint: 0.02,
  lightness: 0.72,
  chroma: 0.12,
  brights: 0.06,
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function nudge(seeds: Seeds, field: SeedField, steps: number): Seeds {
  const raw = seeds[field.key] + field.step * steps
  const value = field.wraps ? ((raw % field.max) + field.max) % field.max : clamp(raw, field.min, field.max)
  return { ...seeds, [field.key]: Math.round(value * 10_000) / 10_000 }
}

export function grow(s: Seeds): Colors {
  const at = (l: number, c: number, h: number) => inGamut(clamp(l, 0, 1), c, h)
  const ansi: Hex[] = Array.from({ length: 16 }, () => '#000000')
  ansi[0] = at(s.background + 0.06, s.tint, s.hue)
  ansi[8] = at(s.background + 0.25, s.tint, s.hue)
  ansi[7] = at(s.foreground - 0.06, s.tint / 2, s.hue)
  ansi[15] = at(s.foreground + 0.06, s.tint / 2, s.hue)
  for (const role of ROLES) {
    const hue = (ROLE_HUES[role] as { center: number }).center
    ansi[role] = at(s.lightness, s.chroma, hue)
    ansi[role + 8] = at(s.lightness + s.brights, s.chroma, hue)
  }
  return {
    background: at(s.background, s.tint, s.hue),
    foreground: at(s.foreground, s.tint / 2, s.hue),
    cursor: at(s.lightness + s.brights, Math.max(s.chroma, 0.08), s.hue),
    selection: at(s.background + 0.1, s.tint * 2, s.hue),
    ansi,
  }
}
