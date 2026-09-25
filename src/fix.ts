import { contrast, type Hex, luminance, oklch } from './color.ts'
import {
  ACHROMATIC,
  BRIGHT_GAP,
  brightDrift,
  check,
  DISTINCT_HUE,
  DISTINCT_LIGHTNESS,
  exemptSlots,
  type Gated,
  hueGap,
  lookalikes,
  offRole,
  ROLE_HUES,
  ROLES,
  roleOf,
  type Violation,
} from './contrast.ts'

export interface Move {
  slot: string
  rule: string
  from: Hex
  to: Hex
}

export type Fixable = Gated & { selectionBackground: Hex; signatureSlots: string[] }

const MARGIN = 5
const PASSES = 6
const HEADROOM = 0.05
const ACCENTS = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14]

const toward = (from: number, to: number) => ((to - from + 360) % 360 <= 180 ? 1 : -1)

export function srgb(l: number, c: number, h: number): number[] | undefined {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const lms = [
    l + 0.3963377774 * a + 0.2158037573 * b,
    l - 0.1055613458 * a - 0.0638541728 * b,
    l - 0.0894841775 * a - 1.291485548 * b,
  ].map((v) => v ** 3) as [number, number, number]
  const [x, y, z] = lms
  const linear = [
    4.0767416621 * x - 3.3077115913 * y + 0.2309699292 * z,
    -1.2684380046 * x + 2.6097574011 * y - 0.3413193965 * z,
    -0.0041960863 * x - 0.7034186147 * y + 1.707614701 * z,
  ]
  if (linear.some((v) => v < -1e-4 || v > 1 + 1e-4)) return undefined
  return linear.map((v) => {
    const u = Math.min(1, Math.max(0, v))
    return Math.round(255 * (u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055))
  })
}

function inGamut(l: number, c: number, h: number): Hex {
  let lo = 0
  let hi = c
  if (srgb(l, c, h) === undefined) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (srgb(l, mid, h) === undefined) hi = mid
      else lo = mid
    }
  } else lo = c
  const rgb = srgb(l, lo, h) ?? [0, 0, 0]
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export function rehue(hex: Hex, hue: number): Hex {
  const { l, c } = oklch(hex)
  return inGamut(l, c, (hue + 360) % 360)
}

function relight(hex: Hex, against: Hex, min: number): Hex {
  const { l, c, h } = oklch(hex)
  const up = luminance(against) < 0.18
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
  const band = ROLE_HUES[role] as { center: number; width: number }
  const [n, b] = [oklch(ansi[role] as Hex), oklch(ansi[role + 8] as Hex)]
  const span = (slot: number, now: number) =>
    exempt.has(slot)
      ? [now]
      : Array.from({ length: 2 * band.width + 1 }, (_, i) => (band.center - band.width + i + 360) % 360)
  const clear = (slot: number, hue: number, l: number) =>
    ROLES.every((j) => {
      const other = (slot > 8 ? 8 : 0) + j
      if (other === slot) return true
      const o = oklch(ansi[other] as Hex)
      return o.c < ACHROMATIC || hueGap(o.h, hue) >= DISTINCT_HUE + 1 || Math.abs(o.l - l) >= DISTINCT_LIGHTNESS
    })
  let best: [number, number] | undefined
  let cost = Number.POSITIVE_INFINITY
  for (const hn of span(role, n.h)) {
    if (!exempt.has(role) && !clear(role, hn, n.l)) continue
    for (const hb of span(role + 8, b.h)) {
      if (hueGap(hn, hb) > BRIGHT_GAP - MARGIN || (!exempt.has(role + 8) && !clear(role + 8, hb, b.l))) continue
      const moved = hueGap(hn, n.h) + hueGap(hb, b.h)
      if (moved < cost) {
        cost = moved
        best = [hn, hb]
      }
    }
  }
  return best
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
      const band = ROLE_HUES[roleOf(slot)] as { center: number; width: number }
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
    const lift = (rule: string, slots: string[], min: number, against = background) => {
      if (waived.has(rule)) return
      for (const slot of slots) {
        if (contrast(this.get(slot), against) < min) this.set(slot, rule, relight(this.get(slot), against, min))
      }
    }
    lift('foreground', ['foreground'], 7)
    lift(
      'accents',
      ACCENTS.map((i) => `ansi${i}`),
      3,
    )
    lift('light-ansi', ['ansi7', 'ansi15'], 7)
    lift('ansi8-visible', ['ansi8'], 1.6)
    if (!waived.has('ansi0-dark') && luminance(this.get('ansi0')) > 0.15) {
      this.set('ansi0', 'ansi0-dark', darken(this.get('ansi0'), 0.15))
    }
    lift('selection', ['selection'], 7, this.theme.foreground)
  }

  net(): Move[] {
    return [...new Set(this.moves.map((m) => m.slot))].flatMap((slot) => {
      const mine = this.moves.filter((m) => m.slot === slot)
      const from = (mine[0] as Move).from
      const to = this.get(slot)
      return from === to ? [] : [{ slot, rule: [...new Set(mine.map((m) => m.rule))].join(', '), from, to }]
    })
  }
}

export function fixRoles<T extends Fixable>(theme: T): { theme: T; moves: Move[] } {
  const fixer = new Fixer(theme)
  for (let pass = 0; pass < PASSES; pass++) {
    fixer.roles()
    if (check(fixer.theme).length === 0) break
  }
  return { theme: fixer.theme, moves: fixer.net() }
}

export function fixGate<T extends Fixable>(theme: T): { theme: T; moves: Move[]; left: Violation[] } {
  const fixer = new Fixer(theme)
  for (let pass = 0; pass < PASSES; pass++) {
    fixer.readability()
    fixer.roles()
    if (check(fixer.theme).length === 0) break
  }
  return { theme: fixer.theme, moves: fixer.net(), left: check(fixer.theme) }
}
