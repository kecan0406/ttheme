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
  ansi: string[]
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
  ansi: string[]
}

interface Manifest {
  version: string
  palettes: ManifestEntry[]
}

const manifestPath = join(process.cwd(), '..', 'dist', 'manifest.json')

export function loadThemes(): Theme[] {
  const { palettes }: Manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  return palettes
    .filter((entry) => !entry.default)
    .map((entry) => ({
      name: entry.name,
      group: entry.group,
      native: entry.native ?? null,
      lead: entry.lead === true,
      ansiSource: entry.ansiSource,
      background: entry.background,
      foreground: entry.foreground,
      cursor: entry.cursor,
      selectionBackground: entry.selection,
      signature: entry.signature,
      ansi: entry.ansi,
    }))
}
