import type { Metadata } from 'next'
import { Suspense } from 'react'
import { MarketStore } from '@/components/market-store'
import { SiteHeader } from '@/components/site-header'
import { loadMarkets } from '@/lib/markets'
import { loadManifest } from '@/lib/themes'

export const metadata: Metadata = {
  title: 'ttheme — market',
  description: 'One ttheme market: its repository, its palettes and how they measure against the contrast gate',
}

export default async function MarketStorePage() {
  const { gate } = loadManifest()
  const markets = await loadMarkets()

  return (
    <div className="ground min-h-dvh">
      <div className="mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-5 pt-4.5">
        <SiteHeader current="/market" />
        <Suspense>
          <MarketStore markets={markets} gate={gate} />
        </Suspense>
      </div>
    </div>
  )
}
