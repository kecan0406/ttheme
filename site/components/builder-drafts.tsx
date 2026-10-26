import { escapeHtml } from '@kitajs/html'
import { Search, Trash2, Undo2 } from 'lucide'
import { Button } from '@/components/ui/button'
import type { DraftList } from '@/lib/builder-view'
import { Icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { Dots, HEAD, ITEM } from './builder-start'

export function DraftRoom({ list }: { list: DraftList }) {
  const full = list.count >= list.most

  return (
    <span class={cn('font-mono text-xs tabular-nums', full ? 'text-warning' : 'text-muted-foreground')} safe>
      {full ? `${list.count} / ${list.most}, the oldest goes next` : `${list.count} / ${list.most}`}
    </span>
  )
}

export function DraftEntries({ list }: { list: DraftList }) {
  return (
    <>
      {list.deleted === null ? null : (
        <p class="flex h-8 items-center gap-2 pr-1 pl-2 text-xs text-muted-foreground">
          <span class="min-w-0 flex-1 truncate">
            deleted{' '}
            <b class="font-display font-extrabold text-foreground" translate="no" safe>
              {list.deleted}
            </b>
          </span>
          <Button variant="ghost" size="xs" data-draft-undo>
            <Icon node={Undo2} />
            undo
          </Button>
        </p>
      )}
      {list.groups.map((group) => (
        <section aria-label={group.title}>
          <p class={HEAD} safe>
            {group.title}
          </p>
          <ul class="grid">
            {group.drafts.map((draft) => (
              <li class="flex items-center gap-0.5">
                <button
                  type="button"
                  data-draft-open={draft.id}
                  aria-current={draft.current ? 'true' : undefined}
                  class={`${ITEM} aria-[current=true]:bg-accent`}
                >
                  <Dots dots={draft.dots} />
                  <span class="min-w-0 flex-1 truncate font-display font-extrabold" translate="no" safe>
                    {draft.name}
                  </span>
                  <span class="flex-none text-xs text-muted-foreground" safe>
                    {draft.current ? 'editing' : draft.when}
                  </span>
                </button>
                {draft.current ? null : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    data-draft-delete={draft.id}
                    aria-label={`delete ${draft.name}`}
                    class="flex-none text-faint-foreground hover:text-destructive"
                  >
                    <Icon node={Trash2} />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {list.count === 0 ? (
        <p class="px-2 py-6 text-center text-sm text-muted-foreground">no drafts in this browser</p>
      ) : list.groups.length === 0 ? (
        <p class="px-2 py-6 text-center text-sm text-muted-foreground">
          {escapeHtml(`no draft matches '${list.query}'`)} <span aria-hidden="true">( ˘ω˘ )</span>
        </p>
      ) : null}
    </>
  )
}

export function DraftsPanel({ list }: { list: DraftList }) {
  return (
    <section
      id="builder-drafts"
      role="tabpanel"
      aria-labelledby="builder-tab-drafts"
      data-panel-body="drafts"
      hidden
      class="pb-6"
    >
      <div class="flex h-11 items-center justify-between gap-2 border-b border-border pr-3 pl-4">
        <span class="text-2xs font-bold tracking-caps text-muted-foreground uppercase">in this browser</span>
        <span data-drafts-room>
          <DraftRoom list={list} />
        </span>
      </div>
      <search class="px-2 pt-2" data-drafts-search hidden={list.count === 0}>
        <label class="flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-2.5 has-focus-visible:border-ring">
          <Icon node={Search} class="size-3.5 flex-none text-muted-foreground" />
          <input
            type="search"
            data-draft-search
            aria-label="search the drafts"
            placeholder="search the drafts"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            enterkeyhint="search"
            class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint-foreground"
          />
        </label>
      </search>
      <div data-drafts-list class="px-2">
        <DraftEntries list={list} />
      </div>
    </section>
  )
}
