import type { Scene } from '@/components/terminal-preview'
import type { Theme } from '@/lib/themes'
import { isLight } from '@/lib/wear'

export type Source = 'all' | 'official' | 'markets'
export type Ground = 'both' | 'dark' | 'light'

export interface Filters {
  query: string
  source: Source
  ground: Ground
  scene: Scene
}

export interface Section {
  key: string
  title: string
  subtitle?: string
  href?: string
  themes: Theme[]
}

export interface Shelf {
  title: string
  market: boolean
  count: number
}

export interface Placed {
  shown: boolean
  heading: boolean
  divider: boolean
  total: number
}

export const START: Filters = { query: '', source: 'all', ground: 'both', scene: 'shell' }

export function matches(theme: Theme, { query, source, ground }: Filters): boolean {
  if (source === 'official' && theme.market) return false
  if (source === 'markets' && !theme.market) return false
  if (ground !== 'both' && isLight(theme) !== (ground === 'light')) return false
  const q = query.trim().toLowerCase()
  return !q || `${theme.id} ${theme.group} ${theme.native ?? ''}`.toLowerCase().includes(q)
}

export function arrange(shelves: Shelf[], sources: boolean): Placed[] {
  const totals = new Map<string, number>()
  for (const shelf of shelves) totals.set(shelf.title, (totals.get(shelf.title) ?? 0) + shelf.count)
  let previous: Shelf | undefined
  let marketsShown = false
  return shelves.map((shelf) => {
    if (shelf.count === 0) return { shown: false, heading: false, divider: false, total: 0 }
    const divider = sources && shelf.market && !marketsShown
    marketsShown ||= shelf.market
    const heading = previous?.title !== shelf.title
    previous = shelf
    return { shown: true, heading, divider, total: totals.get(shelf.title) ?? 0 }
  })
}

export function marketPath(id: string): string {
  return `/market/${encodeURIComponent(id).replaceAll('%40', '@')}`
}
