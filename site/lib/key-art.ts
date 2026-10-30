import snapshot from '@/art.json' with { type: 'json' }
import type { Art, WorkArt } from '@/lib/art'

const art = snapshot as Art

export function artFor(work: string): WorkArt | undefined {
  return Object.hasOwn(art, work) ? art[work] : undefined
}
