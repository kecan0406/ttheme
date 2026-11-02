import { BROWSE_PATH } from '@/lib/gallery'

export const CATEGORIES = [
  { slug: 'anime', label: 'anime' },
  { slug: 'game', label: 'game' },
  { slug: 'manga', label: 'manga' },
  { slug: 'novel', label: 'novel' },
  { slug: 'vocaloid', label: 'vocaloid' },
] as const

export const GENRES = [
  { slug: 'rhythm-game', label: 'rhythm game', fact: 'rhythm' },
  { slug: 'visual-novel', label: 'visual novel', fact: 'vn' },
] as const

export const GENRE_KEY = 'genre'

const GENRES_IN = 'game'

const PRINT = ['manga', 'novel'] as const

export type Category = (typeof CATEGORIES)[number]

export type CategorySlug = Category['slug']

export type Genre = (typeof GENRES)[number]

export type GenreSlug = Genre['slug']

export type Place = CategorySlug | GenreSlug

export interface WorkFacts {
  tags: readonly string[]
  medium: string | null
  genres: readonly string[]
  nature: string | null
}

const WORK_PLACES = new Map<string, readonly Place[]>([
  ['atelier', ['game', 'anime']],
  ['axis-powers-hetalia', ['anime']],
  ['batman', []],
  ['beatmania-iidx', ['rhythm-game']],
  ['black-bullet', ['anime']],
  ['bocchi-the-rock', ['anime']],
  ['call-of-the-night', ['anime']],
  ['chuunibyou', ['anime']],
  ['code-geass', ['anime']],
  ['cyberpunk-edgerunners', ['anime']],
  ['dancedancerevolution', ['rhythm-game']],
  ['disgaea', ['game', 'anime']],
  ['doki-doki-literature-club', ['visual-novel']],
  ['dungeon-and-fighter', ['game']],
  ['evangelion', ['anime']],
  ['fate', ['game', 'anime']],
  ['gintama', ['anime']],
  ['gitadora', ['rhythm-game']],
  ['heaven-burns-red', ['game']],
  ['higurashi', ['visual-novel', 'anime']],
  ['inazuma-eleven-go', ['game', 'anime']],
  ['jubeat', ['rhythm-game']],
  ['jujutsu-kaisen', ['anime']],
  ['k-on', ['anime']],
  ['kamen-rider', []],
  ['kingdom-hearts', ['game']],
  ['lain', ['anime']],
  ['lucky-star', ['anime']],
  ['madoka-magica', ['anime']],
  ['marvel', []],
  ['meitantei-conan', ['anime']],
  ['monogatari', ['anime']],
  ['nichijou', ['anime']],
  ['nier', ['game', 'anime']],
  ['nitroplus', []],
  ['no-game-no-life', ['anime']],
  ['oregairu', ['anime']],
  ['osomatsu', ['anime']],
  ['persona-5', ['game', 'anime']],
  ['phantasy-star', ['game', 'anime']],
  ['pokemon', ['game', 'anime']],
  ['pokemon-diamond-pearl-platinum', ['game']],
  ['pokemon-tcg', ['game']],
  ['pokemon-x-and-y', ['game', 'anime']],
  ['pop-n-music', ['rhythm-game']],
  ['pretty-series', ['anime']],
  ['project-moon', ['game']],
  ['reflec-beat', ['rhythm-game']],
  ['sailor-moon', ['anime']],
  ['science-adventure', ['visual-novel', 'anime']],
  ['senran-kagura', ['game', 'anime']],
  ['sound-voltex', ['rhythm-game']],
  ['spider-man', []],
  ['star-wars', []],
  ['steins-gate', ['visual-novel', 'anime']],
  ['sword-art-online', ['anime']],
  ['the-devil-is-a-part-timer', ['anime']],
  ['toaru-kagaku-no-railgun', ['anime']],
  ['tokyo-afterschool-summoners', ['game']],
  ['touhou-project', ['game']],
  ['umineko', ['visual-novel', 'anime']],
  ['undertale', ['game']],
  ['utdr', ['game']],
  ['va-11-hall-a', ['game']],
  ['vocaloid', ['vocaloid']],
  ['vspo', []],
  ['world-witches-series', ['anime', 'game']],
  ['x-men', []],
])

function isGenre(place: Place): place is GenreSlug {
  return GENRES.some((genre) => genre.slug === place)
}

function categoryOf(place: Place): CategorySlug {
  return isGenre(place) ? GENRES_IN : place
}

function gamePlace(games: readonly WorkFacts[]): Place {
  const held = GENRES.find(
    (genre) => games.filter((game) => game.genres.includes(genre.fact)).length * 2 >= games.length,
  )

  return held?.slug ?? GENRES_IN
}

export function placesFrom(members: readonly WorkFacts[]): Place[] {
  if (members.some((member) => member.nature !== null)) return []
  const tagged = members.filter((member) => member.tags.length > 0)
  const counted = tagged.length > 0 ? tagged : members
  const games = counted.filter((member) => member.medium === GENRES_IN)

  const screen: Place[] = [
    ...(counted.some((member) => member.medium === 'anime') ? (['anime'] as const) : []),
    ...(games.length > 0 ? [gamePlace(games)] : []),
  ]

  return screen.length > 0 ? screen : PRINT.filter((medium) => counted.some((member) => member.medium === medium))
}

export function placesOf(work: string, found: readonly Place[] = []): readonly Place[] {
  return WORK_PLACES.get(work) ?? found
}

export function isPlace(value: unknown): value is Place {
  return [...CATEGORIES, ...GENRES].some((one) => one.slug === value)
}

export function categoriesFrom(places: readonly Place[]): readonly CategorySlug[] {
  return [...new Set(places.map(categoryOf))]
}

export function genresFrom(places: readonly Place[]): readonly GenreSlug[] {
  return places.filter(isGenre)
}

export function genresIn(category: CategorySlug): readonly Genre[] {
  return category === GENRES_IN ? GENRES : []
}

export function categoryPath(slug: CategorySlug): string {
  return `${BROWSE_PATH}/${slug}`
}

export function placeLinks(places: readonly Place[]): { label: string; href: string }[] {
  return [...CATEGORIES, ...GENRES].flatMap((one) =>
    places.includes(one.slug)
      ? [
          {
            label: one.label,
            href: isGenre(one.slug)
              ? `${categoryPath(GENRES_IN)}?${new URLSearchParams({ [GENRE_KEY]: one.slug })}`
              : categoryPath(one.slug),
          },
        ]
      : [],
  )
}

export function placesLabel(places: readonly Place[]): string | null {
  return (
    placeLinks(places)
      .map((one) => one.label)
      .join(', ') || null
  )
}

export function alsoIn(places: readonly Place[], shown: CategorySlug | null): string | null {
  const others = placeLinks(places.filter((place) => categoryOf(place) !== shown))

  return others.length > 0 ? `+ ${others.map((one) => one.label).join(', ')}` : null
}

export function uncategorized(works: readonly { id: string }[]): string[] {
  return works.flatMap((work) => (WORK_PLACES.has(work.id) ? [] : [work.id]))
}
