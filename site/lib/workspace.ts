import type { GateRule, Marketplace, Theme } from '@/lib/themes'

export type Where = Pick<Marketplace, 'id' | 'repo' | 'add'> | null

export interface WorkspaceData {
  where: Where
  gate: GateRule[]
  start: string
  current: string
}

export interface Neighbors {
  prev: Theme
  next: Theme
}

export function neighbors(theme: Theme, palettes: Theme[]): Neighbors {
  const home = theme.work?.id ?? null
  const shelf = palettes.filter((other) => (other.work?.id ?? null) === home)
  const at = shelf.indexOf(theme)

  return {
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
