import pkg from '../../package.json' with { type: 'json' }
import { backdropTone } from './backdrop-tone.ts'
import { isHex } from './color.ts'
import type { Work } from './commons.ts'
import { GATE_RULES, type GateRule, measure } from './contrast.ts'
import { memo } from './memo.ts'
import { mirror } from './mirror.ts'
import { type Mode, modeOf } from './mode.ts'
import type { Colors } from './seeds.ts'
import { FACE } from './slots.ts'
import type { Shade, SharedPicture, Theme } from './theme.ts'
import { nameProblem, subjectProblem } from './theme.ts'

export interface PaletteEntry {
  name: string
  subject?: string
  from?: string
  background: string
  foreground: string
  cursor: string
  selection: string
  signature: string[]
  signatureSlots: string[]
  ansi: string[]
  other?: Colors
  gate: number[]
  backdrop: { slot: string; color: string; opacity: number }
  pictures?: SharedPicture[]
}

export interface Bundle {
  version: string
  gate: GateRule[]
  palettes: PaletteEntry[]
}

export interface Manifest extends Bundle {
  works: Work[]
}

export function colorsOfTheme(theme: Shade): Colors {
  return {
    background: theme.background,
    foreground: theme.foreground,
    cursor: theme.cursor,
    selection: theme.selectionBackground,
    ansi: theme.ansi,
  }
}

export function shadeOf(colors: Colors): Shade {
  return {
    background: colors.background,
    foreground: colors.foreground,
    cursor: colors.cursor,
    selectionBackground: colors.selection,
    ansi: colors.ansi,
  }
}

type Painted = Pick<PaletteEntry, 'background' | 'foreground' | 'cursor' | 'selection' | 'ansi'>

export function slotColor(colors: Painted, slot: string): string {
  if (slot === 'background' || slot === 'foreground' || slot === 'cursor' || slot === 'selection') {
    return colors[slot]
  }

  return colors.ansi[Number(slot.slice(4))] as string
}

export function withColors(entry: PaletteEntry, colors: Colors): PaletteEntry {
  const patched = { ...entry, ...colors, signature: entry.signatureSlots.map((slot) => slotColor(colors, slot)) }
  const theme = toTheme(patched)

  const { slot, color, opacity } = backdropTone({ name: patched.name, ...colors })

  return { ...patched, gate: measure(theme), backdrop: { slot, color, opacity } }
}

export function otherColors(entry: PaletteEntry): Colors {
  if (entry.other) {
    return entry.other
  }

  const theme = toTheme(entry)

  return memo('mirror', JSON.stringify(theme), () => colorsOfTheme(mirror(theme)))
}

export function inMode(entry: PaletteEntry, mode: Mode): PaletteEntry {
  const same = modeOf(entry) === mode

  if (same && entry.other) {
    return entry
  }

  const other = otherColors(entry)

  if (same) {
    return { ...entry, other }
  }

  const own = {
    background: entry.background,
    foreground: entry.foreground,
    cursor: entry.cursor,
    selection: entry.selection,
    ansi: entry.ansi,
  }

  return memo('mode', JSON.stringify([entry, other]), () => withColors({ ...entry, other: own }, other))
}

export function paletteEntry(t: Theme): PaletteEntry {
  const { slot, color, opacity } = backdropTone({
    name: t.name,
    background: t.background,
    foreground: t.foreground,
    cursor: t.cursor,
    selection: t.selectionBackground,
    ansi: t.ansi,
  })

  return {
    name: t.name,
    ...(t.subject ? { subject: t.subject } : {}),
    ...(t.from ? { from: t.from } : {}),
    background: t.background,
    foreground: t.foreground,
    cursor: t.cursor,
    selection: t.selectionBackground,
    signature: t.signature,
    signatureSlots: t.signatureSlots,
    ansi: t.ansi,
    ...(t.other ? { other: colorsOfTheme(t.other) } : {}),
    gate: measure(t),
    backdrop: { slot, color, opacity },
    ...(t.pictures ? { pictures: t.pictures } : {}),
  }
}

