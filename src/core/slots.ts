import { contrast, type Hex, luminance, type Oklch, oklch, rgb } from './color.ts'
import {
  ACCENT_SLOTS,
  ACHROMATIC,
  BRIGHT_GAP,
  brightDrift,
  confusions,
  exemptSlots,
  GATE_RULES,
  type Gated,
  hueGap,
  isLight,
  lookalikes,
  offRole,
  ROLE_HUES,
  ROLES,
  roleOf,
} from './contrast.ts'
import { type Colors, SEEDS } from './seeds.ts'

export const SLOT_NAMES = [
  'background',
  'foreground',
  'cursor',
  'selection',
  ...Array.from({ length: 16 }, (_, i) => `ansi${i}`),
]

export function listOf(c: Colors): Hex[] {
  return [c.background, c.foreground, c.cursor, c.selection, ...c.ansi]
}

export function slotLabel(slot: number) {
  if (slot < BASE.length) {
    return { name: BASE[slot] as string, about: SLOT_NAMES[slot] as string }
  }

  const ansi = slot - BASE.length
  const pair = PAIRS[ansi % 8] as string

  return ansi < 8
    ? { name: pair, about: `ANSI ${ansi}` }
    : { name: `Bright ${pair.toLowerCase()}`, about: `ANSI ${ansi}` }
}

export function slotUse(slot: number): string {
  const ansi = slot - BASE.length

  if (ansi >= 9 && ansi <= 15) {
    return `Bold or bright ${(PAIRS[ansi - 8] as string).toLowerCase()} text`
  }

  return USES[slot] as string
}

export function ruleSlots(list: Hex[], signature: string[], waive: string[], rule: string): number[] {
  const theme = gatedOf(list, signature, waive)
  const { background: bg, foreground: fg, selection, ansi } = colorsOf(list)
  const under = (slot: number, color: Hex, against: Hex) => (contrast(color, against) < bound(rule) ? [slot] : [])

  if (rule === 'foreground') {
    return contrast(fg, bg) < bound(rule) ? [1, 0] : []
  }

  if (rule === 'selection') {
    return contrast(fg, selection) < bound(rule) ? [3, 1] : []
  }

  if (rule === 'accents') {
    return ACCENT_SLOTS.flatMap((i) => under(BASE.length + i, ansi[i] as Hex, bg))
  }

  if (rule === 'light-ansi') {
    return [7, 15].flatMap((i) => under(BASE.length + i, ansi[i] as Hex, bg))
  }

  if (rule === 'ansi8-visible') {
    return under(BASE.length + 8, ansi[8] as Hex, bg)
  }

  if (rule === 'ansi0-dark') {
    return !isLight(theme) && luminance(ansi[0] as Hex) > bound(rule) ? [BASE.length] : []
  }

  if (rule === 'ansi0-on-accents') {
    const low = ROLES.flatMap((i) => under(BASE.length + i, ansi[i] as Hex, ansi[0] as Hex))

    return low.length > 0 ? [BASE.length, ...low] : []
  }

  if (rule === 'ansi7-on-ansi8') {
    return contrast(ansi[7] as Hex, ansi[8] as Hex) < bound(rule) ? [BASE.length + 7, BASE.length + 8] : []
  }

  if (rule === 'cvd-red-green') {
    return confusions(theme).flatMap(([red, green]) => [BASE.length + red, BASE.length + green])
  }

  if (rule === 'ansi-role') {
    return offRole(theme).map(({ slot }) => BASE.length + slot)
  }

  if (rule === 'bright-follows') {
    return brightDrift(theme)
      .filter(({ gap }) => gap > BRIGHT_GAP)
      .flatMap(({ normal }) => [BASE.length + normal, BASE.length + normal + 8])
  }

  if (rule === 'distinct') {
    return lookalikes(theme).flatMap(([a, b]) => [BASE.length + a, BASE.length + b])
  }

  return []
}

export function misses(list: Hex[], signature: string[], waive: string[]): Set<number> {
  return new Set(
    [...SLOT_NAMES.keys()].filter((slot) =>
      slotChecks(list, signature, waive, slot).some((check) => check.ok === false),
    ),
  )
}

