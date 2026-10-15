import type { GateRule, Marketplace, Theme } from '@/lib/themes'

export type Where = Pick<Marketplace, 'id' | 'repo' | 'add'> | null

export interface WorkspaceData {
  where: Where
  palettes: Theme[]
  gate: GateRule[]
  start: string
  current: string
}

export interface Neighbors {
  at: number
  count: number
  prev: Theme
  next: Theme
}

export function leadOf(themes: Theme[]): Theme {
  return themes.find((theme) => theme.lead) ?? (themes[0] as Theme)
}

export function neighbors(theme: Theme, palettes: Theme[]): Neighbors {
  const shelf = palettes.filter((other) => other.catalog === theme.catalog)
  const at = shelf.indexOf(theme)

  return {
    at: at + 1,
    count: shelf.length,
    prev: shelf[(at - 1 + shelf.length) % shelf.length] as Theme,
    next: shelf[(at + 1) % shelf.length] as Theme,
  }
}

export function nameAt(path: string): string | null {
  const parts = path.split('/').filter(Boolean)

  if (parts[0] !== 'marketplace' || parts.length !== 3) return null

  try {
    return decodeURIComponent(parts[2] as string)
  } catch {
    return null
  }
}
