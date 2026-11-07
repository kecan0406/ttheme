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
  LayoutGrid,
  Plus,
  Star,
  X,
} from 'lucide'
import { siGithub } from 'simple-icons'
import { Badge } from '@/components/ui/badge'
import { Button, LinkButton } from '@/components/ui/button'
import { MeltCard } from '@/components/ui/melt-card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Toggle } from '@/components/ui/toggle'
import type { KeyArt } from '@/lib/art'
import {
  alsoIn,
  type Category,
  type CategorySlug,
  categoriesFrom,
  categoryPath,
  genresFrom,
  genresIn,
} from '@/lib/categories'
import type { Facts } from '@/lib/facts'
import {
  BROWSE_PATH,
  FIRST_SORT,
  initOf,
  MARKETPLACES_PATH,
  marketplacePath,
  palettePath,
  type Shelf,
  type Sort,
  searchText,
} from '@/lib/gallery'
import { BrandIcon, Icon, NewTab } from '@/lib/icons'
import { artFor } from '@/lib/key-art'
import { makePath } from '@/lib/names'
import { json } from '@/lib/render'
import { BUILTIN, type Theme } from '@/lib/themes'
import { cn } from '@/lib/utils'
import { wearStyle } from '@/lib/wear'
import { byWork, facetStyle, focusOf, leadOf, tileLook, WORN_FACETS, type WorkEntry } from '@/lib/works'
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

const RAIL_EAGER = 6

interface Stack {
  id: string | null
  name: string
  note: string | null
  lang: string | undefined
  themes: Theme[]
  lead: Theme
  art: KeyArt | null
  facets: string
  look: string
  focus: string | null
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
      art: work ? (artFor(work.id)?.art ?? null) : null,
      facets: facetStyle(lead),
      look: tileLook(lead),
      focus: work ? focusOf(work.id) : null,
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
          class="relative inline-flex items-baseline gap-2.5 pb-2 font-display text-display-lg font-black text-muted-foreground transition-colors hover:text-soft-foreground aria-[current=page]:text-foreground"
        >
          {one.lens}
          <span class="font-mono text-sm font-normal tracking-normal text-muted-foreground tabular-nums">
            {counts[one.lens]}
          </span>
          {one.lens === lens ? (
            <span data-lens-bar aria-hidden="true" class="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
          ) : null}
        </a>
      ))}
    </nav>
  )
}

