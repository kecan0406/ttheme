import { type SimpleIcon, siGithub, siNpm, siX } from 'simple-icons'
import { CREDITS_PATH } from '@/lib/art'
import type { Facts } from '@/lib/facts'
import { BROWSE_PATH, MARKETPLACES_PATH, marketplacePath, NPM_URL, REPO_URL, X_URL } from '@/lib/gallery'
import { BrandIcon, NewTab } from '@/lib/icons'
import { BUILTIN } from '@/lib/themes'
import { cn } from '@/lib/utils'
import { Mark } from './mark'
import { Wordmark } from './wordmark'

const COLUMNS: { title: string; links: { label: string; href: string; brand?: SimpleIcon }[] }[] = [
  {
    title: 'browse',
    links: [
      { label: 'works', href: BROWSE_PATH },
      { label: 'marketplaces', href: MARKETPLACES_PATH },
      { label: 'built-in', href: marketplacePath(BUILTIN) },
    ],
  },
  {
    title: 'your own',
    links: [
      { label: 'make a palette', href: '/builder' },
      { label: 'publish a marketplace', href: '/docs/guide/make#publish-a-marketplace' },
      { label: 'marketplaces on GitHub', href: 'https://github.com/topics/ttheme-marketplace', brand: siGithub },
    ],
  },
  {
    title: 'project',
    links: [
      { label: 'docs', href: '/docs' },
      { label: 'github', href: REPO_URL, brand: siGithub },
      { label: 'npm', href: NPM_URL, brand: siNpm },
      { label: 'x', href: X_URL, brand: siX },
      { label: 'report a bug', href: `${REPO_URL}/issues/new/choose` },
      { label: 'credits', href: CREDITS_PATH },
    ],
  },
]

function outside(href: string): boolean {
  return href.startsWith('https://')
}

function OutLabel({ label }: { label: string }) {
  const at = label.lastIndexOf(' ') + 1

  return (
    <>
      <span safe>{label.slice(0, at)}</span>
      <span class="whitespace-nowrap">
        <span safe>{label.slice(at)}</span>
        <NewTab class="inline-block size-3.5 align-middle" />
      </span>
    </>
  )
}

const SLOTS = Array.from({ length: 16 }, (_, index) => index)

function Brand() {
  return (
    <div class="grid content-start justify-items-start gap-2.5 max-[640px]:col-span-2">
      <a
        href="/"
        translate="no"
        data-slot="lockup"
        class="rounded-sm text-display-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Mark />
        <Wordmark />
      </a>
      <p class="text-xs font-medium tracking-wide text-muted-foreground">use your favorite character</p>
    </div>
  )
}

function Columns({ current, plain = false }: { current: string; plain?: boolean }) {
  return (
    <nav
      aria-label="more"
      class={cn(
        'grid max-[640px]:grid-cols-2 max-[640px]:gap-6',
        plain
          ? 'grid-cols-[repeat(3,auto)] justify-start gap-14 lead-stacked:gap-8'
          : 'col-span-3 grid-cols-3 gap-8 max-[640px]:col-span-2',
      )}
    >
      {COLUMNS.map((column, index) => (
        <div
          class={cn(
            'grid content-start gap-3',
            column.title === 'your own' && 'max-[640px]:order-3 max-[640px]:col-span-2',
          )}
          style={plain ? undefined : `--key:var(--sg${index})`}
        >
          <h2 class="flex items-center gap-2 text-2xs font-bold tracking-caps text-muted-foreground uppercase">
            {plain ? null : <i aria-hidden="true" class="h-1 w-3 rounded-full bg-(--key)" />}
            <span safe>{column.title}</span>
          </h2>
          <ul data-glide class="grid gap-2">
            {column.links.map((link) => (
              <li>
                <a
                  href={link.href}
                  target={outside(link.href) ? '_blank' : undefined}
                  rel={outside(link.href) ? 'noopener' : undefined}
                  aria-current={link.href === current ? 'page' : undefined}
                  class="rounded-sm text-sm text-soft-foreground underline decoration-transparent decoration-2 underline-offset-4 aria-[current=page]:text-foreground aria-[current=page]:decoration-primary"
                >
                  {link.brand && !plain ? (
                    <BrandIcon icon={link.brand} class="mr-1.5 inline-block size-3.5 align-middle" />
                  ) : null}
                  <span>{outside(link.href) ? <OutLabel label={link.label} /> : <span safe>{link.label}</span>}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function LandingFooter({ facts }: { facts: Facts }) {
  return (
    <footer data-site-footer data-lead-footer>
      <div data-lead-footer-top>
        <div aria-hidden="true" data-lead-footer-field>
          <i data-lead-footer-echo />
          <i data-lead-footer-solid />
        </div>
        <div aria-hidden="true" translate="no" data-lead-footer-mega class="text-mega select-none">
          <Wordmark leading={0.85} />
        </div>
        <div data-lead-footer-body>
          <div class="grid content-start justify-items-start gap-3">
            <a
              href="/"
              translate="no"
              data-slot="lockup"
              class="rounded-sm text-display-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Mark />
              <Wordmark />
            </a>
            <p class="text-base font-medium">use your favorite character</p>
          </div>
          <Columns current="/" plain />
        </div>
      </div>
      <div aria-hidden="true" data-lead-footer-pills>
        {SLOTS.map((slot) => (
          <i
            class="block h-2.5 min-w-1.5 rounded-full inset-ring inset-ring-foreground/16 forced-color-adjust-none motion-safe:animate-dance"
            style={`background:var(--a${slot});width:${slot % 3 === 0 ? 28 : 12}px;animation-delay:${slot * -0.6}s`}
          />
        ))}
      </div>
      <div data-lead-footer-line class="text-xs text-muted-foreground">
        <span>MIT</span>
        <span translate="no" safe>{`v${facts.version}`}</span>
        <span>a palette is colors and post numbers, never code</span>
      </div>
    </footer>
  )
}

export function SiteFooter({ facts, current = '' }: { facts: Facts; current?: string }) {
  return (
    <footer
      data-site-footer
      class="relative isolate mt-auto before:absolute before:inset-0 before:-z-1 before:border-t before:border-border before:bg-glass before:backdrop-blur-[14px] before:backdrop-saturate-130"
    >
      <div class="mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-8 pt-9 pb-6">
        <div class="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-8 max-[640px]:grid-cols-2 max-[640px]:gap-6">
          <Brand />
          <Columns current={current} />
        </div>
        <div class="flex flex-wrap justify-between gap-x-4 gap-y-1.5 border-t pt-5 text-xs text-muted-foreground">
          <span safe>{`free and open, MIT, v${facts.version}`}</span>
          <span>a palette is colors and post numbers, never code</span>
        </div>
      </div>
    </footer>
  )
}
