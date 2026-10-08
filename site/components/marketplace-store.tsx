import { escapeHtml, type PropsWithChildren } from '@kitajs/html'
import { Badge } from '@/components/ui/badge'
import { catalogsOf } from '@/lib/catalogs'
import { gatePassed } from '@/lib/sheet'
import type { GateRule, Marketplace } from '@/lib/themes'
import { CommandRow } from './command-row'
import { MarketplaceGallery } from './marketplace-gallery'
import { MarketplaceFrame } from './marketplace-page'

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

export function MarketplaceStore({ marketplace, gate }: { marketplace: Marketplace; gate: GateRule[] }) {
  const clean = marketplace.palettes.filter((theme) => gatePassed(theme, gate) === gate.length).length

  return (
    <MarketplaceFrame>
      <div class="grid grid-cols-[minmax(0,1fr)] gap-3 pt-5">
        <p class="text-2xs font-bold tracking-caps text-muted-foreground uppercase">community marketplace</p>
        <h1 class="font-display text-display-lg font-black [overflow-wrap:anywhere]" safe>
          {marketplace.id}
        </h1>
        {marketplace.about ? (
          <p class="max-w-[68ch] text-soft-foreground" safe>
            {marketplace.about}
          </p>
        ) : null}
        <CommandRow command={`ttheme marketplace add ${marketplace.add}`} class="max-w-[520px]" />
      </div>
      <dl class="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] rounded-xl border bg-card shadow-sm">
        <Stat label="palettes">{marketplace.palettes.length}</Stat>
        <Stat label="contrast gate · advisory">
          {clean} / {marketplace.palettes.length}{' '}
          <span class="text-xs font-normal text-muted-foreground">clear every floor</span>
        </Stat>
        <Stat label="last push">{escapeHtml(marketplace.pushedAt)}</Stat>
        <Stat label="GitHub stars">{marketplace.stars}</Stat>
        <Stat label="license">
          {marketplace.license ? escapeHtml(marketplace.license) : <Badge variant="warning">none stated</Badge>}
        </Stat>
        <Stat label="source">
          <a
            href={`https://github.com/${marketplace.repo}`}
            class="text-primary underline-offset-4 hover:underline"
            safe
          >
            {marketplace.repo}
          </a>
        </Stat>
      </dl>
      <MarketplaceGallery
        sections={catalogsOf(marketplace.palettes).map(({ catalog, themes }) => ({
          key: `${marketplace.id}:${catalog ?? ''}`,
          title: 'palettes',
          ...(catalog ? { subtitle: catalog } : {}),
          themes,
        }))}
        marketplaces={[marketplace]}
        gate={gate}
        sources={false}
      />
    </MarketplaceFrame>
  )
}

export function NoSuchMarketplace({ id }: { id: string }) {
  return (
    <MarketplaceFrame>
      <div class="grid justify-items-start gap-3 pt-5">
        <h1 class="font-display text-display-lg font-black">no such marketplace</h1>
        <p class="max-w-[68ch] text-soft-foreground">
          {escapeHtml(`No repository with the ttheme-marketplace topic publishes ${id}.`)} The list is refreshed from
          GitHub every hour. ( ˘ω˘ )
        </p>
        <a href="/marketplace" class="text-sm font-medium text-primary underline-offset-4 hover:underline">
          back to every palette
        </a>
      </div>
    </MarketplaceFrame>
  )
}
