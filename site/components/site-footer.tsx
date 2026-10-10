import { Badge } from '@/components/ui/badge'
import type { Facts } from '@/lib/facts'
import { OFFICIAL_REPO } from '@/lib/gallery'
import type { Theme } from '@/lib/themes'
import { cn } from '@/lib/utils'

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

const SLOTS = Array.from({ length: 16 }, (_, index) => index)

function Ribbon({ theme }: { theme: Theme | 'worn' }) {
  const colors = theme === 'worn' ? SLOTS.map((slot) => `var(--a${slot})`) : theme.ansi
  return (
    <div data-slot="ribbon" class="grid gap-2">
      <div aria-hidden="true" class="grid h-1.5 grid-cols-16 gap-0.75">
        {colors.map((color) => (
          <i class="rounded-full" style={`background:${color}`} />
        ))}
      </div>
      {theme === 'worn' ? null : (
        <p class="text-right font-mono text-2xs text-muted-foreground" safe>
          {`ansi 0–15 · ${theme.name}`}
        </p>
      )}
    </div>
  )
}

function Brand({ facts }: { facts: Facts }) {
  return (
    <div class="grid content-start justify-items-start gap-2.5 max-[640px]:col-span-2">
      <a
        href="/"
        class="rounded-sm font-display text-display-sm font-black outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ttheme
      </a>
      <p class="text-xs font-medium tracking-wide text-muted-foreground">wear your favorite character</p>
      <Badge variant="count">
        {facts.palettes} palettes · {facts.catalogs} catalogs
      </Badge>
    </div>
  )
}

function Tagline({ facts }: { facts: Facts }) {
  return (
    <div class="grid content-start justify-items-start gap-2.5 max-[640px]:col-span-2">
      <p class="max-w-[18ch] font-display text-display-sm font-extrabold">wear your favorite character</p>
      <Badge variant="count">
        {facts.palettes} palettes · {facts.catalogs} catalogs
      </Badge>
    </div>
  )
}

function Columns() {
  return (
    <nav
      aria-label="more"
      class="col-span-3 grid grid-cols-3 gap-8 max-[640px]:col-span-2 max-[640px]:grid-cols-2 max-[640px]:gap-6"
    >
      {COLUMNS.map((column) => (
        <div
          class={cn(
            'grid content-start gap-3',
            column.title === 'your own' && 'max-[640px]:order-3 max-[640px]:col-span-2',
          )}
        >
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
  )
}

function Mega() {
  return (
    <div aria-hidden="true" class="relative h-[0.63em] overflow-hidden text-mega select-none">
      <span class="absolute top-0 left-1/2 -translate-x-1/2 font-display font-black whitespace-nowrap text-primary/16">
        ttheme
      </span>
      <div class="absolute inset-x-0 bottom-6 flex justify-center gap-2 max-[640px]:bottom-3.5 max-[640px]:gap-1">
        {SLOTS.map((slot) => (
          <i
            class="block h-5 w-11 rounded-full inset-ring inset-ring-foreground/16 motion-safe:animate-dance max-[640px]:h-3 max-[640px]:w-4"
            style={`background:var(--a${slot});animation-delay:${slot * -0.6}s`}
          />
        ))}
      </div>
    </div>
  )
}

export function SiteFooter({
  facts,
  ribbon,
  landing = false,
}: {
  facts: Facts
  ribbon?: Theme | 'worn'
  landing?: boolean
}) {
  return (
    <footer class={cn('grid gap-8 pt-9 pb-6', !ribbon && !landing && 'border-t')}>
      {ribbon ? <Ribbon theme={ribbon} /> : null}
      <div class="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-8 max-[640px]:grid-cols-2 max-[640px]:gap-6">
        {landing ? <Tagline facts={facts} /> : <Brand facts={facts} />}
        <Columns />
      </div>
      {landing ? <Mega /> : null}
      <div class="flex flex-wrap justify-between gap-x-4 gap-y-1.5 border-t pt-5 text-xs text-muted-foreground">
        <span safe>{`free and open, MIT · v${facts.version}`}</span>
        <span>a palette is colors and post numbers, never code</span>
      </div>
    </footer>
  )
}
