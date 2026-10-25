import type { PropsWithChildren } from '@kitajs/html'
import {
  ArrowDownAZ,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  type IconNode,
  Layers,
  Search,
  Star,
  Store,
} from 'lucide'
import { siGithub } from 'simple-icons'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants, LinkButton } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { ToggleGroup, ToggleGroupCount, ToggleGroupItem } from '@/components/ui/toggle-group'
import { catalogsOf, nativeLang } from '@/lib/catalogs'
import {
  FIRST_SORT,
  marketplacePath,
  OFFICIAL,
  type Peek,
  palettePath,
  peekOf,
  type Shelf,
  SORTS,
  SOURCES,
  type Sort,
  type Source,
  START,
  searchable,
  shelvesMatching,
  starCount,
} from '@/lib/gallery'
import { BrandIcon, Icon } from '@/lib/icons'
import { json } from '@/lib/render'
import { paint, type Theme } from '@/lib/themes'
import { cn, plural } from '@/lib/utils'
import { TerminalFrame } from './terminal-frame'
import { TerminalPreview } from './terminal-preview'

const DOTS = 9

const SOURCE_ICONS: Record<Source, IconNode | null> = { all: null, official: Layers, community: Store }

const SORT_LABELS = {
  popular: { label: 'popular', icon: Star },
  updated: { label: 'updated', icon: Clock },
  name: { label: 'a–z', icon: ArrowDownAZ },
} as const satisfies Record<Sort, { label: string; icon: IconNode }>

interface Catalog {
  catalog: string | null
  name: string
  note: string | null
  lang: string | undefined
  themes: Theme[]
  lead: Theme
}

function catalogsIn(shelf: Shelf): Catalog[] {
  return catalogsOf(shelf.palettes).flatMap(({ catalog, themes }) => {
    const lead = themes.find((theme) => theme.lead) ?? themes[0]

    if (!lead) return []
    const note = catalog === null ? null : (lead.native ?? `led by ${lead.name}`)
    const lang = catalog === null ? undefined : nativeLang(lead)

    return [{ catalog, name: catalog ?? 'other palettes', note, lang, themes, lead }]
  })
}

function CatalogSwatch({ theme }: { theme: Theme }) {
  const style = [
    `--bg:${paint(theme, (shade) => shade.background)}`,
    ...theme.signature.map((_, index) => `--sg${index}:${paint(theme, (shade) => shade.signature[index] as string)}`),
  ].join(';')

  return <span aria-hidden="true" data-slot="catalog-swatch" style={style} />
}

function PaletteDots({ themes }: { themes: Theme[] }) {
  const style = themes
    .slice(0, DOTS)
    .map((theme, index) => `--dot${index}:${paint(theme, (shade) => shade.signature[0] as string)}`)
    .join(';')

  return <span aria-hidden="true" data-slot="palette-dots" style={style} />
}

function CatalogCard({ catalog, official }: { catalog: Catalog; official: boolean }) {
  return (
    <a
      href={palettePath(catalog.lead)}
      data-catalog
      data-search={catalog.themes.map((theme) => searchable(theme).text).join('\n')}
      data-official={official}
      class="grid gap-3 rounded-xl border bg-card px-3.5 py-3 shadow-sm transition-[translate,border-color,box-shadow] duration-200 outline-none hover:border-input hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring motion-safe:hover:-translate-y-0.5"
    >
      <span class="flex min-w-0 items-center gap-2.5">
        <CatalogSwatch theme={catalog.lead} />
        <span class="grid min-w-0">
          <span class="truncate font-display text-base leading-snug font-extrabold" safe>
            {catalog.name}
          </span>
          {catalog.note === null ? null : (
            <span lang={catalog.lang} class="truncate font-display text-xs font-extrabold text-muted-foreground" safe>
              {catalog.note}
            </span>
          )}
        </span>
      </span>
      <span class="flex items-center justify-between gap-2 border-t pt-2.5">
        <PaletteDots themes={catalog.themes} />
        <span class="font-mono text-xs text-muted-foreground" safe>
          {plural(catalog.themes.length, 'palette')}
        </span>
      </span>
    </a>
  )
}

