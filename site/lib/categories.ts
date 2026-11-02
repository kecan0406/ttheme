import { BROWSE_PATH } from '@/lib/gallery'

export const CATEGORIES = [
  { slug: 'anime', label: 'anime' },
  { slug: 'rhythm-game', label: 'rhythm game' },
  { slug: 'game', label: 'game' },
  { slug: 'visual-novel', label: 'visual novel' },
  { slug: 'vocaloid', label: 'vocaloid' },
] as const

export type Category = (typeof CATEGORIES)[number]

export type CategorySlug = Category['slug']

const WORK_CATEGORIES = new Map<string, readonly CategorySlug[]>([
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

export function categoriesOf(work: string): readonly CategorySlug[] {
  return WORK_CATEGORIES.get(work) ?? []
}

export function categoryPath(slug: CategorySlug): string {
  return `${BROWSE_PATH}/${slug}`
}

export function alsoIn(work: string, shown: CategorySlug | null): string | null {
  const others = CATEGORIES.filter((one) => one.slug !== shown && categoriesOf(work).includes(one.slug))

  return others.length > 0 ? `+ ${others.map((one) => one.label).join(', ')}` : null
}
