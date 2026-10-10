import type { Theme } from '@/lib/themes'

export type Source = 'all' | 'official' | 'marketplaces'

export const SOURCES: Source[] = ['all', 'official', 'marketplaces']

export interface Filters {
  query: string
  source: Source
}

export const START: Filters = { query: '', source: 'all' }

export interface Searchable {
  text: string
  official: boolean
}

export function searchable(theme: Theme): Searchable {
  return {
    text: `${theme.id} ${theme.catalog ?? ''} ${theme.native ?? ''}`.toLowerCase(),
    official: theme.marketplace === null,
  }
}

export function matches({ text, official }: Searchable, { query, source }: Filters): boolean {
  if (source === 'official' && !official) return false
  if (source === 'marketplaces' && official) return false
  const q = query.trim().toLowerCase()
  return !q || text.includes(q)
}

export function shelvesMatching(shelves: Searchable[][], filters: Filters): number {
  return shelves.filter((members) => members.some((member) => matches(member, filters))).length
}

export interface Shelf {
  id: string
  repo: string
  about: string
  palettes: Theme[]
}

export const OFFICIAL = 'official'

export const OFFICIAL_REPO = 'kecan0406/ttheme'

export const OFFICIAL_ABOUT =
  'The palettes that come with ttheme, each measured from official art and held to the contrast gate before it ships.'

export function marketplacePath(id: string | null): string {
  return `/marketplace/${id === null ? OFFICIAL : encodeURIComponent(id).replaceAll('%40', '@')}`
}

export function palettePath(theme: Pick<Theme, 'marketplace' | 'name'>): string {
  return `${marketplacePath(theme.marketplace)}/${encodeURIComponent(theme.name)}`
}

export function catalogAnchor(catalog: string | null): string {
  if (catalog === null) return 'loose'
  return `catalog-${catalog
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')}`
}

export function catalogPath(theme: Pick<Theme, 'marketplace' | 'catalog'>): string {
  return `${marketplacePath(theme.marketplace)}#${catalogAnchor(theme.catalog)}`
}
