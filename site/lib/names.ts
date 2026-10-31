import type { FoundWork } from '@/lib/found'

export const NAMES_PATH = '/names.json'

export const NEW_KEY = 'new'

export const MOST_ASKED = 100

export const NAME_PAUSE = 300

export interface NamedRow {
  id: string
  read: string
  by: 'work' | 'character'
  characters: string[]
}

export interface NamesAnswer {
  works: NamedRow[]
  found: FoundWork[]
  label: string
  request: string
  name: string | null
}

export function namesPath(query: string): string {
  return `${NAMES_PATH}?${new URLSearchParams({ q: query.normalize('NFKC').replace(/\s+/g, ' ').trim() })}`
}

export function makePath(name: string | null): string {
  return `/builder?${new URLSearchParams({ [NEW_KEY]: name ?? '' })}`
}
