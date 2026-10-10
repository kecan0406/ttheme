import type { Theme } from '@/lib/themes'

export function catalogsOf(themes: Theme[]): { catalog: string | null; themes: Theme[] }[] {
  return [...Map.groupBy(themes, (theme) => theme.catalog)]
    .sort(([a], [b]) => Number(a === null) - Number(b === null))
    .map(([catalog, shelf]) => ({ catalog, themes: shelf }))
}
