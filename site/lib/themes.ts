import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface Theme {
  id: string
  market: string | null
  name: string
  group: string
  native: string | null
  lead: boolean
  ansiSource: string
  background: string
  foreground: string
  cursor: string
  selectionBackground: string
  signature: string[]
  signatureSlots: string[]
  ansi: string[]
  gate: number[]
}

export interface GateRule {
  rule: string
  label: string
  unit: 'ratio' | 'luminance'
  min?: number
  max?: number
}

export interface ManifestEntry {
  name: string
  group: string
  native?: string
  lead?: boolean
  ansiSource: string
  default?: boolean
  background: string
  foreground: string
  cursor: string
  selection: string
  signature: string[]
  signatureSlots: string[]
  ansi: string[]
  gate: number[]
}

interface Manifest {
  version: string
  gate: GateRule[]
  palettes: ManifestEntry[]
}

const manifestPath = join(process.cwd(), '..', 'dist', 'manifest.json')

export function toTheme(entry: ManifestEntry, market: string | null = null): Theme {
  return {
    id: market ? `${market}/${entry.name}` : entry.name,
    market,
    name: entry.name,
    group: market ?? entry.group,
    native: market ? null : (entry.native ?? null),
    lead: market ? false : (entry.lead ?? false),
    ansiSource: entry.ansiSource,
    background: entry.background,
    foreground: entry.foreground,
    cursor: entry.cursor,
    selectionBackground: entry.selection,
    signature: entry.signature,
    signatureSlots: entry.signatureSlots,
    ansi: entry.ansi,
    gate: entry.gate,
  }
}

export function loadManifest(): { version: string; gate: GateRule[]; themes: Theme[] } {
  const { version, gate, palettes }: Manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  return {
    version,
    gate,
    themes: palettes.filter((entry) => !entry.default).map((entry) => toTheme(entry)),
  }
}
