import { luminance } from '@/lib/sheet'
import type { Theme } from '@/lib/themes'

export const SETTLE_MS = 650

export function wearSlots(theme: Theme): [string, string][] {
  return [
    ['--bg', theme.background],
    ['--fg', theme.foreground],
    ['--cu', theme.cursor],
    ['--se', theme.selectionBackground],
    ...theme.ansi.map((color, index): [string, string] => [`--a${index}`, color]),
  ]
}

export function wearStyle(theme: Theme): string {
  return wearSlots(theme)
    .map(([slot, color]) => `${slot}:${color}`)
    .join(';')
}

export function isLight(theme: Theme): boolean {
  return luminance(theme.background) > 0.3
}
