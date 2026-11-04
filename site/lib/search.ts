import type { KeyArt } from '@/lib/art'

export const SEARCH_PATH = '/browse/search.json'

export const SHOWN = 8

export const LOOK_SLOTS = [
  '--bg',
  '--fg',
  '--cu',
  '--se',
  '--a1',
  '--a2',
  '--a3',
  '--a4',
  '--a5',
  '--a6',
  '--a8',
] as const

export interface SearchPalette {
  name: string
  slug: string
  look: string[]
}

export interface SearchWork {
  id: string
  name: string
  native: string | null
  lang: string | null
  path: string
  art: KeyArt | null
  facets: string
  search: string
  palettes: SearchPalette[]
}

export interface SearchMarket {
  id: string
  text: string
}

export interface SearchIndex {
  works: SearchWork[]
  markets: SearchMarket[]
}

export interface Hit {
  work: SearchWork
  palette: SearchPalette
}

export function lookStyle(look: readonly string[]): string {
  return LOOK_SLOTS.flatMap((slot, at) => (look[at] ? [`${slot}:${look[at]}`] : [])).join(';')
}

export function said(search: string, names: readonly string[], query: string): boolean {
  return search.includes(query) || names.includes(query)
}

function rankOf(
  work: SearchWork,
  query: string,
  named: readonly string[],
): [rank: number, palette: SearchPalette] | null {
  const lead = work.palettes[0] as SearchPalette
  const titles = work.search.split('\n')
  const exact = work.palettes.find((palette) => palette.name === query || palette.slug === query)

  if (titles.includes(query)) return [0, exact ?? lead]

  if (titles.some((title) => title.startsWith(query))) return [1, exact ?? lead]

  if (exact) return [2, exact]

  if (work.search.includes(query)) return [3, lead]

  return named.includes(work.id) ? [4, lead] : null
}

export function searchWorks(works: readonly SearchWork[], query: string, named: readonly string[] = []): Hit[] {
  const asked = query.trim().toLowerCase()

  if (!asked) return []

  return works
    .flatMap((work, at) => {
      const ranked = rankOf(work, asked, named)

      return ranked ? [{ rank: ranked[0], at, hit: { work, palette: ranked[1] } }] : []
    })
    .sort((a, b) => a.rank - b.rank || a.at - b.at)
    .map(({ hit }) => hit)
}

export interface Worn {
  name: string
  work: string | null
}

export function isWorn(hit: Hit, worn: Worn): boolean {
  return hit.palette.slug === worn.name && (worn.work === null || hit.work.id === worn.work)
}

export function allWorks(works: readonly SearchWork[], worn: Worn): Hit[] {
  const hits = works.map((work) => ({ work, palette: work.palettes[0] as SearchPalette }))

  const mine = works
    .flatMap((work) => work.palettes.map((palette) => ({ work, palette })))
    .find((hit) => isWorn(hit, worn))

  return mine ? [mine, ...hits.filter((hit) => hit.work !== mine.work)] : hits
}

export function marketsFor(markets: readonly SearchMarket[], query: string): SearchMarket[] {
  const asked = query.trim().toLowerCase()

  return asked.length > 1 ? markets.filter((market) => market.text.includes(asked)) : []
}
