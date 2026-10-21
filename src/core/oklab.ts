import { type Hex, oklch } from './color.ts'

type Lab = [number, number, number]

function toLab(hex: Hex): Lab {
  const { l, c, h } = oklch(hex)
  const turn = (h * Math.PI) / 180

  return [l, c * Math.cos(turn), c * Math.sin(turn)]
}

function channel(value: number): string {
  const encoded = value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055

  return Math.round(Math.min(1, Math.max(0, encoded)) * 255)
    .toString(16)
    .padStart(2, '0')
}

function fromLab([l, a, b]: Lab): Hex {
  const long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const medium = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const short = (l - 0.0894841775 * a - 1.291485548 * b) ** 3

  return `#${channel(4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short)}${channel(
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
  )}${channel(-0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short)}`
}

export function mixOk(from: Hex, to: Hex, t: number): Hex {
  const start = toLab(from)
  const end = toLab(to)

  return fromLab(start.map((value, at) => value + ((end[at] as number) - value) * t) as Lab)
}

export function liftOk(hex: Hex, by: number): Hex {
  const [l, a, b] = toLab(hex)

  return fromLab([l + by, a, b])
}
