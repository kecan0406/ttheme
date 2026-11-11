import { Check, ChevronDown, Search } from 'lucide'
import { Badge } from '@/components/ui/badge'
import {
  Combobox,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { MeltCard } from '@/components/ui/melt-card'
import { Popover, PopoverTrigger } from '@/components/ui/popover'
import { searchText } from '@/lib/gallery'
import { Icon } from '@/lib/icons'
import type { SearchWork } from '@/lib/search'
import type { Theme } from '@/lib/themes'
import { byWork, leadOf, shelfFocusOf, tileLook } from '@/lib/works'
import { Dots, dotColors } from './dots'
import { WorkArt } from './work-art'

export function OptionsNote({ failed = false }: { failed?: boolean }) {
  return (
    <p class="px-2.5 py-2 text-xs text-muted-foreground">
      {failed ? "couldn't load the palettes" : 'loading the palettes…'}
    </p>
  )
}

export function PaletteOptions({
  themes,
  current,
  arts,
}: {
  themes: Theme[]
  current: string
  arts: ReadonlyMap<string, Pick<SearchWork, 'art' | 'facets'>>
}) {
  return (
    <>
      {byWork(themes).map((shelf) => {
        const lead = leadOf(shelf)
        const worn = shelf.themes.find((theme) => theme.name === current)
        const pictured = shelf.work ? arts.get(shelf.work.id) : undefined

        return (
          <ComboboxGroup label={shelf.work?.name ?? 'originals'} data-shelf data-lead={lead.name}>
            <MeltCard size="shelf" style={tileLook(worn ?? lead)}>
              {pictured ? (
                <WorkArt
                  art={pictured.art}
                  facets={pictured.facets}
                  focus={shelf.work ? shelfFocusOf(shelf.work.id) : null}
                  sizes="320px"
                  late
                  data-melt-side
                  class="absolute inset-y-0 right-0 -z-10 w-52 max-[440px]:w-32"
                />
              ) : null}
              <Badge variant="glass" data-shelf-use class="absolute top-2 right-2">
                in use
              </Badge>
              <p aria-hidden="true" translate="no" class="relative mb-1 grid min-w-0 justify-items-start gap-px px-1.5">
                <span class="max-w-full truncate font-display text-base leading-tight font-black" safe>
                  {shelf.work?.name ?? 'originals'}
                </span>
                {shelf.work?.native ? (
                  <span
                    lang={shelf.work.lang ?? undefined}
                    class="max-w-44 truncate font-display text-2xs font-extrabold text-soft-foreground transition-colors duration-200 motion-reduce:transition-none"
                    safe
                  >
                    {shelf.work.native}
                  </span>
                ) : null}
              </p>
              {shelf.themes.map((theme) => (
                <ComboboxItem
                  id={`wear-option-${shelf.key}-${theme.name}`}
                  value={theme.name}
                  text={searchText(theme)}
                  selected={theme.name === current}
                  class="group/option relative flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-sm transition-[background-color] hover:bg-foreground/10 data-highlighted:bg-foreground/10"
                >
                  <Dots colors={dotColors(theme)} />
                  <span class="min-w-0 truncate font-display font-extrabold" translate="no" safe>
                    {theme.name}
                  </span>
                  <Icon node={Check} class="hidden size-3.5 flex-none text-primary group-data-selected/option:block" />
                </ComboboxItem>
              ))}
            </MeltCard>
          </ComboboxGroup>
        )
      })}
      <ComboboxEmpty class="px-2.5 py-2 text-xs text-muted-foreground">
        no palette matches <span aria-hidden="true">( ˘ω˘ )</span>
      </ComboboxEmpty>
    </>
  )
}

export function PalettePicker() {
  return (
    <palette-picker class="inline-flex header-menu:flex-1">
      <PopoverTrigger
        popover="wear-picker"
        render={(props) => (
          <button
            {...props}
            data-wear-trigger
            class="inline-flex h-8 w-48 cursor-pointer items-center gap-2 rounded-full border border-border bg-card pr-2.5 pl-3.5 shadow-sm transition-colors outline-none hover:bg-muted/65 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-popup-open:bg-muted/65 header-menu:w-full"
          >
            <span class="sr-only">palette</span>
            <span
              data-wear-label
              translate="no"
              class="relative min-w-0 flex-1 truncate text-left font-display text-sm font-extrabold after:content-(--wear-name)"
            />
            <Dots />
            <Icon node={ChevronDown} class="size-3.5 flex-none text-muted-foreground" />
          </button>
        )}
      />
      <Popover id="wear-picker" label="pick a palette" variant="picker" align="end" offset={6}>
        <Combobox>
          <label class="relative block">
            <Icon
              node={Search}
              class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint-foreground"
            />
            <ComboboxInput
              list="wear-options"
              label="search palettes"
              placeholder="search palettes"
              enterkeyhint="go"
              data-initial-focus
              class="h-9 w-full min-w-0 rounded-xl border border-border bg-card pr-3 pl-9 text-sm transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-faint-foreground hover:border-input focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/35"
            />
          </label>
          <ComboboxList
            id="wear-options"
            label="palettes"
            data-options
            class="grid max-h-[min(560px,calc(100dvh-140px))] min-h-0 auto-rows-max grid-cols-[minmax(0,1fr)] gap-1.5 overflow-y-auto overscroll-contain"
          >
            <OptionsNote />
          </ComboboxList>
        </Combobox>
      </Popover>
    </palette-picker>
  )
}
