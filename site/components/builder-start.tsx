import { FolderOpen, Search, Sprout, Star } from 'lucide'
import { Button } from '@/components/ui/button'
import type { StartList } from '@/lib/builder-view'
import { Icon } from '@/lib/icons'

function Dots({ dots }: { dots: string[] }) {
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

const ITEM =
  'flex h-8 w-full min-w-0 items-center gap-2.5 rounded-lg px-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring'

const HEAD = 'flex items-baseline gap-2 px-2 pt-3 pb-1 text-2xs font-bold tracking-caps text-muted-foreground uppercase'

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

  const empty = list.drafts.length === 0 && list.groups.length === 0

  return (
    <>
      {list.drafts.length > 0 ? (
        <section aria-label="drafts in this browser">
          <p class={HEAD}>
            drafts <span class="font-medium tracking-normal normal-case">in this browser</span>
          </p>
          {list.drafts.map((draft) => (
            <button
              type="button"
              data-start-draft={draft.id}
              aria-current={draft.current ? 'true' : undefined}
              class={`${ITEM} aria-[current=true]:bg-accent`}
            >
              <Dots dots={draft.dots} />
              <span class="min-w-0 flex-1 truncate font-display font-extrabold" translate="no" safe>
                {draft.name}
              </span>
              <span class="flex-none text-xs text-muted-foreground" safe>
                {draft.when}
              </span>
            </button>
          ))}
        </section>
      ) : null}
      {list.groups.map((group) => (
        <section aria-label={group.title}>
          <p class={HEAD}>
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
            <button type="button" data-start-from={item.name} class={ITEM}>
              <Dots dots={item.dots} />
              <span class="min-w-0 flex-1 truncate font-display font-extrabold" translate="no" safe>
                {item.label}
              </span>
              {item.lead ? (
                <span class="flex-none text-muted-foreground">
                  <Icon node={Star} class="size-3" />
                  <span class="sr-only">lead</span>
                </span>
              ) : null}
            </button>
          ))}
        </section>
      ))}
      {empty ? (
        <p class="px-2 py-6 text-center text-sm text-muted-foreground" safe>
          {`no palette matches '${list.query}'`} <span aria-hidden="true">( ˘ω˘ )</span>
        </p>
      ) : null}
    </>
  )
}

export function StartPopover() {
  return (
    <div
      id="builder-start"
      popover="auto"
      role="dialog"
      aria-label="start from"
      data-start-pop
      class="m-0 hidden max-h-[min(640px,calc(100dvh-120px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-border bg-popover text-popover-foreground shadow-lg inset-auto open:flex"
    >
      <div class="grid gap-0.5 border-b border-border p-2">
        <button type="button" data-start-blank class={`${ITEM} h-auto items-start py-2`}>
          <Icon node={Sprout} class="mt-0.5 size-4 flex-none text-primary" />
          <span class="grid gap-0.5">
            <b class="font-semibold">blank</b>
            <span class="text-xs text-muted-foreground">
              grow one from seven seeds — it clears the gate at every setting
            </span>
          </span>
        </button>
        <button
          type="button"
          data-start-open
          aria-expanded="false"
          aria-controls="builder-open-box"
          class={`${ITEM} h-auto items-start py-2`}
        >
          <Icon node={FolderOpen} class="mt-0.5 size-4 flex-none text-primary" />
          <span class="grid gap-0.5">
            <b class="font-semibold">open a link, code or file</b>
            <span class="text-xs text-muted-foreground">a ttheme.dev/p link, a tt4: code or a palette's .toml</span>
          </span>
        </button>
        <div id="builder-open-box" data-open-box hidden class="grid gap-2 px-2 pt-1 pb-2">
          <textarea
            data-open-text
            aria-label="a share link, a code or a palette's text"
            rows="3"
            spellcheck="false"
            autocapitalize="none"
            autocorrect="off"
            placeholder="https://ttheme.dev/p/tt4:…"
            class="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs outline-none placeholder:text-faint-foreground hover:border-input focus-visible:border-ring"
          />
          <div class="flex flex-wrap items-center gap-2">
            <Button size="sm" data-open-go>
              open
            </Button>
            <Button variant="outline" size="sm" data-open-file>
              choose a .toml
            </Button>
            <input type="file" accept=".toml,text/plain" data-open-input hidden aria-label="a palette file" />
          </div>
          <p data-open-error role="status" hidden class="text-xs text-destructive" />
        </div>
      </div>
      <search class="border-b border-border p-2">
        <label class="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 has-focus-visible:border-ring">
          <Icon node={Search} class="size-4 flex-none text-muted-foreground" />
          <input
            type="search"
            data-start-search
            aria-label="search the palettes"
            placeholder="search the palettes"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            enterkeyhint="search"
            class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint-foreground"
          />
        </label>
      </search>
      <div data-start-list class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        <StartEntries list={{ state: 'loading' }} />
      </div>
    </div>
  )
}
