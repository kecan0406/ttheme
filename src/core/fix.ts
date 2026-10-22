import { contrast, deuteranope, type Hex, lab, luminance, oklch } from './color.ts'
import {
  ACCENT_MIN,
  ACCENT_SLOTS,
  ANSI0_MAX_LUMINANCE,
  ANSI7_ON_ANSI8_MIN,
  ANSI8_MIN,
  apart,
  BODY_MIN,
  BRIGHT_GAP,
  brightDrift,
  check,
  confusions,
  exemptSlots,
  type Gated,
  hueGap,
  isLight,
  lookalikes,
  ON_ACCENT_MIN,
  offRole,
  ROLE_HUES,
  ROLES,
  roleOf,
} from './contrast.ts'

export interface Move {
  slot: string
  rule: string
  from: Hex
  to: Hex
}

type Fixable = Gated & { selectionBackground: Hex; signatureSlots: string[] }

const MARGIN = 5
const PASSES = 6
const HEADROOM = 0.05
const CLEAR = 1.05

const toward = (from: number, to: number) => ((to - from + 360) % 360 <= 180 ? 1 : -1)

const outside = (v: number) => v < -1e-4 || v > 1 + 1e-4

const encoded = (v: number) => {
  const u = Math.min(1, Math.max(0, v))

  return Math.round(255 * (u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055))
}

const byte = (v: number) => v.toString(16).padStart(2, '0')

function linearOf(l: number, a: number, b: number): [number, number, number] {
  const x = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const y = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const z = (l - 0.0894841775 * a - 1.291485548 * b) ** 3

  return [
    4.0767416621 * x - 3.3077115913 * y + 0.2309699292 * z,
    -1.2684380046 * x + 2.6097574011 * y - 0.3413193965 * z,
    -0.0041960863 * x - 0.7034186147 * y + 1.707614701 * z,
  ]
}

function fits(l: number, a: number, b: number): boolean {
  const [r, g, bl] = linearOf(l, a, b)

  return !(outside(r) || outside(g) || outside(bl))
}

export function srgb(l: number, c: number, h: number): number[] | undefined {
  const [r, g, b] = linearOf(l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180))

  if (outside(r) || outside(g) || outside(b)) return undefined

  return [encoded(r), encoded(g), encoded(b)]
}

export function edgeChroma(l: number, h: number, c: number): number {
  const cos = Math.cos((h * Math.PI) / 180)
  const sin = Math.sin((h * Math.PI) / 180)

  if (fits(l, c * cos, c * sin)) return c
  let lo = 0
  let hi = c

  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2

    if (fits(l, mid * cos, mid * sin)) lo = mid
    else hi = mid
  }

  return lo
}

export function inGamut(l: number, c: number, h: number): Hex {
  const [r, g, b] = srgb(l, edgeChroma(l, h, c), h) ?? [0, 0, 0]

  return `#${byte(r as number)}${byte(g as number)}${byte(b as number)}`
}

function rehue(hex: Hex, hue: number): Hex {
  const { l, c } = oklch(hex)

  return inGamut(l, c, (hue + 360) % 360)
}

function relight(hex: Hex, against: Hex, min: number, up = luminance(against) < 0.18): Hex {
  const { l, c, h } = oklch(hex)
  const at = (t: number) => inGamut(up ? l + (1 - l) * t : l * (1 - t), c, h)

  if (contrast(at(1), against) < min + HEADROOM) {
    return at(1)
  }

  let lo = 0
  let hi = 1

  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2

    if (contrast(at(mid), against) >= min + HEADROOM) hi = mid
    else lo = mid
  }

  return at(hi)
}

function darken(hex: Hex, max: number): Hex {
  const { l, c, h } = oklch(hex)
  let lo = 0
  let hi = l

  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2

    if (luminance(inGamut(mid, c, h)) <= max - 0.005) lo = mid
    else hi = mid
  }

  return inGamut(lo, c, h)
}

