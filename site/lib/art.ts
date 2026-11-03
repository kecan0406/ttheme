import type { KeyArt } from '@kecan0406/aninames/pictures'

export type { KeyArt }

export interface WorkArt {
  art: KeyArt | null
  cast: Record<string, string>
}

export type Art = Record<string, WorkArt>

export const CREDITS_PATH = '/credits'

export const TMDB_HOME = 'https://www.themoviedb.org'

export const ANILIST_HOME = 'https://anilist.co'

export const BANGUMI_HOME = 'https://bgm.tv'

export const STEAM_HOME = 'https://store.steampowered.com'

export const IGDB_HOME = 'https://www.igdb.com'

export function pictureOf(art: WorkArt | undefined, character: string): string | null {
  return art && Object.hasOwn(art.cast, character) ? (art.cast[character] ?? null) : null
}
