export type Hex = string

const HEX = /^#[0-9a-f]{6}$/

export function isHex(value: string): value is Hex {
  return HEX.test(value)
}

export function rgb(hex: Hex): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)

  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

export function mix(a: Hex, b: Hex, t: number): Hex {
  const from = rgb(a)
  const to = rgb(b)

  return `#${from
    .map((c, i) =>
      Math.round(c + ((to[i] ?? 0) - c) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

export function luminance(hex: Hex): number {
  const [r, g, b] = rgb(hex).map(linear) as Linear

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

export interface Lab {
  l: number
  a: number
  b: number
}

type Linear = [number, number, number]

function labOf([r, g, b]: Linear): Lab {
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (t * 841) / 108 + 4 / 29)
  const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047)
  const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b)
  const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883)

  return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) }
}

export function lab(hex: Hex): Lab {
  return labOf(rgb(hex).map(linear) as Linear)
}

export function deuteranope(hex: Hex): Lab {
  const [r, g, b] = rgb(hex).map(linear) as Linear
  const clip = (v: number) => Math.min(1, Math.max(0, v))
  const seen = clip(0.2903053213 * r + 0.7096946787 * g)

  return labOf([seen, seen, clip(b + 0.0219735394 * (g - r))])
}
