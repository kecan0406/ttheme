export interface GateRule {
  rule: string
  label: string
  unit: string
  min?: number
  max?: number
}

export interface Theme {
  id: string
  marketplace: string | null
  name: string
  group: string
  catalog: string | null
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

export interface Marketplace {
  id: string
  repo: string
  add: string
  about: string
  stars: number
  pushedAt: string
  license: string | null
  palettes: Theme[]
}

export interface ManifestEntry {
  name: string
  group: string
  catalog?: string
  native?: string
  lead?: boolean
  ansiSource: string
  background: string
  foreground: string
  cursor: string
  selection: string
  signature: string[]
  signatureSlots: string[]
  ansi: string[]
  gate: number[]
}

export function toTheme(entry: ManifestEntry, marketplace: string | null = null): Theme {
  return {
    id: marketplace ? `${marketplace}/${entry.name}` : entry.name,
    marketplace,
    name: entry.name,
    group: marketplace ?? entry.group,
    catalog: marketplace ? (entry.catalog ?? null) : null,
    native: marketplace ? null : (entry.native ?? null),
    lead: marketplace ? false : (entry.lead ?? false),
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
