import { escapeHtml, type PropsWithChildren } from '@kitajs/html'
import type { Facts } from '@/lib/facts'
import { marketplacePath, OFFICIAL } from '@/lib/gallery'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'

export interface Crumb {
  label: string
  href?: string
}

export function Crumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav
      aria-label="breadcrumb"
      class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
    >
      {trail.map((crumb, index) => (
        <>
          {index > 0 ? (
            <span aria-hidden="true" class="text-faint-foreground">
              /
            </span>
          ) : null}
          {crumb.href ? (
            <a href={crumb.href} class="transition-colors hover:text-foreground [overflow-wrap:anywhere]" safe>
              {crumb.label}
            </a>
          ) : (
            <span aria-current="page" class="text-soft-foreground [overflow-wrap:anywhere]" safe>
              {crumb.label}
            </span>
          )}
        </>
      ))}
    </nav>
  )
}

export function MarketplaceFrame({ facts, current, children }: PropsWithChildren<{ facts: Facts; current?: string }>) {
  return (
    <div class="ground flex min-h-dvh flex-col">
      <SiteHeader current="/marketplace" />
      <div class="mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-5 pt-5">
        <main id="content" class="grid grid-cols-[minmax(0,1fr)] gap-14 pt-8 pb-24">
          {children}
        </main>
      </div>
      <SiteFooter facts={facts} current={current} />
    </div>
  )
}

export function NoSuchMarketplace({ id, facts }: { id: string; facts: Facts }) {
  return (
    <MarketplaceFrame facts={facts}>
      <div class="grid justify-items-start gap-3">
        <Crumbs trail={[{ label: 'marketplace', href: '/marketplace' }, { label: id }]} />
        <h1 class="font-display text-display-lg font-black">no such marketplace</h1>
        <p class="max-w-[68ch] text-soft-foreground">
          {escapeHtml(`No repository with the ttheme-marketplace topic publishes ${id}.`)} The list is refreshed from
          GitHub every hour. <span aria-hidden="true">( ˘ω˘ )</span>
        </p>
        <a href="/marketplace" class="text-sm font-medium text-primary underline-offset-4 hover:underline">
          back to every marketplace
        </a>
      </div>
    </MarketplaceFrame>
  )
}

export function NoSuchPalette({ id, name, facts }: { id: string; name: string; facts: Facts }) {
  const home = marketplacePath(id === OFFICIAL ? null : id)

  return (
    <MarketplaceFrame facts={facts}>
      <div class="grid justify-items-start gap-3">
        <Crumbs trail={[{ label: 'marketplace', href: '/marketplace' }, { label: id, href: home }, { label: name }]} />
        <h1 class="font-display text-display-lg font-black">no such palette</h1>
        <p class="max-w-[68ch] text-soft-foreground">
          {escapeHtml(`${id} has no palette named ${name}.`)} It may have been renamed or removed.{' '}
          <span aria-hidden="true">( ˘ω˘ )</span>
        </p>
        <a href={home} class="text-sm font-medium text-primary underline-offset-4 hover:underline">
          back to its marketplace
        </a>
      </div>
    </MarketplaceFrame>
  )
}
