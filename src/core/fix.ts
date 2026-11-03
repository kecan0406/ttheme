import { contrastOf, deuteranopeInto, type Hex, hexOf, labInto, luminanceOf, oklchInto, rgbOf } from './color.ts'
import {
  ACCENT_MIN,
  ACCENT_SLOTS,
  ANSI0_MAX_LUMINANCE,
  ANSI7_ON_ANSI8_MIN,
  ANSI8_MIN,
  apartAt,
  BODY_MIN,
  BRIGHT_GAP,
  brightDrift,
  CURSOR_MIN,
  check,
  confusions,
  hueGap,
  isLight,
  lookalikes,
  ON_ACCENT_MIN,
  offRole,
  passes,
  type Readable,
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

type Fixable = Readable & { selectionBackground: Hex }

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

function fits(l: number, a: number, b: number): boolean {
  const x = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const y = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const z = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const r = 4.0767416621 * x - 3.3077115913 * y + 0.2309699292 * z

  if (outside(r)) return false

  const g = -1.2684380046 * x + 2.6097574011 * y - 0.3413193965 * z

  if (outside(g)) return false

  return !outside(-0.0041960863 * x - 0.7034186147 * y + 1.707614701 * z)
}

function srgbOf(l: number, c: number, h: number): number {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const x = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const y = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const z = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const r = 4.0767416621 * x - 3.3077115913 * y + 0.2309699292 * z
  const g = -1.2684380046 * x + 2.6097574011 * y - 0.3413193965 * z
  const bl = -0.0041960863 * x - 0.7034186147 * y + 1.707614701 * z

  if (outside(r) || outside(g) || outside(bl)) return -1

  return (encoded(r) << 16) | (encoded(g) << 8) | encoded(bl)
}

export function srgb(l: number, c: number, h: number): number[] | undefined {
  const n = srgbOf(l, c, h)

  return n < 0 ? undefined : [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
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

function gamutOf(l: number, c: number, h: number): number {
  return Math.max(0, srgbOf(l, edgeChroma(l, h, c), h))
}

export function inGamut(l: number, c: number, h: number): Hex {
  return hexOf(gamutOf(l, c, h))
}

const OK = new Float64Array(3)

function lchOf(hex: Hex): [number, number, number] {
  oklchInto(rgbOf(hex), OK, 0)

  return [OK[0] as number, OK[1] as number, OK[2] as number]
}

function rehue(hex: Hex, hue: number): Hex {
  const [l, c] = lchOf(hex)

  return hexOf(gamutOf(l, c, (hue + 360) % 360))
}

const lumOf = (hex: Hex) => luminanceOf(rgbOf(hex))

const ratio = (a: Hex, b: Hex) => contrastOf(lumOf(a), lumOf(b))

function relight(hex: Hex, against: Hex, min: number, up = lumOf(against) < 0.18): Hex {
  const [l, c, h] = lchOf(hex)
  const under = lumOf(against)
  const at = (t: number) => gamutOf(up ? l + (1 - l) * t : l * (1 - t), c, h)
  const top = at(1)

  if (contrastOf(luminanceOf(top), under) < min + HEADROOM) {
    return hexOf(top)
  }

  let lo = 0
  let hi = 1

  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2

    if (contrastOf(luminanceOf(at(mid)), under) >= min + HEADROOM) hi = mid
    else lo = mid
  }

  return hexOf(at(hi))
}

function darken(hex: Hex, max: number): Hex {
  const [l, c, h] = lchOf(hex)
  let lo = 0
  let hi = l

  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2

    if (luminanceOf(gamutOf(mid, c, h)) <= max - 0.005) lo = mid
    else hi = mid
  }

  return hexOf(gamutOf(lo, c, h))
}

const MINE = new Float64Array(3)

function place(ansi: Hex[], role: number): [number, number] | undefined {
  const band = ROLE_HUES.get(role) as { center: number; width: number }
  const labs = new Float64Array(48)

  for (const j of ROLES) {
    labInto(rgbOf(ansi[j] as Hex), labs, j * 3)
    labInto(rgbOf(ansi[j + 8] as Hex), labs, (j + 8) * 3)
  }

  const [nl, nc, nh] = lchOf(ansi[role] as Hex)
  const [bl, bc, bh] = lchOf(ansi[role + 8] as Hex)
  const count = 2 * band.width + 1
  const hues = new Float64Array(count)
  const near = new Float64Array(count)
  const reach = new Float64Array(count)

  for (let i = 0; i < count; i++) {
    const hue = (band.center - band.width + i + 360) % 360
    hues[i] = hue
    near[i] = hueGap(hue, nh)
    reach[i] = hueGap(hue, bh)
  }

  const clear = (slot: number, l: number, c: number, hue: number) => {
    labInto(gamutOf(l, c, (hue + 360) % 360), MINE, 0)
    const base = slot > 8 ? 8 : 0

    for (const j of ROLES) {
      const other = base + j

      if (other !== slot && apartAt(MINE, 0, labs, other * 3) < CLEAR) return false
    }

    return true
  }

  const normal = new Int8Array(count).fill(-1)
  const bright = new Int8Array(count).fill(-1)

  const normalClear = (i: number) => {
    if (normal[i] === -1) normal[i] = clear(role, nl, nc, hues[i] as number) ? 1 : 0

    return normal[i] === 1
  }

  const brightClear = (j: number) => {
    if (bright[j] === -1) bright[j] = clear(role + 8, bl, bc, hues[j] as number) ? 1 : 0

    return bright[j] === 1
  }

  const indices = Array.from({ length: count }, (_, i) => i)
  const byNear = indices.toSorted((a, b) => (near[a] as number) - (near[b] as number))
  const byReach = indices.toSorted((a, b) => (reach[a] as number) - (reach[b] as number))
  let cost = Number.POSITIVE_INFINITY
  let first = -1
  let second = -1

  for (const i of byNear) {
    const moved = near[i] as number

    if (moved > cost) break

    if (!normalClear(i)) continue

    for (const j of byReach) {
      const total = moved + (reach[j] as number)

      if (total > cost) break

      if (hueGap(hues[i] as number, hues[j] as number) > BRIGHT_GAP - MARGIN || !brightClear(j)) continue

      if (total < cost || i < first || (i === first && j < second)) {
        cost = total
        first = i
        second = j
      }
    }
  }

  return first < 0 ? undefined : [hues[first] as number, hues[second] as number]
}

function shadeOf(l: number, c: number, h: number, t: number, up: boolean): number {
  return gamutOf(up ? l + (1 - l) * t : l * (1 - t), c, h)
}

const DEUT = new Float64Array(6)

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
    else if (slot === 'cursor') this.theme.cursor = to
    else this.theme.ansi[Number(slot.slice(4))] = to
  }

  get(slot: string): Hex {
    if (slot === 'foreground') return this.theme.foreground

    if (slot === 'selection') return this.theme.selectionBackground

    if (slot === 'cursor') return this.theme.cursor as Hex

    return this.theme.ansi[Number(slot.slice(4))] as Hex
  }

  rehue(slot: number, rule: string, hue: number): void {
    this.set(`ansi${slot}`, rule, rehue(this.theme.ansi[slot] as Hex, hue))
  }

  roles(): void {
    for (const { slot, hue } of offRole(this.theme)) {
      const band = ROLE_HUES.get(roleOf(slot)) as { center: number; width: number }
      this.rehue(slot, 'ansi-role', band.center + toward(band.center, hue) * (band.width - MARGIN))
    }

    for (const { normal, gap } of brightDrift(this.theme)) {
      if (gap <= BRIGHT_GAP) continue
      const a = lchOf(this.theme.ansi[normal] as Hex)[2]
      const m = lchOf(this.theme.ansi[normal + 8] as Hex)[2]
      this.rehue(normal + 8, 'bright-follows', a + toward(a, m) * (BRIGHT_GAP - MARGIN))
    }

    for (const [, b] of lookalikes(this.theme)) {
      const role = roleOf(b)
      const hues = place(this.theme.ansi, role)

      if (hues === undefined) continue
      this.rehue(role, 'distinct', hues[0])
      this.rehue(role + 8, 'distinct', hues[1])
    }
  }

  readability(): void {
    const { background } = this.theme
    const light = isLight(this.theme)

    const lift = (rule: string, slots: string[], min: number, against = background) => {
      for (const slot of slots) {
        if (ratio(this.get(slot), against) < min) this.set(slot, rule, relight(this.get(slot), against, min))
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

    if (!light && lumOf(this.get('ansi0')) > ANSI0_MAX_LUMINANCE) {
      this.set('ansi0', 'ansi0-dark', darken(this.get('ansi0'), ANSI0_MAX_LUMINANCE))
    }

    const weakest = ROLES.map((i) => this.get(`ansi${i}`)).reduce((a, b) =>
      ratio(this.get('ansi0'), a) <= ratio(this.get('ansi0'), b) ? a : b,
    )

    if (ratio(this.get('ansi0'), weakest) < ON_ACCENT_MIN) {
      this.set('ansi0', 'ansi0-on-accents', relight(this.get('ansi0'), weakest, ON_ACCENT_MIN, light))
    }

    if (ratio(this.get('ansi7'), this.get('ansi8')) < ANSI7_ON_ANSI8_MIN) {
      this.set('ansi7', 'ansi7-on-ansi8', relight(this.get('ansi7'), this.get('ansi8'), ANSI7_ON_ANSI8_MIN, !light))
    }

    lift('selection', ['selection'], BODY_MIN, this.theme.foreground)

    if (this.theme.cursor !== undefined) lift('cursor', ['cursor'], CURSOR_MIN)
  }

  separate(): void {
    for (const [red, green] of confusions(this.theme)) {
      for (const mover of [green, red]) {
        if (this.pull(mover, mover === red ? green : red)) break
      }
    }
  }

  pull(mover: number, other: number): boolean {
    const from = this.get(`ansi${mover}`)
    const against = this.get(`ansi${other}`)
    const [l, c, h] = lchOf(from)
    const up = l >= lchOf(against)[0]
    const under = lumOf(this.theme.background)
    const ink = lumOf(this.get('ansi0'))

    deuteranopeInto(rgbOf(against), DEUT, 3)

    for (let step = 1; step <= 40; step++) {
      const to = shadeOf(l, c, h, step / 100, up)
      const lum = luminanceOf(to)

      if (contrastOf(lum, under) < ACCENT_MIN || (mover < 8 && contrastOf(lum, ink) < ON_ACCENT_MIN)) {
        return false
      }

      deuteranopeInto(to, DEUT, 0)

      if (apartAt(DEUT, 0, DEUT, 3) >= CLEAR) {
        this.set(`ansi${mover}`, 'cvd-red-green', hexOf(to))

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

    if (passes(fixer.theme)) break
  }

  return { theme: fixer.theme, moves: fixer.net() }
}

export function fixGate<T extends Fixable>(theme: T) {
  const fixer = new Fixer(theme)

  for (let pass = 0; pass < PASSES; pass++) {
    fixer.readability()
    fixer.separate()
    fixer.roles()

    if (passes(fixer.theme)) break
  }

  return { theme: fixer.theme, moves: fixer.net(), left: check(fixer.theme) }
}
