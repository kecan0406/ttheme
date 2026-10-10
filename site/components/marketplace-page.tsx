import { catalogsOf } from '@/lib/catalogs'
import { OFFICIAL, OFFICIAL_ABOUT, OFFICIAL_REPO, type Shelf } from '@/lib/gallery'
import type { GateRule, Marketplace, Theme } from '@/lib/themes'
import { CommandRow, INIT } from './command-row'
import { MarketplaceBoard } from './marketplace-board'
import { MarketplaceFrame } from './marketplace-frame'
import { SectionHead } from './palette-parts'

const TERMINALS = [
  'Ghostty',
  'iTerm2',
  'kitty',
  'Alacritty',
  'WezTerm',
  'Windows Terminal',
  'Warp',
  'Konsole',
  'Terminal.app',
]

function inOrder(palettes: Theme[]): Theme[] {
  return catalogsOf(palettes).flatMap((shelf) => shelf.themes)
}

function shelvesOf(themes: Theme[], marketplaces: Marketplace[]): Shelf[] {
  return [
    { id: OFFICIAL, repo: OFFICIAL_REPO, about: OFFICIAL_ABOUT, palettes: inOrder(themes) },
    ...marketplaces.map((marketplace) => ({
      id: marketplace.id,
      repo: marketplace.repo,
      about: marketplace.about,
      palettes: inOrder(marketplace.palettes),
    })),
  ]
}

export function MarketplacePage({
  themes,
  marketplaces,
  gate,
}: {
  themes: Theme[]
  marketplaces: Marketplace[]
  gate: GateRule[]
}) {
  const shelves = shelvesOf(themes, marketplaces)
  const palettes = shelves.reduce((sum, shelf) => sum + shelf.palettes.length, 0)

  return (
    <MarketplaceFrame>
      <section
        aria-labelledby="marketplace-title"
        class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-start gap-x-16 gap-y-5 max-[960px]:grid-cols-[minmax(0,1fr)]"
      >
        <div class="grid gap-2">
          <h1 id="marketplace-title" class="font-display text-display-lg font-black">
            marketplace
          </h1>
          <p class="text-sm font-medium tracking-wide text-muted-foreground">every palette ttheme can wear</p>
        </div>
        <p class="text-display-sm leading-snug text-muted-foreground">
          {palettes} palettes in {shelves.length} marketplaces: the official one, which comes with ttheme, and every
          marketplace anyone publishes from a GitHub repository. Official palettes clear the contrast gate before they
          ship; marketplace palettes are measured the same way and shown, never refused.
        </p>
      </section>
      <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-x-16 gap-y-10 max-[960px]:grid-cols-[minmax(0,1fr)]">
        <section aria-labelledby="try" class="grid content-start gap-4">
          <SectionHead title="try it now" id="try" />
          <CommandRow command={INIT} class="bg-card" />
        </section>
        <section aria-labelledby="terminals" class="grid content-start gap-4">
          <SectionHead title="for these terminals" id="terminals" />
          <ul class="flex flex-wrap gap-2">
            {TERMINALS.map((name) => (
              <li class="rounded-full border bg-card px-3 py-1 text-sm text-soft-foreground" safe>
                {name}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <MarketplaceBoard shelves={shelves} gate={gate} />
    </MarketplaceFrame>
  )
}
