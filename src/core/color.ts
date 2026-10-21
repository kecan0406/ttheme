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

const RAD = Math.PI / 180

const angle = (b: number, a: number) => (a === 0 && b === 0 ? 0 : ((Math.atan2(b, a) / RAD) % 360) + 360) % 360

export function deltaE(from: Hex, to: Hex): number {
  const one = lab(from)
  const two = lab(to)
  const mean = (Math.hypot(one.a, one.b) + Math.hypot(two.a, two.b)) / 2
  const g = 0.5 * (1 - Math.sqrt(mean ** 7 / (mean ** 7 + 25 ** 7)))
  const a1 = (1 + g) * one.a
  const a2 = (1 + g) * two.a
  const c1 = Math.hypot(a1, one.b)
  const c2 = Math.hypot(a2, two.b)
  const h1 = angle(one.b, a1)
  const h2 = angle(two.b, a2)
  const chromatic = c1 * c2 !== 0
  const turn = h2 - h1
  const dh = chromatic ? (turn > 180 ? turn - 360 : turn < -180 ? turn + 360 : turn) : 0
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin((dh / 2) * RAD)
  const l = (one.l + two.l) / 2
  const c = (c1 + c2) / 2

  const h = chromatic
    ? Math.abs(h1 - h2) > 180
      ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2
      : (h1 + h2) / 2
    : h1 + h2

  const t =
    1 -
    0.17 * Math.cos((h - 30) * RAD) +
    0.24 * Math.cos(2 * h * RAD) +
    0.32 * Math.cos((3 * h + 6) * RAD) -
    0.2 * Math.cos((4 * h - 63) * RAD)

  const theta = 30 * Math.exp(-(((h - 275) / 25) ** 2))
  const rc = 2 * Math.sqrt(c ** 7 / (c ** 7 + 25 ** 7))
  const sl = 1 + (0.015 * (l - 50) ** 2) / Math.sqrt(20 + (l - 50) ** 2)
  const sc = 1 + 0.045 * c
  const sh = 1 + 0.015 * c * t
  const rt = -Math.sin(2 * theta * RAD) * rc
  const dl = (two.l - one.l) / sl
  const dc = (c2 - c1) / sc
  const dhh = dH / sh

  return Math.sqrt(dl ** 2 + dc ** 2 + dhh ** 2 + rt * dc * dhh)
}

export function deuteranope(hex: Hex): Lab {
  const [r, g, b] = rgb(hex).map(linear) as Linear
  const clip = (v: number) => Math.min(1, Math.max(0, v))
  const seen = clip(0.2903053213 * r + 0.7096946787 * g)

  return labOf([seen, seen, clip(b + 0.0219735394 * (g - r))])
}
