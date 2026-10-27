import { BookOpen, Menu, Paintbrush, Store } from 'lucide'
import { siGithub } from 'simple-icons'
import { Button, LinkButton } from '@/components/ui/button'
import type { Facts } from '@/lib/facts'
import { REPO_URL, starCount } from '@/lib/gallery'
import { BrandIcon, GitHubStar, Icon, NewTab } from '@/lib/icons'
import { cn, plural } from '@/lib/utils'
import { HeaderBar } from './header-bar'
import { Mark } from './mark'
import { Wordmark } from './wordmark'

const NAV = [
  { href: '/marketplace', label: 'marketplace', icon: Store },
  { href: '/builder', label: 'builder', icon: Paintbrush },
  { href: '/docs', label: 'docs', icon: BookOpen },
] as const

export function SiteHeader({ current, facts, fixed = false }: { current: string; facts: Facts; fixed?: boolean }) {
  const stars = facts.repo?.stars ?? null

  return (
    <header
      data-sticky
      data-site-header
      data-fixed={fixed}
      class="sticky z-10 before:absolute before:inset-0 before:-z-1 before:border-b before:border-border before:bg-glass before:backdrop-blur-[14px] before:backdrop-saturate-130"
    >
      <div
        class={cn(
          'mx-auto flex min-h-13 flex-wrap items-stretch justify-between gap-x-4 header-icons:gap-x-3',
          fixed ? 'w-full px-5' : 'w-[min(1280px,calc(100%-40px))]',
        )}
      >
        <div class="flex flex-wrap items-stretch gap-x-3 header-tight:gap-x-1.5">
          <a
            href="/"
            data-wordmark
            data-slot="lockup"
            translate="no"
            class={cn(
              'self-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
              fixed ? 'text-display-sm' : 'text-display-md header-tight:text-display-sm',
            )}
          >
            <Mark />
            <Wordmark />
          </a>
          <nav aria-label="site" data-glide class="flex flex-wrap items-stretch">
            {NAV.map((item) => (
              <a
                href={item.href}
                aria-current={item.href === current ? 'page' : undefined}
                class="rounded-sm px-3 text-sm leading-13 font-medium whitespace-nowrap text-soft-foreground underline decoration-transparent decoration-2 underline-offset-4 aria-[current=page]:text-foreground aria-[current=page]:decoration-primary header-tight:px-2.5 header-icons:px-2"
              >
                <Icon node={item.icon} class="mr-1.5 inline-block size-4 align-middle header-icons:hidden" />
                <span class="header-icons:inline-flex header-icons:align-middle">
                  <Icon node={item.icon} class="hidden size-4 header-icons:block" />
                  <span class="header-icons:sr-only">{item.label}</span>
                </span>
              </a>
            ))}
          </nav>
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="menu"
          popovertarget="site-menu"
          class="ml-auto hidden self-center header-menu:inline-flex"
        >
          <Icon node={Menu} />
        </Button>
        <div
          id="site-menu"
          popover="auto"
          class="top-15 right-5 m-0 w-64 gap-1.5 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg inset-auto open:grid header-wide:static header-wide:my-2.5 header-wide:ml-auto header-wide:flex header-wide:w-auto header-wide:flex-wrap header-wide:items-center header-wide:justify-end header-wide:self-center header-wide:gap-2.5 header-wide:overflow-visible header-wide:border-0 header-wide:bg-transparent header-wide:p-0 header-wide:text-inherit header-wide:shadow-none"
        >
          <HeaderBar />
          <LinkButton
            variant="raised"
            size="sm"
            href={REPO_URL}
            target="_blank"
            rel="noopener"
            class="h-8 justify-start gap-2 header-menu:rounded-xl header-short:w-8 header-short:justify-center header-short:px-0"
          >
            <BrandIcon icon={siGithub} />
            <span class={stars === null ? 'header-short:sr-only' : 'sr-only'}>github</span>
            {stars === null ? null : (
              <>
                <span aria-hidden="true" class="inline-flex items-center gap-1.5 header-short:hidden">
                  <GitHubStar />
                  <span class="font-bold text-foreground tabular-nums" safe>
                    {starCount(stars)}
                  </span>
                </span>
                <span class="sr-only" safe>
                  {plural(stars, 'star')}
                </span>
              </>
            )}
            {stars === null ? (
              <NewTab class="header-short:hidden" />
            ) : (
              <span class="sr-only">, opens in a new tab</span>
            )}
          </LinkButton>
        </div>
      </div>
    </header>
  )
}
