import type { Mode } from '@/lib/mode'

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
  signature: string[]
  ansi: string[]
  gate: number[]
}

export interface Theme extends Shade {
  id: string
  marketplace: string | null
  name: string
  catalog: string | null
  native: string | null
  lead: boolean
  from: string | null
  ansiSource: string
  signatureSlots: string[]
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

export function shelfOf(theme: Pick<Theme, 'marketplace' | 'catalog'>): string {
  return [theme.marketplace, theme.catalog].filter((part) => part !== null).join(' / ')
}

export function shadeOf(theme: Shade): Shade {
  return {
    background: theme.background,
    foreground: theme.foreground,
    cursor: theme.cursor,
    selectionBackground: theme.selectionBackground,
    signature: theme.signature,
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
