import type { Metadata } from 'next'
import { CommandRow } from '@/components/command-row'
import { MarketGallery, type Section } from '@/components/market-gallery'
import { SiteHeader } from '@/components/site-header'
import { loadMarkets } from '@/lib/markets'
import { seriesOf } from '@/lib/sheet'
import { loadManifest } from '@/lib/themes'

export const metadata: Metadata = {
  title: 'ttheme — market',
  description: 'Every ttheme palette: the official series and the markets anyone publishes from GitHub',
}

export default async function MarketPage() {
  const { gate, themes } = loadManifest()
  const markets = await loadMarkets()
  const series = seriesOf(themes)
  const sections: Section[] = [
    ...series.map((entry) => ({ key: `series:${entry.name}`, title: entry.name, themes: entry.themes })),
    ...markets.map((market) => ({
      key: `market:${market.id}`,
      title: market.id,
      href: `/market/store?m=${encodeURIComponent(market.id)}`,
      themes: market.palettes,
    })),
  ]

  return (
    <div className="ground min-h-dvh">
      <div className="mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-5 pt-4.5">
        <SiteHeader current="/market" />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 pt-5">
          <h1 className="font-display text-display-lg font-black">market</h1>
          <p className="max-w-[68ch] text-soft-foreground">
            {themes.length} official palettes in {series.length} series, and every market anyone publishes from a GitHub
            repository. Official palettes clear the contrast gate before they ship. Market palettes are measured the
            same way and shown, never refused.
          </p>
          <div className="flex max-w-[720px] flex-wrap gap-2">
            <CommandRow command="npx @kecan0406/ttheme init" className="flex-[1_1_280px]" />
            <CommandRow command="ttheme market init <name>" className="flex-[1_1_280px]" />
          </div>
        </div>
        <MarketGallery sections={sections} markets={markets} gate={gate} />
      </div>
    </div>
  )
}
