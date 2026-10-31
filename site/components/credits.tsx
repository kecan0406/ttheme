import { type SimpleIcon, siAnilist, siIgdb, siSteam, siThemoviedatabase } from 'simple-icons'
import { ANILIST_HOME, BANGUMI_HOME, CREDITS_PATH, IGDB_HOME, STEAM_HOME, TMDB_HOME } from '@/lib/art'
import type { Facts } from '@/lib/facts'
import { BrandIcon, NewTab } from '@/lib/icons'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'

interface Source {
  name: string
  home: string
  icon: SimpleIcon | null
  what: string
  notice: string | null
}

const SOURCES: Source[] = [
  {
    name: 'TMDB',
    home: TMDB_HOME,
    icon: siThemoviedatabase,
    what: "The key art behind each work, on the work's page and in the marketplace's search.",
    notice: 'This site uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.',
  },
  {
    name: 'AniList',
    home: ANILIST_HOME,
    icon: siAnilist,
    what: "A character's picture on a work's page where Bangumi has none, and a work's banner where TMDB has no key art.",
    notice: null,
  },
  {
    name: 'Bangumi',
    home: BANGUMI_HOME,
    icon: null,
    what: "The characters' pictures on a work's page.",
    notice: null,
  },
  {
    name: 'Steam',
    home: STEAM_HOME,
    icon: siSteam,
    what: "A game's key art on its page, where neither TMDB nor AniList has a picture of it.",
    notice: null,
  },
  {
    name: 'IGDB',
    home: IGDB_HOME,
    icon: siIgdb,
    what: "A game's key art where Steam has none either.",
    notice: null,
  },
]

export function Credits({ facts }: { facts: Facts }) {
  return (
    <div class="ground flex min-h-dvh flex-col">
      <SiteHeader current="" facts={facts} />
      <main
        id="content"
        class="mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-6 pt-13 pb-24"
      >
        <div class="grid gap-3">
          <h1 class="font-display text-display-lg font-black">credits</h1>
          <p class="max-w-[68ch] text-pretty text-soft-foreground">
            Where the pictures on this site come from. Each one is shown from its source's own servers, and ttheme keeps
            none of them.
          </p>
        </div>
        <ul class="grid max-w-[68ch] gap-6">
          {SOURCES.map((source) => (
            <li class="grid gap-2 border-t pt-6">
              <a
                href={source.home}
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-2 justify-self-start rounded-sm font-display text-display-sm font-black transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
              >
                {source.icon === null ? null : <BrandIcon icon={source.icon} class="size-5 flex-none" />}
                <span safe>{source.name}</span>
                <NewTab class="size-4" />
              </a>
              <p class="text-pretty text-soft-foreground" safe>
                {source.what}
              </p>
              {source.notice === null ? null : (
                <p class="text-sm text-pretty text-muted-foreground" safe>
                  {source.notice}
                </p>
              )}
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter facts={facts} current={CREDITS_PATH} />
    </div>
  )
}
