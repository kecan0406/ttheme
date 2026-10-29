import type { Mode } from '@/lib/mode'
import type { BUILTIN as Builtin } from '../../src/core/theme.ts'

export const BUILTIN: typeof Builtin = 'ttheme'

export interface GateRule {
  rule: string
  label: string
  unit: string
  min?: number
  max?: number
}

export interface Shade {
  background: string
  foreground: string
  cursor: string
  selectionBackground: string
  ansi: string[]
  gate: number[]
}

export interface WorkRef {
  id: string
  name: string
  native: string | null
  lang: string | null
  lead: string
}

export interface CharacterRef {
  id: string
  native: string[]
}

export interface Theme extends Shade {
  id: string
  marketplace: string
  name: string
  subject: string | null
  work: WorkRef | null
  also: WorkRef[]
  character: CharacterRef | null
  from: string | null
  mode: Mode
  other: Shade
}

export interface Marketplace {
  id: string
  repo: string
  add: string
  about: string
  stars: number
  pushedAt: string
  license: string | null
  palettes: Theme[]
}

export function isBuiltin(theme: Pick<Theme, 'marketplace'>): boolean {
  return theme.marketplace === BUILTIN
}

export function shortName(name: string): string {
  return name.startsWith(`${BUILTIN}/`) ? name.slice(BUILTIN.length + 1) : name
}

export function faceOf(shade: Pick<Shade, 'cursor' | 'selectionBackground' | 'foreground'>): string[] {
  return [shade.cursor, shade.selectionBackground, shade.foreground]
}

export function shadeOf(theme: Shade): Shade {
  return {
    background: theme.background,
    foreground: theme.foreground,
    cursor: theme.cursor,
    selectionBackground: theme.selectionBackground,
    ansi: theme.ansi,
    gate: theme.gate,
  }
}

export function shades(theme: Theme): Record<Mode, Shade> {
  return theme.mode === 'dark'
    ? { dark: shadeOf(theme), light: theme.other }
    : { dark: theme.other, light: shadeOf(theme) }
}

export function pinned(theme: Theme): Theme {
  return { ...theme, other: shadeOf(theme) }
}

export function inMode(theme: Theme, mode: Mode): Theme {
  if (theme.mode === mode) return theme

  return { ...theme, ...theme.other, mode, other: shadeOf(theme) }
}

export function pair(light: string, dark: string): string {
  return light === dark ? light : `light-dark(${light},${dark})`
}

export function paint(theme: Theme, pick: (shade: Shade) => string): string {
  const { dark, light } = shades(theme)

  return pair(pick(light), pick(dark))
}
