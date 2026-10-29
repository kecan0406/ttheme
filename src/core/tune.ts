import { contrast, type Hex, luminance, type Oklch, oklch } from './color.ts'
import { ACCENT_SLOTS, ACHROMATIC, hueGap } from './contrast.ts'
import { inGamut } from './fix.ts'
import { reach } from './plane.ts'
import { BASE, bound, lchIn, weakestUnder } from './slots.ts'

export interface Partner {
  against: number
  floor: number | undefined
}

export interface Placed {
  lch: Oklch
  hex: Hex
}

export interface Solved extends Placed {
  stops: number | undefined
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const hexOf = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')

export function room(l: number, h: number): number {
  return Math.floor(reach(l, h) * 10_000) / 10_000
}

export function placed(l: number, c: number, h: number): Placed {
  const fits = Math.min(c, room(l, h))

  return { lch: { l, c: fits, h }, hex: inGamut(l, fits, h) }
}

export function parseColor(text: string): Hex | undefined {
  const t = text.trim().toLowerCase()
  const hex = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/.exec(t)

  if (hex) {
    const h = hex[1] as string

    return `#${h.length === 3 ? [...h].map((c) => c + c).join('') : h}`
  }

  const rgb = /^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/.exec(t)

  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map((n) => hexOf(Number(n)))
      .join('')}`
  }

  const lch = /^oklch\(\s*([\d.]+)(%?)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:deg|°)?\s*\)$/.exec(t)

  if (lch) {
    const l = Number(lch[1]) / (lch[2] ? 100 : 1)

    return inGamut(clamp(l, 0, 1), Number(lch[3]), Number(lch[4]) % 360)
  }

  return undefined
}

export function partnerOf(list: Hex[], slot: number): Partner {
  const ansi = slot - BASE.length

  const rule =
    slot <= 1
      ? 'foreground'
      : slot === 3
        ? 'selection'
        : ansi === 0
          ? 'ansi0-on-accents'
          : ansi === 7 || ansi === 15
            ? 'light-ansi'
            : ansi === 8
              ? 'ansi8-visible'
              : ACCENT_SLOTS.includes(ansi)
                ? 'accents'
                : undefined

  return {
    against: ansi === 0 ? BASE.length + weakestUnder(list) : slot === 0 || slot === 3 ? 1 : 0,
    floor: rule === undefined ? undefined : bound(rule),
  }
}

export function solveLightness(color: Hex, at: Oklch, keep: number, against: Hex, target: number): Solved {
  const colorAt = (l: number) => inGamut(l, Math.min(keep, room(l, at.h)), at.h)
  const ratioAt = (l: number) => contrast(colorAt(l), against)
  const up = luminance(color) >= luminance(against)
  const want = Math.max(1, Math.round(target * 100) / 100)
  const far = up ? 1 : 0
  const short = ratioAt(far) < want
  let l = far

  if (!short) {
    let near = oklch(against).l
    let away = far

    for (let i = 0; i < 24; i++) {
      const mid = (near + away) / 2

      if (ratioAt(mid) >= want) {
        away = mid
      } else {
        near = mid
      }
    }

    l = away
  }

  let found = placed(l, keep, at.h)

  for (let i = 0; i < 40 && l !== far && contrast(found.hex, against) < want; i++) {
    l = up ? Math.min(1, l + 0.001) : Math.max(0, l - 0.001)
    found = placed(l, keep, at.h)
  }

  return {
    lch: { ...found.lch, l: Math.round(l * 10_000) / 10_000 },
    hex: found.hex,
    stops: short ? ratioAt(far) : undefined,
  }
}

export function offsetOf(from: Oklch, to: Oklch): Oklch {
  return { l: to.l - from.l, c: to.c - from.c, h: ((((to.h - from.h) % 360) + 540) % 360) - 180 }
}

export function brightLinks(list: Hex[]): Map<number, Oklch> {
  const links = new Map<number, Oklch>()

  for (let k = 0; k < 8; k++) {
    const normal = BASE.length + k
    const bright = normal + 8
    const a = lchIn(list, list[normal] as Hex)
    const b = lchIn(list, list[bright] as Hex)

    if (a.c >= ACHROMATIC && b.c >= ACHROMATIC && hueGap(a.h, b.h) <= 3) {
      links.set(bright, offsetOf(a, b))
    }
  }

  return links
}

export function following(normal: Oklch, by: Oklch): Placed {
  return placed(clamp(normal.l + by.l, 0, 1), Math.max(0, normal.c + by.c), (((normal.h + by.h) % 360) + 360) % 360)
}
