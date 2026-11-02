import { BROWSE_PATH } from '@/lib/gallery'

export const CATEGORIES = [
  { slug: 'anime', label: 'anime' },
  { slug: 'game', label: 'game' },
  { slug: 'vocaloid', label: 'vocaloid' },
] as const

export const GENRES = [
  { slug: 'rhythm-game', label: 'rhythm game' },
  { slug: 'visual-novel', label: 'visual novel' },
] as const

export const GENRE_KEY = 'genre'

const GENRES_IN = 'game'

export type Category = (typeof CATEGORIES)[number]

export type CategorySlug = Category['slug']

export type Genre = (typeof GENRES)[number]

export type GenreSlug = Genre['slug']

type Place = CategorySlug | GenreSlug

const WORK_PLACES = new Map<string, readonly Place[]>([
  ['beatmania-iidx', ['rhythm-game']],
  ['black-bullet', ['anime']],
  ['bocchi-the-rock', ['anime']],
  ['call-of-the-night', ['anime']],
  ['chuunibyou', ['anime']],
  ['code-geass', ['anime']],
  ['cyberpunk-edgerunners', ['anime']],
  ['dancedancerevolution', ['rhythm-game']],
  ['doki-doki-literature-club', ['visual-novel']],
  ['evangelion', ['anime']],
  ['gitadora', ['rhythm-game']],
  ['higurashi', ['visual-novel', 'anime']],
  ['jubeat', ['rhythm-game']],
  ['jujutsu-kaisen', ['anime']],
  ['k-on', ['anime']],
  ['lain', ['anime']],
  ['lucky-star', ['anime']],
  ['madoka-magica', ['anime']],
  ['monogatari', ['anime']],
  ['nichijou', ['anime']],
  ['no-game-no-life', ['anime']],
  ['oregairu', ['anime']],
  ['persona-5', ['game', 'anime']],
  ['pop-n-music', ['rhythm-game']],
  ['reflec-beat', ['rhythm-game']],
  ['sailor-moon', ['anime']],
  ['sound-voltex', ['rhythm-game']],
  ['steins-gate', ['visual-novel', 'anime']],
  ['sword-art-online', ['anime']],
  ['the-devil-is-a-part-timer', ['anime']],
  ['touhou-project', ['game']],
  ['umineko', ['visual-novel', 'anime']],
  ['undertale', ['game']],
  ['va-11-hall-a', ['game']],
  ['vocaloid', ['vocaloid']],
])

function isGenre(place: Place): place is GenreSlug {
  return GENRES.some((genre) => genre.slug === place)
}

function categoryOf(place: Place): CategorySlug {
  return isGenre(place) ? GENRES_IN : place
}

function placesOf(work: string): readonly Place[] {
  return WORK_PLACES.get(work) ?? []
}

export function categoriesOf(work: string): readonly CategorySlug[] {
  return [...new Set(placesOf(work).map(categoryOf))]
}

export function genresOf(work: string): readonly GenreSlug[] {
  return placesOf(work).filter(isGenre)
}

export function genresIn(category: CategorySlug): readonly Genre[] {
  return category === GENRES_IN ? GENRES : []
}

export function categoryPath(slug: CategorySlug): string {
  return `${BROWSE_PATH}/${slug}`
}

export function alsoIn(work: string, shown: CategorySlug | null): string | null {
  const places = placesOf(work).filter((place) => categoryOf(place) !== shown)
  const others = [...CATEGORIES, ...GENRES].filter((one) => places.includes(one.slug))

  return others.length > 0 ? `+ ${others.map((one) => one.label).join(', ')}` : null
}

export function uncategorized(works: readonly { id: string }[]): string[] {
  return works.flatMap((work) => (WORK_PLACES.has(work.id) ? [] : [work.id]))
}
