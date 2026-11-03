import { type Children, escapeHtml } from '@kitajs/html'
import {
  ArrowRight,
  History,
  type IconNode,
  Link,
  Monitor,
  Paintbrush,
  Palette,
  SlidersHorizontal,
  Sprout,
  Terminal,
} from 'lucide'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/button'
import { Popover } from '@/components/ui/popover'
import { BROWSE_PATH, initOf, MARKETPLACES_PATH } from '@/lib/gallery'
import { Icon, NewTab } from '@/lib/icons'
import type { DocIcon, MenuArt, MenuDoc, MenuFacts, MenuPlace, MenuWork } from '@/lib/menu'
import { makePath } from '@/lib/names'
import { linesOf } from '@/lib/terminal'
import { WORN_FACETS } from '@/lib/works'
import { CommandRow } from './command-row'
import { TerminalScreen } from './terminal'
import { TerminalFrame } from './terminal-frame'
import { WorkArt } from './work-art'

export const NAV_ANCHOR = 'site-nav'

export const MENUS = { browse: 'menu-browse', builder: 'menu-builder', docs: 'menu-docs' } as const

export type MenuKey = keyof typeof MENUS

export const BUILDER_START = '/builder#builder-start'

export const BUILDER_OPEN = '/builder#builder-open'

export const BUILDER_DRAFTS = '/builder#builder-drafts'

const ROW =
  'flex min-w-0 items-center gap-3.5 rounded-2xl p-2.5 outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring'

const HEAD = 'px-2.5 pt-2 pb-1 text-2xs font-bold tracking-caps text-muted-foreground uppercase'

const TILE = 'relative grid size-15 flex-none place-items-center overflow-hidden rounded-xl'

const FEATURE =
  'relative flex min-h-80 w-75 flex-none flex-col overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring max-[880px]:hidden'

const PROMPT = '«2»~ «B5»❯ «»'

const DOC_ICONS: Record<DocIcon, { icon: IconNode; tone: string }> = {
  use: { icon: Palette, tone: 'bg-(--a6)/14 text-(--a6)' },
  make: { icon: Paintbrush, tone: 'bg-(--a5)/14 text-(--a5)' },
  terminals: { icon: Monitor, tone: 'bg-(--a4)/16 text-(--a4)' },
  commands: { icon: Terminal, tone: 'bg-(--a2)/14 text-(--a2)' },
  settings: { icon: SlidersHorizontal, tone: 'bg-(--a3)/14 text-(--a3)' },
}

