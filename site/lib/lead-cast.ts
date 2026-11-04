import type { Theme } from '@/lib/themes'

export interface CastMember {
  name: string
  face: number
  scale: number
}

export const CAST: readonly CastMember[] = [
  { name: 'souryuu-asuka-langley', face: 930 / 756, scale: 1 },
  { name: 'ayanami-rei', face: 946 / 756, scale: 1 },
  { name: 'izumi-konata', face: 860 / 756, scale: 0.5 / 0.55 },
  { name: 'shinonome-nano', face: 1086 / 756, scale: 1 },
]

export function castOf(themes: readonly Theme[]): Theme[] {
  return CAST.flatMap((member) => themes.find((theme) => theme.name === member.name) ?? [])
}

export function isCast(name: string): boolean {
  return CAST.some((member) => member.name === name)
}
