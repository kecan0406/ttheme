import { Store } from 'lucide'
import { catalogsOf } from '@/lib/catalogs'
import type { Facts } from '@/lib/facts'
import {
  FIRST_SORT,
  OFFICIAL,
  OFFICIAL_ABOUT,
  OFFICIAL_COMMITS_URL,
  OFFICIAL_REPO,
  OFFICIAL_THEMES_URL,
  ORDERS,
  rankOf,
  repoUrl,
  type Shelf,
} from '@/lib/gallery'
import { Icon } from '@/lib/icons'
import type { Marketplace, Theme } from '@/lib/themes'
import { plural } from '@/lib/utils'
import { CommandRow } from './command-row'
import { MarketplaceBoard } from './marketplace-board'
import { MarketplaceFrame } from './marketplace-frame'

const PUBLISH = ['ttheme marketplace init', 'ttheme marketplace check']

function inOrder(palettes: Theme[]): Theme[] {
  return catalogsOf(palettes).flatMap((shelf) => shelf.themes)
}

function shelvesOf(themes: Theme[], marketplaces: Marketplace[], facts: Facts): Shelf[] {
  const shelves: Shelf[] = [
    {
      id: OFFICIAL,
      repo: OFFICIAL_REPO,
      url: OFFICIAL_THEMES_URL,
      commits: OFFICIAL_COMMITS_URL,
      about: OFFICIAL_ABOUT,
      stars: facts.repo?.stars ?? null,
      pushedAt: facts.repo?.pushedAt ?? null,
      version: facts.version,
      palettes: inOrder(themes),
    },
    ...marketplaces.map((marketplace) => ({
      id: marketplace.id,
      repo: marketplace.repo,
      url: repoUrl(marketplace.repo),
      commits: `${repoUrl(marketplace.repo)}/commits`,
      about: marketplace.about,
      stars: marketplace.stars,
      pushedAt: marketplace.pushedAt,
      version: null,
      palettes: inOrder(marketplace.palettes),
    })),
  ]

  return shelves.toSorted((a, b) => ORDERS[FIRST_SORT](rankOf(a), rankOf(b)))
}

export function MarketplacePage({
  themes,
  marketplaces,
  facts,
}: {
  themes: Theme[]
  marketplaces: Marketplace[]
  facts: Facts
}) {
  const shelves = shelvesOf(themes, marketplaces, facts)
  const palettes = shelves.reduce((sum, shelf) => sum + shelf.palettes.length, 0)

  const catalogs = shelves.reduce(
    (sum, shelf) => sum + catalogsOf(shelf.palettes).filter((entry) => entry.catalog !== null).length,
    0,
  )

  return (
    <MarketplaceFrame facts={facts} current="/marketplace">
      <MarketplaceBoard shelves={shelves}>
        <div class="grid gap-1.5">
          <h1 class="font-display text-display-lg font-black">marketplace</h1>
          <p class="text-sm font-medium text-muted-foreground" safe>
            {[plural(shelves.length, 'marketplace'), plural(palettes, 'palette'), plural(catalogs, 'catalog')].join(
              ' · ',
            )}
          </p>
        </div>
      </MarketplaceBoard>
      <section
        aria-labelledby="publish"
        class="flex flex-wrap items-center justify-between gap-x-14 gap-y-6 rounded-3xl border bg-muted p-6"
      >
        <div class="grid max-w-[520px] flex-[1_1_22rem] gap-2">
          <p class="inline-flex items-center gap-2 text-2xs font-bold tracking-caps text-muted-foreground uppercase [&_svg]:size-3.25">
            <Icon node={Store} />
            publish your own
          </p>
          <h2 id="publish" class="font-display text-display-sm font-black">
            your marketplace, listed here
          </h2>
          <p class="text-sm text-soft-foreground">
            A marketplace is a GitHub repository of palette files: <code class="font-mono text-xs">init</code> makes
            one, <code class="font-mono text-xs">check</code> reads it as an install would, and once it carries the{' '}
            <code class="font-mono text-xs text-foreground">ttheme-marketplace</code> topic it shows up here and in
            ttheme's own search within about an hour.
          </p>
        </div>
        <ol class="grid max-w-[560px] flex-[1_1_26rem] gap-2">
          {PUBLISH.map((command, index) => (
            <li class="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2.5">
              <span class="font-mono text-xs text-muted-foreground">{index + 1}</span>
              <CommandRow command={command} class="bg-card" />
            </li>
          ))}
          <li class="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2.5">
            <span class="font-mono text-xs text-muted-foreground">{PUBLISH.length + 1}</span>
            <span class="px-3 text-sm text-soft-foreground">
              push it to GitHub with the <code class="font-mono text-xs text-foreground">ttheme-marketplace</code> topic
            </span>
          </li>
        </ol>
      </section>
    </MarketplaceFrame>
  )
}
