import { FolderOpen, Search, Sprout, Star } from 'lucide'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Combobox,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Popover } from '@/components/ui/popover'
import type { StartList } from '@/lib/builder-view'
import { Icon } from '@/lib/icons'
import { CODE, SHARE_URL } from '../../src/core/draft.ts'

export function Dots({ dots }: { dots: string[] }) {
  return (
    <span aria-hidden="true" class="flex flex-none gap-0.75">
      {dots.map((hex) => (
        <i
          class="size-2 rounded-full ring-1 ring-border inset-ring inset-ring-black/14 forced-color-adjust-none"
          style={`background:${hex}`}
        />
      ))}
    </span>
  )
}

export const ITEM =
  'flex h-8 w-full min-w-0 items-center gap-2.5 rounded-lg px-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring'

export const HEAD =
  'flex items-baseline gap-2 px-2 pt-3 pb-1 text-2xs font-bold tracking-caps text-muted-foreground uppercase'

export function StartEntries({ list }: { list: StartList }) {
  if (list.state === 'loading') {
    return <p class="px-2 py-6 text-center text-sm text-muted-foreground">loading the palettes…</p>
  }

  if (list.state === 'failed') {
    return (
      <div class="grid justify-items-center gap-2 px-2 py-6 text-center text-sm text-muted-foreground">
        the palettes did not load
        <Button variant="outline" size="sm" data-start-retry>
          try again
        </Button>
      </div>
    )
  }

  return (
    <>
      {list.groups.map((group) => (
        <ComboboxGroup label={group.title}>
          <p aria-hidden="true" class={HEAD}>
            <span translate="no" safe>
              {group.title}
            </span>
            {group.native ? (
              <span class="truncate font-medium tracking-normal normal-case" lang={group.lang} safe>
                {group.native}
              </span>
            ) : null}
          </p>
          {group.palettes.map((item) => (
            <ComboboxItem id={`builder-start-${item.name}`} value={item.name} text={item.words} class={ITEM}>
              <Dots dots={item.dots} />
              <span class="min-w-0 flex-1 truncate" translate="no">
                <span class="font-display font-extrabold" safe>
                  {item.label}
                </span>
                {item.publisher ? (
                  <span class="pl-1.5 font-mono text-xs text-muted-foreground" safe>
                    {item.publisher}
                  </span>
                ) : null}
              </span>
              {item.lead ? (
                <span class="flex-none text-muted-foreground">
                  <Icon node={Star} class="size-3" />
                  <span class="sr-only">lead</span>
                </span>
              ) : null}
            </ComboboxItem>
          ))}
        </ComboboxGroup>
      ))}
      <ComboboxEmpty class="px-2 py-6 text-center text-sm text-muted-foreground">
        no palette matches <span aria-hidden="true">( ˘ω˘ )</span>
      </ComboboxEmpty>
    </>
  )
}

export function StartPopover() {
  return (
    <Popover id="builder-start" label="start from" variant="sheet" align="start">
      <div class="grid gap-0.5 border-b border-border p-2">
        <button type="button" data-start-blank class={ITEM}>
          <Icon node={Sprout} class="size-4 flex-none text-primary" />
          <b class="font-semibold">blank</b>
        </button>
        <Collapsible data-open-box>
          <CollapsibleTrigger class={ITEM}>
            <Icon node={FolderOpen} class="size-4 flex-none text-primary" />
            <b class="font-semibold">open a link, code or file</b>
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <div class="grid gap-2 px-2 pt-1 pb-2">
              <textarea
                data-open-text
                aria-label="a share link, a code or the text of a .toml"
                rows="3"
                spellcheck="false"
                autocapitalize="none"
                autocorrect="off"
                placeholder={`${SHARE_URL}${CODE}…`}
                class="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs outline-none placeholder:text-faint-foreground hover:border-input focus-visible:border-ring"
              />
              <div class="flex flex-wrap items-center gap-2">
                <Button size="sm" data-open-go>
                  open
                </Button>
                <Button variant="outline" size="sm" data-open-file>
                  choose a .toml
                </Button>
                <input type="file" accept=".toml,text/plain" data-open-input hidden aria-label="a .toml file" />
              </div>
              <p data-open-error role="status" hidden class="text-xs text-destructive" />
            </div>
          </CollapsiblePanel>
        </Collapsible>
      </div>
      <Combobox>
        <search class="border-b border-border p-2">
          <label class="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 has-focus-visible:border-ring">
            <Icon node={Search} class="size-4 flex-none text-muted-foreground" />
            <ComboboxInput
              list="builder-start-list"
              label="search the palettes"
              placeholder="search the palettes"
              enterkeyhint="search"
              class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint-foreground"
            />
          </label>
        </search>
        <ComboboxList
          id="builder-start-list"
          label="palettes"
          data-start-list
          class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
        >
          <StartEntries list={{ state: 'loading' }} />
        </ComboboxList>
      </Combobox>
    </Popover>
  )
}
