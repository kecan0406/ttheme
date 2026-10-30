import type { PropsWithChildren } from '@kitajs/html'
import {
  ArrowDownAZ,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  type IconNode,
  Layers,
  Search,
  Star,
  Store,
} from 'lucide'
import { siGithub } from 'simple-icons'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants, LinkButton } from '@/components/ui/button'
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { RadioGroup, RadioGroupCount, RadioGroupItem } from '@/components/ui/radio-group'
import {
  FIRST_SORT,
  marketplacePath,
  type Peek,
  palettePath,
  peekOf,
  type Shelf,
  SORTS,
  SOURCE_LABELS,
  SOURCES,
  type Sort,
  type Source,
  START,
  searchable,
  shelvesMatching,
  starCount,
} from '@/lib/gallery'
import { BrandIcon, GitHubStar, Icon, NewTab } from '@/lib/icons'
import { makePath } from '@/lib/names'
import { json } from '@/lib/render'
import { sceneLines, useOf } from '@/lib/sessions'
import { BUILTIN, paint, type Theme } from '@/lib/themes'
import { cn, plural } from '@/lib/utils'
import { byWork, leadOf, leadsOf, swatchStyle } from '@/lib/works'
import { requestUrl } from '../../src/core/names.ts'
import { TerminalScreen } from './terminal'
import { TerminalFrame } from './terminal-frame'
import { WorkSwatch } from './work-results'

const DOTS = 9

const SOURCE_ICONS: Record<Source, IconNode | null> = { all: null, builtin: Layers, community: Store }

const SORT_LABELS = {
  popular: { label: 'popular', icon: Star },
  updated: { label: 'updated', icon: Clock },
  name: { label: 'a–z', icon: ArrowDownAZ },
} as const satisfies Record<Sort, { label: string; icon: IconNode }>

interface Stack {
  id: string | null
  work: string | null
  name: string
  note: string | null
  lang: string | undefined
  themes: Theme[]
  lead: Theme
}

function stacksIn(shelf: Shelf): Stack[] {
  return byWork(shelf.palettes).map((group) => {
    const { work, themes } = group
    const lead = leadOf(group)

    return {
      id: work?.id ?? null,
      work: work?.name ?? null,
      name: work?.name ?? 'originals',
      note: work ? (work.native ?? `led by ${lead.name}`) : null,
      lang: work?.lang ?? undefined,
      themes,
      lead,
    }
  })
}

function peeksIn(shelf: Shelf, stacks: Stack[]): Stack[] {
  const first = leadsOf(shelf.palettes)[0]

  return [...stacks.filter((stack) => stack.lead === first), ...stacks.filter((stack) => stack.lead !== first)]
}

function PaletteDots({ themes }: { themes: Theme[] }) {
  const style = themes
    .slice(0, DOTS)
    .map((theme, index) => `--dot${index}:${paint(theme, (shade) => shade.cursor)}`)
    .join(';')

  return <span aria-hidden="true" data-slot="palette-dots" style={style} />
}

function StackCard({ stack, builtin }: { stack: Stack; builtin: boolean }) {
  return (
    <a
      href={palettePath(stack.lead)}
      data-stack
      data-work={stack.id ?? undefined}
      data-search={stack.themes.map((theme) => searchable(theme).text).join('\n')}
      data-builtin={builtin}
      class="grid gap-3 rounded-xl border bg-card px-3.5 py-3 shadow-sm transition-[translate,border-color,box-shadow] duration-200 outline-none hover:border-input hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring motion-safe:hover:-translate-y-0.5"
    >
      <span class="flex min-w-0 items-center gap-2.5">
        <WorkSwatch style={swatchStyle(stack.lead)} />
        <span class="grid min-w-0">
          <span class="truncate font-display text-base leading-snug font-extrabold" safe>
            {stack.name}
          </span>
          {stack.note === null ? null : (
            <span lang={stack.lang} class="truncate font-display text-xs font-extrabold text-muted-foreground" safe>
              {stack.note}
            </span>
          )}
        </span>
      </span>
      <span class="flex items-center justify-between gap-2 border-t pt-2.5">
        <PaletteDots themes={stack.themes} />
        <span class="font-mono text-xs text-muted-foreground" safe>
          {plural(stack.themes.length, 'palette')}
        </span>
      </span>
    </a>
  )
}

