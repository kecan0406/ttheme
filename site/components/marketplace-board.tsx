import { escapeHtml } from '@kitajs/html'
import { ArrowRight, ChevronRight, Search } from 'lucide'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { marketplacePath, OFFICIAL, type Shelf, SOURCES, START, searchable, shelvesMatching } from '@/lib/gallery'
import { Icon } from '@/lib/icons'
import { gatePassed } from '@/lib/sheet'
import type { GateRule } from '@/lib/themes'
import { cn } from '@/lib/utils'
import { SectionHead } from './palette-parts'
import { PaletteRow } from './palette-rows'

const COLUMNS = 'grid-cols-[2.5rem_minmax(0,1fr)_6rem_5rem] max-[760px]:grid-cols-[2rem_minmax(0,1fr)_auto]'

function ShelfRow({ shelf, number, gate }: { shelf: Shelf; number: number; gate: GateRule[] }) {
  const clean = shelf.palettes.filter((theme) => gatePassed(theme, gate) === gate.length).length
  return (
    <details data-shelf={shelf.id} class="group/shelf border-b">
      <summary class="cursor-pointer list-none outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <div class={cn('grid items-center gap-4 py-3.5 transition-colors hover:bg-muted/60', COLUMNS)}>
          <span class="font-mono text-sm text-muted-foreground tabular-nums">{number}</span>
          <span class="grid min-w-0 gap-0.5">
            <span class="flex min-w-0 items-baseline gap-2">
              <Icon
                node={ChevronRight}
                class="size-4 flex-none self-center text-muted-foreground transition-transform group-open/shelf:rotate-90"
              />
              <span class="truncate font-display text-base font-extrabold" safe>
                {shelf.id}
              </span>
              <span class="truncate font-mono text-xs text-muted-foreground max-[560px]:hidden" safe>
                {shelf.repo}
              </span>
            </span>
            <span class="truncate pl-6 text-sm text-muted-foreground" safe>
              {shelf.about}
            </span>
          </span>
          <span data-shelf-count class="text-right font-mono text-sm tabular-nums">
            {shelf.palettes.length}
          </span>
          <span class="text-right font-mono text-sm text-soft-foreground tabular-nums max-[760px]:hidden">
            {clean}/{shelf.palettes.length}
          </span>
        </div>
      </summary>
      <div class="grid grid-cols-[minmax(0,1fr)] pb-2 pl-14 max-[760px]:pl-12 [&>[data-row]:last-child]:border-b-0">
        <a
          href={marketplacePath(shelf.id === OFFICIAL ? null : shelf.id)}
          class="inline-flex items-center gap-1.5 justify-self-start py-2 text-sm font-medium text-primary underline-offset-4 hover:underline [&_svg]:size-4"
        >
          {escapeHtml(`open ${shelf.id}`)}
          <Icon node={ArrowRight} />
        </a>
        {shelf.palettes.map((theme) => (
          <PaletteRow theme={theme} gate={gate} />
        ))}
      </div>
    </details>
  )
}

export function MarketplaceBoard({ shelves, gate }: { shelves: Shelf[]; gate: GateRule[] }) {
  const found = shelves.map((shelf) => shelf.palettes.map(searchable))
  const count = (source: (typeof SOURCES)[number]) => shelvesMatching(found, { ...START, source })

  return (
    <marketplace-board class="grid grid-cols-[minmax(0,1fr)] gap-4">
      <SectionHead title="marketplaces" id="marketplaces" />
      <InputGroup class="h-11">
        <InputGroupAddon>
          <Icon node={Search} />
        </InputGroupAddon>
        <InputGroupInput
          name="query"
          placeholder="search palettes, catalogs, marketplaces"
          aria-label="search palettes"
          spellcheck="false"
          autocomplete="off"
        />
        <InputGroupAddon align="inline-end">
          <Kbd>/</Kbd>
        </InputGroupAddon>
      </InputGroup>
      <ToggleGroup variant="underline" label="source">
        {SOURCES.map((source) => (
          <ToggleGroupItem variant="underline" name="source" value={source} checked={source === START.source}>
            {source}
            <span data-count={source} class="text-faint-foreground tabular-nums">
              {count(source)}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div class="grid grid-cols-[minmax(0,1fr)] pt-2">
        <div
          class={cn(
            'grid items-end gap-4 border-b pb-3 text-2xs font-bold tracking-caps text-muted-foreground uppercase max-[760px]:hidden',
            COLUMNS,
          )}
        >
          <span>#</span>
          <span>marketplace</span>
          <span class="text-right">palettes</span>
          <span class="text-right">gate</span>
        </div>
        {shelves.map((shelf, index) => (
          <ShelfRow shelf={shelf} number={index + 1} gate={gate} />
        ))}
      </div>
      <div data-empty hidden class="py-15 text-center text-muted-foreground">
        <strong data-empty-title class="block font-semibold text-foreground">
          no palette matches these filters ( ˘ω˘ )
        </strong>
        clear a filter, or search for a catalog instead.
      </div>
    </marketplace-board>
  )
}
