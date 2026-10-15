import type { Theme } from '@/lib/themes'

export function catalogsOf(themes: Theme[]): { catalog: string | null; themes: Theme[] }[] {
  return [...Map.groupBy(themes, (theme) => theme.catalog)]
    .sort(([a], [b]) => Number(a === null) - Number(b === null))
    .map(([catalog, shelf]) => ({ catalog, themes: shelf }))
}

export function nativeLang({ native, marketplace }: Pick<Theme, 'native' | 'marketplace'>): string | undefined {
  const text = native ?? ''

  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return 'ja'

  if (/\p{Script=Hangul}/u.test(text)) return 'ko'

  if (marketplace === null && /\p{Script=Han}/u.test(text)) return 'ja'

  return undefined
}
