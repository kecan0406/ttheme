import { escapeHtml, type PropsWithChildren } from '@kitajs/html'
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  GalleryHorizontalEnd,
  type IconNode,
  Layers,
  LayoutGrid,
  Plus,
  Search,
  Star,
  Store,
} from 'lucide'
import { siGithub } from 'simple-icons'
import { Button, LinkButton } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { RadioGroup, RadioGroupCount, RadioGroupItem } from '@/components/ui/radio-group'
import { type KeyArt, keyArtOf } from '@/lib/art'
import type { Facts } from '@/lib/facts'
import {
  BROWSE_PATH,
  FIRST_SORT,
  MARKETPLACES_PATH,
  marketplacePath,
  palettePath,
  type Shelf,
  SOURCE_LABELS,
  SOURCES,
  type Sort,
  type Source,
  START,
  searchable,
  shelvesMatching,
} from '@/lib/gallery'
import { BrandIcon, Icon, NewTab } from '@/lib/icons'
import { artFor } from '@/lib/key-art'
import { makePath } from '@/lib/names'
import { json } from '@/lib/render'
import { BUILTIN, type Theme } from '@/lib/themes'
import { cn } from '@/lib/utils'
import { byWork, facetStyle, leadOf, type WorkEntry } from '@/lib/works'
import { requestUrl } from '../../src/core/names.ts'
import { CommandRow } from './command-row'
import { MarketplaceFrame } from './marketplace-frame'
import { WorkArt } from './work-art'
import { MarketBadge, RepoLine, Stars, THUMB_SIZES, Updated, updatedAt, WorkThumb } from './work-parts'

type Lens = 'works' | 'marketplaces'

interface Option {
  label: string
  icon: IconNode
}

const LENSES: { lens: Lens; href: string }[] = [
  { lens: 'works', href: BROWSE_PATH },
  { lens: 'marketplaces', href: MARKETPLACES_PATH },
]

const SOURCE_ICONS: Record<Source, IconNode | null> = { all: null, builtin: Layers, community: Store }

const WORK_SORTS = {
  name: { label: 'a–z', icon: ArrowDownAZ },
  palettes: { label: 'most palettes', icon: ArrowDownWideNarrow },
} satisfies Record<string, Option>

const MARKET_SORTS = {
  popular: { label: 'popular', icon: Star },
  updated: { label: 'updated', icon: Clock },
  name: { label: 'a–z', icon: ArrowDownAZ },
} satisfies Record<Sort, Option>

const VIEWS = {
  shelves: { label: 'shelves', icon: GalleryHorizontalEnd },
  covers: { label: 'covers', icon: LayoutGrid },
} satisfies Record<string, Option>

const PUBLISH = ['ttheme marketplace init', 'ttheme marketplace check']

interface Stack {
  id: string | null
  name: string
  note: string | null
  lang: string | undefined
  themes: Theme[]
  lead: Theme
  art: KeyArt | null
  facets: string
}

function stacksIn(shelf: Shelf): Stack[] {
  return byWork(shelf.palettes).map((group) => {
    const { work, themes } = group
    const lead = leadOf(group)

    return {
      id: work?.id ?? null,
      name: work?.name ?? 'originals',
      note: work ? (work.native ?? `led by ${lead.name}`) : null,
      lang: work?.lang ?? undefined,
      themes,
      lead,
      art: work ? keyArtOf(artFor(work.id)) : null,
      facets: facetStyle(lead),
    }
  })
}

function Lenses({ lens, counts }: { lens: Lens; counts: Record<Lens, number> }) {
  return (
    <nav aria-label="browse by" class="flex flex-wrap items-baseline gap-x-7.5 gap-y-1">
      {LENSES.map((one) => (
        <a
          href={one.href}
          data-lens={one.lens}
          aria-current={one.lens === lens ? 'page' : undefined}
          class="relative inline-flex items-baseline gap-2.5 pb-2 font-display text-display-lg font-black text-muted-foreground transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 hover:text-soft-foreground aria-[current=page]:text-foreground aria-[current=page]:after:opacity-100"
        >
          {one.lens}
          <span class="font-mono text-sm font-normal tracking-normal text-muted-foreground tabular-nums">
            {counts[one.lens]}
          </span>
        </a>
      ))}
    </nav>
  )
}

