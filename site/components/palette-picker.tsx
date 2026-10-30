import { Check, ChevronDown, Search } from 'lucide'
import {
  Combobox,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Popover, PopoverTrigger } from '@/components/ui/popover'
import { searchText } from '@/lib/gallery'
import { Icon } from '@/lib/icons'
import type { Theme } from '@/lib/themes'
import { byWork } from '@/lib/works'
import { Signature } from './palette-parts'

export function PaletteOptions({ themes, current }: { themes: Theme[]; current: string }) {
  return (
    <>
      {byWork(themes).map((shelf) => (
        <ComboboxGroup label={shelf.work?.name ?? 'originals'} class="grid gap-0.5">
          <p
            aria-hidden="true"
            translate="no"
            class="sticky top-0 z-1 truncate bg-popover px-2.5 py-1.5 text-2xs font-bold tracking-caps text-muted-foreground uppercase"
            safe
          >
            {shelf.work?.name ?? 'originals'}
          </p>
          {shelf.themes.map((theme) => (
            <ComboboxItem
              id={`wear-option-${shelf.key}-${theme.name}`}
              value={theme.name}
              text={searchText(theme)}
              selected={theme.name === current}
              class="group/option flex scroll-mt-8 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-[background-color] hover:bg-muted data-selected:bg-accent"
            >
              <span aria-hidden="true">
                <Signature theme={theme} />
              </span>
              <span class="min-w-0 flex-1 truncate font-display font-extrabold" translate="no" safe>
                {theme.name}
              </span>
              <Icon node={Check} class="hidden size-3.5 text-primary group-data-selected/option:block" />
            </ComboboxItem>
          ))}
        </ComboboxGroup>
      ))}
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
            <span aria-hidden="true" class="flex flex-none gap-1">
              <i class="size-3 rounded-full bg-(--sg0) ring-1 ring-border inset-ring inset-ring-black/14 forced-color-adjust-none" />
              <i class="size-3 rounded-full bg-(--sg1) ring-1 ring-border inset-ring inset-ring-black/14 forced-color-adjust-none" />
              <i class="size-3 rounded-full bg-(--sg2) ring-1 ring-border inset-ring inset-ring-black/14 forced-color-adjust-none" />
            </span>
            <Icon node={ChevronDown} class="size-3.5 flex-none text-muted-foreground" />
          </button>
        )}
      />
      <Popover id="wear-picker" label="pick a palette" variant="picker" align="start" offset={6}>
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
              class="h-9 w-full min-w-0 rounded-lg border border-border bg-card pr-3 pl-9 text-sm transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-faint-foreground hover:border-input focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/35"
            />
          </label>
          <ComboboxList
            id="wear-options"
            label="palettes"
            data-options
            class="grid max-h-[60dvh] min-h-0 gap-1 overflow-y-auto overscroll-contain"
          >
            <p class="px-2.5 py-2 text-xs text-muted-foreground">loading the palettes…</p>
          </ComboboxList>
        </Combobox>
      </Popover>
    </palette-picker>
  )
}
