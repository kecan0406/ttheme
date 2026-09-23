import pkg from '../../package.json' with { type: 'json' }
import { GATE_RULES, type GateRule, measure } from '../contrast.ts'
import type { Font, Theme } from '../theme.ts'
import type { Emitter, Output } from './index.ts'

export interface PaletteEntry {
  name: string
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
}

export interface Manifest {
  version: string
  gate: GateRule[]
  font: Font
  shader?: string
  palettes: PaletteEntry[]
}

export function paletteEntry(t: Theme): PaletteEntry {
  return {
    name: t.name,
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
    font: first.font,
    ...(first.ghostty.shader ? { shader: first.ghostty.shader } : {}),
    palettes: themes.map(paletteEntry),
  }
}

export const meta: Emitter = {
  id: 'meta',

  emitShared(themes: Theme[]): Output[] {
    return [{ path: 'manifest.json', content: `${JSON.stringify(manifest(themes), null, 2)}\n` }]
  },
}
