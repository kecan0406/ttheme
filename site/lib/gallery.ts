import { BUILTIN, isBuiltin, shortName, type Theme } from '@/lib/themes'
import { wearStyle } from '@/lib/wear'

export type Source = 'all' | 'builtin' | 'community'

export const SOURCES: Source[] = ['all', 'builtin', 'community']

export const SOURCE_LABELS = {
  all: 'all',
  builtin: 'built-in',
  community: 'community',
} as const satisfies Record<Source, string>

export interface Filters {
  query: string
  source: Source
}

export const START: Filters = { query: '', source: 'all' }

export interface Searchable {
  text: string
  builtin: boolean
}

export function searchText(theme: Theme): string {
  const works = [theme.work, ...theme.also].flatMap((work) => (work ? [work.name, work.native ?? ''] : []))

  return [theme.id, ...works, theme.character?.id ?? '', ...(theme.character?.native ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function searchable(theme: Theme): Searchable {
  return { text: searchText(theme), builtin: isBuiltin(theme) }
}

export function matches({ text, builtin }: Searchable, { query, source }: Filters): boolean {
  if (source === 'builtin' && !builtin) return false

  if (source === 'community' && builtin) return false
  const q = query.trim().toLowerCase()

  return !q || text.includes(q)
}

export function shelvesMatching(shelves: Searchable[][], filters: Filters): number {
  return shelves.filter((members) => members.some((member) => matches(member, filters))).length
}

export interface Shelf {
  id: string
  repo: string
  url: string
  commits: string
  about: string
  stars: number | null
  pushedAt: string | null
  version: string | null
  palettes: Theme[]
}

export type Sort = 'popular' | 'updated' | 'name'

export const SORTS: Sort[] = ['popular', 'updated', 'name']

export const FIRST_SORT: Sort = 'popular'

export interface Ranked {
  id: string
  stars: number
  pushedAt: string
}

function byName(a: Ranked, b: Ranked): number {
  return a.id.localeCompare(b.id)
}

function builtinFirst(a: Ranked, b: Ranked): number {
  return Number(b.id === BUILTIN) - Number(a.id === BUILTIN) || byName(a, b)
}

export const ORDERS: Record<Sort, (a: Ranked, b: Ranked) => number> = {
  popular: (a, b) => b.stars - a.stars || builtinFirst(a, b),
  updated: (a, b) => b.pushedAt.localeCompare(a.pushedAt) || b.stars - a.stars || builtinFirst(a, b),
  name: byName,
}

export function rankOf(shelf: Pick<Shelf, 'id' | 'stars' | 'pushedAt'>): Ranked {
  return { id: shelf.id, stars: shelf.stars ?? 0, pushedAt: shelf.pushedAt ?? '' }
}

export function starCount(stars: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(stars).toLowerCase()
}

export const REPO = 'kecan0406/ttheme'

export const REPO_URL = `https://github.com/${REPO}`

export const BUILTIN_URL = `${REPO_URL}/tree/main/builtin`

export const BUILTIN_COMMITS_URL = `${REPO_URL}/commits/main/builtin`

export function repoUrl(repo: string): string {
  return `https://github.com/${repo}`
}

export const NPM_URL = 'https://www.npmjs.com/package/@kecan0406/ttheme'

export const INIT = 'npx @kecan0406/ttheme init'

export const BUILTIN_ABOUT = "The palettes that come with ttheme, each measured from the character's official art."

export function marketplacePath(id: string): string {
  return `/marketplace/${encodeURIComponent(id).replaceAll('%40', '@')}`
}

export function palettePath(theme: Pick<Theme, 'marketplace' | 'name'>): string {
  return `${marketplacePath(theme.marketplace)}/${encodeURIComponent(theme.name)}`
}

export function palettesPath(id: string): string {
  return `${marketplacePath(id)}/palettes.json`
}

export interface Peek {
  title: string
  use: string
  style: string
}

export function peekOf(lead: Theme, work: string | null): Peek {
  return {
    title: [work, lead.name].filter(Boolean).join(' · '),
    use: shortName(lead.id),
    style: wearStyle(lead),
  }
}