function Head({
  lens,
  counts,
  placeholder,
  children,
}: PropsWithChildren<{ lens: Lens; counts: Record<Lens, number>; placeholder: string }>) {
  return (
    <div class="grid grid-cols-[minmax(0,1fr)] gap-5">
      <h1 class="sr-only">{lens === 'works' ? 'browse works' : 'browse marketplaces'}</h1>
      <div class="flex flex-wrap items-end justify-between gap-x-12 gap-y-5">
        <Lenses lens={lens} counts={counts} />
        <search class="max-w-[540px] flex-[1_1_22rem]">
          <InputGroup class="h-11">
            <InputGroupAddon>
              <Icon node={Search} />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              name="query"
              placeholder={placeholder}
              aria-label={placeholder}
              aria-keyshortcuts="Meta+K Control+K"
              spellcheck="false"
              autocomplete="off"
              autocapitalize="none"
              autocorrect="off"
              enterkeyhint="search"
            />
            <InputGroupAddon align="inline-end">
              <Kbd>
                <span data-key="apple">⌘</span>
                <span data-key="other">ctrl</span>k
              </Kbd>
            </InputGroupAddon>
          </InputGroup>
        </search>
      </div>
      <div class="flex flex-wrap items-end">{children}</div>
    </div>
  )
}

function Sources({ counts }: { counts: Record<Source, number> }) {
  return (
    <RadioGroup variant="underline" label="source" class="w-auto flex-[1_1_auto]">
      {SOURCES.map((source) => {
        const icon = SOURCE_ICONS[source]

        return (
          <RadioGroupItem variant="underline" name="source" value={source} checked={source === START.source}>
            {icon ? <Icon node={icon} /> : null}
            {SOURCE_LABELS[source]}
            <RadioGroupCount data-count={source}>{counts[source]}</RadioGroupCount>
          </RadioGroupItem>
        )
      })}
    </RadioGroup>
  )
}

function Choice({
  name,
  options,
  first,
  class: className,
}: {
  name: string
  options: Record<string, Option>
  first: string
  class?: string
}) {
  return (
    <RadioGroup variant="underline" label={name} class={cn('w-auto flex-[1_1_auto] justify-end gap-5', className)}>
      <span aria-hidden="true" class="pb-3 text-sm text-muted-foreground" safe>
        {name}
      </span>
      {Object.entries(options).map(([value, option]) => (
        <RadioGroupItem variant="underline" name={name} value={value} checked={value === first}>
          <Icon node={option.icon} />
          {escapeHtml(option.label)}
        </RadioGroupItem>
      ))}
    </RadioGroup>
  )
}

function Hint({ href, label }: { href: string; label: string }) {
  return (
    <p
      data-hint
      hidden
      class="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg bg-muted/65 px-3.5 py-2.5 text-sm text-soft-foreground"
    >
      <span data-hint-text></span>
      <a
        data-hint-link
        href={href}
        class="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
      >
        <span safe>{label}</span>
        <Icon node={ArrowRight} class="size-3.5" />
      </a>
    </p>
  )
}

function Empty() {
  return (
    <div data-empty hidden class="grid justify-items-center gap-1 py-15 text-center text-muted-foreground">
      <strong class="block font-semibold text-foreground">
        <span data-empty-title>no palette matches these filters</span>{' '}
        <span data-empty-face aria-hidden="true">
          ( ˘ω˘ )
        </span>
      </strong>
      <span data-empty-text>clear a filter, or search for a work instead.</span>
      <span data-empty-ask hidden class="mt-3 flex flex-wrap justify-center gap-2">
        <LinkButton variant="outline" size="sm" href={requestUrl('')} target="_blank" rel="noopener" data-request>
          request a palette
          <NewTab />
        </LinkButton>
        <LinkButton size="sm" href={makePath(null)} data-make>
          make one
        </LinkButton>
      </span>
    </div>
  )
}

