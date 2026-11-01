import snapshot from '@/cast.json' with { type: 'json' }
import type { Casts, FoundCast, People } from '@/lib/found'
import known from '@/people.json' with { type: 'json' }

const casts = snapshot as Casts

const people = known as People

export function castFor(work: string): FoundCast[] {
  return Object.hasOwn(casts, work) ? (casts[work] ?? []) : []
}

export function personOf(work: string, character: string): string | null {
  const subject = `${work}/${character}`

  return Object.hasOwn(people, subject) ? (people[subject] ?? null) : null
}
