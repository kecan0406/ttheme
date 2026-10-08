import type { PropsWithChildren } from '@kitajs/html'
import { catalogsOf } from '@/lib/catalogs'
import { marketplacePath, type Section } from '@/lib/gallery'
import type { GateRule, Marketplace, Theme } from '@/lib/themes'
import { CommandRow } from './command-row'
import { MarketplaceGallery } from './marketplace-gallery'
import { SiteHeader } from './site-header'

export function MarketplaceFrame({ children }: PropsWithChildren) {
  return (
    <div class="ground min-h-dvh">
      <div class="mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-5 pt-4.5">
        <SiteHeader current="/marketplace" />
        {children}
      </div>
    </div>
  )
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
  const catalogs = catalogsOf(themes)
  const sections: Section[] = [
    ...catalogs.map(({ catalog, themes }) => ({ key: `catalog:${catalog ?? ''}`, title: catalog ?? '', themes })),
    ...marketplaces.flatMap((marketplace) =>
      catalogsOf(marketplace.palettes).map(({ catalog, themes }) => ({
        key: `marketplace:${marketplace.id}:${catalog ?? ''}`,
        title: marketplace.id,
        ...(catalog ? { subtitle: catalog } : {}),
        href: marketplacePath(marketplace.id),
        themes,
      })),
    ),
  ]

  return (
    <MarketplaceFrame>
      <div class="grid grid-cols-[minmax(0,1fr)] gap-3 pt-5">
        <h1 class="font-display text-display-lg font-black">marketplace</h1>
        <p class="max-w-[68ch] text-soft-foreground">
          {themes.length} official palettes in {catalogs.length} catalogs, and every marketplace anyone publishes from a
          GitHub repository. Official palettes clear the contrast gate before they ship. Marketplace palettes are
          measured the same way and shown, never refused.
        </p>
        <div class="flex max-w-[720px] flex-wrap gap-2">
          <CommandRow command="npx @kecan0406/ttheme init" class="flex-[1_1_280px]" />
          <CommandRow command="ttheme marketplace init <name>" class="flex-[1_1_280px]" />
        </div>
      </div>
      <MarketplaceGallery sections={sections} marketplaces={marketplaces} gate={gate} />
    </MarketplaceFrame>
  )
}
