import type { GateRule, Theme } from '@/lib/themes'
import type { Vars } from '@/lib/wear'

export type Slot = 'bg' | 'fg' | 'cu' | 'se' | `a${number}`

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
  const [la, lb] = [luminance(a), luminance(b)]

  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export function passes({ value, min, max }: { value: number; min?: number; max?: number }): boolean {
  if (min !== undefined) return value >= min

  return max === undefined || value <= max
}

export function gatePassed(theme: Theme, gate: GateRule[]): number {
  return gate.filter((rule, index) => passes({ value: theme.gate[index] as number, min: rule.min, max: rule.max }))
    .length
}

export function sheetNumber(themes: Theme[], theme: Theme): string {
  return String(themes.indexOf(theme) + 1).padStart(3, '0')
}

export function sheetVars(theme: Theme, number: string, gate: GateRule[]): Vars {
  const passed = gatePassed(theme, gate)

  const marks = theme.signatureSlots.slice(0, 3).flatMap((slot, index): Vars => {
    const selection = slot === 'selection'

    return [
      [`--sheet-mark${index}`, JSON.stringify(selection ? ' sel ' : '●')],
      [`--sheet-ground${index}`, selection ? 'var(--se)' : 'transparent'],
      [`--sheet-ink${index}`, selection ? 'var(--fg)' : `var(--${slotOf(slot)})`],
    ]
  })

  return [
    ['--sheet-number', JSON.stringify(number)],
    ['--sheet-lead', JSON.stringify(theme.lead ? ' · lead' : '')],
    ['--sheet-ansi', JSON.stringify(theme.ansiSource)],
    ['--sheet-slots', JSON.stringify(theme.signatureSlots.join(' '))],
    ['--sheet-cursor', JSON.stringify(theme.cursor)],
    ['--sheet-floors', JSON.stringify(`${passed} / ${gate.length} floors`)],
    ['--sheet-tone', passed === gate.length ? 'var(--success)' : 'var(--warning)'],
    ...marks,
  ]
}
