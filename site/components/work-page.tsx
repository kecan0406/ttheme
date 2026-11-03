import { ArrowRight, ChevronRight, EllipsisVertical, Plus } from 'lucide'
import { LinkButton } from '@/components/ui/button'
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible'
import { RowLink } from '@/components/ui/row'
import { personOf } from '@/lib/cast'
import { type Place, placeLinks } from '@/lib/categories'
import type { Facts } from '@/lib/facts'
import { type FamilyWork, type FoundCast, type FoundPage, type FoundWork, SHOWN_CAST, SHOWN_FAMILY } from '@/lib/found'
import { BROWSE_PATH, marketplacePath, palettePath, type Shelf } from '@/lib/gallery'
import { Icon, NewTab } from '@/lib/icons'
import { makePath } from '@/lib/names'
import { BUILTIN, type Theme } from '@/lib/themes'
import { cn, plural } from '@/lib/utils'
import type { CastSlot, Neighbor, WorkMarket, WorkPage } from '@/lib/work-page'
import { ribbon, WORN_FACETS } from '@/lib/works'
import { requestUrl } from '../../src/core/names.ts'
import { CAST, CastSearch, CIRCLE, Member } from './cast-members'
import { CommandRow } from './command-row'
import { Dots, dotColors } from './dots'
import { GLASS } from './glass'
import { Crumbs } from './marketplace-frame'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'
import { SlotArt, WorkHero } from './work-art'
import { LeadStar, MarketBadge, RepoLine, Updated, updatedAt } from './work-parts'

const PUBLISH_PATH = '/docs/guide/make#publish-a-marketplace'

export const HERO_SIZES = '100vw'

const HEADING = 'flex items-baseline gap-2.5 font-display text-display-md font-black'

const COUNT = 'font-mono text-sm font-normal tracking-normal text-muted-foreground'

const MAIN = 'relative mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] pb-24'

const SECTIONS = 'grid grid-cols-[minmax(0,1fr)] gap-16 max-sm:gap-11'

const SECTION = 'grid grid-cols-[minmax(0,1fr)] gap-4.5'

function Who({ slot }: { slot: CastSlot }) {
  return (
    <li class="grid w-27 flex-none max-sm:w-21 max-sm:snap-start">
      <button
        type="button"
        data-who={slot.id}
        aria-pressed="false"
        class="group/who grid content-start justify-items-center gap-2 text-center outline-none transition-opacity duration-200 data-dim:opacity-45"
      >
        <span
          class={cn(
            CIRCLE,
            'bg-muted transition-[translate,box-shadow] duration-200 group-focus-visible/who:ring-2 group-focus-visible/who:ring-ring group-focus-visible/who:ring-offset-2 group-focus-visible/who:ring-offset-background group-aria-pressed/who:ring-2 group-aria-pressed/who:ring-primary group-aria-pressed/who:ring-offset-2 group-aria-pressed/who:ring-offset-background motion-safe:group-hover/who:-translate-y-0.5',
          )}
        >
          <SlotArt picture={slot.picture} tones={slot.tones} />
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
    </li>
  )
}

function Request({ work }: { work: string }) {
  return (
    <li class="grid w-27 flex-none max-sm:w-21 max-sm:snap-start">
      <a
        href={requestUrl(work)}
        target="_blank"
        rel="noopener"
        class="group/who grid content-start justify-items-center gap-2 text-center outline-none"
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
    </li>
  )
}