function Count({ value }: { value: number }) {
  return <b class="font-mono font-normal text-soft-foreground tabular-nums">{value}</b>
}

export function BrowseWorks({ entries, shelves, facts }: { entries: WorkEntry[]; shelves: Shelf[]; facts: Facts }) {
  const count = (source: Source) =>
    entries.filter((entry) => source === 'all' || (source === 'builtin' ? entry.builtin : entry.community)).length

  const markets = shelves.map((shelf) => ({
    id: shelf.id,
    text: [shelf.id, shelf.repo, shelf.about].join(' ').toLowerCase(),
  }))

  return (
    <MarketplaceFrame facts={facts} current={BROWSE_PATH}>
      <browse-works class="grid grid-cols-[minmax(0,1fr)] gap-5">
        <Head
          lens="works"
          counts={{ works: entries.length, marketplaces: shelves.length }}
          placeholder="search works and characters"
        >
          <Sources counts={{ all: count('all'), builtin: count('builtin'), community: count('community') }} />
          <Choice name="sort" options={WORK_SORTS} first="name" />
        </Head>
        <Hint href={MARKETPLACES_PATH} label="see marketplaces" />
        <p data-summary hidden class="text-sm text-soft-foreground">
          <b data-summary-count class="font-mono font-normal text-foreground tabular-nums"></b>{' '}
          <span data-summary-text></span>
          <span data-pending hidden class="text-muted-foreground">
            {' '}
            · looking up names…
          </span>
        </p>
        <ul
          data-tiles
          aria-label="works"
          class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13.75rem),1fr))] gap-x-4 gap-y-6.5 pt-2 max-sm:grid-cols-2 max-sm:gap-x-3 max-sm:gap-y-5"
        >
          {entries.map((entry, index) => (
            <li
              data-work={entry.id}
              data-search={entry.search}
              data-builtin={entry.builtin}
              data-community={entry.community}
              data-palettes={entry.palettes}
              data-order={index}
              class="grid"
            >
              <WorkThumb
                href={entry.path}
                name={entry.name}
                native={entry.native}
                lang={entry.lang}
                count={entry.palettes}
                art={entry.art}
                facets={entry.facets}
                sizes={THUMB_SIZES}
                eager={index < 5}
                community={!entry.builtin}
              />
            </li>
          ))}
        </ul>
        <Empty />
        <script type="application/json" data-markets>
          {json(markets)}
        </script>
      </browse-works>
    </MarketplaceFrame>
  )
}

