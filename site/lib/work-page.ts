import { type KeyArt, keyArtOf, pictureOf } from '@/lib/art'
import { commons } from '@/lib/builtin'
import { castFor } from '@/lib/cast'
import type { FoundCast } from '@/lib/found'
import type { Shelf } from '@/lib/gallery'
import { artFor } from '@/lib/key-art'
import { listedWorks } from '@/lib/marketplaces'
import { langOf } from '@/lib/theme-entry'
import { BUILTIN, type Theme, type WorkRef } from '@/lib/themes'
import { byWork, facetStyle, leadOf } from '@/lib/works'
import { mergeWorks, type Work, workOf, workOfListed } from '../../src/core/commons.ts'

export interface CastSlot {
  id: string
  native: string | null
  lang: string | null
  picture: string | null
  lead: boolean
}

export interface WorkMarket {
  shelf: Shelf
  palettes: Theme[]
}

export interface WorkPage {
  work: WorkRef
  lead: Theme
  art: KeyArt | null
  facets: string
  cast: CastSlot[]
  more: FoundCast[]
  markets: WorkMarket[]
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function castOf(work: Work | undefined, ref: WorkRef, themes: readonly Theme[]): CastSlot[] {
  const art = artFor(ref.id)
  const listed = work?.characters ?? []
  const named = new Set(listed.map((character) => character.id))

  const strays = [
    ...new Set(
      themes.flatMap((theme) => (theme.character && !named.has(theme.character.id) ? [theme.character.id] : [])),
    ),
  ]

  const known = workOf(commons.works, ref.id) !== undefined

  const slots = [
    ...listed.map((character) => ({ id: character.id, native: character.native?.[0] ?? null })),
    ...strays.map((id) => ({ id, native: null })),
  ].map(({ id, native }) => ({
    id,
    native,
    lang: native ? langOf(native, known) : null,
    picture: pictureOf(art, id),
    lead: ref.lead === `${ref.id}/${id}`,
  }))

  return slots.toSorted((a, b) => Number(b.lead) - Number(a.lead))
}

function orderOf(themes: readonly Theme[], cast: CastSlot[], lead: Theme): Theme[] {
  const at = (theme: Theme) => {
    const index = cast.findIndex((slot) => slot.id === theme.character?.id)

    return index < 0 ? cast.length : index
  }

  return themes.toSorted((a, b) => Number(b === lead) - Number(a === lead) || at(a) - at(b) || cmp(a.name, b.name))
}

export function workPages(themes: readonly Theme[], shelves: readonly Shelf[]): Map<string, WorkPage> {
  const works = mergeWorks(commons.works, listedWorks.map(workOfListed))
  const pages = new Map<string, WorkPage>()

  for (const group of byWork(themes)) {
    const ref = group.work

    if (!ref) continue
    const lead = leadOf(group)
    const cast = castOf(workOf(works, ref.id), ref, group.themes)

    const markets = shelves
      .toSorted((a, b) => Number(b.id === BUILTIN) - Number(a.id === BUILTIN))
      .flatMap((shelf) => {
        const palettes = orderOf(
          group.themes.filter((theme) => theme.marketplace === shelf.id),
          cast,
          lead,
        )

        return palettes.length > 0 ? [{ shelf, palettes }] : []
      })

    pages.set(ref.id, {
      work: ref,
      lead,
      art: keyArtOf(artFor(ref.id)),
      facets: facetStyle(lead),
      cast,
      more: castFor(ref.id),
      markets,
    })
  }

  return pages
}
