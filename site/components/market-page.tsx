import type { PropsWithChildren } from '@kitajs/html'
import { catalogsOf } from '@/lib/catalogs'
import { marketPath, type Section } from '@/lib/gallery'
import { seriesOf } from '@/lib/sheet'
import type { GateRule, Market, Theme } from '@/lib/themes'
import { CommandRow } from './command-row'
import { MarketGallery } from './market-gallery'
import { SiteHeader } from './site-header'

export function MarketFrame({ children }: PropsWithChildren) {
  return (
    <div class="ground min-h-dvh">
      <div class="mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-5 pt-4.5">
        <SiteHeader current="/market" />
        {children}
      </div>
    </div>
  )
}

export function MarketPage({ themes, markets, gate }: { themes: Theme[]; markets: Market[]; gate: GateRule[] }) {
  const series = seriesOf(themes)
  const sections: Section[] = [
    ...series.map((entry) => ({ key: `series:${entry.name}`, title: entry.name, themes: entry.themes })),
    ...markets.flatMap((market) =>
      catalogsOf(market.palettes).map(({ catalog, themes }) => ({
        key: `market:${market.id}:${catalog ?? ''}`,
        title: market.id,
        ...(catalog ? { subtitle: catalog } : {}),
        href: marketPath(market.id),
        themes,
      })),
    ),
  ]

  return (
    <MarketFrame>
      <div class="grid grid-cols-[minmax(0,1fr)] gap-3 pt-5">
        <h1 class="font-display text-display-lg font-black">market</h1>
        <p class="max-w-[68ch] text-soft-foreground">
          {themes.length} official palettes in {series.length} series, and every market anyone publishes from a GitHub
          repository. Official palettes clear the contrast gate before they ship. Market palettes are measured the same
          way and shown, never refused.
        </p>
        <div class="flex max-w-[720px] flex-wrap gap-2">
          <CommandRow command="npx @kecan0406/ttheme init" class="flex-[1_1_280px]" />
          <CommandRow command="ttheme market init <name>" class="flex-[1_1_280px]" />
        </div>
      </div>
      <MarketGallery sections={sections} markets={markets} gate={gate} />
    </MarketFrame>
  )
}
