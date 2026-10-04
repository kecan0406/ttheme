import { escapeHtml, type PropsWithChildren } from '@kitajs/html'
import { Badge } from '@/components/ui/badge'
import { catalogsOf } from '@/lib/catalogs'
import { gatePassed } from '@/lib/sheet'
import type { GateRule, Market } from '@/lib/themes'
import { CommandRow } from './command-row'
import { MarketGallery } from './market-gallery'
import { MarketFrame } from './market-page'

function Stat({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <div class="grid content-start gap-0.5 border-border px-4 py-3 not-first:border-l max-[560px]:not-first:border-t max-[560px]:not-first:border-l-0">
      <dt class="text-xs text-muted-foreground" safe>
        {label}
      </dt>
      <dd class="text-base font-semibold tabular-nums [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

export function MarketStore({ market, gate }: { market: Market; gate: GateRule[] }) {
  const clean = market.palettes.filter((theme) => gatePassed(theme, gate) === gate.length).length

  return (
    <MarketFrame>
      <div class="grid grid-cols-[minmax(0,1fr)] gap-3 pt-5">
        <p class="text-2xs font-bold tracking-caps text-muted-foreground uppercase">community market</p>
        <h1 class="font-display text-display-lg font-black [overflow-wrap:anywhere]" safe>
          {market.id}
        </h1>
        {market.about ? (
          <p class="max-w-[68ch] text-soft-foreground" safe>
            {market.about}
          </p>
        ) : null}
        <CommandRow command={`ttheme market add ${market.add}`} class="max-w-[520px]" />
      </div>
      <dl class="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] rounded-xl border bg-card shadow-sm">
        <Stat label="palettes">{market.palettes.length}</Stat>
        <Stat label="contrast gate · advisory">
          {clean} / {market.palettes.length}{' '}
          <span class="text-xs font-normal text-muted-foreground">clear every floor</span>
        </Stat>
        <Stat label="last push">{escapeHtml(market.pushedAt)}</Stat>
        <Stat label="GitHub stars">{market.stars}</Stat>
        <Stat label="license">
          {market.license ? escapeHtml(market.license) : <Badge variant="warning">none stated</Badge>}
        </Stat>
        <Stat label="source">
          <a href={`https://github.com/${market.repo}`} class="text-primary underline-offset-4 hover:underline" safe>
            {market.repo}
          </a>
        </Stat>
      </dl>
      <MarketGallery
        sections={catalogsOf(market.palettes).map(({ catalog, themes }) => ({
          key: `${market.id}:${catalog ?? ''}`,
          title: 'palettes',
          ...(catalog ? { subtitle: catalog } : {}),
          themes,
        }))}
        markets={[market]}
        gate={gate}
        sources={false}
      />
    </MarketFrame>
  )
}

export function NoSuchMarket({ id }: { id: string }) {
  return (
    <MarketFrame>
      <div class="grid justify-items-start gap-3 pt-5">
        <h1 class="font-display text-display-lg font-black">no such market</h1>
        <p class="max-w-[68ch] text-soft-foreground">
          {escapeHtml(`No repository with the ttheme-market topic publishes ${id}.`)} The list is refreshed from GitHub
          every hour. ( ˘ω˘ )
        </p>
        <a href="/market" class="text-sm font-medium text-primary underline-offset-4 hover:underline">
          back to every palette
        </a>
      </div>
    </MarketFrame>
  )
}
