import type { PropsWithChildren } from '@kitajs/html'
import type { Facts } from '@/lib/facts'
import type { Theme } from '@/lib/themes'
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

export function MarketplaceFrame({ facts, ribbon, children }: PropsWithChildren<{ facts: Facts; ribbon?: Theme }>) {
  return (
    <div class="ground min-h-dvh">
      <div class="mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-5 pt-4.5">
        <SiteHeader current="/marketplace" />
        <main class="grid grid-cols-[minmax(0,1fr)] gap-14 pt-8 pb-24">{children}</main>
        <SiteFooter facts={facts} ribbon={ribbon} />
      </div>
    </div>
  )
}
