import type { GateRule, Theme } from '@/lib/themes'

export type Slot = 'bg' | 'fg' | 'cu' | 'se' | `a${number}`

export interface Series {
  name: string
  themes: Theme[]
}

const NAMED: Record<string, Slot> = { background: 'bg', foreground: 'fg', cursor: 'cu', selection: 'se' }

export function slotOf(name: string): Slot {
  return NAMED[name] ?? (`a${name.slice(4)}` as Slot)
}

function channel(hex: string, shift: number): number {
  const value = ((Number.parseInt(hex.slice(1), 16) >> shift) & 255) / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  return 0.2126 * channel(hex, 16) + 0.7152 * channel(hex, 8) + 0.0722 * channel(hex, 0)
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

export function passes({ value, min, max }: { value: number; min?: number; max?: number }): boolean {
  if (min !== undefined) return value >= min
  return max === undefined || value <= max
}

export function gatePassed(theme: Theme, gate: GateRule[]): number {
  return gate.filter((rule, index) => passes({ value: theme.gate[index] as number, min: rule.min, max: rule.max }))
    .length
}

export function seriesOf(themes: Theme[]): Series[] {
  const series: Series[] = []
  for (const theme of themes) {
    const open = series.at(-1)
    if (open?.name === theme.group) open.themes.push(theme)
    else series.push({ name: theme.group, themes: [theme] })
  }
  return series
}

export function sheetNumber(themes: Theme[], theme: Theme): string {
  return String(themes.indexOf(theme) + 1).padStart(3, '0')
}