export function RepoButton({ shelf }: { shelf: Shelf }) {
  return (
    <LinkButton
      variant="raised"
      size="xs"
      href={shelf.url}
      target="_blank"
      rel="noopener"
      class="relative z-1 max-w-full min-w-0 shrink"
    >
      <BrandIcon icon={siGithub} class="size-3.5 flex-none" />
      <span class="truncate font-mono font-normal" safe>
        {shelf.repo}
      </span>
      {shelf.stars === null ? null : (
        <>
          <span
            aria-hidden="true"
            class="inline-flex flex-none items-center gap-1.5 font-bold text-foreground tabular-nums"
          >
            <GitHubStar />
            <span safe>{starCount(shelf.stars)}</span>
          </span>
          <span class="sr-only" safe>
            {`, ${plural(shelf.stars, 'GitHub star')}`}
          </span>
        </>
      )}
      <span class="sr-only">, opens in a new tab</span>
    </LinkButton>
  )
}

export function Updated({ at }: { at: string | null }) {
  return at === null ? null : (
    <span class="inline-flex h-7 items-center gap-1.5 px-1 text-xs text-muted-foreground">
      <Icon node={Clock} class="size-3.5" />
      updated
      <b class="font-mono font-normal text-soft-foreground" safe>
        {at}
      </b>
    </span>
  )
}

function PeekWindow({ shelf, stacks }: { shelf: Shelf; stacks: Stack[] }) {
  const first = stacks[0]

  if (!first) return null
  const peek = peekOf(first.lead, first.work)

  return (
    <TerminalFrame
      data-peek={shelf.id}
      style={peek.style}
      title={peek.title}
      recolor
      class="min-w-0 flex-[0_1_440px]"
      controls={
        stacks.length > 1 ? (
          <>
            <Button variant="scene" size="icon-sm" aria-label="previous palette" data-peek-step="-1">
              <Icon node={ChevronLeft} />
            </Button>
            <Button variant="scene" size="icon-sm" aria-label="next palette" data-peek-step="1">
              <Icon node={ChevronRight} />
            </Button>
          </>
        ) : undefined
      }
    >
      <TerminalScreen
        lines={sceneLines('shell', useOf(first.lead))}
        decorative
        class="overflow-hidden px-4 pt-3 pb-3.5 text-code"
      />
    </TerminalFrame>
  )
}

function MarketplaceCard({ shelf, stacks }: { shelf: Shelf; stacks: Stack[] }) {
  const builtin = shelf.id === BUILTIN
  const works = stacks.filter((stack) => stack.work !== null).length

  return (
    <article
      data-shelf={shelf.id}
      data-stars={shelf.stars ?? 0}
      data-pushed={shelf.pushedAt ?? ''}
      class="overflow-hidden rounded-3xl border bg-card shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-input hover:shadow-md has-[details[open]]:border-input"
    >
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 p-3.5">
        <PeekWindow shelf={shelf} stacks={peeksIn(shelf, stacks)} />
        <div class="group/open relative flex min-w-0 flex-[1_1_20rem] items-center gap-4 self-stretch rounded-2xl p-4 transition-colors has-[a[data-open]:hover]:bg-muted/65 has-[a[data-open]:focus-visible]:ring-2 has-[a[data-open]:focus-visible]:ring-ring">
          <div class="grid min-w-0 flex-1 gap-1.5">
            <span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h2 class="font-display text-display-sm font-black [overflow-wrap:anywhere]">
                <a
                  href={marketplacePath(shelf.id)}
                  data-open
                  class="outline-none transition-colors after:absolute after:inset-0 after:rounded-2xl hover:text-primary"
                  safe
                >
                  {shelf.id}
                </a>
              </h2>
              {builtin ? (
                <Badge>
                  <Icon node={Layers} />
                  built-in
                </Badge>
              ) : null}
            </span>
            <p class="text-sm text-soft-foreground" safe>
              {shelf.about}
            </p>
            <p class="text-sm text-soft-foreground">
              <b data-shelf-count class="font-mono font-normal text-foreground tabular-nums">
                {shelf.palettes.length}
              </b>{' '}
              palettes
              {shelf.version === null ? null : (
                <>
                  {' · ttheme '}
                  <b class="font-mono font-normal text-foreground" safe>
                    {`v${shelf.version}`}
                  </b>
                </>
              )}
            </p>
            <span class="mt-1 flex flex-wrap items-center gap-1.5">
              <RepoButton shelf={shelf} />
              <Updated at={shelf.pushedAt} />
            </span>
          </div>
          <span
            aria-hidden="true"
            class="grid size-10 flex-none place-items-center rounded-full border bg-card text-soft-foreground transition-[background-color,border-color,color,translate] duration-200 group-has-[a[data-open]:hover]/open:border-primary group-has-[a[data-open]:hover]/open:bg-primary group-has-[a[data-open]:hover]/open:text-primary-foreground motion-safe:group-has-[a[data-open]:hover]/open:translate-x-0.5"
          >
            <Icon node={ArrowRight} class="size-4.5" />
          </span>
        </div>
      </div>
      <Collapsible class="group/works">
        <CollapsibleTrigger class="group/toggle flex items-center gap-3 px-5 pt-0.5 pb-4 outline-none before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
          <span
            class={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'pr-2.5 pl-3.5 group-hover/toggle:border-input group-hover/toggle:bg-secondary group-hover/toggle:text-foreground group-focus-visible/toggle:ring-2 group-focus-visible/toggle:ring-ring group-focus-visible/toggle:ring-offset-2 group-focus-visible/toggle:ring-offset-background group-active/toggle:scale-96 group-data-open/works:border-input group-data-open/works:text-foreground',
            )}
          >
            <b class="font-mono font-normal text-foreground tabular-nums">{works}</b> {works === 1 ? 'work' : 'works'}
            <Icon
              node={ChevronDown}
              class="transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-data-open/works:rotate-180"
            />
          </span>
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-2.5 border-t bg-muted/65 px-5 pt-4.5 pb-5">
            {stacks.map((stack) => (
              <StackCard stack={stack} builtin={builtin} />
            ))}
          </div>
        </CollapsiblePanel>
      </Collapsible>
    </article>
  )
}

