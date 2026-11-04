import type { KeyArt, WorkArt } from '@/lib/art'
import type { Shelf } from '@/lib/gallery'
import { BUILTIN, paint, type Theme } from '@/lib/themes'
import { byWork, facetStyle, focusOf, leadOf, tileLook } from '@/lib/works'

export interface FeatureArt {
  art: KeyArt | null
  facets: string
  focus: string | null
}

export interface FeatureCharacter extends FeatureArt {
  name: string
  look: string
  dot: string
}

export interface FeatureCommunity {
  id: string
  look: string
  covers: FeatureArt[]
}

export interface FeaturePicture {
  theme: Theme
  art: KeyArt
}

export interface HomeFeatures {
  characters: FeatureCharacter[]
  community: FeatureCommunity | null
  picture: FeaturePicture | null
}

const CHARACTERS: readonly (readonly [subject: string, focus: string])[] = [
  ['steins-gate/makise-kurisu', '50% 22%'],
  ['bocchi-the-rock/gotoh-hitori', '50% 10%'],
  ['vocaloid/hatsune-miku', '72% 50%'],
]

const PICTURED = 'lain'

const COVERS = ['beatmania-iidx', 'pop-n-music', 'sound-voltex', 'dancedancerevolution']

function community(shelves: readonly Shelf[], artOf: (work: string) => WorkArt | undefined): FeatureCommunity | null {
  const shelf = shelves.find((one) => one.id !== BUILTIN)

  if (!shelf) return null
  const stacks = byWork(shelf.palettes).filter((stack) => stack.work)
  const lead = stacks[0] && leadOf(stacks[0])

  if (!lead) return null

  const ranked = stacks.toSorted((a, b) => {
    const at = (id: string | undefined) => {
      const found = COVERS.indexOf(id ?? '')

      return found === -1 ? COVERS.length : found
    }

    return at(a.work?.id) - at(b.work?.id)
  })

  return {
    id: shelf.id,
    look: tileLook(lead),
    covers: ranked.slice(0, 4).map((stack) => ({
      art: artOf(stack.work?.id ?? '')?.art ?? null,
      facets: facetStyle(leadOf(stack)),
      focus: focusOf(stack.work?.id ?? ''),
    })),
  }
}

export function homeFeatures(
  themes: readonly Theme[],
  shelves: readonly Shelf[],
  artOf: (work: string) => WorkArt | undefined,
): HomeFeatures {
  const characters = CHARACTERS.flatMap(([subject, focus]) => {
    const theme = themes.find((one) => one.subject === subject)

    return theme
      ? [
          {
            name: theme.name,
            look: tileLook(theme),
            dot: paint(theme, (shade) => shade.cursor),
            art: artOf(theme.work?.id ?? '')?.art ?? null,
            facets: facetStyle(theme),
            focus,
          },
        ]
      : []
  })

  const pictured = themes.find((theme) => theme.work?.id === PICTURED)
  const picture = pictured ? (artOf(PICTURED)?.art ?? null) : null

  return {
    characters,
    community: community(shelves, artOf),
    picture: pictured && picture ? { theme: pictured, art: picture } : null,
  }
}