function place(ansi: Hex[], role: number, exempt: Set<number>): [number, number] | undefined {
  const band = ROLE_HUES.get(role) as { center: number; width: number }
  const [n, b] = [oklch(ansi[role] as Hex), oklch(ansi[role + 8] as Hex)]

  const span = (slot: number, now: number) =>
    exempt.has(slot)
      ? [now]
      : Array.from({ length: 2 * band.width + 1 }, (_, i) => (band.center - band.width + i + 360) % 360)

  const clear = (slot: number, hue: number) => {
    if (exempt.has(slot)) return true
    const mine = lab(rehue(ansi[slot] as Hex, hue))

    return ROLES.every((j) => {
      const other = (slot > 8 ? 8 : 0) + j

      return other === slot || apart(mine, lab(ansi[other] as Hex)) >= CLEAR
    })
  }

  const normals = span(role, n.h).filter((hue) => clear(role, hue))
  const brights = span(role + 8, b.h).filter((hue) => clear(role + 8, hue))
  let best: [number, number] | undefined
  let cost = Number.POSITIVE_INFINITY

  for (const hn of normals) {
    for (const hb of brights) {
      if (hueGap(hn, hb) > BRIGHT_GAP - MARGIN) continue
      const moved = hueGap(hn, n.h) + hueGap(hb, b.h)

      if (moved < cost) {
        cost = moved
        best = [hn, hb]
      }
    }
  }

  return best
}

function shade(hex: Hex, t: number, up: boolean): Hex {
  const { l, c, h } = oklch(hex)

  return inGamut(up ? l + (1 - l) * t : l * (1 - t), c, h)
}

class Fixer<T extends Fixable> {
  theme: T
  readonly moves: Move[] = []

  constructor(theme: T) {
    this.theme = { ...theme, ansi: [...theme.ansi] }
  }

  set(slot: string, rule: string, to: Hex): void {
    const from = this.get(slot)

    if (to === from) return
    this.moves.push({ slot, rule, from, to })

    if (slot === 'foreground') this.theme.foreground = to
    else if (slot === 'selection') this.theme.selectionBackground = to
    else this.theme.ansi[Number(slot.slice(4))] = to
  }

  get(slot: string): Hex {
    if (slot === 'foreground') return this.theme.foreground

    if (slot === 'selection') return this.theme.selectionBackground

    return this.theme.ansi[Number(slot.slice(4))] as Hex
  }

  rehue(slot: number, rule: string, hue: number): void {
    this.set(`ansi${slot}`, rule, rehue(this.theme.ansi[slot] as Hex, hue))
  }

  roles(): void {
    const own = new Set(this.theme.signatureSlots)

    for (const { slot, hue } of offRole(this.theme)) {
      const band = ROLE_HUES.get(roleOf(slot)) as { center: number; width: number }
      this.rehue(slot, 'ansi-role', band.center + toward(band.center, hue) * (band.width - MARGIN))
    }

    for (const { normal, gap } of brightDrift(this.theme)) {
      if (gap <= BRIGHT_GAP) continue
      const [anchor, mover] = own.has(`ansi${normal + 8}`) ? [normal + 8, normal] : [normal, normal + 8]
      const a = oklch(this.theme.ansi[anchor] as Hex).h
      const m = oklch(this.theme.ansi[mover] as Hex).h
      this.rehue(mover, 'bright-follows', a + toward(a, m) * (BRIGHT_GAP - MARGIN))
    }

    const exempt = exemptSlots(this.theme)

    for (const [a, b] of lookalikes(this.theme)) {
      const role = roleOf(exempt.has(b) ? a : b)
      const hues = place(this.theme.ansi, role, exempt)

      if (hues === undefined) continue
      this.rehue(role, 'distinct', hues[0])
      this.rehue(role + 8, 'distinct', hues[1])
    }
  }