function MarketShelf({ shelf, stacks }: { shelf: Shelf; stacks: Stack[] }) {
  const builtin = shelf.id === BUILTIN
  const heading = `shelf-${shelf.id.replace(/[^\w-]/g, '-')}`

  return (
    <section
      data-shelf={shelf.id}
      data-stars={shelf.stars ?? 0}
      data-pushed={shelf.pushedAt ?? ''}
      aria-labelledby={heading}
      class="grid grid-cols-[minmax(0,1fr)] gap-3.5"
    >
      <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div class="grid min-w-0 flex-[1_1_28rem] gap-1.5">
          <span class="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h2 id={heading} class="font-display text-display-sm font-black [overflow-wrap:anywhere]">
              <a href={marketplacePath(shelf.id)} translate="no" class="transition-colors hover:text-primary" safe>
                {shelf.id}
              </a>
            </h2>
            <MarketBadge builtin={builtin} />
          </span>
          <p class="text-sm text-pretty text-soft-foreground" safe>
            {shelf.about}
          </p>
          <span class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <RepoLine shelf={shelf} />
            <Updated at={updatedAt(shelf)} />
            <span class="text-xs text-muted-foreground">
              <Count value={shelf.palettes.length} /> palettes ·{' '}
              <b data-works-count class="font-mono font-normal text-soft-foreground tabular-nums">
                {stacks.length}
              </b>{' '}
              works
            </span>
          </span>
        </div>
        <span class="flex flex-none items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-round"
            data-scroll="-1"
            aria-label={`scroll ${shelf.id} back`}
            class="max-sm:hidden"
          >
            <Icon node={ChevronLeft} />
          </Button>
          <Button
            variant="outline"
            size="icon-round"
            data-scroll="1"
            aria-label={`scroll ${shelf.id} on`}
            class="max-sm:hidden"
          >
            <Icon node={ChevronRight} />
          </Button>
          <a
            href={marketplacePath(shelf.id)}
            aria-label={`open ${shelf.id}`}
            class="ml-1.5 grid size-9 place-items-center rounded-full border text-soft-foreground transition-[background-color,border-color,color,translate] duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground motion-safe:hover:translate-x-0.5"
          >
            <Icon node={ArrowRight} class="size-4" />
          </a>
        </span>
      </div>
      <ul
        data-rail
        data-slot="rail"
        aria-label={`works in ${shelf.id}`}
        class="-mx-5 grid snap-x snap-mandatory scroll-px-5 auto-cols-[14.75rem] grid-flow-col gap-4 overflow-x-auto px-5 pt-0.5 pb-2 [scrollbar-width:none] max-sm:auto-cols-[12.5rem] max-sm:gap-3"
      >
        {stacks.map((stack) => (
          <li
            data-stack
            data-work={stack.id ?? undefined}
            data-search={stack.themes.map((theme) => searchable(theme).text).join('\n')}
            data-builtin={builtin}
            class="grid snap-start"
          >
            <WorkThumb
              href={palettePath(stack.lead)}
              name={stack.name}
              native={stack.note}
              lang={stack.lang}
              count={stack.themes.length}
              art={stack.art}
              facets={stack.facets}
              sizes="(min-width: 640px) 236px, 200px"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

function MarketCover({ shelf, stacks }: { shelf: Shelf; stacks: Stack[] }) {
  const tiles = stacks.length >= 4 ? stacks.slice(0, 4) : stacks.slice(0, 1)

  return (
    <a
      href={marketplacePath(shelf.id)}
      data-shelf={shelf.id}
      data-stars={shelf.stars ?? 0}
      data-pushed={shelf.pushedAt ?? ''}
      class="group/cover grid min-w-0 content-start gap-3.5 outline-none"
    >
      <span
        class={cn(
          'grid aspect-video gap-0.75 overflow-hidden rounded-2xl bg-muted transition-[translate,box-shadow] duration-200 group-hover/cover:shadow-md group-focus-visible/cover:ring-2 group-focus-visible/cover:ring-ring group-focus-visible/cover:ring-offset-2 group-focus-visible/cover:ring-offset-background motion-safe:group-hover/cover:-translate-y-0.5',
          tiles.length > 1 ? 'grid-cols-2 grid-rows-2' : null,
        )}
      >
        {tiles.map((stack) => (
          <WorkArt art={stack.art} facets={stack.facets} sizes="(min-width: 640px) 200px, 50vw" class="relative" />
        ))}
      </span>
      <span class="grid min-w-0 gap-1.5">
        <span class="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <h2
            translate="no"
            class="font-display text-display-sm font-black transition-colors [overflow-wrap:anywhere] group-hover/cover:text-primary"
            safe
          >
            {shelf.id}
          </h2>
          <MarketBadge builtin={shelf.id === BUILTIN} />
        </span>
        <span class="text-sm text-pretty text-soft-foreground" safe>
          {shelf.about}
        </span>
        <span class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span translate="no" class="inline-flex min-w-0 items-center gap-2 font-mono text-xs text-soft-foreground">
            <BrandIcon icon={siGithub} class="size-3 flex-none" />
            <span class="truncate" safe>
              {shelf.repo}
            </span>
            <Stars stars={shelf.stars} />
          </span>
          <Updated at={updatedAt(shelf)} />
        </span>
        <span class="text-xs text-muted-foreground">
          <Count value={shelf.palettes.length} /> palettes · <Count value={stacks.length} /> works
        </span>
      </span>
    </a>
  )
}

function PublishCover() {
  return (
    <div class="grid min-w-0 content-start gap-3.5">
      <span
        aria-hidden="true"
        class="grid aspect-video place-content-center justify-items-center gap-2.5 rounded-2xl bg-muted/55 text-soft-foreground inset-ring inset-ring-border"
      >
        <span class="grid size-12 place-items-center rounded-full border border-input">
          <Icon node={Plus} class="size-5.5" />
        </span>
        <span class="font-display text-sm font-extrabold">your marketplace here</span>
      </span>
      <div class="grid min-w-0 gap-1.5">
        <h2 class="font-display text-display-sm font-black">publish your own</h2>
        <p class="text-sm text-pretty text-soft-foreground">
          A GitHub repository of palettes, a file for each work. Give it the{' '}
          <code class="font-mono text-xs text-foreground">ttheme-marketplace</code> topic and it shows up here within
          about an hour.
        </p>
        <CommandRow command={PUBLISH[0] as string} class="mt-1" />
      </div>
    </div>
  )
}

function Publish({ class: className }: { class?: string }) {
  return (
    <section aria-labelledby="publish" class={cn('mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 border-t pt-9', className)}>
      <h2 id="publish" class="font-display text-display-sm font-black">
        publish your own
      </h2>
      <p class="max-w-[620px] text-sm text-pretty text-soft-foreground">
        A marketplace is a GitHub repository of palettes, a file for each work:{' '}
        <code class="font-mono text-xs">init</code> makes one, <code class="font-mono text-xs">check</code> reads it as
        an install would, and once it carries the{' '}
        <code class="font-mono text-xs text-foreground">ttheme-marketplace</code> topic it shows up here and in ttheme's
        own search within about an hour.
      </p>
      <ol class="grid max-w-[560px] gap-2">
        {PUBLISH.map((command, index) => (
          <li class="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2.5">
            <span class="font-mono text-xs text-muted-foreground">{index + 1}</span>
            <CommandRow command={command} />
          </li>
        ))}
        <li class="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2.5">
          <span class="font-mono text-xs text-muted-foreground">{PUBLISH.length + 1}</span>
          <span class="px-3 text-sm text-soft-foreground">
            push it to GitHub with the <code class="font-mono text-xs text-foreground">ttheme-marketplace</code> topic
          </span>
        </li>
      </ol>
    </section>
  )
}

export function BrowseMarketplaces({ shelves, works, facts }: { shelves: Shelf[]; works: number; facts: Facts }) {
  const stacks = shelves.map(stacksIn)
  const found = shelves.map((shelf) => shelf.palettes.map(searchable))
  const count = (source: Source) => shelvesMatching(found, { ...START, source })

  return (
    <MarketplaceFrame facts={facts} current={MARKETPLACES_PATH}>
      <browse-marketplaces class="group/browse grid grid-cols-[minmax(0,1fr)] gap-5">
        <Head
          lens="marketplaces"
          counts={{ works, marketplaces: shelves.length }}
          placeholder="search marketplaces, works, palettes"
        >
          <Sources counts={{ all: count('all'), builtin: count('builtin'), community: count('community') }} />
          <Choice name="sort" options={MARKET_SORTS} first={FIRST_SORT} />
          <Choice name="view" options={VIEWS} first="shelves" class="flex-none pl-6" />
        </Head>
        <Hint href={BROWSE_PATH} label="see them as works" />
        <div
          data-shelves
          class="grid grid-cols-[minmax(0,1fr)] gap-12 pt-3 group-has-[[value=covers]:checked]/browse:hidden"
        >
          {shelves.map((shelf, index) => (
            <MarketShelf shelf={shelf} stacks={stacks[index] ?? []} />
          ))}
        </div>
        <div
          data-covers
          class={cn(
            'hidden grid-cols-[repeat(auto-fill,minmax(min(100%,18.75rem),1fr))] gap-x-5 gap-y-8 pt-3',
            'group-has-[[value=covers]:checked]/browse:grid',
          )}
        >
          {shelves.map((shelf, index) => (
            <MarketCover shelf={shelf} stacks={stacks[index] ?? []} />
          ))}
          <PublishCover />
        </div>
        <Empty />
        <Publish class="group-has-[[value=covers]:checked]/browse:hidden" />
      </browse-marketplaces>
    </MarketplaceFrame>
  )
}
