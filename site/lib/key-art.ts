import snapshot from '@/art.json' with { type: 'json' }
import type { Art, WorkArt } from '@/lib/art'
import { isPlace, type Place } from '@/lib/categories'
import placesSnapshot from '@/places.json' with { type: 'json' }

const art = snapshot as Art

const places = placesSnapshot as Record<string, unknown[]>

export function artFor(work: string): WorkArt | undefined {
  return Object.hasOwn(art, work) ? art[work] : undefined
}

export function placesFoundFor(work: string): readonly Place[] | undefined {
  return Object.hasOwn(places, work) ? places[work]?.filter(isPlace) : undefined
}
