import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface GateRule {
  rule: string
  label: string
  unit: 'ratio' | 'luminance'
  min?: number
  max?: number
}

export interface Theme {
  name: string
  group: string
  native: string | null
  lead: boolean
  order: number
  ansiSource: string
  background: string
  foreground: string
  cursor: string
  selectionBackground: string
  signature: string[]
  signatureSlots: string[]
  ansi: string[]
  gate: number[]
  waived: string[]
}

export interface Catalog {
  themes: Theme[]
  gate: GateRule[]
}

interface ManifestEntry {
  name: string
  group: string
  native?: string
  lead?: boolean
  order: number
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
  waived?: string[]
}

interface Manifest {
  version: string
  gate: GateRule[]
  palettes: ManifestEntry[]
}

const manifestPath = join(process.cwd(), '..', 'dist', 'manifest.json')

export function loadCatalog(): Catalog {
  const { gate, palettes }: Manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  return {
    gate,
    themes: palettes
      .filter((entry) => !entry.default)
      .map((entry) => ({
        name: entry.name,
        group: entry.group,
        native: entry.native ?? null,
        lead: entry.lead === true,
        order: entry.order,
        ansiSource: entry.ansiSource,
        background: entry.background,
        foreground: entry.foreground,
        cursor: entry.cursor,
        selectionBackground: entry.selection,
        signature: entry.signature,
        signatureSlots: entry.signatureSlots,
        ansi: entry.ansi,
        gate: entry.gate,
        waived: entry.waived ?? [],
      })),
  }
}