export function toTheme(entry: PaletteEntry): Theme {
  return {
    name: entry.name,
    ...(entry.subject ? { subject: entry.subject } : {}),
    ...(entry.from ? { from: entry.from } : {}),
    background: entry.background,
    foreground: entry.foreground,
    cursor: entry.cursor,
    selectionBackground: entry.selection,
    ansi: entry.ansi,
    ...(entry.other ? { other: shadeOf(entry.other) } : {}),
    signature: entry.signature,
    signatureSlots: entry.signatureSlots,
    ...(entry.pictures ? { pictures: entry.pictures } : {}),
  }
}

const SWATCH_SIZE = 6
const SWATCH_FILL = ['ansi1', 'ansi2', 'ansi4', 'ansi3', 'ansi5', 'ansi6']

type Swatched = Pick<PaletteEntry, 'foreground' | 'cursor' | 'selection' | 'ansi'>

export function swatch(entry: Swatched): string[] {
  const color = (slot: string) =>
    slot.startsWith('ansi')
      ? entry.ansi[Number(slot.slice(4))]
      : slot === 'foreground'
        ? entry.foreground
        : slot === 'cursor'
          ? entry.cursor
          : slot === 'selection'
            ? entry.selection
            : undefined

  const role = (slot: string) => (slot.startsWith('ansi') ? `ansi${Number(slot.slice(4)) % 8}` : slot)
  const roles = new Set<string>()
  const colors: string[] = []

  for (const slot of ['foreground', ...FACE, ...SWATCH_FILL]) {
    const hex = color(slot)

    if (colors.length === SWATCH_SIZE || !hex || roles.has(role(slot)) || colors.includes(hex)) {
      continue
    }

    roles.add(role(slot))
    colors.push(hex)
  }

  return colors
}

export function emptyManifest(): Manifest {
  return { version: pkg.version, gate: GATE_RULES, palettes: [], works: [] }
}

export function parseBuiltin(source: string): Bundle {
  let doc: unknown

  try {
    doc = JSON.parse(source)
  } catch {
    throw new Error('the built-in palettes are not valid JSON')
  }

  const bundle = doc as Bundle

  if (typeof bundle?.version !== 'string' || !Array.isArray(bundle.palettes) || !Array.isArray(bundle.gate)) {
    throw new Error('the built-in palettes have no version, gate or palettes')
  }

  for (const p of bundle.palettes) {
    const problem = entryProblem(p)

    if (problem) {
      throw new Error(`the built-in palette ${JSON.stringify(p?.name)} ${problem}`)
    }
  }

  return { version: bundle.version, gate: bundle.gate, palettes: bundle.palettes }
}

export function entryProblem(p: PaletteEntry): string | undefined {
  if (typeof p?.name !== 'string' || !Array.isArray(p.ansi) || p.ansi.length !== 16) {
    return 'is missing name or its 16 ANSI colors'
  }

  const named = [p.name, p.from].map((name) => (name === undefined ? undefined : nameProblem(name))).find(Boolean)

  if (named) {
    return named
  }

  if (p.subject !== undefined && (typeof p.subject !== 'string' || subjectProblem(p.subject))) {
    return `names the subject ${JSON.stringify(p.subject)}, which is not <work> or <work>/<character>`
  }

  if (![p.background, p.foreground, p.cursor, p.selection, ...p.ansi].every((c) => typeof c === 'string' && isHex(c))) {
    return 'holds a color that is not "#rrggbb"'
  }

  const other = p.other

  if (
    other !== undefined &&
    !(
      Array.isArray(other?.ansi) &&
      other.ansi.length === 16 &&
      [other.background, other.foreground, other.cursor, other.selection, ...other.ansi].every(
        (c) => typeof c === 'string' && isHex(c),
      )
    )
  ) {
    return 'holds an other mode that is not 20 "#rrggbb" colors'
  }

  return undefined
}