export function slotChecks(list: Hex[], signature: string[], waive: string[], slot: number): Check[] {
  const c = colorsOf(list)
  const theme = gatedOf(list, signature, waive)

  if (slot === 0) {
    const weakest = ACCENT_SLOTS.reduce((a, b) =>
      contrast(c.ansi[a] as Hex, c.background) <= contrast(c.ansi[b] as Hex, c.background) ? a : b,
    )

    return [
      ratioCheck(c.foreground, c.background, 'foreground', 'Foreground on it', waive),
      ratioCheck(c.ansi[weakest] as Hex, c.background, 'accents', `Weakest, ANSI ${weakest},`, waive),
      ratioCheck(c.ansi[8] as Hex, c.background, 'ansi8-visible', 'ANSI 8 on it', waive),
    ]
  }

  if (slot === 1) {
    return [
      ratioCheck(c.foreground, c.background, 'foreground', 'On background', waive),
      ratioCheck(c.foreground, c.selection, 'selection', 'On the selection', waive),
    ]
  }

  if (slot === 2) {
    return [{ ok: undefined, text: `On background ${contrast(c.cursor, c.background).toFixed(2)}:1` }]
  }

  if (slot === 3) {
    return [ratioCheck(c.foreground, c.selection, 'selection', 'Foreground on it', waive)]
  }

  const ansi = slot - BASE.length
  const color = c.ansi[ansi] as Hex

  if (ansi === 0) {
    const lum = luminance(color)
    const max = bound('ansi0-dark')
    const weakest = weakestUnder(list)
    const under = ratioCheck(color, c.ansi[weakest] as Hex, 'ansi0-on-accents', `On ANSI ${weakest}`, waive)

    if (isLight(theme)) return [under]

    return [
      waive.includes('ansi0-dark')
        ? { ok: undefined, text: `Luminance ${lum.toFixed(3)} · waived` }
        : { ok: lum <= max, text: `Luminance ${lum.toFixed(3)} · ≤ ${max}` },
      under,
    ]
  }

  if (ansi === 7) {
    return [
      ratioCheck(color, c.background, 'light-ansi', 'On background', waive),
      ratioCheck(color, c.ansi[8] as Hex, 'ansi7-on-ansi8', 'On ANSI 8', waive),
    ]
  }

  if (ansi === 15) {
    return [ratioCheck(color, c.background, 'light-ansi', 'On background', waive)]
  }

  if (ansi === 8) {
    return [
      ratioCheck(color, c.background, 'ansi8-visible', 'On background', waive),
      ratioCheck(c.ansi[7] as Hex, color, 'ansi7-on-ansi8', 'ANSI 7 on it', waive),
    ]
  }

  const checks = [ratioCheck(color, c.background, 'accents', 'On background', waive)]

  if (ROLES.includes(ansi)) {
    checks.push(ratioCheck(c.ansi[0] as Hex, color, 'ansi0-on-accents', 'ANSI 0 on it', waive))
  }

  const here = oklch(color)
  const role = roleOf(ansi)
  const band = ROLE_HUES.get(role) as { name: string; center: number; width: number }
  const range = `${band.name} ${band.center}±${band.width}°`

  if (here.c < ACHROMATIC) {
    checks.push({ ok: undefined, text: 'Too grey to have a hue' })
  } else if (exemptSlots(theme).has(ansi)) {
    checks.push({ ok: undefined, text: `Hue ${here.h.toFixed(0)}° · a signature, free of ${range}` })
  } else if (waive.includes('ansi-role')) {
    checks.push({ ok: undefined, text: `Hue ${here.h.toFixed(0)}° · ${range} waived` })
  } else {
    const over = hueGap(here.h, band.center) - band.width
    checks.push(
      over > 0
        ? { ok: false, text: `Hue ${here.h.toFixed(0)}° · ${over.toFixed(0)}° outside ${range}` }
        : { ok: true, text: `Hue ${here.h.toFixed(0)}° · in ${range}` },
    )
  }

  const twin = ansi < 8 ? ansi + 8 : ansi - 8
  const drift = brightDrift(theme).find((d) => d.normal === role)

  if (drift) {
    checks.push(
      waive.includes('bright-follows')
        ? { ok: undefined, text: `${drift.gap.toFixed(0)}° from ANSI ${twin} · waived` }
        : { ok: drift.gap <= BRIGHT_GAP, text: `${drift.gap.toFixed(0)}° from ANSI ${twin} · ≤ ${BRIGHT_GAP}°` },
    )
  }

  const alike = lookalikes(theme).flatMap(([a, b]) => (a === ansi ? [b] : b === ansi ? [a] : []))

  if (alike.length > 0 && !waive.includes('distinct')) {
    checks.push({ ok: false, text: `Reads as ANSI ${alike.join(', ')} at text size` })
  }

  const mixed = confusions(theme).flatMap(([red, green]) => (red === ansi ? [green] : green === ansi ? [red] : []))

  if (mixed.length > 0 && !waive.includes('cvd-red-green')) {
    checks.push({ ok: false, text: `Reads as ANSI ${mixed.join(', ')} to a deuteranope` })
  }

  return checks
}

