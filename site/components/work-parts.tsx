import { Clock, Layers, Star, Store } from 'lucide'
import { Badge } from '@/components/ui/badge'
import type { KeyArt } from '@/lib/art'
import { type Shelf, starCount } from '@/lib/gallery'
import { GitHubStar, Icon } from '@/lib/icons'
import { plural } from '@/lib/utils'
import { RepoLink } from './repo-link'
import { WorkArt } from './work-art'

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

export function updatedAt(shelf: Shelf): string | null {
  return shelf.version === null ? shelf.pushedAt : `v${shelf.version}`
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

export function Stars({ stars }: { stars: number | null }) {
  return stars === null ? null : (
    <>
      <span aria-hidden="true" class="inline-flex flex-none items-center gap-1 tabular-nums">
        <GitHubStar />
        <span safe>{starCount(stars)}</span>
      </span>
      <span class="sr-only" safe>
        {plural(stars, 'GitHub star')}
      </span>
    </>
  )
}

export function RepoLine({ shelf }: { shelf: Shelf }) {
  return (
    <span class="inline-flex min-w-0 items-center gap-2 font-mono text-xs text-soft-foreground">
      <RepoLink href={shelf.url} repo={shelf.repo} />
      <Stars stars={shelf.stars} />
    </span>
  )
}

export function WorkThumb({
  href,
  name,
  native,
  lang,
  count,
  art,
  facets,
  sizes,
  eager = false,
  community = false,
}: {
  href: string
  name: string
  native: string | null
  lang: string | null | undefined
  count: number
  art: KeyArt | null
  facets: string
  sizes: string
  eager?: boolean
  community?: boolean
}) {
  return (
    <a href={href} class="group/thumb grid min-w-0 content-start gap-2.5 outline-none">
      <span class="relative block rounded-xl transition-[translate,box-shadow] duration-200 group-hover/thumb:shadow-md group-focus-visible/thumb:ring-2 group-focus-visible/thumb:ring-ring group-focus-visible/thumb:ring-offset-2 group-focus-visible/thumb:ring-offset-background motion-safe:group-hover/thumb:-translate-y-0.5">
        <WorkArt art={art} facets={facets} sizes={sizes} eager={eager} class="relative aspect-video rounded-xl" />
        {community ? (
          <Badge variant="glass" class="absolute top-2 left-2">
            <Icon node={Store} />
            community
          </Badge>
        ) : null}
      </span>
      <span class="grid min-w-0 gap-px">
        <span class="flex min-w-0 items-baseline gap-2">
          <span
            translate="no"
            class="truncate font-display text-base leading-snug font-extrabold transition-colors group-hover/thumb:text-primary"
            safe
          >
            {name}
          </span>
          <span class="ml-auto flex-none font-mono text-xs text-muted-foreground" safe>
            {plural(count, 'palette')}
          </span>
        </span>
        {native ? (
          <span
            translate="no"
            lang={lang ?? undefined}
            class="truncate font-display text-xs font-extrabold text-muted-foreground"
            safe
          >
            {native}
          </span>
        ) : null}
      </span>
    </a>
  )
}
