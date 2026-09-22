const RAD = Math.PI / 180
const DEG = 180 / Math.PI

const linear = (v: number) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const pivot = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116)

export function lab(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = linear((n >> 16) & 255)
  const g = linear((n >> 8) & 255)
  const b = linear(n & 255)
  const x = pivot((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047)
  const y = pivot(0.2126 * r + 0.7152 * g + 0.0722 * b)
  const z = pivot((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

const hueAngle = (b: number, a: number) => {
  if (a === 0 && b === 0) return 0
  const h = Math.atan2(b, a) * DEG
  return h < 0 ? h + 360 : h
}

export function deltaE(from: string, to: string): number {
  const [L1, a1, b1] = lab(from)
  const [L2, a2, b2] = lab(to)
  const Cbar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)))
  const ap1 = (1 + G) * a1
  const ap2 = (1 + G) * a2
  const Cp1 = Math.hypot(ap1, b1)
  const Cp2 = Math.hypot(ap2, b2)
  const hp1 = hueAngle(b1, ap1)
  const hp2 = hueAngle(b2, ap2)
  let dh = 0
  if (Cp1 * Cp2 !== 0) {
    dh = hp2 - hp1
    if (dh > 180) dh -= 360
    else if (dh < -180) dh += 360
  }
  const dL = L2 - L1
  const dC = Cp2 - Cp1
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * RAD)
  const Lbar = (L1 + L2) / 2
  const Cpbar = (Cp1 + Cp2) / 2
  let hbar = hp1 + hp2
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) hbar += hp1 + hp2 < 360 ? 360 : -360
    hbar /= 2
  }
  const T =
    1 -
    0.17 * Math.cos((hbar - 30) * RAD) +
    0.24 * Math.cos(2 * hbar * RAD) +
    0.32 * Math.cos((3 * hbar + 6) * RAD) -
    0.2 * Math.cos((4 * hbar - 63) * RAD)
  const dTheta = 30 * Math.exp(-(((hbar - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(Cpbar ** 7 / (Cpbar ** 7 + 25 ** 7))
  const Sl = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2)
  const Sc = 1 + 0.045 * Cpbar
  const Sh = 1 + 0.015 * Cpbar * T
  const Rt = -Math.sin(2 * dTheta * RAD) * Rc
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))
}

const PERMUTATIONS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
]

export function tripletDelta(a: string[], b: string[]): number {
  return Math.min(
    ...PERMUTATIONS.map(
      (p) =>
        (deltaE(a[0] as string, b[p[0] as number] as string) +
          deltaE(a[1] as string, b[p[1] as number] as string) +
          deltaE(a[2] as string, b[p[2] as number] as string)) /
        3,
    ),
  )
}
