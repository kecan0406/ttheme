import { ArrowRight, Search, Store, X } from 'lucide'
import { LinkButton } from '@/components/ui/button'
import { Combobox, ComboboxInput, ComboboxLink, ComboboxList } from '@/components/ui/combobox'
import { Kbd } from '@/components/ui/kbd'
import { Popover } from '@/components/ui/popover'
import type { FoundWork } from '@/lib/found'
import { BROWSE_PATH, MARKETPLACES_PATH, marketplacePath } from '@/lib/gallery'
import { Icon, NewTab } from '@/lib/icons'
import { type Hit, lookStyle, type SearchMarket, type SearchPalette } from '@/lib/search'
import { linesOf } from '@/lib/terminal'
import { WORN_FACETS, workPath } from '@/lib/works'
import { TerminalScreen } from './terminal'
import { TerminalFrame } from './terminal-frame'
import { WorkArt } from './work-art'

export const SEARCH_POPUP = 'site-search'

export const SEARCH_BOX = 'site-search-box'

export const SEARCH_LIST = 'site-search-list'

const PROMPT = '«2»~/dotfiles «4»main «B5»❯ «»'

const ROW =
  'flex min-w-0 items-center gap-3 rounded-xl px-2.5 py-2 text-sm outline-none data-highlighted:bg-muted max-[720px]:py-1.5'

const NOTE = 'grid justify-items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground'

function Dots({ look }: { look: readonly string[] }) {
  return (
    <span
      aria-hidden="true"
      data-slot="signature-dots"
      class="max-[720px]:hidden"
      style={`--sg0:${look[2]};--sg1:${look[3]};--sg2:${look[1]}`}
    />
  )
}

function Thumb({ hit }: { hit: { art: Hit['work']['art']; facets: string } }) {
  return (
    <WorkArt
      art={hit.art}
      facets={hit.facets}
      sizes="64px"
      class="relative hidden aspect-video w-16 flex-none rounded-md max-[720px]:block"
    />
  )
}

function Native({ native, lang }: { native: string | null; lang: string | null }) {
  return native ? (
    <span
      class="min-w-0 truncate font-display text-xs font-extrabold text-muted-foreground"
      lang={lang ?? undefined}
      translate="no"
      safe
    >
      {native}
    </span>
  ) : null
}

function HitRow({ hit, lead }: { hit: Hit; lead: boolean }) {
  const { work, palette } = hit

  return (
    <ComboboxLink
      id={`site-search-${work.id}`}
      href={work.path}
      value={work.id}
      text={work.name}
      data-palette={palette.name}
      class={ROW}
    >
      <Thumb hit={work} />
      <Dots look={palette.look} />
      <span class="flex min-w-0 flex-1 items-baseline gap-2">
        <span class="max-w-full shrink-0 truncate font-display text-base font-extrabold" translate="no" safe>
          {work.name}
        </span>
        <Native native={work.native} lang={work.lang} />
      </span>
      {lead ? null : (
        <span class="flex-none font-mono text-xs text-soft-foreground" translate="no" safe>
          {palette.slug}
        </span>
      )}
    </ComboboxLink>
  )
}

function FoundRow({ work }: { work: FoundWork }) {
  return (
    <ComboboxLink
      id={`site-search-found-${work.id}`}
      href={workPath(work.id)}
      value={`found:${work.id}`}
      text={work.name}
      class={ROW}
    >
      <Thumb hit={{ art: work.art, facets: WORN_FACETS }} />
      <span class="flex min-w-0 flex-1 items-baseline gap-2">
        <span class="max-w-full shrink-0 truncate font-display text-base font-extrabold" translate="no" safe>
          {work.name}
        </span>
        <Native native={work.native} lang={work.lang} />
      </span>
      <span class="flex-none text-xs text-muted-foreground">no palettes yet</span>
    </ComboboxLink>
  )
}

