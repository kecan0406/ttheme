import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface Theme {
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
  backdrop: Tone
}

export interface Tone {
  slot: string
  color: string
  opacity: number
}

export interface Placement {
  tall: number
  reach: number
  widest: number
  headroom: number
  margin: number
  stands: number
}

export interface GateRule {
  rule: string
  label: string
  unit: 'ratio' | 'luminance'
  min?: number
  max?: number
}

interface ManifestEntry {
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
  backdrop: Tone
}

interface Manifest {
  version: string
  gate: GateRule[]
  placement: Placement
  palettes: ManifestEntry[]
}

const manifestPath = join(process.cwd(), '..', 'dist', 'manifest.json')

export function loadManifest(): { version: string; gate: GateRule[]; placement: Placement; themes: Theme[] } {
  const { version, gate, placement, palettes }: Manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  return {
    version,
    gate,
    placement,
    themes: palettes
      .filter((entry) => !entry.default)
      .map((entry) => ({
        name: entry.name,
        group: entry.group,
        native: entry.native ?? null,
        lead: entry.lead ?? false,
        ansiSource: entry.ansiSource,
        background: entry.background,
        foreground: entry.foreground,
        cursor: entry.cursor,
        selectionBackground: entry.selection,
        signature: entry.signature,
        signatureSlots: entry.signatureSlots,
        ansi: entry.ansi,
        gate: entry.gate,
        backdrop: entry.backdrop,
      })),
  }
}
