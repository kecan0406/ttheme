import pkg from '../../package.json' with { type: 'json' }
import { backdropTone, PLACEMENT } from '../backdrop.ts'
import { GATE_RULES, type GateRule, measure } from '../contrast.ts'
import type { SharedPicture, Theme } from '../theme.ts'
import type { Emitter, Output } from './index.ts'

export interface PaletteEntry {
  name: string
  base?: string
  group: string
  native?: string
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
  gate: number[]
  waived?: string[]
  backdrop: { slot: string; color: string; opacity: number }
  pictures?: SharedPicture[]
}

export interface Manifest {
  version: string
  gate: GateRule[]
  placement: typeof PLACEMENT
  palettes: PaletteEntry[]
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
    group: t.group,
    ...(t.native ? { native: t.native } : {}),
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
    group: entry.group,
    ...(entry.native ? { native: entry.native } : {}),
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

export function listed(palettes: PaletteEntry[]): PaletteEntry[] {
  return palettes.filter((p) => p.default !== true)
}

export function manifest(themes: Theme[]): Manifest {
  const [first] = themes
  if (!first) {
    throw new Error('manifest needs at least one theme')
  }
  return {
    version: pkg.version,
    gate: GATE_RULES,
    placement: PLACEMENT,
    palettes: themes.map(paletteEntry),
  }
}

export const meta: Emitter = {
  id: 'meta',

  emitShared(themes: Theme[]): Output[] {
    return [{ path: 'manifest.json', content: `${JSON.stringify(manifest(themes), null, 2)}\n` }]
  },
}
