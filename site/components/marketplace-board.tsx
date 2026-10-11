import type { PropsWithChildren } from '@kitajs/html'
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, type IconNode, Layers, Search, Store } from 'lucide'
import { siGithub } from 'simple-icons'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { ToggleGroup, ToggleGroupCount, ToggleGroupItem } from '@/components/ui/toggle-group'
import { catalogsOf } from '@/lib/catalogs'
import {
  catalogPath,
  marketplacePath,
  OFFICIAL,
  type Peek,
  peekOf,
  type Shelf,
  SOURCES,
  type Source,
  START,
  searchable,
  shelvesMatching,
} from '@/lib/gallery'
import { BrandIcon, Icon } from '@/lib/icons'
import { json } from '@/lib/render'
import type { Theme } from '@/lib/themes'
import { cn, plural } from '@/lib/utils'
import { TerminalPreview } from './terminal-preview'

const DOTS = 9

const SOURCE_ICONS: Record<Source, IconNode | null> = { all: null, official: Layers, community: Store }

interface Catalog {
  catalog: string | null
  name: string
  note: string | null
  themes: Theme[]
  lead: Theme
}

function catalogsIn(shelf: Shelf): Catalog[] {
  return catalogsOf(shelf.palettes).flatMap(({ catalog, themes }) => {
    const lead = themes.find((theme) => theme.lead) ?? themes[0]
    if (!lead) return []
    const note = catalog === null ? null : (lead.native ?? `led by ${lead.name}`)
    return [{ catalog, name: catalog ?? 'other palettes', note, themes, lead }]
  })
}

function CatalogSwatch({ theme }: { theme: Theme }) {
  const style = [`--bg:${theme.background}`, ...theme.signature.map((color, index) => `--sg${index}:${color}`)].join(
    ';',
  )
  return <span aria-hidden="true" data-slot="catalog-swatch" style={style} />
}

function PaletteDots({ themes }: { themes: Theme[] }) {
  const style = themes
    .slice(0, DOTS)
    .map((theme, index) => `--dot${index}:${theme.signature[0]}`)
    .join(';')
  return <span aria-hidden="true" data-slot="palette-dots" style={style} />
}

function CatalogCard({ catalog, official }: { catalog: Catalog; official: boolean }) {
  return (
    <a
      href={catalogPath(catalog.lead)}
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
            <span class="truncate font-display text-xs font-extrabold text-muted-foreground" safe>
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
    <div
      data-peek={shelf.id}
      data-slot="peek-window"
      style={peek.style}
      class="min-w-0 flex-[0_1_440px] overflow-hidden rounded-2xl bg-(--bg) text-(--fg) ring-1 ring-border"
    >
      <div class="flex items-center gap-2 border-b border-(--fg)/12 py-1 pr-1 pl-3.5">
        <span aria-hidden="true" class="flex gap-1.5">
          <i class="size-2.5 rounded-full bg-(--a1)" />
          <i class="size-2.5 rounded-full bg-(--a3)" />
          <i class="size-2.5 rounded-full bg-(--a2)" />
        </span>
        <span data-peek-title class="min-w-0 flex-1 truncate text-center font-mono text-xs text-(--fg)/62" safe>
          {peek.title}
        </span>
        {catalogs.length > 1 ? (
          <>
            <Button variant="scene" size="icon-sm" aria-label="previous palette" data-peek-step="-1">
              <Icon node={ChevronLeft} />
            </Button>
            <Button variant="scene" size="icon-sm" aria-label="next palette" data-peek-step="1">
              <Icon node={ChevronRight} />
            </Button>
          </>
        ) : null}
      </div>
      <TerminalPreview theme={first.lead} scene="shell" worn class="min-h-0 px-4 pt-3 pb-3.5" />
    </div>
  )
}

function MarketplaceCard({ shelf, catalogs }: { shelf: Shelf; catalogs: Catalog[] }) {
  const official = shelf.id === OFFICIAL
  const named = catalogs.filter((catalog) => catalog.catalog !== null).length
  return (
    <article
      data-shelf={shelf.id}
      class="overflow-hidden rounded-3xl border bg-card shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-input hover:shadow-md has-[details[open]]:border-input"
    >
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 p-3.5">
        <PeekWindow shelf={shelf} catalogs={catalogs} />
        <div class="group/open relative flex min-w-0 flex-[1_1_20rem] items-center gap-4 self-stretch rounded-2xl p-4 transition-colors has-[a:hover]:bg-muted/65 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
          <div class="grid min-w-0 flex-1 gap-1.5">
            <span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h2 class="font-display text-display-sm font-black [overflow-wrap:anywhere]">
                <a
                  href={marketplacePath(official ? null : shelf.id)}
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
            <span class="flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <BrandIcon icon={siGithub} class="size-3 flex-none" />
              <span class="truncate" safe>
                {shelf.repo}
              </span>
            </span>
            <p class="text-sm text-soft-foreground" safe>
              {shelf.about}
            </p>
            <p class="mt-1 flex flex-wrap gap-x-4.5 gap-y-1 text-sm text-soft-foreground">
              <span>
                <b data-shelf-count class="font-mono font-normal text-foreground tabular-nums">
                  {shelf.palettes.length}
                </b>{' '}
                palettes
              </span>
              <span>
                updated{' '}
                <b class="font-mono font-normal text-foreground" safe>
                  {shelf.updated}
                </b>
              </span>
            </p>
          </div>
          <span
            aria-hidden="true"
            class="grid size-10 flex-none place-items-center rounded-full border bg-card text-soft-foreground transition-[background-color,border-color,color,translate] duration-200 group-has-[a:hover]/open:border-primary group-has-[a:hover]/open:bg-primary group-has-[a:hover]/open:text-primary-foreground motion-safe:group-has-[a:hover]/open:translate-x-0.5"
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
        <InputGroup class="h-11 max-w-[540px] flex-[1_1_22rem]">
          <InputGroupAddon>
            <Icon node={Search} />
          </InputGroupAddon>
          <InputGroupInput
            name="query"
            placeholder="search marketplaces, catalogs, palettes"
            aria-label="search marketplaces"
            aria-keyshortcuts="/"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            enterkeyhint="search"
          />
          <InputGroupAddon align="inline-end">
            <Kbd>/</Kbd>
          </InputGroupAddon>
        </InputGroup>
      </div>
      <ToggleGroup variant="underline" label="source">
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
      <div class="grid grid-cols-[minmax(0,1fr)] gap-4 pt-2">
        {shelves.map((shelf, index) => (
          <MarketplaceCard shelf={shelf} catalogs={catalogs[index] ?? []} />
        ))}
      </div>
      <div data-empty hidden class="py-15 text-center text-muted-foreground">
        <strong data-empty-title class="block font-semibold text-foreground">
          no palette matches these filters ( ˘ω˘ )
        </strong>
        clear a filter, or search for a catalog instead.
      </div>
      <script type="application/json" data-peeks>
        {json(peeks)}
      </script>
    </marketplace-board>
  )
}