function Track({ theme, lead, lang }: { theme: Theme; lead: boolean; lang: string | null }) {
  const person = theme.work && theme.character ? personOf(theme.work.id, theme.character.id) : null
  const native = person ?? theme.character?.native[0]

  return (
    <li class="grid">
      <a
        href={palettePath(theme)}
        data-who={theme.character?.id ?? ''}
        class="group/track grid min-h-15 grid-cols-[2.75rem_minmax(0,1fr)_minmax(7.5rem,18.75rem)_1.75rem] items-center gap-4 rounded-lg border-y border-transparent bg-clip-padding px-3 py-2 outline-none transition-[background-color,opacity] duration-150 hover:bg-muted focus-visible:inset-ring-2 focus-visible:inset-ring-ring data-dim:opacity-40 data-picked:bg-accent max-sm:grid-cols-[2.75rem_minmax(0,1fr)_4.5rem] max-sm:gap-3 max-sm:px-1.5"
      >
        <Dots colors={dotColors(theme)} />
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
              lang={person ? undefined : (lang ?? undefined)}
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

function Total({ count, one }: { count: number; one: string }) {
  return (
    <span class="inline-flex items-baseline gap-1.5">
      <b class="font-display text-display-sm font-black tabular-nums">{count}</b>
      <span class="text-sm text-muted-foreground" safe>
        {count === 1 ? one : `${one}s`}
      </span>
    </span>
  )
}

function MarketLabel({ shelf, works }: { shelf: Shelf; works: number }) {
  return (
    <div class="grid content-start justify-items-start gap-2 px-3 max-sm:px-1.5 md:sticky md:top-(--clearance) md:self-start">
      <MarketBadge builtin={shelf.id === BUILTIN} />
      <a
        href={marketplacePath(shelf.id)}
        class="group/name inline-flex max-w-full items-center gap-2 rounded-sm font-display text-display-sm font-black outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span translate="no" class="min-w-0 [overflow-wrap:anywhere]" safe>
          {shelf.id}
        </span>
        <Icon
          node={ArrowRight}
          class="size-4.5 flex-none text-muted-foreground transition-[color,translate] duration-200 group-hover/name:text-primary motion-safe:group-hover/name:translate-x-0.5"
        />
      </a>
      <p class="text-sm text-pretty text-soft-foreground" safe>
        {shelf.about}
      </p>
      <p class="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Total count={works} one="work" />
        <Total count={shelf.palettes.length} one="palette" />
      </p>
      <span class="grid justify-items-start">
        <RepoLine shelf={shelf} />
        <Updated at={updatedAt(shelf)} />
      </span>
    </div>
  )
}

const CHEVRON =
  'size-3.5 flex-none text-faint-foreground transition-transform duration-150 group-data-open/work:rotate-90 motion-reduce:transition-none'

function Size({ count }: { count: number }) {
  return <span class="flex-none font-mono text-xs font-normal text-muted-foreground tabular-nums">{count}</span>
}

function NeighborWork({ neighbor }: { neighbor: Neighbor }) {
  return (
    <li class="group/row relative">
      <Collapsible class="group/work">
        <CollapsibleTrigger
          row="md"
          class="pr-11 group-data-open/work:text-foreground group-has-[>a:hover]/row:bg-muted group-has-[>a:hover]/row:text-foreground"
        >
          <Icon node={ChevronRight} class={CHEVRON} />
          <Dots colors={dotColors(neighbor.lead)} />
          <span translate="no" class="min-w-0 truncate" safe>
            {neighbor.name}
          </span>
          <Size count={neighbor.palettes.length} />
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <ul class="grid pt-0.5 pb-2 pl-7.5">
            {neighbor.palettes.map((theme) => (
              <li>
                <RowLink size="sm" href={palettePath(theme)}>
                  <Dots colors={dotColors(theme)} />
                  <span translate="no" class="min-w-0 truncate" safe>
                    {theme.name}
                  </span>
                </RowLink>
              </li>
            ))}
          </ul>
        </CollapsiblePanel>
      </Collapsible>
      <a
        href={neighbor.path}
        aria-label={`open ${neighbor.name}`}
        class="group/go absolute top-0 right-0 grid size-9 place-items-center rounded-lg text-muted-foreground outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-ring"
      >
        <Icon
          node={ArrowRight}
          class="size-4 transition-[color,translate] duration-200 group-hover/go:text-primary motion-safe:group-hover/go:translate-x-0.5"
        />
      </a>
    </li>
  )
}

function Elsewhere({ count }: { count: number }) {
  return count === 0 ? null : (
    <li class="flex h-8.5 items-center gap-2.5 pl-2.5 text-sm text-muted-foreground">
      <Icon node={EllipsisVertical} class="size-3.5 flex-none text-faint-foreground" />
      <span aria-hidden="true" class="w-11 flex-none" />
      <span safe>{plural(count, 'more work')}</span>
    </li>
  )
}

function Market({
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
  const { shelf, palettes, catalog } = market

  return (
    <section
      data-market={shelf.id}
      aria-label={shelf.id}
      class="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-5 border-t pt-5 pb-6 transition-opacity duration-200 data-missing:opacity-45 md:grid-cols-[16.25rem_minmax(0,1fr)]"
    >
      <MarketLabel shelf={shelf} works={catalog.works} />
      <div class="grid min-w-0 content-start gap-3">
        <nav aria-label={`works in ${shelf.id}`} class="grid min-w-0 content-start gap-2">
          <ul class={cn(GLASS, 'grid min-w-0 rounded-2xl p-2')}>
            <Elsewhere count={catalog.before} />
            {catalog.previous.map((neighbor) => (
              <NeighborWork neighbor={neighbor} />
            ))}
            <li>
              <Collapsible open class="group/work">
                <CollapsibleTrigger row="lg" aria-current="page">
                  <Icon node={ChevronRight} class={cn(CHEVRON, 'text-soft-foreground')} />
                  <Dots colors={dotColors(catalog.lead)} />
                  <span translate="no" class="min-w-0 truncate font-display text-base font-black" safe>
                    {work}
                  </span>
                  <Size count={palettes.length} />
                </CollapsibleTrigger>
                <CollapsiblePanel>
                  <p data-missing-note hidden class="mx-3 mt-1.5 text-sm text-muted-foreground max-sm:mx-1.5">
                    no <span data-missing-who translate="no"></span> palette here yet
                  </p>
                  <ol
                    aria-label={`${work} palettes in ${shelf.id}`}
                    class="my-0.5 ml-5.5 grid border-l pl-2.5 max-sm:ml-3 max-sm:pl-1.5"
                  >
                    {palettes.map((theme) => (
                      <Track
                        theme={theme}
                        lead={theme.subject === leadSubject}
                        lang={langs.get(theme.character?.id ?? '') ?? null}
                      />
                    ))}
                  </ol>
                </CollapsiblePanel>
              </Collapsible>
            </li>
            {catalog.next.map((neighbor) => (
              <NeighborWork neighbor={neighbor} />
            ))}
            <Elsewhere count={catalog.after} />
          </ul>
          {catalog.more ? (
            <a
              href={marketplacePath(shelf.id)}
              class="inline-flex items-center gap-1.5 justify-self-start rounded-sm pl-2.5 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              see all {catalog.works} works in{' '}
              <span translate="no" safe>
                {shelf.id}
              </span>
              <Icon node={ArrowRight} class="size-3.5" />
            </a>
          ) : null}
        </nav>
        {shelf.add ? <CommandRow command={`ttheme marketplace add ${shelf.add}`} class="max-w-140 bg-card" /> : null}
      </div>
    </section>
  )
}

function WorkHead({
  name,
  native,
  lang,
  places,
}: {
  name: string
  native: string | null
  lang: string | null
  places: readonly Place[]
}) {
  const links = placeLinks(places)

  return (
    <div class="relative mx-auto grid min-h-133 w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] content-end gap-1.5 pt-15 pb-8 max-sm:min-h-102">
      <Crumbs trail={[{ label: 'browse', href: BROWSE_PATH }, { label: 'works' }]} />
      <h1 translate="no" class="font-display text-display-xl font-black text-balance [overflow-wrap:anywhere]" safe>
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
      {links.length === 0 ? null : (
        <p class="flex flex-wrap gap-x-3 text-sm text-soft-foreground">
          {links.map((link) => (
            <a href={link.href} class="underline-offset-4 hover:text-foreground hover:underline" safe>
              {link.label}
            </a>
          ))}
        </p>
      )}
    </div>
  )
}

const SHOW_ALL =
  'justify-self-start rounded-sm text-sm font-medium text-primary outline-none group-open/more:hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring'

const FAMILY = 'grid max-w-[68ch] gap-2'

function RestOfCast({ rest, total, lang }: { rest: FoundCast[]; total: number; lang: string | null }) {
  return rest.length === 0 ? null : (
    <Collapsible class="group/more grid grid-cols-[minmax(0,1fr)] gap-5">
      <CollapsibleTrigger class={SHOW_ALL}>show all {total}</CollapsibleTrigger>
      <CollapsiblePanel>
        <ul class={CAST}>
          {rest.map((member) => (
            <Member member={member} lang={lang} />
          ))}
        </ul>
      </CollapsiblePanel>
    </Collapsible>
  )
}

function Members({ cast, lang }: { cast: FoundCast[]; lang: string | null }) {
  return (
    <>
      <ul class={CAST}>
        {cast.slice(0, SHOWN_CAST).map((member) => (
          <Member member={member} lang={lang} />
        ))}
      </ul>
      <RestOfCast rest={cast.slice(SHOWN_CAST)} total={cast.length} lang={lang} />
    </>
  )
}

function FamilyRow({ work }: { work: FamilyWork }) {
  return (
    <li class="flex min-w-0 items-baseline gap-3">
      <span translate="no" class="min-w-0 truncate font-display text-base font-extrabold" safe>
        {work.name}
      </span>
      <span class="flex-none font-mono text-xs text-muted-foreground" safe>
        {[work.medium, work.year].filter((part) => part !== null).join(', ')}
      </span>
    </li>
  )
}

function Family({ works }: { works: FamilyWork[] }) {
  const rest = works.slice(SHOWN_FAMILY)

  return (
    <div class="grid grid-cols-[minmax(0,1fr)] gap-2">
      <ol class={FAMILY}>
        {works.slice(0, SHOWN_FAMILY).map((work) => (
          <FamilyRow work={work} />
        ))}
      </ol>
      {rest.length === 0 ? null : (
        <Collapsible class="group/more grid grid-cols-[minmax(0,1fr)]">
          <CollapsibleTrigger class={cn(SHOW_ALL, 'mt-2.5')}>show all {works.length}</CollapsibleTrigger>
          <CollapsiblePanel>
            <ol class={FAMILY}>
              {rest.map((work) => (
                <FamilyRow work={work} />
              ))}
            </ol>
          </CollapsiblePanel>
        </Collapsible>
      )}
    </div>
  )
}

function NoPalettes({ work }: { work: FoundWork }) {
  return (
    <div class="grid justify-items-start gap-3.5">
      <p class="text-soft-foreground">
        no marketplace has a palette of{' '}
        <span translate="no" class="font-semibold text-foreground" safe>
          {work.name}
        </span>{' '}
        yet — make one yourself, or publish a marketplace of your own.
      </p>
      <span class="flex flex-wrap gap-2">
        <LinkButton size="sm" href={makePath(work.id)}>
          make one
        </LinkButton>
        <LinkButton variant="outline" size="sm" href={PUBLISH_PATH}>
          publish a marketplace
        </LinkButton>
      </span>
    </div>
  )
}

export function FoundView({ page, facts, path }: { page: FoundPage; facts: Facts; path: string }) {
  const { work, cast, family } = page

  return (
    <div class="ground relative isolate flex min-h-dvh flex-col">
      <WorkHero art={work.art} facets={WORN_FACETS} sizes={HERO_SIZES} />
      <SiteHeader current={BROWSE_PATH} facts={facts} />
      <main id="content" data-work-main>
        <WorkHead name={work.name} native={work.native} lang={work.lang} places={work.places} />
        <div class={MAIN}>
          <div class={SECTIONS}>
            {cast.length === 0 ? null : (
              <section aria-labelledby="characters" class={SECTION}>
                <h2 id="characters" class={HEADING}>
                  characters <span class={COUNT}>{cast.length}</span>
                </h2>
                <Members cast={cast} lang={work.lang} />
                <CastSearch id={work.id} work={work.name} lang={work.lang} />
              </section>
            )}
            <section aria-labelledby="marketplaces" class={SECTION}>
              <h2 id="marketplaces" class={HEADING}>
                marketplaces <span class={COUNT}>0</span>
              </h2>
              <NoPalettes work={work} />
            </section>
            {family.length < 2 ? null : (
              <section aria-labelledby="works" class={SECTION}>
                <h2 id="works" class={HEADING}>
                  works <span class={COUNT}>{family.length}</span>
                </h2>
                <Family works={family} />
              </section>
            )}
          </div>
        </div>
      </main>
      <SiteFooter facts={facts} current={path} />
    </div>
  )
}

export function WorkView({ page, facts, path }: { page: WorkPage; facts: Facts; path: string }) {
  const { work, cast, more, markets } = page
  const langs = new Map(cast.map((slot) => [slot.id, slot.lang]))
  const room = Math.max(0, SHOWN_CAST - cast.length)

  return (
    <div class="ground relative isolate flex min-h-dvh flex-col">
      <WorkHero art={page.art} facets={page.facets} sizes={HERO_SIZES} />
      <SiteHeader current={BROWSE_PATH} facts={facts} />
      <main id="content" data-work-main>
        <WorkHead name={work.name} native={work.native} lang={work.lang} places={page.places} />
        <div class={MAIN}>
          <work-page class={SECTIONS}>
            <section aria-labelledby="characters" class={SECTION}>
              <div class="flex items-baseline gap-3.5">
                <h2 id="characters" class={HEADING}>
                  characters <span class={COUNT}>{cast.length + more.length}</span>
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
              <ul class={CAST}>
                {cast.map((slot) => (
                  <Who slot={slot} />
                ))}
                {more.slice(0, room).map((member) => (
                  <Member member={member} lang={work.lang} />
                ))}
                <Request work={work.name} />
              </ul>
              <RestOfCast rest={more.slice(room)} total={cast.length + more.length} lang={work.lang} />
              {page.findable ? <CastSearch id={work.id} work={work.name} lang={work.lang} /> : null}
            </section>
            <section aria-labelledby="marketplaces" class={SECTION}>
              <h2 id="marketplaces" class={HEADING}>
                marketplaces <span class={COUNT}>{markets.length}</span>
              </h2>
              <div class="grid grid-cols-[minmax(0,1fr)]">
                {markets.map((market) => (
                  <Market market={market} work={work.name} leadSubject={work.lead} langs={langs} />
                ))}
              </div>
            </section>
          </work-page>
        </div>
      </main>
      <SiteFooter facts={facts} current={path} />
    </div>
  )
}