function Head({
  lens,
  heading,
  counts,
  clear,
  children,
}: PropsWithChildren<{ lens: Lens; heading: string; counts: Record<Lens, number>; clear: string }>) {
  return (
    <div class="grid grid-cols-[minmax(0,1fr)] gap-5">
      <h1 class="sr-only" safe>
        {heading}
      </h1>
      <div class="flex flex-wrap items-end justify-between gap-x-12 gap-y-5">
        <Lenses lens={lens} counts={counts} />
        <LinkButton variant="outline" size="sm" href={clear} data-clear hidden class="mb-2.5">
          <span data-clear-text translate="no"></span>
          <Icon node={X} />
          <span class="sr-only">clear the search</span>
        </LinkButton>
      </div>
      <div class="flex flex-wrap items-end">{children}</div>
    </div>
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

function Empty({ everyWork = false }: { everyWork?: boolean }) {
  return (
    <div data-empty hidden class="grid justify-items-center gap-1 py-15 text-center text-muted-foreground">
      <strong class="block font-semibold text-foreground">
        <span data-empty-title>no palettes yet</span>{' '}
        <span data-empty-face aria-hidden="true">
          ( ˘ω˘ )
        </span>
      </strong>
      <span data-empty-text>ask for one, or make it yourself.</span>
      <span data-empty-ask hidden class="mt-3 flex flex-wrap justify-center gap-2">
        <LinkButton variant="outline" size="sm" href={requestUrl('')} target="_blank" rel="noopener" data-request>
          request a character
          <NewTab />
        </LinkButton>
        <LinkButton size="sm" href={makePath(null)} data-make>
          make one
        </LinkButton>
      </span>
      {everyWork ? (
        <span data-empty-every hidden class="mt-3 flex justify-center">
          <LinkButton variant="outline" size="sm" href={BROWSE_PATH} data-keep-query>
            search every work
          </LinkButton>
        </span>
      ) : null}
    </div>
  )
}

function Count({ value }: { value: number }) {
  return <b class="font-mono font-normal text-soft-foreground tabular-nums">{value}</b>
}

const TILES =
  'grid grid-cols-[repeat(auto-fill,minmax(min(100%,13.75rem),1fr))] gap-4 max-sm:grid-cols-2 max-sm:gap-2.5'

interface WorkGroup {
  id: string
  slug: CategorySlug | null
  label: string
  href: string | null
  entries: WorkEntry[]
}

function groupsOf(entries: WorkEntry[], categories: readonly Category[], category: Category | undefined): WorkGroup[] {
  const groups = (category ? [category] : categories).map((one) => ({
    id: one.slug,
    slug: one.slug,
    label: one.label,
    href: category ? null : categoryPath(one.slug),
    entries: entries.filter((entry) => categoriesFrom(entry.places).includes(one.slug)),
  }))

  const other = entries.filter((entry) => entry.places.length === 0)

  return category || other.length === 0
    ? groups
    : [...groups, { id: 'other', slug: null, label: 'other', href: null, entries: other }]
}

function Categories({ categories, current }: { categories: readonly Category[]; current: CategorySlug | undefined }) {
  return (
    <nav
      aria-label="category"
      class="flex flex-[1_1_auto] items-center gap-6 border-b border-border max-sm:basis-full max-sm:overflow-x-auto max-sm:[scrollbar-width:none]"
    >
      {categories.map((one) => (
        <a
          href={one.slug === current ? BROWSE_PATH : categoryPath(one.slug)}
          data-keep-query
          aria-current={one.slug === current ? 'page' : undefined}
          class="relative -mb-px flex-none px-0.5 pb-3 text-sm font-medium whitespace-nowrap text-soft-foreground transition-colors duration-150 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:after:opacity-100 max-sm:mb-0"
        >
          {one.label}
        </a>
      ))}
    </nav>
  )
}

function Genres({ category, entries }: { category: CategorySlug; entries: WorkEntry[] }) {
  const genres = genresIn(category)

  if (genres.length === 0) return null

  return (
    <fieldset aria-label="genre" data-genre-filter class="flex flex-wrap items-center gap-2">
      {genres.map((genre) => (
        <Toggle variant="chip" value={genre.slug}>
          <span>{genre.label}</span>
          <b data-genre-count class="font-mono text-xs font-normal text-muted-foreground tabular-nums">
            {entries.filter((entry) => genresFrom(entry.places).includes(genre.slug)).length}
          </b>
        </Toggle>
      ))}
    </fieldset>
  )
}

export function BrowseWorks({
  entries,
  categories,
  shelves,
  facts,
  category,
}: {
  entries: WorkEntry[]
  categories: readonly Category[]
  shelves: Shelf[]
  facts: Facts
  category?: Category
}) {
  const markets = shelves.map((shelf) => ({
    id: shelf.id,
    text: [shelf.id, shelf.repo, shelf.about].join(' ').toLowerCase(),
  }))

  return (
    <MarketplaceFrame facts={facts} current={BROWSE_PATH}>
      <browse-works
        data-category={category?.label}
        data-slug={category?.slug}
        class="grid grid-cols-[minmax(0,1fr)] gap-5"
      >
        <Head
          lens="works"
          heading={category ? `browse ${category.label} works` : 'browse works'}
          counts={{ works: entries.length, marketplaces: shelves.length }}
          clear={category ? categoryPath(category.slug) : BROWSE_PATH}
        >
          <Categories categories={categories} current={category?.slug} />
          <Choice name="sort" options={WORK_SORTS} first="name" />
        </Head>
        {category ? <Genres category={category.slug} entries={entries} /> : null}
        <Hint href={MARKETPLACES_PATH} label="see marketplaces" />
        <p data-summary hidden class="text-sm text-soft-foreground">
          <b data-summary-count class="font-mono font-normal text-foreground tabular-nums"></b>{' '}
          <span data-summary-text></span>
          <span data-pending hidden class="text-muted-foreground">
            {' '}
            — looking up names…
          </span>
        </p>
        {groupsOf(entries, categories, category).map((group, at) => (
          <section
            data-group
            aria-labelledby={`group-${group.id}`}
            class="grid grid-cols-[minmax(0,1fr)] gap-3.5 not-first-of-type:pt-3.5"
          >
            <h2 id={`group-${group.id}`} class="flex items-baseline gap-2 font-display text-display-sm font-black">
              {group.href ? (
                <a href={group.href} data-keep-query class="transition-colors hover:text-primary" safe>
                  {group.label}
                </a>
              ) : (
                <span safe>{group.label}</span>
              )}
              <span
                data-group-count
                class="font-mono text-xs font-normal tracking-normal text-muted-foreground tabular-nums"
              >
                {group.entries.length}
              </span>
            </h2>
            <ul data-tiles aria-label={group.label} class={TILES}>
              {group.entries.map((entry, index) => (
                <li
                  data-work={entry.id}
                  data-genres={genresFrom(entry.places).join(' ') || undefined}
                  data-search={entry.search}
                  data-names={entry.names}
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
                    look={entry.look}
                    focus={entry.focus}
                    sizes={THUMB_SIZES}
                    eager={at === 0 && index < 5}
                    also={alsoIn(entry.places, group.slug)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
        <ul data-found-tiles hidden aria-label="works without palettes" class={TILES}></ul>
        <Empty everyWork={category !== undefined} />
        <script type="application/json" data-markets>
          {json(markets)}
        </script>
      </browse-works>
    </MarketplaceFrame>
  )
}

function MarketShelf({ shelf, stacks, first }: { shelf: Shelf; stacks: Stack[]; first: boolean }) {
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
            <MarketBadge builtin={shelf.id === BUILTIN} />
          </span>
          <p class="text-sm text-pretty text-soft-foreground" safe>
            {shelf.about}
          </p>
          <span class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <RepoLine shelf={shelf} />
            <Updated at={updatedAt(shelf)} />
            <span class="text-xs text-muted-foreground">
              <Count value={shelf.palettes.length} /> palettes,{' '}
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
        {stacks.map((stack, index) => (
          <li
            data-stack
            data-work={stack.id ?? undefined}
            data-search={stack.themes.map(searchText).join('\n')}
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
              look={stack.look}
              focus={stack.focus}
              sizes="(min-width: 640px) 236px, 200px"
              eager={first && index < RAIL_EAGER}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

function MarketCover({ shelf, stacks }: { shelf: Shelf; stacks: Stack[] }) {
  const tiles = stacks.length >= 4 ? stacks.slice(0, 4) : stacks.slice(0, 1)
  const lead = stacks[0]?.lead

  return (
    <MeltCard
      size="cover"
      lift
      data-shelf={shelf.id}
      data-stars={shelf.stars ?? 0}
      data-pushed={shelf.pushedAt ?? ''}
      style={lead ? wearStyle(lead) : undefined}
      class="group/cover"
    >
      <span
        data-melt
        aria-hidden="true"
        class={cn(
          'absolute inset-x-0 top-0 -z-10 grid h-[68%] gap-0.5',
          tiles.length > 1 ? 'grid-cols-2 grid-rows-2' : null,
        )}
      >
        {tiles.map((stack) => (
          <WorkArt
            art={stack.art}
            facets={stack.facets}
            focus={stack.focus}
            sizes="(min-width: 640px) 200px, 50vw"
            class="relative"
          />
        ))}
      </span>
      <a
        href={marketplacePath(shelf.id)}
        class="absolute inset-0 rounded-[inherit] outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-ring"
      >
        <span class="sr-only" safe>
          {`open ${shelf.id}`}
        </span>
      </a>
      <MarketBadge builtin={shelf.id === BUILTIN} variant="glass" class="pointer-events-none absolute top-3 left-3" />
      <div class="pointer-events-none relative grid min-w-0 gap-1.5 px-4 pb-4">
        <h2
          translate="no"
          class="font-display text-display-sm font-black transition-colors [overflow-wrap:anywhere] group-hover/cover:text-primary"
          safe
        >
          {shelf.id}
        </h2>
        <p class="text-sm text-pretty text-soft-foreground" safe>
          {shelf.about}
        </p>
        <span class="flex flex-wrap items-center gap-x-4">
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
          <Count value={shelf.palettes.length} /> palettes, <Count value={stacks.length} /> works
        </span>
        <CommandRow
          command={shelf.add ? `ttheme marketplace add ${shelf.add}` : initOf('npx')}
          class="mt-1.5 [&_pre]:text-2xs"
        />
      </div>
    </MeltCard>
  )
}

function PublishCover() {
  return (
    <MeltCard size="cover" lift>
      <WorkArt
        art={null}
        facets={WORN_FACETS}
        sizes="400px"
        melt
        class="absolute inset-x-0 top-0 -z-10 h-[68%] opacity-55"
      />
      <span
        aria-hidden="true"
        class="absolute top-30 left-1/2 grid size-14 -translate-x-1/2 place-items-center rounded-full border border-input bg-glass text-foreground backdrop-blur-[14px]"
      >
        <Icon node={Plus} class="size-6" />
      </span>
      <Badge variant="glass" class="absolute top-3 left-3">
        your marketplace here
      </Badge>
      <div class="relative grid min-w-0 gap-1.5 px-4 pb-4">
        <h2 class="font-display text-display-sm font-black">publish your own</h2>
        <p class="text-sm text-pretty text-soft-foreground">
          A GitHub repository of palettes, a file for each work. Give it the{' '}
          <code class="font-mono text-xs text-foreground">ttheme-marketplace</code> topic and it shows up here within
          about an hour.
        </p>
        <CommandRow command={PUBLISH[0] as string} class="mt-1.5" />
      </div>
    </MeltCard>
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

  return (
    <MarketplaceFrame facts={facts} current={MARKETPLACES_PATH}>
      <browse-marketplaces class="group/browse grid grid-cols-[minmax(0,1fr)] gap-5">
        <Head
          lens="marketplaces"
          heading="browse marketplaces"
          counts={{ works, marketplaces: shelves.length }}
          clear={MARKETPLACES_PATH}
        >
          <Choice name="sort" options={MARKET_SORTS} first={FIRST_SORT} />
          <Choice name="view" options={VIEWS} first="shelves" class="flex-none pl-6" />
        </Head>
        <Hint href={BROWSE_PATH} label="see them as works" />
        <div
          data-shelves
          class="grid grid-cols-[minmax(0,1fr)] gap-12 pt-3 group-has-[[value=covers]:checked]/browse:hidden"
        >
          {shelves.map((shelf, index) => (
            <MarketShelf shelf={shelf} stacks={stacks[index] ?? []} first={index === 0} />
          ))}
        </div>
        <div
          data-covers
          class={cn(
            'hidden grid-cols-[repeat(auto-fill,minmax(min(100%,18.75rem),1fr))] gap-5 pt-3',
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
