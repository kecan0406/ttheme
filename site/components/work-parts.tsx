import { escapeHtml } from '@kitajs/html'
import { Clock, Layers, Star, Store } from 'lucide'
import { Badge } from '@/components/ui/badge'
import { MeltLink } from '@/components/ui/melt-card'
import type { KeyArt } from '@/lib/art'
import { type Shelf, starCount } from '@/lib/gallery'
import { GitHubStar, Icon } from '@/lib/icons'
import { plural } from '@/lib/utils'
import { RepoLink } from './repo-link'
import { WorkArt } from './work-art'

export const THUMB_SIZES = '(min-width: 1320px) 240px, (min-width: 640px) 25vw, 50vw'

export function LeadStar() {
  return (
    <>
      <Icon node={Star} class="size-3 flex-none fill-current text-primary" />
      <span class="sr-only">, lead</span>
    </>
  )
}

export function MarketBadge({
  builtin,
  variant,
  class: className,
}: {
  builtin: boolean
  variant?: 'outline' | 'glass'
  class?: string
}) {
  return builtin ? (
    <Badge variant={variant} class={className}>
      <Icon node={Layers} />
      built-in
    </Badge>
  ) : (
    <Badge variant={variant} class={className}>
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

export function TileTicks({ colors, at }: { colors: readonly string[]; at: number }) {
  return (
    <>
      {colors.map((color, index) => (
        <i
          data-on={index === at ? '' : undefined}
          class="h-0.75 min-w-0 flex-1 rounded-full opacity-45 transition-opacity duration-150 forced-color-adjust-none data-on:opacity-100"
          style={`background:${color}`}
        />
      ))}
    </>
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
  look,
  focus,
  sizes,
  eager = false,
  also = null,
}: {
  href: string
  name: string
  native: string | null
  lang: string | null | undefined
  count: number
  art: KeyArt | null
  facets: string
  look?: string
  focus?: string | null
  sizes: string
  eager?: boolean
  also?: string | null
}) {
  return (
    <MeltLink size="tile" href={href} data-tile style={look} class="group/thumb max-sm:rounded-xl">
      <WorkArt
        art={art}
        facets={facets}
        focus={focus}
        sizes={sizes}
        eager={eager}
        melt
        class="absolute inset-x-0 top-0 -z-10 aspect-[8/5]"
      />
      {also ? (
        <Badge variant="glass" class="absolute top-2 right-2 px-2 py-0.75 font-mono text-2xs">
          {escapeHtml(also)}
        </Badge>
      ) : null}
      <span class="relative grid min-w-0 gap-px px-3 pb-3 max-sm:px-2.5 max-sm:pb-2">
        <span
          data-ticks
          aria-hidden="true"
          class="absolute inset-x-3 -top-2 flex gap-px opacity-0 transition-opacity duration-150 group-data-scrubbing/thumb:opacity-100"
        />
        <span
          translate="no"
          class="truncate font-display text-base leading-snug font-extrabold transition-colors duration-200 group-hover/thumb:text-primary max-sm:text-sm"
          safe
        >
          {name}
        </span>
        <span class="flex min-w-0 items-baseline gap-2">
          {native ? (
            <span
              data-tile-native
              translate="no"
              lang={lang ?? undefined}
              class="min-w-0 flex-1 truncate font-display text-xs font-extrabold text-muted-foreground transition-colors duration-200 max-sm:text-2xs"
              safe
            >
              {native}
            </span>
          ) : null}
          <span
            data-tile-palette
            hidden
            aria-hidden="true"
            translate="no"
            class="min-w-0 flex-1 truncate font-display text-xs font-extrabold text-soft-foreground transition-colors duration-200"
          />
          <span class="ml-auto flex-none font-mono text-xs text-muted-foreground transition-colors duration-200 max-sm:text-2xs">
            {count === 0 ? (
              'no palettes yet'
            ) : (
              <>
                <span safe>{String(count)}</span>
                <span class="max-sm:sr-only">{count === 1 ? ' palette' : ' palettes'}</span>
              </>
            )}
          </span>
        </span>
      </span>
    </MeltLink>
  )
}