function PeekWindow({ shelf, catalogs }: { shelf: Shelf; catalogs: Catalog[] }) {
  const first = catalogs[0]

  if (!first) return null
  const peek = peekOf(first.lead, first.catalog)

  return (
    <TerminalFrame
      data-peek={shelf.id}
      data-slot="peek-window"
      style={peek.style}
      title={peek.title}
      class="min-w-0 flex-[0_1_440px]"
      controls={
        catalogs.length > 1 ? (
          <>
            <Button variant="scene" size="icon-sm" aria-label="previous palette" data-peek-step="-1">
              <Icon node={ChevronLeft} />
            </Button>
            <Button variant="scene" size="icon-sm" aria-label="next palette" data-peek-step="1">
              <Icon node={ChevronRight} />
            </Button>
          </>
        ) : undefined
      }
    >
      <TerminalPreview theme={first.lead} scene="shell" worn class="min-h-0 px-4 pt-3 pb-3.5" />
    </TerminalFrame>
  )
}

function MarketplaceCard({ shelf, catalogs }: { shelf: Shelf; catalogs: Catalog[] }) {
  const official = shelf.id === OFFICIAL
  const named = catalogs.filter((catalog) => catalog.catalog !== null).length

  return (
    <article
      data-shelf={shelf.id}
      data-stars={shelf.stars ?? 0}
      data-pushed={shelf.pushedAt ?? ''}
      class="overflow-hidden rounded-3xl border bg-card shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-input hover:shadow-md has-[details[open]]:border-input"
    >
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 p-3.5">
        <PeekWindow shelf={shelf} catalogs={catalogs} />
        <div class="group/open relative flex min-w-0 flex-[1_1_20rem] items-center gap-4 self-stretch rounded-2xl p-4 transition-colors has-[a[data-open]:hover]:bg-muted/65 has-[a[data-open]:focus-visible]:ring-2 has-[a[data-open]:focus-visible]:ring-ring">
          <div class="grid min-w-0 flex-1 gap-1.5">
            <span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h2 class="font-display text-display-sm font-black [overflow-wrap:anywhere]">
                <a
                  href={marketplacePath(official ? null : shelf.id)}
                  data-open
                  class="outline-none transition-colors after:absolute after:inset-0 after:rounded-2xl hover:text-primary"
                  safe
                >
                  {shelf.id}
                </a>
              </h2>
              <Badge>
                <Icon node={official ? Layers : Store} />
                {official ? 'official' : 'community'}
              </Badge>
            </span>
            <p class="text-sm text-soft-foreground" safe>
              {shelf.about}
            </p>
            <p class="text-sm text-soft-foreground">
              <b data-shelf-count class="font-mono font-normal text-foreground tabular-nums">
                {shelf.palettes.length}
              </b>{' '}
              palettes
              {shelf.version === null ? null : (
                <>
                  {' · ttheme '}
                  <b class="font-mono font-normal text-foreground" safe>
                    {`v${shelf.version}`}
                  </b>
                </>
              )}
            </p>
            <span class="mt-1 flex flex-wrap gap-1.5">
              <LinkButton
                variant="outline"
                size="xs"
                href={shelf.url}
                target="_blank"
                rel="noopener"
                class="relative z-1 max-w-full min-w-0 shrink"
              >
                <BrandIcon icon={siGithub} class="size-3 flex-none" />
                <span class="truncate font-mono font-normal" safe>
                  {shelf.repo}
                </span>
                {shelf.stars === null ? null : (
                  <>
                    <span
                      aria-hidden="true"
                      class="inline-flex flex-none items-center gap-1 border-l pl-2 font-bold text-foreground tabular-nums"
                    >
                      <span safe>{starCount(shelf.stars)}</span>
                      <Icon node={Star} class="size-3.5 fill-current text-soft-foreground" />
                    </span>
                    <span class="sr-only" safe>
                      {`, ${plural(shelf.stars, 'GitHub star')}`}
                    </span>
                  </>
                )}
                <span class="sr-only">, opens in a new tab</span>
              </LinkButton>
              {shelf.pushedAt === null ? null : (
                <LinkButton
                  variant="outline"
                  size="xs"
                  href={shelf.commits}
                  target="_blank"
                  rel="noopener"
                  class="relative z-1"
                >
                  <Icon node={Clock} class="size-3.5" />
                  updated
                  <b class="font-mono font-normal text-foreground" safe>
                    {shelf.pushedAt}
                  </b>
                  <span class="sr-only">, opens in a new tab</span>
                </LinkButton>
              )}
            </span>
          </div>
          <span
            aria-hidden="true"
            class="grid size-10 flex-none place-items-center rounded-full border bg-card text-soft-foreground transition-[background-color,border-color,color,translate] duration-200 group-has-[a[data-open]:hover]/open:border-primary group-has-[a[data-open]:hover]/open:bg-primary group-has-[a[data-open]:hover]/open:text-primary-foreground motion-safe:group-has-[a[data-open]:hover]/open:translate-x-0.5"
          >
            <Icon node={ArrowRight} class="size-4.5" />
          </span>
        </div>
      </div>
      <details data-slot="marketplace-catalogs" class="group/catalogs">
        <summary class="group/toggle flex cursor-pointer list-none items-center gap-3 px-5 pt-0.5 pb-4 outline-none before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border [&::-webkit-details-marker]:hidden">
          <span
            class={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'pr-2.5 pl-3.5 group-hover/toggle:border-input group-hover/toggle:bg-secondary group-hover/toggle:text-foreground group-focus-visible/toggle:ring-2 group-focus-visible/toggle:ring-ring group-focus-visible/toggle:ring-offset-2 group-focus-visible/toggle:ring-offset-background group-active/toggle:scale-96 group-open/catalogs:border-input group-open/catalogs:text-foreground',
            )}
          >
            <b class="font-mono font-normal text-foreground tabular-nums">{named}</b>{' '}
            {named === 1 ? 'catalog' : 'catalogs'}
            <Icon
              node={ChevronDown}
              class="transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-open/catalogs:rotate-180"
            />
          </span>
        </summary>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-2.5 border-t bg-muted/65 px-5 pt-4.5 pb-5">
          {catalogs.map((catalog) => (
            <CatalogCard catalog={catalog} official={official} />
          ))}
        </div>
      </details>
    </article>
  )
}

