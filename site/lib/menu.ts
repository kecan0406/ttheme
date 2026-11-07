import type { KeyArt } from '@/lib/art'
import { type Category, categoriesFrom, categoryPath, GENRE_KEY, genresFrom, genresIn } from '@/lib/categories'
import type { WorkEntry } from '@/lib/works'

export interface MenuArt {
  art: KeyArt | null
  facets: string
}

export interface MenuGenre {
  label: string
  href: string
}

export interface MenuPlace {
  slug: string
  label: string
  href: string
  cover: MenuArt
  genres: MenuGenre[]
}

export interface MenuWork {
  id: string
  name: string
  native: string | null
  lang: string | null
  path: string
  art: KeyArt | null
  facets: string
}

export type GroupSlug = 'guide' | 'cli' | 'reference'

export type DocIcon = 'use' | 'make' | 'terminals' | 'commands' | 'settings' | 'environment'

export interface MenuDoc {
  label: string
  path: string
  blurb: string
  icon: DocIcon
}

export interface MenuDocGroup {
  slug: GroupSlug
  title: string
  docs: MenuDoc[]
}

export interface MenuDocs {
  quick: { label: string; path: string; lede: string }
  groups: MenuDocGroup[]
}

export interface MenuFacts extends MenuDocs {
  places: MenuPlace[]
  markets: { ids: string[]; covers: MenuArt[] }
  ribbons: string[]
  inUse: MenuWork | null
  release: { version: string; url: string }
}

const COVERS = 4

function mostPalettes(a: WorkEntry, b: WorkEntry): number {
  return b.palettes - a.palettes
}

function coverOf(entries: readonly WorkEntry[]): MenuArt {
  const pick = entries.filter((entry) => entry.art).toSorted(mostPalettes)[0] ?? entries[0]

  return { art: pick?.art ?? null, facets: pick?.facets ?? '' }
}

export function menuWork(entry: WorkEntry): MenuWork {
  return {
    id: entry.id,
    name: entry.name,
    native: entry.native,
    lang: entry.lang,
    path: entry.path,
    art: entry.art,
    facets: entry.facets,
  }
}

export function menuPlaces(entries: readonly WorkEntry[], categories: readonly Category[]): MenuPlace[] {
  return categories.map((category) => {
    const held = entries.filter((entry) => categoriesFrom(entry.places).includes(category.slug))

    return {
      slug: category.slug,
      label: category.label,
      href: categoryPath(category.slug),
      cover: coverOf(held),
      genres: genresIn(category.slug).flatMap((genre) =>
        held.some((entry) => genresFrom(entry.places).includes(genre.slug))
          ? [
              {
                label: genre.label,
                href: `${categoryPath(category.slug)}?${new URLSearchParams({ [GENRE_KEY]: genre.slug })}`,
              },
            ]
          : [],
      ),
    }
  })
}

export function menuCovers(entries: readonly WorkEntry[]): MenuArt[] {
  return entries
    .filter((entry) => entry.art)
    .toSorted(mostPalettes)
    .slice(0, COVERS)
    .map((entry) => ({ art: entry.art, facets: entry.facets }))
}

export function releaseUrl(repo: string, version: string): string {
  return `${repo}/releases/tag/v${version}`
}
