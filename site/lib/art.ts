export interface WorkArt {
  backdrop: string | null
  banner: string | null
  cast: Record<string, string>
}

export type Art = Record<string, WorkArt>

export type ArtSource = 'tmdb' | 'anilist'

export interface KeyArt {
  src: string
  srcset: string | null
  from: ArtSource
}

export const CREDITS_PATH = '/credits'

export const TMDB_HOME = 'https://www.themoviedb.org'

export const ANILIST_HOME = 'https://anilist.co'

const TMDB_IMAGES = 'https://image.tmdb.org/t/p'

export function keyArtOf(art: WorkArt | undefined): KeyArt | null {
  if (art?.backdrop)
    return {
      src: `${TMDB_IMAGES}/w1280${art.backdrop}`,
      srcset: `${TMDB_IMAGES}/w780${art.backdrop} 780w, ${TMDB_IMAGES}/w1280${art.backdrop} 1280w`,
      from: 'tmdb',
    }

  return art?.banner ? { src: art.banner, srcset: null, from: 'anilist' } : null
}

export function pictureOf(art: WorkArt | undefined, character: string): string | null {
  return art && Object.hasOwn(art.cast, character) ? (art.cast[character] ?? null) : null
}
