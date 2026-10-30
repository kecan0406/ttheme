import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Plus, Star } from 'lucide'
import { Button } from '@/components/ui/button'
import type { ArtSource } from '@/lib/art'
import type { Facts } from '@/lib/facts'
import { marketplacePath, palettePath } from '@/lib/gallery'
import { Icon, NewTab } from '@/lib/icons'
import { json } from '@/lib/render'
import { sceneLines, useOf } from '@/lib/sessions'
import { BUILTIN, type Theme } from '@/lib/themes'
import { cn } from '@/lib/utils'
import type { CastSlot, WorkMarket, WorkPage } from '@/lib/work-page'
import { swatchStyle, type WorkData } from '@/lib/works'
import { requestUrl } from '../../src/core/names.ts'
import { RepoButton, Updated } from './marketplace-board'
import { Crumbs } from './marketplace-frame'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'
import { TerminalScreen } from './terminal'
import { TerminalFrame } from './terminal-frame'
import { ArtCredit, SlotArt, WorkArt } from './work-art'
import { LeadStar, MarketBadge, WorkSwatch } from './work-results'

const FOLDS_PAST = 3

export const HERO_SIZES = '100vw'

const LABEL = 'text-2xs font-bold tracking-caps text-muted-foreground uppercase'

function Slot({ slot }: { slot: CastSlot }) {
  return (
    <button
      type="button"
      data-who={slot.id}
      aria-pressed="false"
      class="group/slot relative aspect-3/4 overflow-hidden rounded-xl border bg-muted text-left shadow-sm transition-[opacity,border-color,box-shadow] duration-200 outline-none hover:border-input hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/45 data-dim:opacity-45"
    >
      <SlotArt picture={slot.picture} />
      <span
        aria-hidden="true"
        class="absolute inset-0 bg-linear-to-t from-background via-background/35 via-45% to-transparent"
      />
      {slot.lead ? (
        <span class="absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-full bg-glass">
          <Icon node={Star} class="size-3.5 fill-current text-primary" />
          <span class="sr-only">lead</span>
        </span>
      ) : null}
      <span class="absolute inset-x-3 bottom-3 grid min-w-0 gap-0.5">
        <b translate="no" class="truncate font-display text-base leading-snug font-extrabold" safe>
          {slot.id}
        </b>
        {slot.native === null ? null : (
          <small
            translate="no"
            lang={slot.lang ?? undefined}
            class="truncate font-display text-xs font-extrabold text-soft-foreground"
            safe
          >
            {slot.native}
          </small>
        )}
      </span>
    </button>
  )
}

function PaletteCard({ theme, lead }: { theme: Theme; lead: boolean }) {
  const native = theme.character?.native[0]

  return (
    <a
      href={palettePath(theme)}
      data-who={theme.character?.id ?? ''}
      class="flex min-w-0 items-center gap-3 rounded-xl border bg-card px-3.5 py-3 shadow-sm transition-[translate,border-color,box-shadow,opacity] duration-200 outline-none hover:border-input hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring data-dim:opacity-40 data-picked:border-primary motion-safe:hover:-translate-y-0.5"
    >
      <WorkSwatch style={swatchStyle(theme)} />
      <span class="grid min-w-0">
        <span class="flex min-w-0 items-center gap-1.5">
          <span translate="no" class="truncate font-display text-base leading-snug font-extrabold" safe>
            {theme.name}
          </span>
          {lead ? <LeadStar /> : null}
        </span>
        {native ? (
          <span translate="no" class="truncate font-display text-xs font-extrabold text-muted-foreground" safe>
            {native}
          </span>
        ) : null}
      </span>
    </a>
  )
}