function MarketRow({ markets, query }: { markets: SearchMarket[]; query: string }) {
  const one = markets.length === 1 ? markets[0] : undefined
  const href = one ? marketplacePath(one.id) : `${MARKETPLACES_PATH}?${new URLSearchParams({ q: query })}`

  return (
    <ComboboxLink id="site-search-markets" href={href} value="markets" text={query} class={ROW}>
      <span class="grid size-6 flex-none place-items-center rounded-md bg-accent text-primary">
        <Icon node={Store} class="size-3.5" />
      </span>
      <span class="min-w-0 flex-1 truncate text-soft-foreground">
        {one ? (
          <>
            <span translate="no" safe>
              {one.id}
            </span>{' '}
            is a marketplace
          </>
        ) : (
          <span safe>{`marketplaces matching “${query}”`}</span>
        )}
      </span>
      <Icon node={ArrowRight} class="size-4 flex-none text-muted-foreground" />
    </ComboboxLink>
  )
}

export interface SearchView {
  query: string
  hits: Hit[]
  more: number
  found: FoundWork[]
  markets: SearchMarket[]
  state: 'idle' | 'loading' | 'unloaded' | 'naming' | 'done' | 'failed'
  label: string
  make: string
  request: string
}

export function SearchRows({ view }: { view: SearchView }) {
  if (view.state === 'idle') {
    return <p class={NOTE}>a work, a character or a palette</p>
  }

  if (view.state === 'loading') {
    return <p class={NOTE}>loading the works…</p>
  }

  if (view.state === 'unloaded') {
    return <p class={NOTE}>the works did not load</p>
  }

  const empty = view.hits.length === 0 && view.found.length === 0

  return (
    <>
      {view.hits.map((hit) => (
        <HitRow hit={hit} lead={hit.palette === hit.work.palettes[0]} />
      ))}
      {view.found.map((work) => (
        <FoundRow work={work} />
      ))}
      {view.markets.length > 0 ? <MarketRow markets={view.markets} query={view.query} /> : null}
      {view.state === 'naming' ? (
        <p class="px-2.5 py-2 text-xs text-muted-foreground" safe>{`looking up “${view.query}”…`}</p>
      ) : null}
      {empty && view.state !== 'naming' ? (
        <div class={NOTE}>
          <strong class="font-semibold text-foreground">
            <span safe>
              {view.state === 'failed' ? `no work matches “${view.query}”` : `no work called “${view.label}” yet`}
            </span>{' '}
            <span aria-hidden="true">( ˘ω˘ )</span>
          </strong>
          <span>
            {view.state === 'failed'
              ? 'the name lookup did not answer — ask for one, or make it yourself.'
              : 'look for its work by title, ask for one, or make it yourself.'}
          </span>
          <span class="mt-2 flex flex-wrap justify-center gap-2">
            <LinkButton variant="outline" size="sm" href={view.request} target="_blank" rel="noopener">
              request a character
              <NewTab />
            </LinkButton>
            <LinkButton size="sm" href={view.make}>
              make one
            </LinkButton>
          </span>
        </div>
      ) : null}
    </>
  )
}

function previewLines(palette: SearchPalette) {
  return linesOf([
    `${PROMPT}ttheme use ${palette.slug}`,
    '«8»this tab only',
    `${PROMPT}ls -F`,
    '«B4»shell/«»  «B4»themes/«»  «B2»setup.sh*«»  «6»zshrc@«»  todo.md',
    `${PROMPT}«c» `,
  ])
}