function MenuFoot({ children }: { children: Children }) {
  return (
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-5.5 py-3.5 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function MenuGo({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      class="group/go inline-flex items-center gap-1.5 rounded-sm font-semibold text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span safe>{label}</span>
      <Icon node={ArrowRight} class="size-4 transition-transform duration-150 group-hover/go:translate-x-0.5" />
    </a>
  )
}

function Text({ title, children }: { title: string; children?: Children }) {
  return (
    <span class="grid min-w-0 gap-0.5">
      <span class="truncate text-base leading-snug font-semibold text-foreground" safe>
        {title}
      </span>
      {children ? <span class="truncate text-sm text-muted-foreground">{children}</span> : null}
    </span>
  )
}

function Cover({ art }: { art: MenuArt }) {
  return <WorkArt art={art.art} facets={art.facets} sizes="60px" class={TILE} />
}

export function InUseCard({
  work,
  href,
  ready = false,
  held = true,
}: {
  work: MenuWork | null
  href: string
  ready?: boolean
  held?: boolean
}) {
  return (
    <a
      href={href}
      data-in-use
      data-work={work?.id ?? ''}
      data-ready={ready ? '' : undefined}
      data-held={held ? '' : undefined}
      class={FEATURE}
    >
      <WorkArt art={work?.art ?? null} facets={WORN_FACETS} sizes="300px" class="absolute inset-0" />
      <span
        aria-hidden="true"
        class="absolute inset-0 bg-linear-to-b from-transparent from-35% to-background/90 to-85%"
      />
      <Badge variant="preview" class="absolute top-3.5 left-3.5">
        in use
      </Badge>
      <span class="absolute inset-x-4.5 bottom-4 grid gap-1">
        <span class="flex min-w-0 items-center gap-2 text-sm">
          <span aria-hidden="true" data-slot="signature-dots" />
          <span
            translate="no"
            class="min-w-0 truncate font-display font-extrabold text-soft-foreground after:content-(--wear-name)"
          />
        </span>
        <span data-in-use-work translate="no" class="truncate font-display text-display-sm font-black" safe>
          {work?.name ?? 'originals'}
        </span>
        {work?.native ? (
          <span
            data-in-use-work
            class="truncate font-display text-xs font-extrabold text-muted-foreground"
            lang={work.lang ?? undefined}
            translate="no"
            safe
          >
            {work.native}
          </span>
        ) : null}
      </span>
    </a>
  )
}

function PlaceRow({ place }: { place: MenuPlace }) {
  return (
    <li class={ROW}>
      <a href={place.href} class="flex min-w-0 flex-1 items-center gap-3.5 outline-none">
        <Cover art={place.cover} />
        <Text title={place.label} />
      </a>
      {place.genres.length > 0 ? (
        <span class="flex flex-none flex-col items-end gap-1.5">
          {place.genres.map((genre) => (
            <LinkButton variant="outline" size="chip" href={genre.href}>
              <span safe>{genre.label}</span>
            </LinkButton>
          ))}
        </span>
      ) : null}
    </li>
  )
}

function MarketsRow({ markets }: { markets: MenuFacts['markets'] }) {
  return (
    <li>
      <a href={MARKETPLACES_PATH} class={ROW}>
        <span aria-hidden="true" class={`${TILE} grid-cols-2 gap-px bg-border`}>
          {markets.covers.map((cover) => (
            <WorkArt art={cover.art} facets={cover.facets} sizes="30px" class="relative size-full" />
          ))}
        </span>
        <Text title="marketplaces">
          <span translate="no" safe>
            {markets.ids.join(', ')}
          </span>
        </Text>
      </a>
    </li>
  )
}

export function BrowseMenu({ menu }: { menu: MenuFacts }) {
  return (
    <Popover
      id={MENUS.browse}
      variant="menu"
      align="start"
      anchor={NAV_ANCHOR}
      label="browse"
      class="w-[min(800px,calc(100vw-32px))]"
    >
      <div class="flex gap-2.5 p-2.5">
        <div data-feature="browse" class="contents">
          <InUseCard work={menu.inUse} href={menu.inUse?.path ?? BROWSE_PATH} />
        </div>
        <ul class="grid min-w-0 flex-1 content-start gap-1">
          {menu.places.map((place) => (
            <PlaceRow place={place} />
          ))}
          <MarketsRow markets={menu.markets} />
        </ul>
      </div>
      <MenuFoot>
        <span>palettes of your favorite characters</span>
        <MenuGo href={BROWSE_PATH} label="Browse Works" />
      </MenuFoot>
    </Popover>
  )
}

function Caption({
  badge,
  title,
  named = false,
  children,
}: {
  badge: string
  title: string
  named?: boolean
  children: Children
}) {
  return (
    <span class="mt-auto grid gap-1.5 border-t border-(--fg)/14 px-4.5 pt-3.5 pb-4">
      <Badge variant="preview" class="justify-self-start">
        {escapeHtml(badge)}
      </Badge>
      <span translate={named ? 'no' : undefined} class="truncate font-display text-display-sm font-black" safe>
        {title}
      </span>
      <span class="text-sm text-(--fg)/65">{children}</span>
    </span>
  )
}

const SWATCHES = [
  Array.from({ length: 8 }, (_, at) => `«${at}»███ `).join(''),
  Array.from({ length: 8 }, (_, at) => `«${at + 8}»███ `).join(''),
]

export function BuilderCard() {
  return (
    <a href="/builder" class={FEATURE}>
      <TerminalFrame title="palette builder" class="flex flex-1 flex-col rounded-xl">
        <TerminalScreen
          decorative
          lines={linesOf([`${PROMPT}ttheme new my-palette`, ...SWATCHES, `${PROMPT}«c» `])}
          class="px-4 pb-3 text-code leading-relaxed"
        />
        <Caption badge="start" title="palette builder">
          Tune twenty colors, checked as you go
        </Caption>
      </TerminalFrame>
    </a>
  )
}

export function DraftCard({
  name,
  colors,
  when,
  href,
}: {
  name: string
  colors: readonly string[]
  when: string
  href: string
}) {
  const slots = colors.map((color, at) => `${at < 4 ? ['--bg', '--fg', '--cu', '--se'][at] : `--a${at - 4}`}:${color}`)

  return (
    <a href={href} class={FEATURE}>
      <TerminalFrame title={name} style={slots.join(';')} class="flex flex-1 flex-col rounded-xl">
        <TerminalScreen
          decorative
          lines={linesOf([`${PROMPT}ttheme use ${name}`, '«8»this tab only', ...SWATCHES, `${PROMPT}«c» `])}
          class="px-4 pb-3 text-code leading-relaxed"
        />
        <Caption badge="draft" title={name} named>
          <span safe>{when}</span>
        </Caption>
      </TerminalFrame>
    </a>
  )
}

function ToolRow({
  href,
  visual,
  title,
  children,
}: {
  href: string
  visual: JSX.Element
  title: string
  children: Children
}) {
  return (
    <li>
      <a href={href} class={ROW}>
        {visual}
        <Text title={title}>{children}</Text>
      </a>
    </li>
  )
}

function Tinted({ icon, tone }: { icon: IconNode; tone: string }) {
  return (
    <span aria-hidden="true" class={`${TILE} ${tone}`}>
      <Icon node={icon} class="size-5.5" />
    </span>
  )
}

export function BuilderMenu({ menu }: { menu: MenuFacts }) {
  return (
    <Popover
      id={MENUS.builder}
      variant="menu"
      align="start"
      anchor={NAV_ANCHOR}
      label="builder"
      class="w-[min(760px,calc(100vw-32px))]"
    >
      <div class="flex gap-2.5 p-2.5">
        <div data-feature="builder" class="contents">
          <BuilderCard />
        </div>
        <ul class="grid min-w-0 flex-1 content-start gap-1">
          <ToolRow
            href={makePath(null)}
            visual={<Tinted icon={Sprout} tone="bg-(--a2)/14 text-(--a2)" />}
            title="blank"
          >
            twenty colors from a few seeds
          </ToolRow>
          <ToolRow
            href={BUILDER_START}
            visual={
              <span aria-hidden="true" class={`${TILE} content-center gap-1.5 bg-background px-2.5`}>
                {menu.ribbons.map((ribbon) => (
                  <i class="h-2 w-full rounded-full forced-color-adjust-none" style={`background:${ribbon}`} />
                ))}
              </span>
            }
            title="from a palette"
          >
            one you like, then tune it
          </ToolRow>
          <ToolRow
            href={BUILDER_OPEN}
            visual={<Tinted icon={Link} tone="bg-accent text-primary" />}
            title="open a link, code or file"
          >
            a share link, a <span translate="no">tt8:</span> code or a <span translate="no">.toml</span>
          </ToolRow>
          <ToolRow
            href={BUILDER_DRAFTS}
            visual={<Tinted icon={History} tone="bg-muted text-soft-foreground" />}
            title="drafts"
          >
            <span data-drafts>kept in this browser</span>
          </ToolRow>
        </ul>
      </div>
      <MenuFoot>
        <span>
          share it as a link, install it with <code class="font-mono text-code text-foreground">ttheme add</code>
        </span>
        <MenuGo href="/builder" label="Open Builder" />
      </MenuFoot>
    </Popover>
  )
}

function DocRow({ doc }: { doc: MenuDoc }) {
  const { icon, tone } = DOC_ICONS[doc.icon]

  return (
    <li>
      <a href={doc.path} class={`${ROW} gap-3 py-2`}>
        <span aria-hidden="true" class={`grid size-10 flex-none place-items-center rounded-lg ${tone}`}>
          <Icon node={icon} class="size-4.5" />
        </span>
        <Text title={doc.label}>
          <span safe>{doc.blurb}</span>
        </Text>
      </a>
    </li>
  )
}

export function DocsMenu({ menu }: { menu: MenuFacts }) {
  return (
    <Popover
      id={MENUS.docs}
      variant="menu"
      align="start"
      anchor={NAV_ANCHOR}
      label="docs"
      class="w-[min(800px,calc(100vw-32px))]"
    >
      <div class="flex gap-2.5 p-2.5">
        <div class="flex w-75 flex-none flex-col justify-between gap-4 rounded-xl bg-card p-4.5 inset-ring inset-ring-border max-[880px]:hidden">
          <a
            href={menu.quick.path}
            class="group/quick grid gap-1.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Badge class="justify-self-start">start here</Badge>
            <span class="font-display text-display-sm font-black group-hover/quick:text-primary" safe>
              {menu.quick.label}
            </span>
            <span class="text-sm text-soft-foreground" safe>
              {menu.quick.lede}
            </span>
          </a>
          <CommandRow command={initOf('npx')} class="bg-background" />
        </div>
        <div class="grid min-w-0 flex-1 content-start">
          <p class={HEAD}>Guide</p>
          <ul class="grid gap-0.5">
            {menu.guide.map((doc) => (
              <DocRow doc={doc} />
            ))}
          </ul>
          <p class={`${HEAD} pt-3`}>Reference</p>
          <ul class="grid gap-0.5">
            {menu.reference.map((doc) => (
              <DocRow doc={doc} />
            ))}
          </ul>
        </div>
      </div>
      <MenuFoot>
        <span>
          <b class="font-mono font-medium text-foreground" safe>
            {menu.release.version}
          </b>{' '}
          is out,{' '}
          <a
            href={menu.release.url}
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1 text-soft-foreground underline underline-offset-3 hover:text-foreground"
          >
            what changed
            <NewTab class="size-3.5" />
          </a>
        </span>
        <MenuGo href="/docs" label="Read Docs" />
      </MenuFoot>
    </Popover>
  )
}
