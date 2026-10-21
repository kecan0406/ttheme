export interface Tagged {
  name: string
  frequency: number
}

export interface Worn {
  hair: Tagged[]
  eyes: Tagged[]
  items: Tagged[]
}

export type Verdict =
  | { kind: 'thin'; posts: number }
  | { kind: 'eyes'; tag: Tagged }
  | { kind: 'achromatic' }
  | { kind: 'item'; tag: Tagged }
  | { kind: 'none' }

export const THIN = 50
export const EYES = 0.5
export const ITEM = 0.3

const FLOOR = 0.08
const ACHROMATIC_HAIR = 0.8
const ACHROMATIC_EYES = 0.5
const CHROMATIC = ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'orange', 'brown', 'aqua', 'blonde', 'gold']
const NEUTRAL = ['black', 'white', 'grey', 'silver']
const MIXED = ['multicolored', 'gradient']

const colorOf = (name: string) => name.split('_')[0] as string

export const chromatic = (t: Tagged) => CHROMATIC.includes(colorOf(t.name))

const neutral = (t: Tagged) => NEUTRAL.includes(colorOf(t.name))

const share = (tags: Tagged[], name: string) => tags.find((t) => t.name === name)?.frequency ?? 0

export function worn(related: readonly Tagged[]): Worn {
  const found = related
    .filter(
      (t) =>
        t.frequency >= FLOOR &&
        [...CHROMATIC, ...NEUTRAL, ...MIXED].includes(colorOf(t.name)) &&
        !t.name.endsWith('_background'),
    )
    .sort((a, b) => b.frequency - a.frequency)

  const hair = found.filter((t) => t.name.endsWith('_hair'))
  const eyes = found.filter((t) => t.name.endsWith('_eyes'))

  return { hair, eyes, items: found.filter((t) => !hair.includes(t) && !eyes.includes(t)) }
}

export function verdictOf(posts: number, { hair, eyes, items }: Worn): Verdict {
  if (posts < THIN) return { kind: 'thin', posts }

  const eye = eyes[0]

  if (eye && chromatic(eye) && eye.frequency >= EYES) return { kind: 'eyes', tag: eye }

  const neutralHair = Math.max(...['black_hair', 'white_hair', 'grey_hair'].map((name) => share(hair, name)))
  const neutralEyes = Math.max(share(eyes, 'black_eyes'), share(eyes, 'grey_eyes'))

  if (neutralHair >= ACHROMATIC_HAIR && neutralEyes >= ACHROMATIC_EYES) return { kind: 'achromatic' }

  const item = items.find(chromatic)

  if (item && item.frequency >= ITEM) return { kind: 'item', tag: item }

  return { kind: 'none' }
}

export function hairOf(hair: readonly Tagged[]): (Tagged & { chromatic: boolean }) | undefined {
  const top = hair.find((t) => chromatic(t) || neutral(t))

  return top === undefined ? undefined : { ...top, chromatic: chromatic(top) }
}

export function readRelated(doc: unknown): { posts: number; tags: Tagged[] } | undefined {
  if (typeof doc !== 'object' || doc === null) return undefined

  const { post_count: posts, related_tags: related } = doc as Record<string, unknown>

  if (typeof posts !== 'number' || !Array.isArray(related)) return undefined

  const tags = (related as unknown[]).flatMap((entry): Tagged[] => {
    if (typeof entry !== 'object' || entry === null) return []

    const { tag, frequency } = entry as Record<string, unknown>
    const name = typeof tag === 'object' && tag !== null ? (tag as Record<string, unknown>).name : undefined

    return typeof name === 'string' && typeof frequency === 'number' ? [{ name, frequency }] : []
  })

  return { posts, tags }
}
