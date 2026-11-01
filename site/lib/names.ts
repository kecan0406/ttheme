import type { FoundMember, FoundWork } from '@/lib/found'
import { workPath } from '@/lib/works'

export const NAMES_PATH = '/names.json'

export const CAST_FILE = 'cast.json'

export const NEW_KEY = 'new'

export const MOST_ASKED = 100

export const NAME_PAUSE = 300

export interface NamesAnswer {
  works: string[]
  found: FoundWork[]
  label: string
  request: string
  name: string | null
}

export interface CastAnswer {
  cast: FoundMember[]
}

function asked(query: string): URLSearchParams {
  return new URLSearchParams({ q: query.normalize('NFKC').replace(/\s+/g, ' ').trim() })
}

export function namesPath(query: string): string {
  return `${NAMES_PATH}?${asked(query)}`
}

export function castPath(work: string, query: string): string {
  return `${workPath(work)}/${CAST_FILE}?${asked(query)}`
}

export function makePath(name: string | null): string {
  return `/builder?${new URLSearchParams({ [NEW_KEY]: name ?? '' })}`
}