function MarketCard({ market, work, leadSubject }: { market: WorkMarket; work: string; leadSubject: string }) {
  const { shelf, palettes, peeks } = market
  const first = palettes[0] as Theme
  const peek = peeks[0]
  const foldable = palettes.length > FOLDS_PAST
  const list = `palettes-${shelf.id.replace(/[^\w-]/g, '-')}`

  return (
    <article
      data-market={shelf.id}
      class="group/market overflow-hidden rounded-3xl border bg-card shadow-sm transition-[border-color,box-shadow,opacity] duration-200 has-[a[data-open]:hover]:border-input has-[a[data-open]:hover]:shadow-md has-[a[data-open]:focus-visible]:ring-2 has-[a[data-open]:focus-visible]:ring-ring data-missing:opacity-40"
    >
      <div class="relative flex flex-wrap items-center gap-x-6 gap-y-4 p-3.5">
        <TerminalFrame
          data-peek
          style={peek?.style}
          title={peek?.title}
          recolor
          class="min-w-0 flex-[0_1_440px]"
          controls={
            palettes.length > 1 ? (
              <>
                <Button
                  variant="scene"
                  size="icon-sm"
                  aria-label="previous palette"
                  data-peek-step="-1"
                  class="relative z-1"
                >
                  <Icon node={ChevronLeft} />
                </Button>
                <Button
                  variant="scene"
                  size="icon-sm"
                  aria-label="next palette"
                  data-peek-step="1"
                  class="relative z-1"
                >
                  <Icon node={ChevronRight} />
                </Button>
              </>
            ) : undefined
          }
        >
          <TerminalScreen
            lines={sceneLines('shell', useOf(first))}
            decorative
            class="overflow-hidden px-4 pt-3 pb-3.5 text-code"
          />
        </TerminalFrame>
        <div class="flex min-w-0 flex-[1_1_22rem] items-center gap-4 px-2">
          <div class="grid min-w-0 flex-1 gap-2">
            <span class="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <h3 class="font-display text-display-sm font-black [overflow-wrap:anywhere]">
                <a
                  href={marketplacePath(shelf.id)}
                  data-open
                  translate="no"
                  class="outline-none transition-colors after:absolute after:inset-0 hover:text-primary"
                  safe
                >
                  {shelf.id}
                </a>
              </h3>
              <MarketBadge builtin={shelf.id === BUILTIN} />
            </span>
            <p class="text-sm text-soft-foreground" safe>
              {shelf.about}
            </p>
            <p data-missing-note hidden class="text-sm text-muted-foreground">
              no <span data-missing-who translate="no"></span> palette here yet
            </p>
            <span class="mt-1 flex flex-wrap items-center gap-1.5">
              <RepoButton shelf={shelf} />
              <Updated at={shelf.version === null ? shelf.pushedAt : `v${shelf.version}`} />
            </span>
          </div>
          <span
            aria-hidden="true"
            class="grid size-10 flex-none place-items-center rounded-full border bg-card text-soft-foreground transition-[background-color,border-color,color,translate] duration-200 group-has-[a[data-open]:hover]/market:border-primary group-has-[a[data-open]:hover]/market:bg-primary group-has-[a[data-open]:hover]/market:text-primary-foreground motion-safe:group-has-[a[data-open]:hover]/market:translate-x-0.5"
          >
            <Icon node={ArrowRight} class="size-4.5" />
          </span>
        </div>
      </div>
      <div
        data-fold={foldable ? '' : undefined}
        class="group/area relative overflow-hidden transition-[max-height] duration-460 ease-[cubic-bezier(0.2,0.8,0.2,1)] data-fold:max-h-30 motion-reduce:transition-none"
      >
        <ul
          id={list}
          aria-label={`${work} palettes in ${shelf.id}`}
          class={cn(
            'grid grid-cols-[repeat(auto-fill,minmax(max(min(100%,14rem),calc((100%_-_1.25rem)/3)),1fr))] gap-2.5 px-4.5 pt-1',
            foldable ? 'pb-14' : 'pb-4.5',
          )}
        >
          {palettes.map((theme) => (
            <li class="grid">
              <PaletteCard theme={theme} lead={theme.subject === leadSubject} />
            </li>
          ))}
        </ul>
        {foldable ? (
          <div class="pointer-events-none absolute inset-x-0 bottom-0 flex h-20 items-end justify-center pb-3">
            <span
              data-fade
              aria-hidden="true"
              class="absolute inset-0 bg-linear-to-b from-transparent via-card/90 via-60% to-card transition-opacity duration-460 group-data-open/area:opacity-0"
            />
            <Button
              variant="ghost"
              size="sm"
              data-fold-toggle
              aria-expanded="false"
              aria-controls={list}
              class="group/fold pointer-events-auto relative"
            >
              <span data-fold-label>expand</span>
              <Icon
                node={ChevronDown}
                class="transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-aria-expanded/fold:rotate-180"
              />
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export function WorkView({ page, facts, path }: { page: WorkPage; facts: Facts; path: string }) {
  const { work, cast, markets } = page
  const pictured = cast.some((slot) => slot.picture !== null)

  const from = (['tmdb', 'anilist'] as const).filter(
    (source: ArtSource) => page.art?.from === source || (source === 'anilist' && pictured),
  )

  const data: WorkData = {
    markets: Object.fromEntries(
      markets.map((market) => [
        market.shelf.id,
        { peeks: market.peeks, who: market.palettes.map((theme) => theme.character?.id ?? null) },
      ]),
    ),
  }

  return (
    <div class="ground relative flex min-h-dvh flex-col">
      <WorkArt
        art={page.art}
        facets={page.facets}
        sizes={HERO_SIZES}
        eager
        shade="hero"
        class="absolute inset-x-0 top-0 h-150"
      />
      <SiteHeader current="/marketplace" facts={facts} />
      <div class="relative mx-auto grid min-h-[34rem] w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] content-end gap-2 pt-15 pb-6">
        <Crumbs trail={[{ label: 'marketplace', href: '/marketplace' }, { label: 'works' }]} />
        <h1 translate="no" class="font-display text-display-xl font-black text-balance" safe>
          {work.name}
        </h1>
        {work.native === null ? null : (
          <p
            translate="no"
            lang={work.lang ?? undefined}
            class="font-display text-base font-extrabold text-soft-foreground"
            safe
          >
            {work.native}
          </p>
        )}
      </div>
      <main
        id="content"
        class="relative mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-13 pt-2 pb-24"
      >
        <work-page class="grid grid-cols-[minmax(0,1fr)] gap-13">
          <section aria-labelledby="characters" class="grid gap-3.5">
            <div class="flex items-baseline gap-3">
              <h2 id="characters" class={cn('flex gap-2', LABEL)}>
                characters <span class="font-mono font-normal tracking-normal">{cast.length}</span>
              </h2>
              <button
                type="button"
                data-show-all
                hidden
                class="rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                show all
              </button>
            </div>
            <div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,9.25rem),1fr))] gap-3">
              {cast.map((slot) => (
                <Slot slot={slot} />
              ))}
              <a
                href={requestUrl(work.name)}
                target="_blank"
                rel="noopener"
                class="grid aspect-3/4 place-content-center justify-items-center gap-2 rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground transition-colors outline-none hover:border-input hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon node={Plus} class="size-5" />
                <span class="inline-flex items-center gap-1">
                  request a character
                  <NewTab class="size-3.5" />
                </span>
              </a>
            </div>
          </section>
          <section aria-labelledby="marketplaces" class="grid gap-3.5">
            <h2 id="marketplaces" class={cn('flex gap-2', LABEL)}>
              marketplaces <span class="font-mono font-normal tracking-normal">{markets.length}</span>
            </h2>
            {markets.map((market) => (
              <MarketCard market={market} work={work.name} leadSubject={work.lead} />
            ))}
          </section>
          <script type="application/json" data-work>
            {json(data)}
          </script>
        </work-page>
        <ArtCredit from={from} />
      </main>
      <SiteFooter facts={facts} current={path} />
    </div>
  )
}