export function MarketplaceBoard({ shelves, children }: PropsWithChildren<{ shelves: Shelf[] }>) {
  const found = shelves.map((shelf) => shelf.palettes.map(searchable))
  const stacks = shelves.map(stacksIn)

  const peeks: Record<string, Peek[]> = Object.fromEntries(
    shelves.map((shelf, index) => [
      shelf.id,
      peeksIn(shelf, stacks[index] ?? []).map((stack) => peekOf(stack.lead, stack.work)),
    ]),
  )

  const count = (source: (typeof SOURCES)[number]) => shelvesMatching(found, { ...START, source })

  return (
    <marketplace-board class="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div class="flex flex-wrap items-end justify-between gap-x-12 gap-y-5">
        {children}
        <search class="max-w-[540px] flex-[1_1_22rem]">
          <InputGroup class="h-11">
            <InputGroupAddon>
              <Icon node={Search} />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              name="query"
              placeholder="search marketplaces, works, palettes"
              aria-label="search marketplaces"
              aria-keyshortcuts="Meta+K Control+K"
              spellcheck="false"
              autocomplete="off"
              autocapitalize="none"
              autocorrect="off"
              enterkeyhint="search"
            />
            <InputGroupAddon align="inline-end">
              <Kbd>
                <span data-key="apple">⌘</span>
                <span data-key="other">ctrl</span>k
              </Kbd>
            </InputGroupAddon>
          </InputGroup>
        </search>
      </div>
      <div class="flex flex-wrap items-end">
        <RadioGroup variant="underline" label="source" class="w-auto flex-[1_1_auto]">
          {SOURCES.map((source) => {
            const icon = SOURCE_ICONS[source]

            return (
              <RadioGroupItem variant="underline" name="source" value={source} checked={source === START.source}>
                {icon ? <Icon node={icon} /> : null}
                {SOURCE_LABELS[source]}
                <RadioGroupCount data-count={source}>{count(source)}</RadioGroupCount>
              </RadioGroupItem>
            )
          })}
        </RadioGroup>
        <RadioGroup variant="underline" label="sort" class="w-auto flex-[1_1_auto] justify-end gap-5">
          <span aria-hidden="true" class="pb-3 text-sm text-muted-foreground">
            sort
          </span>
          {SORTS.map((sort) => (
            <RadioGroupItem variant="underline" name="sort" value={sort} checked={sort === FIRST_SORT}>
              <Icon node={SORT_LABELS[sort].icon} />
              {SORT_LABELS[sort].label}
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </div>
      <section data-works hidden aria-label="works" class="grid grid-cols-[minmax(0,1fr)] gap-3 pt-2"></section>
      <div data-shelves class="grid grid-cols-[minmax(0,1fr)] gap-4 pt-2">
        {shelves.map((shelf, index) => (
          <MarketplaceCard shelf={shelf} stacks={stacks[index] ?? []} />
        ))}
      </div>
      <div data-empty hidden class="grid justify-items-center gap-1 py-15 text-center text-muted-foreground">
        <strong class="block font-semibold text-foreground">
          <span data-empty-title>no palette matches these filters</span>{' '}
          <span data-empty-face aria-hidden="true">
            ( ˘ω˘ )
          </span>
        </strong>
        <span data-empty-text>clear a filter, or search for a work instead.</span>
        <span data-empty-ask hidden class="mt-3 flex flex-wrap justify-center gap-2">
          <LinkButton variant="outline" size="sm" href={requestUrl('')} target="_blank" rel="noopener" data-request>
            request a palette
            <NewTab />
          </LinkButton>
          <LinkButton size="sm" href={makePath(null)} data-make>
            make one
          </LinkButton>
        </span>
      </div>
      <script type="application/json" data-peeks>
        {json(peeks)}
      </script>
    </marketplace-board>
  )
}
