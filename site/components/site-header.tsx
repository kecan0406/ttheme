import { BookOpen, ChevronDown, Compass, Menu, Paintbrush } from 'lucide'
import { siGithub } from 'simple-icons'
import { Button, LinkButton } from '@/components/ui/button'
import { Popover, PopoverTrigger } from '@/components/ui/popover'
import type { Facts } from '@/lib/facts'
import { BROWSE_PATH, REPO_URL, starCount } from '@/lib/gallery'
import { BrandIcon, GitHubStar, Icon, NewTab } from '@/lib/icons'
import { cn, plural } from '@/lib/utils'
import { HeaderBar } from './header-bar'
import { Mark } from './mark'
import { BrowseMenu, BuilderMenu, DocsMenu, MENUS, type MenuKey, NAV_ANCHOR } from './site-menus'
import { SiteSearch } from './site-search'
import { Wordmark } from './wordmark'

const NAV = [
  { key: 'browse', href: BROWSE_PATH, label: 'browse', icon: Compass },
  { key: 'builder', href: '/builder', label: 'builder', icon: Paintbrush },
  { key: 'docs', href: '/docs', label: 'docs', icon: BookOpen },
] as const satisfies readonly { key: MenuKey; href: string; label: string; icon: typeof Compass }[]

const ITEM =
  'rounded-sm px-3 text-sm leading-13 font-medium whitespace-nowrap text-soft-foreground underline decoration-transparent decoration-2 underline-offset-4 aria-[current=page]:text-foreground aria-[current=page]:decoration-primary header-tight:px-2.5 header-icons:px-2'

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
          'relative mx-auto flex min-h-13 flex-wrap items-stretch justify-between gap-x-4',
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
          <site-menus class="contents">
            <nav id={NAV_ANCHOR} aria-label="site" data-glide class="flex flex-wrap items-stretch">
              {NAV.map((item) => (
                <span data-menu-item={MENUS[item.key]} class="group/item flex items-stretch">
                  <a
                    href={item.href}
                    aria-current={item.href === current ? 'page' : undefined}
                    class={cn(ITEM, 'header-wide:pr-0')}
                  >
                    <Icon node={item.icon} class="mr-1.5 inline-block size-4 align-middle header-icons:hidden" />
                    <span class="header-icons:inline-flex header-icons:align-middle">
                      <Icon node={item.icon} class="hidden size-4 header-icons:block" />
                      <span class="header-icons:sr-only">{item.label}</span>
                    </span>
                  </a>
                  <button
                    type="button"
                    popovertarget={MENUS[item.key]}
                    popovertargetaction="show"
                    data-menu-trigger
                    aria-label={`${item.label} menu`}
                    class="group/chevron hidden h-8 cursor-pointer place-items-center self-center rounded-md px-2 text-muted-foreground outline-none group-hover/item:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:text-foreground header-wide:grid"
                  >
                    <Icon
                      node={ChevronDown}
                      class="size-3.5 transition-transform duration-200 group-data-popup-open/chevron:rotate-180"
                    />
                  </button>
                </span>
              ))}
            </nav>
          </site-menus>
        </div>
        <div class="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1.5 header-search:flex-none">
          <SiteSearch />
          <PopoverTrigger
            popover="site-menu"
            dialog={false}
            render={(props) => (
              <Button
                {...props}
                variant="outline"
                size="icon-sm"
                aria-label="menu"
                class="hidden self-center header-menu:inline-flex"
              >
                <Icon node={Menu} />
              </Button>
            )}
          />
        </div>
        <Popover
          id="site-menu"
          render={(props) => (
            <div
              {...props}
              class="top-15 right-5 m-0 w-64 gap-1.5 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg inset-auto open:grid header-wide:static header-wide:my-2.5 header-wide:flex header-wide:w-auto header-wide:flex-wrap header-wide:items-center header-wide:justify-end header-wide:self-center header-wide:gap-2.5 header-wide:overflow-visible header-wide:border-0 header-wide:bg-transparent header-wide:p-0 header-wide:text-inherit header-wide:shadow-none"
            />
          )}
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
        </Popover>
      </div>
      <BrowseMenu menu={facts.menu} />
      <BuilderMenu menu={facts.menu} />
      <DocsMenu menu={facts.menu} />
    </header>
  )
}
