import { LinkButton } from '@/components/ui/button'
import { plural } from '@/lib/utils'
import type { WorkRow } from '@/lib/works'

export interface FoundWork {
  row: WorkRow
  read: string | null
  picked: string[]
}

export function WorkSwatch({ style }: { style: string }) {
  return <span aria-hidden="true" data-slot="work-swatch" style={style} />
}

function FoundRow({ found: { row, read, picked }, query }: { found: FoundWork; query: string }) {
  const marketplaces = new Set(row.palettes.map((palette) => palette.marketplace)).size

  return (
    <li class="grid gap-3 rounded-3xl border bg-card p-4 shadow-sm">
      <span class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <WorkSwatch style={row.palettes[0]?.swatch ?? ''} />
        <span class="grid min-w-0 flex-[1_1_12rem]">
          <span translate="no" class="truncate font-display text-base leading-snug font-extrabold" safe>
            {row.name}
          </span>
          {row.native === null ? null : (
            <span
              translate="no"
              lang={row.lang ?? undefined}
              class="truncate font-display text-xs font-extrabold text-muted-foreground"
              safe
            >
              {row.native}
            </span>
          )}
        </span>
        <span class="font-mono text-xs text-muted-foreground" safe>
          {`${plural(row.palettes.length, 'palette')} · ${plural(marketplaces, 'marketplace')}`}
        </span>
      </span>
      {read === null ? null : (
        <span class="text-xs text-muted-foreground">
          <span safe>{`“${query}” → `}</span>
          <span translate="no" safe>
            {read}
          </span>
        </span>
      )}
      <span class="flex flex-wrap gap-1.5">
        {row.palettes.map((palette) => (
          <LinkButton
            variant={picked.includes(palette.path) ? 'raised' : 'outline'}
            size="chip"
            href={palette.path}
            class="max-w-full min-w-0"
          >
            <span aria-hidden="true" data-slot="work-tile" style={palette.swatch} />
            <span translate="no" class="truncate font-mono font-normal" safe>
              {palette.name}
            </span>
          </LinkButton>
        ))}
      </span>
    </li>
  )
}

export function WorkResults({ found, query, pending }: { found: FoundWork[]; query: string; pending: boolean }) {
  return (
    <>
      <h2 class="text-sm text-soft-foreground">
        <b class="font-mono font-normal text-foreground tabular-nums">{found.length}</b>{' '}
        {found.length === 1 ? 'work' : 'works'}
        {pending ? <span class="text-muted-foreground"> · looking up names…</span> : null}
      </h2>
      <ul class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-2.5">
        {found.map((one) => (
          <FoundRow found={one} query={query} />
        ))}
      </ul>
    </>
  )
}