export function lchIn(list: Hex[], hex: Hex): Oklch {
  const found = oklch(hex)

  if (!grey(hex)) {
    return found
  }

  const tinted = [0, 1, 3, 2].map((slot) => list[slot] as Hex).find((color) => !grey(color))

  return { ...found, h: tinted ? oklch(tinted).h : SEEDS.hue }
}

export function colorText(format: Format, hex: Hex, at: Oklch): string {
  if (format === 'rgb') {
    const [r, g, b] = rgb(hex)

    return `rgb(${r} ${g} ${b})`
  }

  if (format === 'oklch') {
    return `oklch(${at.l.toFixed(3)} ${at.c.toFixed(3)} ${at.h.toFixed(0)})`
  }

  return hex
}

export function lchTight(at: Oklch): string {
  const short = (n: number, digits: number) => n.toFixed(digits).replace(/^0(?=\.)/, '')

  return `${short(at.l, 2)} ${short(at.c, 3)} ${at.h.toFixed(0).padStart(3)}°`
}

export function bound(rule: string): number {
  const found = GATE_RULES.find((r) => r.rule === rule)

  return found?.min ?? found?.max ?? 0
}

export function grey(hex: Hex): boolean {
  const [r, g, b] = rgb(hex)

  return r === g && g === b
}

function ratioCheck(color: Hex, against: Hex, rule: string, what: string, waive: string[]): Check {
  const ratio = contrast(color, against)
  const min = bound(rule)

  if (waive.includes(rule)) {
    return { ok: undefined, text: `${what} ${ratio.toFixed(2)}:1 · waived` }
  }

  return { ok: ratio >= min, text: `${what} ${ratio.toFixed(2)}:1 · ≥ ${min}` }
}

const USES = [
  'Behind every cell',
  'Plain text',
  'The cursor block',
  'Selected text',
  'Text on colored bars, dark shades',
  'Errors, deleted lines, failed tests',
  'Success, added lines, prompts',
  'Warnings, commit hashes, skipped tests',
  'Directories, info, keywords',
  'Keywords, branches, pictures in ls',
  'Links, diff hunks, types',
  'Light shades, text in some programs',
  'Comments, muted text, suggestions',
]

export function weakestUnder(list: Hex[]): number {
  const ansi = colorsOf(list).ansi

  return ROLES.reduce((a, b) =>
    contrast(ansi[0] as Hex, ansi[a] as Hex) <= contrast(ansi[0] as Hex, ansi[b] as Hex) ? a : b,
  )
}

export const BASE = ['Background', 'Foreground', 'Cursor', 'Selection']

export interface Check {
  ok: boolean | undefined
  text: string
}

export function colorsOf(list: Hex[]): Colors {
  const [background, foreground, cursor, selection, ...ansi] = list as [Hex, Hex, Hex, Hex, ...Hex[]]

  return { background, foreground, cursor, selection, ansi }
}

export type Format = 'hex' | 'rgb' | 'oklch'

export function gatedOf(list: Hex[], signature: string[], waive: string[]): Gated {
  const c = colorsOf(list)

  return {
    name: 'draft',
    background: c.background,
    foreground: c.foreground,
    selectionBackground: c.selection,
    ansi: c.ansi,
    waive,
    signatureSlots: signature,
  }
}

export const PAIRS = ['Black', 'Red', 'Green', 'Yellow', 'Blue', 'Magenta', 'Cyan', 'White']
