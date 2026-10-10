import { ArrowUpRight, Menu } from 'lucide'
import { Button, LinkButton } from '@/components/ui/button'
import { Icon } from '@/lib/icons'
import { PalettePicker } from './palette-picker'

const NAV = [
  { href: '/sheets', label: 'sheets' },
  { href: '/marketplace', label: 'marketplace' },
] as const

export function SiteHeader({ current }: { current: string }) {
  return (
    <header
      data-sticky
      class="sticky top-4.5 z-10 flex items-center justify-between gap-4 rounded-xl border bg-glass px-4.5 py-3.5 shadow-sm backdrop-blur-[14px] backdrop-saturate-130 max-[720px]:px-3 max-[720px]:py-2.5"
    >
      <div class="flex min-w-0 items-center gap-5 max-[720px]:gap-2.5">
        <a
          href="/"
          class="rounded-sm font-display text-display-md font-black outline-none focus-visible:ring-2 focus-visible:ring-ring max-[720px]:text-display-sm"
        >
          ttheme
        </a>
        <nav aria-label="site" class="flex gap-0.5 rounded-full border bg-muted/65 p-0.75">
          {NAV.map((item) => (
            <a
              href={item.href}
              aria-current={item.href === current ? 'page' : undefined}
              class="rounded-full px-3.5 py-0.75 text-sm font-medium text-soft-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm aria-[current=page]:ring-1 aria-[current=page]:ring-border max-[720px]:px-2.5"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="menu"
        popovertarget="site-menu"
        class="hidden max-[720px]:inline-flex"
      >
        <Icon node={Menu} />
      </Button>
      <div
        id="site-menu"
        popover="auto"
        class="top-22 right-5 m-0 w-56 gap-1.5 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg inset-auto open:grid min-[720px]:static min-[720px]:flex min-[720px]:w-auto min-[720px]:items-center min-[720px]:gap-2.5 min-[720px]:overflow-visible min-[720px]:border-0 min-[720px]:bg-transparent min-[720px]:p-0 min-[720px]:text-inherit min-[720px]:shadow-none"
      >
        <LinkButton variant="ghost" size="sm" href="https://github.com/kecan0406/ttheme" class="justify-start">
          github
          <Icon node={ArrowUpRight} class="size-3" />
        </LinkButton>
        <PalettePicker />
      </div>
    </header>
  )
}
