import type { Theme } from '@/lib/themes'
import { wearStyle } from '@/lib/wear'

export type Source = 'all' | 'official' | 'community'

export const SOURCES: Source[] = ['all', 'official', 'community']

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

  if (source === 'community' && official) return false
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
  updated: string
  palettes: Theme[]
}

export const OFFICIAL = 'official'

export const OFFICIAL_REPO = 'kecan0406/ttheme'

export const OFFICIAL_URL = `https://github.com/${OFFICIAL_REPO}`

export const NPM_URL = 'https://www.npmjs.com/package/@kecan0406/ttheme'

export const INIT = 'npx @kecan0406/ttheme init'

export const OFFICIAL_ABOUT = "The palettes that come with ttheme, each measured from the character's official art."

export function marketplacePath(id: string | null): string {
  return `/marketplace/${id === null ? OFFICIAL : encodeURIComponent(id).replaceAll('%40', '@')}`
}

export function palettePath(theme: Pick<Theme, 'marketplace' | 'name'>): string {
  return `${marketplacePath(theme.marketplace)}/${encodeURIComponent(theme.name)}`
}

export interface Peek {
  title: string
  use: string
  style: string
}

export function windowTitle(theme: Pick<Theme, 'name'>, catalog: string | null): string {
  return [catalog, theme.name].filter(Boolean).join(' · ')
}

export function peekOf(lead: Theme, catalog: string | null): Peek {
  return {
    title: windowTitle(lead, catalog),
    use: lead.marketplace ? lead.id : lead.name,
    style: wearStyle(lead),
  }
}
