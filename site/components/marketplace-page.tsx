import { Store } from 'lucide'
import type { Facts } from '@/lib/facts'
import {
  BUILTIN_ABOUT,
  BUILTIN_COMMITS_URL,
  BUILTIN_URL,
  FIRST_SORT,
  ORDERS,
  REPO,
  rankOf,
  repoUrl,
  type Shelf,
} from '@/lib/gallery'
import { Icon } from '@/lib/icons'
import { BUILTIN, type Marketplace, type Theme } from '@/lib/themes'
import { CommandRow } from './command-row'
import { MarketplaceBoard } from './marketplace-board'
import { MarketplaceFrame } from './marketplace-frame'

const PUBLISH = ['ttheme marketplace init', 'ttheme marketplace check']

function listingsOf(themes: Theme[], marketplaces: Marketplace[], facts: Facts): Shelf[] {
  const shelves: Shelf[] = [
    {
      id: BUILTIN,
      repo: REPO,
      url: BUILTIN_URL,
      commits: BUILTIN_COMMITS_URL,
      about: BUILTIN_ABOUT,
      stars: facts.repo?.stars ?? null,
      pushedAt: facts.repo?.pushedAt ?? null,
      version: facts.version,
      palettes: themes,
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
      palettes: marketplace.palettes,
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
  const shelves = listingsOf(themes, marketplaces, facts)

  return (
    <MarketplaceFrame facts={facts} current="/marketplace">
      <MarketplaceBoard shelves={shelves}>
        <h1 class="font-display text-display-lg font-black">marketplace</h1>
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
            A marketplace is a GitHub repository of palettes, a file for each work:{' '}
            <code class="font-mono text-xs">init</code> makes one, <code class="font-mono text-xs">check</code> reads it
            as an install would, and once it carries the{' '}
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
