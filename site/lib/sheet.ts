import type { GateRule, Theme } from '@/lib/themes'

export type Side = 'l' | 'r'
export type Slot = 'bg' | 'fg' | 'cu' | 'se' | `a${number}`

export interface Series {
  name: string
  themes: Theme[]
}

export interface Reading {
  value: number
  unit: GateRule['unit']
  min?: number
  max?: number
  of?: string
}

export interface Call {
  key: Slot
  role: string
  slots: Slot[]
}

export const CALLS: Record<Side, Call[]> = {
  l: [
    { key: 'se', role: 'selection', slots: ['se'] },
    { key: 'a8', role: 'black', slots: ['a0', 'a8'] },
    { key: 'a7', role: 'white', slots: ['a7', 'a15'] },
    { key: 'fg', role: 'foreground', slots: ['fg'] },
    { key: 'bg', role: 'background', slots: ['bg'] },
    { key: 'cu', role: 'cursor', slots: ['cu'] },
  ],
  r: [
    { key: 'a1', role: 'red', slots: ['a1', 'a9'] },
    { key: 'a2', role: 'green', slots: ['a2', 'a10'] },
    { key: 'a3', role: 'yellow', slots: ['a3', 'a11'] },
    { key: 'a6', role: 'cyan', slots: ['a6', 'a14'] },
    { key: 'a4', role: 'blue', slots: ['a4', 'a12'] },
    { key: 'a5', role: 'magenta', slots: ['a5', 'a13'] },
  ],
}

const ORDER = [...CALLS.l, ...CALLS.r].map((call) => call.key)
const NAMED: Record<string, Slot> = { background: 'bg', foreground: 'fg', cursor: 'cu', selection: 'se' }

export function callNumber(key: Slot): number {
  return ORDER.indexOf(key) + 1
}

export function slotOf(name: string): Slot {
  return NAMED[name] ?? (`a${name.slice(4)}` as Slot)
}

export function hexOf(theme: Theme, slot: Slot): string {
  if (slot === 'bg') return theme.background
  if (slot === 'fg') return theme.foreground
  if (slot === 'cu') return theme.cursor
  if (slot === 'se') return theme.selectionBackground
  return theme.ansi[Number(slot.slice(1))] as string
}

function channel(hex: string, shift: number): number {
  const value = ((Number.parseInt(hex.slice(1), 16) >> shift) & 255) / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 16) + 0.7152 * channel(hex, 8) + 0.0722 * channel(hex, 0)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

function fromGate(theme: Theme, gate: GateRule[], name: string): Reading {
  const index = gate.findIndex((rule) => rule.rule === name)
  const rule = gate[index]
  if (!rule) throw new Error(`manifest gate has no ${name} rule`)
  return { value: theme.gate[index] as number, unit: rule.unit, min: rule.min, max: rule.max }
}

export function readingsFor(theme: Theme, gate: GateRule[], key: Slot): Reading[] {
  const { background, foreground, cursor, selectionBackground } = theme
  if (key === 'bg') return [{ value: luminance(background), unit: 'luminance' }]
  if (key === 'fg') return [fromGate(theme, gate, 'foreground')]
  if (key === 'se') return [{ value: contrast(foreground, selectionBackground), unit: 'ratio', of: 'text on it' }]
  if (key === 'cu') return [{ value: contrast(cursor, background), unit: 'ratio' }]
  if (key === 'a8') return [fromGate(theme, gate, 'ansi0-dark'), fromGate(theme, gate, 'ansi8-visible')]
  if (key === 'a7') return [{ ...fromGate(theme, gate, 'light-ansi'), of: 'weaker' }]
  const { min } = fromGate(theme, gate, 'accents')
  return [{ value: contrast(hexOf(theme, key), background), unit: 'ratio', min }]
}

export function passes({ value, min, max }: Pick<Reading, 'value' | 'min' | 'max'>): boolean {
  if (min !== undefined) return value >= min
  return max === undefined || value <= max
}

export function formatReading({ value, unit }: Reading): string {
  return unit === 'ratio' ? `${value.toFixed(2)}:1` : `L ${value.toFixed(3)}`
}

export function floorOf({ min, max }: Reading): string | null {
  if (min !== undefined) return `≥${min}`
  return max === undefined ? null : `≤${max}`
}

export function gatePassed(theme: Theme, gate: GateRule[]): number {
  return gate.filter((rule, index) => passes({ value: theme.gate[index] as number, min: rule.min, max: rule.max }))
    .length
}

export function weakestAccent(theme: Theme): Slot {
  const score = (key: Slot) => contrast(hexOf(theme, key), theme.background)
  return CALLS.r.map((call) => call.key).reduce((weakest, key) => (score(key) < score(weakest) ? key : weakest))
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
