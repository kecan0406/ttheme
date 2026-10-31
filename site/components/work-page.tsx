import { ArrowRight, Plus } from 'lucide'
import { LinkButton } from '@/components/ui/button'
import type { Facts } from '@/lib/facts'
import { type FoundCast, type FoundPage, type FoundWork, nativeLang } from '@/lib/found'
import { BROWSE_PATH, marketplacePath, palettePath } from '@/lib/gallery'
import { Icon, NewTab } from '@/lib/icons'
import { makePath } from '@/lib/names'
import { BUILTIN, type Theme } from '@/lib/themes'
import { cn } from '@/lib/utils'
import type { CastSlot, WorkMarket, WorkPage } from '@/lib/work-page'
import { ribbon, swatchStyle, WORN_FACETS } from '@/lib/works'
import { requestUrl } from '../../src/core/names.ts'
import { Crumbs } from './marketplace-frame'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'
import { SlotArt, WorkHero } from './work-art'
import { LeadStar, MarketBadge, RepoLine, Updated, updatedAt, WorkSwatch } from './work-parts'

export const HERO_SIZES = '100vw'

const HEADING = 'flex items-baseline gap-2.5 font-display text-display-md font-black'

const COUNT = 'font-mono text-sm font-normal tracking-normal text-muted-foreground'

const CIRCLE = 'relative grid size-24 place-items-center overflow-hidden rounded-full max-sm:size-19'

const CAST =
  'flex flex-wrap gap-x-5.5 gap-y-5 max-sm:-mx-5 max-sm:snap-x max-sm:snap-mandatory max-sm:scroll-px-5 max-sm:flex-nowrap max-sm:gap-x-3.5 max-sm:overflow-x-auto max-sm:px-5 max-sm:pt-1.5 max-sm:pb-1.5 max-sm:[scrollbar-width:none]'

const MAIN = 'relative mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] pb-24'

const SECTIONS = 'grid grid-cols-[minmax(0,1fr)] gap-16 max-sm:gap-11'

const SECTION = 'grid grid-cols-[minmax(0,1fr)] gap-4.5'

function Who({ slot }: { slot: CastSlot }) {
  return (
    <button
      type="button"
      data-who={slot.id}
      aria-pressed="false"
      class="group/who grid w-27 flex-none content-start justify-items-center gap-2 text-center outline-none transition-opacity duration-200 data-dim:opacity-45 max-sm:w-21 max-sm:snap-start"
    >
      <span
        class={cn(
          CIRCLE,
          'bg-muted transition-[translate,box-shadow] duration-200 group-focus-visible/who:ring-2 group-focus-visible/who:ring-ring group-focus-visible/who:ring-offset-2 group-focus-visible/who:ring-offset-background group-aria-pressed/who:ring-2 group-aria-pressed/who:ring-primary group-aria-pressed/who:ring-offset-2 group-aria-pressed/who:ring-offset-background motion-safe:group-hover/who:-translate-y-0.5',
        )}
      >
        <SlotArt picture={slot.picture} />
      </span>
      <span class="grid w-full min-w-0 justify-items-center gap-px">
        <b class="flex max-w-full min-w-0 items-center gap-1.5 font-display text-base leading-snug font-extrabold transition-colors group-hover/who:text-primary">
          <span translate="no" class="truncate" safe>
            {slot.id}
          </span>
          {slot.lead ? <LeadStar /> : null}
        </b>
        {slot.native === null ? null : (
          <small
            translate="no"
            lang={slot.lang ?? undefined}
            class="max-w-full truncate font-display text-xs font-extrabold text-muted-foreground"
            safe
          >
            {slot.native}
          </small>
        )}
      </span>
    </button>
  )
}

function Request({ work }: { work: string }) {
  return (
    <a
      href={requestUrl(work)}
      target="_blank"
      rel="noopener"
      class="group/who grid w-27 flex-none content-start justify-items-center gap-2 text-center outline-none max-sm:w-21 max-sm:snap-start"
    >
      <span
        class={cn(
          CIRCLE,
          'bg-muted/65 text-soft-foreground inset-ring inset-ring-border transition-[color,box-shadow,translate] duration-200 group-hover/who:text-foreground group-hover/who:inset-ring-input group-focus-visible/who:ring-2 group-focus-visible/who:ring-ring group-focus-visible/who:ring-offset-2 group-focus-visible/who:ring-offset-background motion-safe:group-hover/who:-translate-y-0.5',
        )}
      >
        <Icon node={Plus} class="size-5.5" />
      </span>
      <span class="grid w-full justify-items-center gap-px">
        <b class="font-display text-base leading-snug font-extrabold text-soft-foreground transition-colors group-hover/who:text-foreground">
          request
        </b>
        <small class="inline-flex items-center gap-1 font-display text-xs font-extrabold text-muted-foreground">
          a character
          <NewTab class="size-3" />
        </small>
      </span>
    </a>
  )
}