export function SearchPreview({ hit }: { hit: Hit | null }) {
  if (!hit) {
    return (
      <TerminalFrame title="ttheme" class="h-full">
        <TerminalScreen decorative lines={linesOf([`${PROMPT}«c» `])} class="px-4 pb-4 text-code leading-relaxed" />
      </TerminalFrame>
    )
  }

  const { work, palette } = hit
  const others = work.palettes.filter((one) => one !== palette).map((one) => one.slug)

  return (
    <div class="grid h-full grid-rows-[minmax(0,1fr)_auto] gap-2.5">
      <TerminalFrame title={`${palette.slug} / ${work.name}`} style={lookStyle(palette.look)} class="flex flex-col">
        <div class="relative isolate min-h-0 flex-1 overflow-hidden">
          {work.art ? (
            <img
              src={work.art.src}
              srcset={work.art.srcset ?? undefined}
              sizes={work.art.srcset ? '320px' : undefined}
              alt=""
              decoding="async"
              class="absolute inset-0 -z-10 size-full object-cover opacity-55"
            />
          ) : null}
          <span aria-hidden="true" class="absolute inset-0 -z-10 bg-linear-to-r from-(--bg) from-35% to-(--bg)/25" />
          <TerminalScreen decorative lines={previewLines(palette)} class="px-4 pb-4 text-code leading-relaxed" />
        </div>
      </TerminalFrame>
      <div class="grid gap-1 px-1.5">
        <span class="truncate font-display text-base font-extrabold" translate="no" safe>
          {work.name}
        </span>
        <span class="truncate text-xs text-muted-foreground" translate="no" safe>
          {[palette.slug, ...others].join(', ')}
        </span>
      </div>
    </div>
  )
}

export function SearchFoot({ href }: { href: string }) {
  return (
    <div class="flex items-center justify-end border-t border-border px-5 py-3 text-sm">
      <a
        href={href}
        class="group/go inline-flex items-center gap-1.5 rounded-sm font-semibold text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        See All Results
        <Icon node={ArrowRight} class="size-4 transition-transform duration-150 group-hover/go:translate-x-0.5" />
      </a>
    </div>
  )
}

export function SiteSearch() {
  return (
    <site-search class="flex min-w-0 max-w-80 flex-1 items-center justify-end header-search:flex-none">
      <Combobox filter={false}>
        <search id={SEARCH_BOX} data-search-box class="relative flex w-full min-w-0 items-center self-center">
          <button
            type="button"
            data-search-open
            aria-label="search works"
            aria-keyshortcuts="Meta+K Control+K"
            class="hidden size-8 flex-none place-items-center rounded-full border border-border bg-card text-soft-foreground shadow-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring header-search:grid header-icons:size-7.5"
          >
            <Icon node={Search} class="size-4" />
          </button>
          <label
            data-search-field
            class="flex h-8 w-full min-w-0 items-center gap-2 rounded-full border border-border bg-card pr-1.5 pl-3 text-soft-foreground shadow-sm transition-colors has-focus-visible:border-ring header-search:hidden"
          >
            <Icon node={Search} class="size-4 flex-none text-muted-foreground" />
            <ComboboxInput
              list={SEARCH_LIST}
              label="search works and characters"
              placeholder="search works"
              name="q"
              enterkeyhint="search"
              aria-keyshortcuts="Meta+K Control+K"
              aria-expanded="false"
              class="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-faint-foreground [&::-webkit-search-cancel-button]:hidden"
            />
            <Kbd data-search-kbd class="flex-none">
              <span data-key="apple">⌘</span>
              <span data-key="other">ctrl</span>k
            </Kbd>
            <button
              type="button"
              data-search-close
              aria-label="close search"
              class="hidden size-6 flex-none place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Icon node={X} class="size-3.5" />
            </button>
          </label>
        </search>
        <Popover id={SEARCH_POPUP} manual variant="search" align="end" anchor={SEARCH_BOX} label="search results">
          <div class="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)] gap-2.5 p-2.5 max-[720px]:grid-cols-[minmax(0,1fr)]">
            <div data-search-preview class="min-h-64 max-[720px]:hidden">
              <SearchPreview hit={null} />
            </div>
            <ComboboxList
              id={SEARCH_LIST}
              label="works"
              data-search-list
              class="grid min-h-0 content-start gap-0.5 overflow-y-auto overscroll-contain"
            >
              <SearchRows
                view={{
                  query: '',
                  hits: [],
                  more: 0,
                  found: [],
                  markets: [],
                  state: 'idle',
                  label: '',
                  make: '',
                  request: '',
                }}
              />
            </ComboboxList>
          </div>
          <div data-search-foot>
            <SearchFoot href={BROWSE_PATH} />
          </div>
        </Popover>
      </Combobox>
    </site-search>
  )
}
