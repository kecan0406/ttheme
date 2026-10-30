import { ArrowRight, Layers, Star, Store } from 'lucide'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/button'
import type { ArtSource } from '@/lib/art'
import { starCount } from '@/lib/gallery'
import { GitHubStar, Icon } from '@/lib/icons'
import { plural } from '@/lib/utils'
import type { RowMarket, RowPalette, WorkRow } from '@/lib/works'
import { ArtCredit, WorkArt } from './work-art'

const CHIPS = 10

const TILES = 8

export interface FoundWork {
  row: WorkRow
  read: string | null
  picked: string[]
}

export function WorkSwatch({ style }: { style: string }) {
  return <span aria-hidden="true" data-slot="work-swatch" style={style} />
}

export function LeadStar() {
  return (
    <>
      <Icon node={Star} class="size-3 flex-none fill-current text-primary" />
      <span class="sr-only">, lead</span>
    </>
  )
}

export function MarketBadge({ builtin }: { builtin: boolean }) {
  return builtin ? (
    <Badge>
      <Icon node={Layers} />
      built-in
    </Badge>
  ) : (
    <Badge>
      <Icon node={Store} />
      community
    </Badge>
  )
}

function MarketRow({
  market,
  palettes,
  row,
  picked,
}: {
  market: RowMarket
  palettes: RowPalette[]
  row: WorkRow
  picked: string[]
}) {
  const shown = palettes.slice(0, CHIPS)
  const rest = palettes.length - shown.length

  return (
    <div class="flex flex-wrap items-center gap-x-6 gap-y-3 border-t py-4">
      <div class="flex max-w-76 min-w-0 flex-[1_1_15rem] items-center gap-3">
        <WorkSwatch style={palettes[0]?.swatch ?? ''} />
        <div class="grid min-w-0 gap-0.5">
          <span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <a
              href={market.path}
              translate="no"
              class="font-display text-base leading-snug font-extrabold transition-colors [overflow-wrap:anywhere] hover:text-primary"
              safe
            >
              {market.id}
            </a>
            <MarketBadge builtin={market.builtin} />
          </span>
          <span class="flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <span translate="no" class="truncate" safe>
              {market.repo}
            </span>
            {market.stars === null ? null : (
              <>
                <span aria-hidden="true">·</span>
                <span aria-hidden="true" class="inline-flex flex-none items-center gap-1 tabular-nums">
                  <GitHubStar />
                  <span safe>{starCount(market.stars)}</span>
                </span>
                <span class="sr-only" safe>
                  {`, ${plural(market.stars, 'GitHub star')}`}
                </span>
              </>
            )}
          </span>
        </div>
      </div>
      <span class="flex min-w-0 flex-[999_1_22rem] flex-wrap gap-1.5">
        {shown.map((palette) => (
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
            {palette.lead ? <LeadStar /> : null}
          </LinkButton>
        ))}
        {rest > 0 ? (
          <LinkButton variant="muted" size="chip" href={row.path}>
            <span>
              +{rest} more<span class="sr-only"> on the work's page</span>
            </span>
          </LinkButton>
        ) : null}
      </span>
      <span class="ml-auto flex flex-none items-center gap-3">
        <span class="font-mono text-xs text-muted-foreground" safe>
          {plural(palettes.length, 'palette')}
        </span>
        <a
          href={market.path}
          aria-label={`open ${market.id}`}
          class="grid size-8 place-items-center rounded-full border bg-card text-soft-foreground transition-[background-color,border-color,color] duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground"
        >
          <Icon node={ArrowRight} class="size-4" />
        </a>
      </span>
    </div>
  )
}

function FoundCard({
  found: { row, read, picked },
  query,
  first,
}: {
  found: FoundWork
  query: string
  first: boolean
}) {
  const markets = row.markets.flatMap((market) => {
    const palettes = row.palettes.filter((palette) => palette.marketplace === market.id)

    return palettes.length > 0 ? [{ market, palettes }] : []
  })

  return (
    <li data-found={row.id} class="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div class="relative grid min-h-80 content-end">
        <WorkArt
          art={row.art}
          facets={row.facets}
          sizes="(min-width: 1320px) 1280px, 100vw"
          eager={first}
          shade="card"
          class="absolute inset-0"
        />
        <div class="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-6 pt-15 pb-6">
          <div class="grid min-w-0 gap-2">
            <h3 class="font-display text-display-lg font-black text-balance">
              <a href={row.path} translate="no" class="transition-colors hover:text-primary" safe>
                {row.name}
              </a>
            </h3>
            {row.native === null ? null : (
              <p
                translate="no"
                lang={row.lang ?? undefined}
                class="font-display text-base font-extrabold text-soft-foreground"
                safe
              >
                {row.native}
              </p>
            )}
            {read === null ? null : (
              <p class="text-sm text-soft-foreground">
                <span safe>{`“${query}” → `}</span>
                <span translate="no" safe>
                  {read}
                </span>
              </p>
            )}
            <span class="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-2">
              <span class="text-sm text-soft-foreground">
                <b class="font-mono font-normal text-foreground tabular-nums">{row.palettes.length}</b>{' '}
                {row.palettes.length === 1 ? 'palette' : 'palettes'} ·{' '}
                <b class="font-mono font-normal text-foreground tabular-nums">{markets.length}</b>{' '}
                {markets.length === 1 ? 'marketplace' : 'marketplaces'}
              </span>
              <span aria-hidden="true" class="flex gap-1.5">
                {row.palettes.slice(0, TILES).map((palette) => (
                  <span data-slot="work-tile" style={palette.swatch} />
                ))}
              </span>
            </span>
          </div>
          <span class="flex flex-wrap gap-2">
            <LinkButton variant="glass" href={row.path}>
              work page
            </LinkButton>
            <LinkButton href={row.lead.path}>
              <span>
                open{' '}
                <span translate="no" safe>
                  {row.lead.name}
                </span>
              </span>
              <Icon node={ArrowRight} />
            </LinkButton>
          </span>
        </div>
      </div>
      <div class="grid px-6 pt-1.5 pb-2.5">
        <p class="pt-3.5 pb-2.5 text-2xs font-bold tracking-caps text-muted-foreground uppercase">marketplaces</p>
        {markets.map(({ market, palettes }) => (
          <MarketRow market={market} palettes={palettes} row={row} picked={picked} />
        ))}
      </div>
    </li>
  )
}

export function WorkResults({ found, query, pending }: { found: FoundWork[]; query: string; pending: boolean }) {
  const from = (['tmdb', 'anilist'] as const).filter((source: ArtSource) =>
    found.some((one) => one.row.art?.from === source),
  )

  return (
    <>
      <h2 class="text-sm text-soft-foreground">
        <b class="font-mono font-normal text-foreground tabular-nums">{found.length}</b>{' '}
        {found.length === 1 ? 'work' : 'works'}
        {pending ? <span class="text-muted-foreground"> · looking up names…</span> : null}
      </h2>
      <ul class="grid grid-cols-[minmax(0,1fr)] gap-4">
        {found.map((one, index) => (
          <FoundCard found={one} query={query} first={index === 0} />
        ))}
      </ul>
      <ArtCredit from={from} />
    </>
  )
}
