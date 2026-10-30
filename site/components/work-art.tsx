import { type SimpleIcon, siAnilist, siThemoviedatabase } from 'simple-icons'
import { ANILIST_HOME, type ArtSource, type KeyArt, TMDB_HOME } from '@/lib/art'
import { BrandIcon, NewTab } from '@/lib/icons'
import { cn } from '@/lib/utils'

const FACETS: [points: string, tone: number, opacity?: number][] = [
  ['0,0 80,0 0,70', 1],
  ['80,0 95,55 0,70', 2, 0.55],
  ['80,0 170,0 95,55', 1, 0.8],
  ['170,0 160,85 95,55', 5, 0.7],
  ['170,0 240,0 160,85', 2],
  ['240,0 235,60 160,85', 5],
  ['240,0 300,0 235,60', 2, 0.85],
  ['300,0 300,80 235,60', 1],
  ['0,70 95,55 0,140', 1, 0.6],
  ['95,55 70,130 0,140', 3, 0.55],
  ['95,55 160,85 70,130', 3, 0.85],
  ['160,85 150,150 70,130', 1],
  ['160,85 235,60 150,150', 4, 0.9],
  ['235,60 225,135 150,150', 2],
  ['235,60 300,80 225,135', 5, 0.6],
  ['300,80 300,150 225,135', 1],
  ['0,140 70,130 0,200', 0],
  ['70,130 90,200 0,200', 1, 0.7],
  ['70,130 150,150 90,200', 3, 0.35],
  ['150,150 180,200 90,200', 1],
  ['150,150 225,135 180,200', 4, 0.45],
  ['225,135 250,200 180,200', 1, 0.8],
  ['225,135 300,150 250,200', 2, 0.7],
  ['300,150 300,200 250,200', 0],
]

const SLOT_FACETS: [points: string, tint: string][] = [
  ['0,0 70,0 0,60', 'fill-foreground/4'],
  ['70,0 120,0 120,50 55,45', 'fill-foreground/8'],
  ['0,60 55,45 30,110 0,115', 'fill-foreground/6'],
  ['55,45 120,50 90,105 30,110', 'fill-foreground/10'],
  ['120,50 120,120 90,105', 'fill-foreground/7'],
  ['30,110 90,105 70,160 0,160 0,115', 'fill-foreground/3'],
  ['90,105 120,120 120,160 70,160', 'fill-foreground/5'],
]

const CREDITS: Record<ArtSource, { name: string; home: string; icon: SimpleIcon; what: string }> = {
  tmdb: { name: 'TMDB', home: TMDB_HOME, icon: siThemoviedatabase, what: 'Key art' },
  anilist: { name: 'AniList', home: ANILIST_HOME, icon: siAnilist, what: 'Pictures' },
}

function FacetArt({ style }: { style: string }) {
  return (
    <svg
      viewBox="0 0 300 200"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      class="absolute inset-0 size-full forced-color-adjust-none"
      style={style}
    >
      <rect width="300" height="200" style="fill:var(--k0)" />
      {FACETS.map(([points, tone, opacity]) => (
        <polygon points={points} style={`fill:var(--k${tone})${opacity === undefined ? '' : `;opacity:${opacity}`}`} />
      ))}
    </svg>
  )
}

export function WorkArt({
  art,
  facets,
  sizes,
  eager = false,
  shade,
  class: className,
}: {
  art: KeyArt | null
  facets: string
  sizes: string
  eager?: boolean
  shade: 'card' | 'hero'
  class?: string
}) {
  return (
    <div aria-hidden="true" data-slot="work-art" class={cn('overflow-hidden bg-muted', className)}>
      {art ? (
        <img
          src={art.src}
          srcset={art.srcset ?? undefined}
          sizes={art.srcset ? sizes : undefined}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          fetchpriority={eager ? 'high' : undefined}
          decoding="async"
          class="absolute inset-0 size-full object-cover"
        />
      ) : (
        <FacetArt style={facets} />
      )}
      <span data-slot="work-art-shade" data-shade={shade} />
    </div>
  )
}

export function SlotArt({ picture }: { picture: string | null }) {
  return picture ? (
    <img src={picture} alt="" loading="lazy" decoding="async" class="absolute inset-0 size-full object-cover" />
  ) : (
    <svg
      viewBox="0 0 120 160"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      class="absolute inset-0 size-full"
    >
      {SLOT_FACETS.map(([points, tint]) => (
        <polygon points={points} class={tint} />
      ))}
    </svg>
  )
}

export function ArtCredit({ from, class: className }: { from: ArtSource[]; class?: string }) {
  if (from.length === 0) return null

  return (
    <p class={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground', className)}>
      {from.map((source) => {
        const { name, home, icon, what } = CREDITS[source]

        return (
          <span class="inline-flex items-center gap-1.5">
            <span safe>{`${what} from`}</span>
            <a
              href={home}
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1 text-soft-foreground transition-colors hover:text-foreground"
            >
              <BrandIcon icon={icon} class="size-3.5 flex-none" />
              <span safe>{name}</span>
              <NewTab class="size-3" />
            </a>
          </span>
        )
      })}
      {from.includes('tmdb') ? (
        <span>
          This site uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.
        </span>
      ) : null}
    </p>
  )
}