function Track({ theme, number, lead, lang }: { theme: Theme; number: number; lead: boolean; lang: string | null }) {
  const native = theme.character?.native[0]

  return (
    <li class="grid">
      <a
        href={palettePath(theme)}
        data-who={theme.character?.id ?? ''}
        class="group/track grid min-h-15 grid-cols-[1.375rem_2rem_minmax(0,1fr)_minmax(7.5rem,18.75rem)_1.75rem] items-center gap-4 rounded-lg px-3 py-2 outline-none transition-[background-color,opacity] duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-dim:opacity-40 data-picked:bg-accent max-sm:grid-cols-[2rem_minmax(0,1fr)_4.5rem] max-sm:gap-3 max-sm:px-1.5"
      >
        <span class="text-right font-mono text-xs text-muted-foreground tabular-nums group-data-picked/track:text-soft-foreground max-sm:hidden">
          {number}
        </span>
        <WorkSwatch style={swatchStyle(theme)} />
        <span class="grid min-w-0 gap-px">
          <span class="flex min-w-0 items-center gap-1.5">
            <span
              translate="no"
              class="truncate font-display text-base leading-snug font-extrabold transition-colors group-hover/track:text-primary"
              safe
            >
              {theme.name}
            </span>
            {lead ? <LeadStar /> : null}
          </span>
          {native ? (
            <span
              translate="no"
              lang={lang ?? undefined}
              class="truncate font-display text-xs font-extrabold text-muted-foreground group-data-picked/track:text-soft-foreground"
              safe
            >
              {native}
            </span>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          class="block h-3 rounded-sm ring-1 ring-border forced-color-adjust-none"
          style={`background:${ribbon(theme)}`}
        />
        <Icon
          node={ArrowRight}
          class="size-4 justify-self-center text-soft-foreground opacity-0 transition-opacity duration-150 group-hover/track:opacity-100 group-focus-visible/track:opacity-100 max-sm:hidden"
        />
      </a>
    </li>
  )
}

function Tracks({
  market,
  work,
  leadSubject,
  langs,
}: {
  market: WorkMarket
  work: string
  leadSubject: string
  langs: Map<string, string | null>
}) {
  const { shelf, palettes } = market

  return (
    <div data-market={shelf.id} class="grid transition-opacity duration-200 data-missing:opacity-45">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 pb-3 max-sm:px-1.5">
        <span class="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <a
            href={marketplacePath(shelf.id)}
            translate="no"
            class="font-display text-display-sm font-black transition-colors [overflow-wrap:anywhere] hover:text-primary"
            safe
          >
            {shelf.id}
          </a>
          <MarketBadge builtin={shelf.id === BUILTIN} />
        </span>
        <span class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 max-sm:order-2 max-sm:w-full">
          <RepoLine shelf={shelf} />
          <Updated at={updatedAt(shelf)} />
        </span>
        <a
          href={marketplacePath(shelf.id)}
          aria-label={`open ${shelf.id}`}
          class="ml-auto grid size-9 flex-none place-items-center rounded-full border text-soft-foreground transition-[background-color,border-color,color,translate] duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground max-sm:order-1 motion-safe:hover:translate-x-0.5"
        >
          <Icon node={ArrowRight} class="size-4" />
        </a>
      </div>
      <p data-missing-note hidden class="mx-3 mt-2.5 text-sm text-muted-foreground max-sm:mx-1.5">
        no <span data-missing-who translate="no"></span> palette here yet
      </p>
      <ol aria-label={`${work} palettes in ${shelf.id}`} class="mt-1.5 grid">
        {palettes.map((theme, index) => (
          <Track
            theme={theme}
            number={index + 1}
            lead={theme.subject === leadSubject}
            lang={langs.get(theme.character?.id ?? '') ?? null}
          />
        ))}
      </ol>
    </div>
  )
}

function WorkHead({ name, native, lang }: { name: string; native: string | null; lang: string | null }) {
  return (
    <div class="relative mx-auto grid min-h-133 w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] content-end gap-1.5 pt-15 pb-8 max-sm:min-h-102">
      <Crumbs trail={[{ label: 'browse', href: BROWSE_PATH }, { label: 'works' }]} />
      <h1 translate="no" class="font-display text-display-xl font-black text-balance" safe>
        {name}
      </h1>
      {native === null ? null : (
        <p
          translate="no"
          lang={lang ?? undefined}
          class="font-display text-base font-extrabold text-soft-foreground"
          safe
        >
          {native}
        </p>
      )}
    </div>
  )
}

function Member({ member, lang }: { member: FoundCast; lang: string | null }) {
  return (
    <li class="grid w-27 flex-none content-start justify-items-center gap-2 text-center max-sm:w-21 max-sm:snap-start">
      <span class={cn(CIRCLE, 'bg-muted')}>
        <SlotArt picture={member.picture} />
      </span>
      <span class="grid w-full min-w-0 justify-items-center gap-px">
        <b translate="no" class="max-w-full truncate font-display text-base leading-snug font-extrabold" safe>
          {member.name}
        </b>
        {member.native === null ? null : (
          <small
            translate="no"
            lang={nativeLang(member.native, lang) ?? undefined}
            class="max-w-full truncate font-display text-xs font-extrabold text-muted-foreground"
            safe
          >
            {member.native}
          </small>
        )}
      </span>
    </li>
  )
}

function NoPalettes({ work }: { work: FoundWork }) {
  return (
    <div class="grid justify-items-start gap-3.5">
      <p class="text-soft-foreground">
        no palettes of{' '}
        <span translate="no" class="font-semibold text-foreground" safe>
          {work.name}
        </span>{' '}
        yet — ask for one, or make it yourself.
      </p>
      <span class="flex flex-wrap gap-2">
        <LinkButton variant="outline" size="sm" href={requestUrl(work.name)} target="_blank" rel="noopener">
          request a palette
          <NewTab />
        </LinkButton>
        <LinkButton size="sm" href={makePath(work.id)}>
          make one
        </LinkButton>
      </span>
    </div>
  )
}

export function FoundView({ page, facts, path }: { page: FoundPage; facts: Facts; path: string }) {
  const { work, cast } = page

  return (
    <div class="ground relative isolate flex min-h-dvh flex-col">
      <WorkHero art={work.art} facets={WORN_FACETS} sizes={HERO_SIZES} />
      <SiteHeader current={BROWSE_PATH} facts={facts} />
      <WorkHead name={work.name} native={work.native} lang={work.lang} />
      <main id="content" class={MAIN}>
        <div class={SECTIONS}>
          {cast.length === 0 ? null : (
            <section aria-labelledby="characters" class={SECTION}>
              <h2 id="characters" class={HEADING}>
                characters <span class={COUNT}>{cast.length}</span>
              </h2>
              <ul class={CAST}>
                {cast.map((member) => (
                  <Member member={member} lang={work.lang} />
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="palettes" class={SECTION}>
            <h2 id="palettes" class={HEADING}>
              palettes <span class={COUNT}>0</span>
            </h2>
            <NoPalettes work={work} />
          </section>
        </div>
      </main>
      <SiteFooter facts={facts} current={path} />
    </div>
  )
}

export function WorkView({ page, facts, path }: { page: WorkPage; facts: Facts; path: string }) {
  const { work, cast, markets } = page
  const count = markets.reduce((sum, market) => sum + market.palettes.length, 0)
  const langs = new Map(cast.map((slot) => [slot.id, slot.lang]))

  return (
    <div class="ground relative isolate flex min-h-dvh flex-col">
      <WorkHero art={page.art} facets={page.facets} sizes={HERO_SIZES} />
      <SiteHeader current={BROWSE_PATH} facts={facts} />
      <WorkHead name={work.name} native={work.native} lang={work.lang} />
      <main id="content" class={MAIN}>
        <work-page class={SECTIONS}>
          <section aria-labelledby="characters" class={SECTION}>
            <div class="flex items-baseline gap-3.5">
              <h2 id="characters" class={HEADING}>
                characters <span class={COUNT}>{cast.length}</span>
              </h2>
              <button
                type="button"
                data-show-all
                hidden
                class="rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                show all
              </button>
            </div>
            <div class={CAST}>
              {cast.map((slot) => (
                <Who slot={slot} />
              ))}
              <Request work={work.name} />
            </div>
          </section>
          <section aria-labelledby="palettes" class={SECTION}>
            <h2 id="palettes" class={HEADING}>
              palettes <span class={COUNT}>{count}</span>
            </h2>
            <div class="grid grid-cols-[minmax(0,1fr)] gap-8.5">
              {markets.map((market) => (
                <Tracks market={market} work={work.name} leadSubject={work.lead} langs={langs} />
              ))}
            </div>
          </section>
        </work-page>
      </main>
      <SiteFooter facts={facts} current={path} />
    </div>
  )
}
