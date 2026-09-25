'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import type { Market } from '@/lib/markets'
import { gatePassed } from '@/lib/sheet'
import type { GateRule } from '@/lib/themes'
import { CommandRow } from './command-row'
import { MarketGallery } from './market-gallery'

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-0.5 border-border px-4 py-3 not-first:border-l max-[560px]:not-first:border-t max-[560px]:not-first:border-l-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-base font-semibold tabular-nums [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

export function MarketStore({ markets, gate }: { markets: Market[]; gate: GateRule[] }) {
  const id = useSearchParams().get('m')
  const market = markets.find((entry) => entry.id === id)

  if (!market)
    return (
      <div className="grid justify-items-start gap-3 pt-5">
        <h1 className="font-display text-display-lg font-black">no such market</h1>
        <p className="max-w-[68ch] text-soft-foreground">
          {id ? `No repository with the ttheme-market topic publishes ${id}.` : 'Pick a market from the gallery.'} The
          list is rebuilt every day from GitHub. ( ˘ω˘ )
        </p>
        <Link href="/market" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          back to every palette
        </Link>
      </div>
    )

  const clean = market.palettes.filter((theme) => gatePassed(theme, gate) === gate.length).length

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 pt-5">
        <p className="text-2xs font-bold tracking-caps text-muted-foreground uppercase">community market</p>
        <h1 className="font-display text-display-lg font-black [overflow-wrap:anywhere]">{market.id}</h1>
        {market.about ? <p className="max-w-[68ch] text-soft-foreground">{market.about}</p> : null}
        <CommandRow command={`ttheme market add ${market.add}`} className="max-w-[520px]" />
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] rounded-xl border bg-card shadow-sm">
        <Stat label="palettes">{market.palettes.length}</Stat>
        <Stat label="contrast gate · advisory">
          {clean} / {market.palettes.length}{' '}
          <span className="text-xs font-normal text-muted-foreground">clear every floor</span>
        </Stat>
        <Stat label="last push">{market.pushedAt}</Stat>
        <Stat label="GitHub stars · at site build">{market.stars}</Stat>
        <Stat label="license">{market.license ?? <Badge variant="warning">none stated</Badge>}</Stat>
        <Stat label="source">
          <a href={`https://github.com/${market.repo}`} className="text-primary underline-offset-4 hover:underline">
            {market.repo}
          </a>
        </Stat>
      </dl>
      <MarketGallery
        sections={[{ key: market.id, title: 'palettes', themes: market.palettes }]}
        markets={[market]}
        gate={gate}
        sources={false}
      />
    </>
  )
}
