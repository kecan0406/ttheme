import snapshot from '@/cast.json' with { type: 'json' }
import type { Casts, FoundCast } from '@/lib/found'

const casts = snapshot as Casts

export function castFor(work: string): FoundCast[] {
  return Object.hasOwn(casts, work) ? (casts[work] ?? []) : []
}
