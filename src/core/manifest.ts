import pkg from '../../package.json' with { type: 'json' }
import { backdropTone } from './backdrop-tone.ts'
import { isHex } from './color.ts'
import { GATE_RULES, type GateRule, measure } from './contrast.ts'
import { memo } from './memo.ts'
import { mirror } from './mirror.ts'
import { type Mode, modeOf } from './mode.ts'
import type { Colors } from './seeds.ts'
import type { Shade, SharedPicture, Theme } from './theme.ts'
import { catalogProblem, nameProblem, textProblem } from './theme.ts'

export interface PaletteEntry {
  name: string
  base?: string
  from?: string
  catalog?: string
  native?: string
  nativeNames?: string[]
  lead?: boolean
  order: number
  ansiSource: string
  booru?: string
  booruSites?: Record<string, string[]>
  default?: boolean
  background: string
  foreground: string
  cursor: string
  selection: string
  signature: string[]
  signatureSlots: string[]
  ansi: string[]
  other?: Colors
  gate: number[]
  waived?: string[]
  backdrop: { slot: string; color: string; opacity: number }
  pictures?: SharedPicture[]
}

export const SCHEMA = 1

export interface Manifest {
  schema: number
  version: string
  gate: GateRule[]
  palettes: PaletteEntry[]
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

  const { slot, color, opacity } = backdropTone(
    { name: patched.name, ...colors, waived: theme.waive },
    patched.signatureSlots,
  )

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
  const { slot, color, opacity } = backdropTone(
    {
      name: t.name,
      background: t.background,
      foreground: t.foreground,
      cursor: t.cursor,
      selection: t.selectionBackground,
      ansi: t.ansi,
      waived: t.waive,
    },
    t.signatureSlots,
  )

  return {
    name: t.name,
    ...(t.base ? { base: t.base } : {}),
    ...(t.from ? { from: t.from } : {}),
    ...(t.catalog ? { catalog: t.catalog } : {}),
    ...(t.native ? { native: t.native } : {}),
    ...(t.nativeNames ? { nativeNames: t.nativeNames } : {}),
    ...(t.lead ? { lead: true } : {}),
    order: t.order,
    ansiSource: t.ansiSource,
    ...(t.booru ? { booru: t.booru } : {}),
    ...(t.booruSites ? { booruSites: t.booruSites } : {}),
    ...(t.role === 'default' ? { default: true } : {}),
    background: t.background,
    foreground: t.foreground,
    cursor: t.cursor,
    selection: t.selectionBackground,
    signature: t.signature,
    signatureSlots: t.signatureSlots,
    ansi: t.ansi,
    ...(t.other ? { other: colorsOfTheme(t.other) } : {}),
    gate: measure(t),
    ...(t.waive.length > 0 ? { waived: t.waive } : {}),
    backdrop: { slot, color, opacity },
    ...(t.pictures ? { pictures: t.pictures } : {}),
  }
}

export function toTheme(entry: PaletteEntry): Theme {
  return {
    name: entry.name,
    ...(entry.base ? { base: entry.base } : {}),
    ...(entry.from ? { from: entry.from } : {}),
    ...(entry.catalog ? { catalog: entry.catalog } : {}),
    ...(entry.native ? { native: entry.native } : {}),
    ...(entry.nativeNames ? { nativeNames: entry.nativeNames } : {}),
    lead: entry.lead === true,
    order: entry.order,
    ...(entry.default ? { role: 'default' as const } : {}),
    ansiSource: entry.ansiSource,
    ...(entry.booru ? { booru: entry.booru } : {}),
    ...(entry.booruSites ? { booruSites: entry.booruSites } : {}),
    background: entry.background,
    foreground: entry.foreground,
    cursor: entry.cursor,
    selectionBackground: entry.selection,
    ansi: entry.ansi,
    ...(entry.other ? { other: shadeOf(entry.other) } : {}),
    signature: entry.signature,
    signatureSlots: entry.signatureSlots,
    ghostty: {
      iconGhost: entry.cursor,
      iconScreen: [entry.cursor, entry.selection, entry.background],
    },
    waive: entry.waived ?? [],
    ...(entry.pictures ? { pictures: entry.pictures } : {}),
  }
}

const SWATCH_SIZE = 6
const SWATCH_FILL = ['ansi1', 'ansi2', 'ansi4', 'ansi3', 'ansi5', 'ansi6']

type Swatched = Pick<PaletteEntry, 'foreground' | 'cursor' | 'selection' | 'ansi' | 'signatureSlots'>

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

  for (const slot of ['foreground', ...entry.signatureSlots, ...SWATCH_FILL]) {
    const hex = color(slot)

    if (colors.length === SWATCH_SIZE || !hex || roles.has(role(slot)) || colors.includes(hex)) {
      continue
    }

    roles.add(role(slot))
    colors.push(hex)
  }

  return colors
}

export function listed(palettes: PaletteEntry[]): PaletteEntry[] {
  return palettes.filter((p) => p.default !== true)
}

export function emptyManifest(): Manifest {
  return { schema: SCHEMA, version: pkg.version, gate: GATE_RULES, palettes: [] }
}

export function parseManifest(source: string): Manifest {
  let doc: unknown

  try {
    doc = JSON.parse(source)
  } catch {
    throw new Error('the manifest is not valid JSON')
  }

  const manifest = doc as Manifest

  if (typeof manifest?.version !== 'string' || !Array.isArray(manifest.palettes)) {
    throw new Error('the manifest has no version or palettes')
  }

  for (const p of manifest.palettes) {
    const problem = entryProblem(p)

    if (problem) {
      throw new Error(`manifest entry ${JSON.stringify(p?.name)} ${problem}`)
    }
  }

  return manifest
}

export function entryProblem(p: PaletteEntry): string | undefined {
  if (typeof p?.name !== 'string' || !Array.isArray(p.ansi) || p.ansi.length !== 16) {
    return 'is missing name or its 16 ANSI colors'
  }

  const named = [p.name, p.base, p.from]
    .map((name) => (name === undefined ? undefined : nameProblem(name)))
    .find(Boolean)

  if (named) {
    return named
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

  const shelved = typeof p.catalog === 'string' ? catalogProblem(p.catalog) : undefined

  if (shelved) {
    return shelved
  }

  return [p.native ?? '-', p.catalog ?? '-', p.ansiSource]
    .map((field) => (typeof field === 'string' ? textProblem(field) : 'has a field that is not text'))
    .find(Boolean)
}