export function MarketplaceBoard({ shelves, children }: PropsWithChildren<{ shelves: Shelf[] }>) {
  const found = shelves.map((shelf) => shelf.palettes.map(searchable))
  const catalogs = shelves.map(catalogsIn)

  const peeks: Record<string, Peek[]> = Object.fromEntries(
    shelves.map((shelf, index) => [
      shelf.id,
      (catalogs[index] ?? []).map((catalog) => peekOf(catalog.lead, catalog.catalog)),
    ]),
  )

  const count = (source: (typeof SOURCES)[number]) => shelvesMatching(found, { ...START, source })

  return (
    <marketplace-board class="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div class="flex flex-wrap items-end justify-between gap-x-12 gap-y-5">
        {children}
        <search class="max-w-[540px] flex-[1_1_22rem]">
          <InputGroup class="h-11">
            <InputGroupAddon>
              <Icon node={Search} />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              name="query"
              placeholder="search marketplaces, catalogs, palettes"
              aria-label="search marketplaces"
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
      <div class="flex flex-wrap items-end">
        <ToggleGroup variant="underline" label="source" class="w-auto flex-[1_1_auto]">
          {SOURCES.map((source) => {
            const icon = SOURCE_ICONS[source]

            return (
              <ToggleGroupItem variant="underline" name="source" value={source} checked={source === START.source}>
                {icon ? <Icon node={icon} /> : null}
                {source}
                <ToggleGroupCount data-count={source}>{count(source)}</ToggleGroupCount>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
        <ToggleGroup variant="underline" label="sort" class="w-auto flex-[1_1_auto] justify-end gap-5">
          <span aria-hidden="true" class="pb-3 text-sm text-muted-foreground">
            sort
          </span>
          {SORTS.map((sort) => (
            <ToggleGroupItem variant="underline" name="sort" value={sort} checked={sort === FIRST_SORT}>
              <Icon node={SORT_LABELS[sort].icon} />
              {SORT_LABELS[sort].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div data-shelves class="grid grid-cols-[minmax(0,1fr)] gap-4 pt-2">
        {shelves.map((shelf, index) => (
          <MarketplaceCard shelf={shelf} catalogs={catalogs[index] ?? []} />
        ))}
      </div>
      <div data-empty hidden class="py-15 text-center text-muted-foreground">
        <strong class="block font-semibold text-foreground">
          <span data-empty-title>no palette matches these filters</span> <span aria-hidden="true">( ˘ω˘ )</span>
        </strong>
        clear a filter, or search for a catalog instead.
      </div>
      <script type="application/json" data-peeks>
        {json(peeks)}
      </script>
    </marketplace-board>
  )
}