  readability(): void {
    const waived = new Set(this.theme.waive)
    const { background } = this.theme
    const light = isLight(this.theme)

    const lift = (rule: string, slots: string[], min: number, against = background) => {
      if (waived.has(rule)) return

      for (const slot of slots) {
        if (contrast(this.get(slot), against) < min) this.set(slot, rule, relight(this.get(slot), against, min))
      }
    }

    lift('foreground', ['foreground'], BODY_MIN)
    lift(
      'accents',
      ACCENT_SLOTS.map((i) => `ansi${i}`),
      ACCENT_MIN,
    )
    lift('light-ansi', ['ansi7', 'ansi15'], BODY_MIN)
    lift('ansi8-visible', ['ansi8'], ANSI8_MIN)

    if (!light && !waived.has('ansi0-dark') && luminance(this.get('ansi0')) > ANSI0_MAX_LUMINANCE) {
      this.set('ansi0', 'ansi0-dark', darken(this.get('ansi0'), ANSI0_MAX_LUMINANCE))
    }

    if (!waived.has('ansi0-on-accents')) {
      const weakest = ROLES.map((i) => this.get(`ansi${i}`)).reduce((a, b) =>
        contrast(this.get('ansi0'), a) <= contrast(this.get('ansi0'), b) ? a : b,
      )

      if (contrast(this.get('ansi0'), weakest) < ON_ACCENT_MIN) {
        this.set('ansi0', 'ansi0-on-accents', relight(this.get('ansi0'), weakest, ON_ACCENT_MIN, light))
      }
    }

    if (!waived.has('ansi7-on-ansi8') && contrast(this.get('ansi7'), this.get('ansi8')) < ANSI7_ON_ANSI8_MIN) {
      this.set('ansi7', 'ansi7-on-ansi8', relight(this.get('ansi7'), this.get('ansi8'), ANSI7_ON_ANSI8_MIN, !light))
    }

    lift('selection', ['selection'], BODY_MIN, this.theme.foreground)
  }

  separate(): void {
    if (this.theme.waive.includes('cvd-red-green')) return
    const exempt = exemptSlots(this.theme)

    for (const [red, green] of confusions(this.theme)) {
      for (const mover of exempt.has(green) ? [red, green] : [green, red]) {
        if (this.pull(mover, mover === red ? green : red)) break
      }
    }
  }

  pull(mover: number, other: number): boolean {
    const from = this.get(`ansi${mover}`)
    const against = this.get(`ansi${other}`)
    const up = oklch(from).l >= oklch(against).l

    for (let step = 1; step <= 40; step++) {
      const to = shade(from, step / 100, up)

      if (
        contrast(to, this.theme.background) < ACCENT_MIN ||
        (mover < 8 && contrast(to, this.get('ansi0')) < ON_ACCENT_MIN)
      ) {
        return false
      }

      if (apart(deuteranope(to), deuteranope(against)) >= CLEAR) {
        this.set(`ansi${mover}`, 'cvd-red-green', to)

        return true
      }
    }

    return false
  }

  net(): Move[] {
    return [...Map.groupBy(this.moves, (m) => m.slot)].flatMap(([slot, mine]) => {
      const from = (mine[0] as Move).from
      const to = this.get(slot)

      return from === to ? [] : [{ slot, rule: [...new Set(mine.map((m) => m.rule))].join(', '), from, to }]
    })
  }
}

export function fixRoles<T extends Fixable>(theme: T) {
  const fixer = new Fixer(theme)

  for (let pass = 0; pass < PASSES; pass++) {
    fixer.roles()

    if (check(fixer.theme).length === 0) break
  }

  return { theme: fixer.theme, moves: fixer.net() }
}

export function fixGate<T extends Fixable>(theme: T) {
  const fixer = new Fixer(theme)

  for (let pass = 0; pass < PASSES; pass++) {
    fixer.readability()
    fixer.separate()
    fixer.roles()

    if (check(fixer.theme).length === 0) break
  }

  return { theme: fixer.theme, moves: fixer.net(), left: check(fixer.theme) }
}
