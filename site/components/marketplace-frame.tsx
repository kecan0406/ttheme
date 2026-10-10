import type { PropsWithChildren } from '@kitajs/html'
import { OFFICIAL_REPO } from '@/lib/gallery'
import { SiteHeader } from './site-header'

const REPO = `https://github.com/${OFFICIAL_REPO}`

const COLUMNS = [
  {
    title: 'browse',
    links: [
      { label: 'every palette', href: '/marketplace' },
      { label: 'official', href: '/marketplace/official' },
      { label: 'sheets', href: '/sheets' },
    ],
  },
  {
    title: 'your own',
    links: [
      { label: 'make a palette', href: `${REPO}#your-own-palettes` },
      { label: 'publish a marketplace', href: `${REPO}#marketplaces` },
      { label: 'marketplaces on GitHub', href: 'https://github.com/topics/ttheme-marketplace' },
    ],
  },
  {
    title: 'project',
    links: [
      { label: 'github', href: REPO },
      { label: 'npm', href: 'https://www.npmjs.com/package/@kecan0406/ttheme' },
      { label: 'report a bug', href: `${REPO}/issues/new/choose` },
    ],
  },
]

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

function MarketplaceFooter() {
  return (
    <footer class="grid gap-10 border-t pt-12 pb-10">
      <nav aria-label="more" class="grid grid-cols-3 gap-8 max-[640px]:grid-cols-2">
        {COLUMNS.map((column) => (
          <div class="grid content-start gap-3">
            <h2 class="text-2xs font-bold tracking-caps text-muted-foreground uppercase" safe>
              {column.title}
            </h2>
            <ul class="grid gap-2">
              {column.links.map((link) => (
                <li>
                  <a href={link.href} class="text-sm text-soft-foreground transition-colors hover:text-foreground" safe>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div class="flex flex-wrap justify-between gap-4 border-t pt-6 text-xs text-muted-foreground">
        <span>free and open, MIT</span>
        <span>a palette is colors and post numbers, never code</span>
      </div>
    </footer>
  )
}

export function MarketplaceFrame({ children }: PropsWithChildren) {
  return (
    <div class="ground min-h-dvh">
      <div class="mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-5 pt-4.5">
        <SiteHeader current="/marketplace" />
        <main class="grid grid-cols-[minmax(0,1fr)] gap-14 pt-8 pb-24">{children}</main>
        <MarketplaceFooter />
      </div>
    </div>
  )
}
