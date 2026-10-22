import { Check, ChevronDown, Search } from 'lucide'
import { catalogsOf } from '@/lib/catalogs'
import { Icon } from '@/lib/icons'
import type { Theme } from '@/lib/themes'
import { Signature } from './palette-parts'

export function PaletteOptions({ themes, current }: { themes: Theme[]; current: string }) {
  return (
    <>
      {catalogsOf(themes).map((shelf) => (
        <fieldset aria-label={shelf.catalog ?? 'other'} data-shelf class="m-0 grid min-w-0 gap-0.5 border-0 p-0">
          <p
            aria-hidden="true"
            translate="no"
            class="sticky top-0 z-1 truncate bg-popover px-2.5 py-1.5 text-2xs font-bold tracking-caps text-muted-foreground uppercase"
            safe
          >
            {shelf.catalog ?? 'other'}
          </p>
          {shelf.themes.map((theme) => (
            <button
              type="button"
              role="option"
              tabindex="-1"
              id={`wear-option-${theme.name}`}
              data-name={theme.name}
              data-text={`${theme.name} ${theme.catalog ?? ''} ${theme.native ?? ''}`.toLowerCase()}
              aria-selected={String(theme.name === current)}
              class="group/option flex scroll-mt-8 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-[background-color] hover:bg-muted aria-selected:bg-accent"
            >
              <span aria-hidden="true">
                <Signature theme={theme} />
              </span>
              <span class="min-w-0 flex-1 truncate font-display font-extrabold" translate="no" safe>
                {theme.name}
              </span>
              <Icon node={Check} class="hidden size-3.5 text-primary group-aria-selected/option:block" />
            </button>
          ))}
        </fieldset>
      ))}
      <p data-empty hidden class="px-2.5 py-2 text-xs text-muted-foreground">
        no palette matches <span aria-hidden="true">( ˘ω˘ )</span>
      </p>
    </>
  )
}

export function PalettePicker() {
  return (
    <palette-picker class="inline-flex header-menu:w-full">
      <button
        type="button"
        popovertarget="wear-picker"
        aria-haspopup="dialog"
        data-wear-trigger
        class="inline-flex h-full w-48 cursor-pointer items-center gap-2 pr-2.5 pl-3.5 transition-colors outline-none hover:bg-muted/65 focus-visible:inset-ring-2 focus-visible:inset-ring-ring header-menu:h-8 header-menu:w-full"
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
      <div
        id="wear-picker"
        popover="auto"
        role="dialog"
        aria-label="pick a palette"
        class="m-0 w-64 max-w-[calc(100vw-2rem)] flex-col gap-2 overflow-hidden rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg inset-auto open:flex"
      >
        <label class="relative block">
          <Icon
            node={Search}
            class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint-foreground"
          />
          <input
            type="search"
            role="combobox"
            aria-controls="wear-options"
            aria-expanded="true"
            aria-autocomplete="list"
            data-search
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="go"
            aria-label="search palettes"
            placeholder="search palettes"
            class="h-9 w-full min-w-0 rounded-lg border border-border bg-card pr-3 pl-9 text-sm transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-faint-foreground hover:border-input focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/35"
          />
        </label>
        <div
          id="wear-options"
          role="listbox"
          aria-label="palettes"
          tabindex="-1"
          data-options
          class="grid max-h-[60dvh] min-h-0 gap-1 overflow-y-auto overscroll-contain"
        >
          <p class="px-2.5 py-2 text-xs text-muted-foreground">loading the palettes…</p>
        </div>
      </div>
    </palette-picker>
  )
}
