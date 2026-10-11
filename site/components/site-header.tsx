import { Menu } from 'lucide'
import { siGithub } from 'simple-icons'
import { Button, LinkButton } from '@/components/ui/button'
import { BrandIcon, Icon } from '@/lib/icons'
import { PalettePicker } from './palette-picker'

const NAV = [
  { href: '/sheets', label: 'sheets' },
  { href: '/marketplace', label: 'marketplace' },
] as const

export function SiteHeader({ current }: { current: string }) {
  return (
    <header
      data-sticky
      data-site-header
      class="sticky z-10 before:absolute before:inset-0 before:-z-1 before:border-b before:border-border before:bg-glass before:backdrop-blur-[14px] before:backdrop-saturate-130"
    >
      <div class="mx-auto flex h-full w-[min(1280px,calc(100%-40px))] items-stretch justify-between gap-4">
        <div class="flex min-w-0 items-stretch gap-3 max-[720px]:gap-1.5">
          <a
            href="/"
            data-wordmark
            class="self-center rounded-sm font-display text-display-md font-black outline-none focus-visible:ring-2 focus-visible:ring-ring max-[720px]:text-display-sm"
          >
            ttheme
          </a>
          <nav aria-label="site" data-glide class="flex items-stretch">
            {NAV.map((item) => (
              <a
                href={item.href}
                aria-current={item.href === current ? 'page' : undefined}
                class="rounded-sm px-3 text-sm leading-13 font-medium text-soft-foreground underline decoration-transparent decoration-2 underline-offset-4 aria-[current=page]:text-foreground aria-[current=page]:decoration-primary max-[720px]:px-2.5"
              >
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="menu"
          popovertarget="site-menu"
          class="hidden self-center max-[720px]:inline-flex"
        >
          <Icon node={Menu} />
        </Button>
        <div
          id="site-menu"
          popover="auto"
          class="top-15 right-5 m-0 w-56 gap-1.5 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg inset-auto open:grid min-[720px]:static min-[720px]:flex min-[720px]:w-auto min-[720px]:items-center min-[720px]:self-center min-[720px]:gap-2.5 min-[720px]:overflow-visible min-[720px]:border-0 min-[720px]:bg-transparent min-[720px]:p-0 min-[720px]:text-inherit min-[720px]:shadow-none"
        >
          <LinkButton variant="ghost" size="sm" href="https://github.com/kecan0406/ttheme" class="justify-start">
            <BrandIcon icon={siGithub} />
            github
          </LinkButton>
          <PalettePicker />
        </div>
      </div>
    </header>
  )
}
