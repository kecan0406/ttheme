import type { Theme } from './themes'

export function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16)
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel((value >> 16) & 255) + 0.7152 * channel((value >> 8) & 255) + 0.0722 * channel(value & 255)
}

export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export function accentFor(theme: Theme): string {
  const candidates = [theme.cursor, theme.ansi[12], theme.ansi[13], theme.ansi[4], theme.foreground].filter(
    (color): color is string => color !== undefined,
  )
  return candidates.find((color) => luminance(color) >= 0.22) ?? theme.foreground
}
