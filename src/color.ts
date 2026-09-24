export type Hex = string

const HEX = /^#[0-9a-f]{6}$/

export function isHex(value: string): value is Hex {
  return HEX.test(value)
}

export function rgb(hex: Hex): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

export function luminance(hex: Hex): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: Hex, b: Hex): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export function ratio(a: Hex, b: Hex): number {
  return Math.round(contrast(a, b) * 100) / 100
}

export interface Oklch {
  l: number
  c: number
  h: number
}

function linear(channel: number): number {
  const s = channel / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function oklch(hex: Hex): Oklch {
  const [r, g, b] = rgb(hex).map(linear) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const x = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const y = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    c: Math.hypot(x, y),
    h: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
  }
}
