import type { KeyArt } from '@/lib/art'
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

function ArtImage({
  art,
  sizes,
  eager,
  class: className,
}: {
  art: KeyArt
  sizes: string
  eager: boolean
  class?: string
}) {
  return (
    <img
      src={art.src}
      srcset={art.srcset ?? undefined}
      sizes={art.srcset ? sizes : undefined}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      fetchpriority={eager ? 'high' : undefined}
      decoding="async"
      class={cn('absolute inset-0 size-full object-cover', className)}
    />
  )
}

export function WorkArt({
  art,
  facets,
  sizes,
  eager = false,
  class: className,
}: {
  art: KeyArt | null
  facets: string
  sizes: string
  eager?: boolean
  class?: string
}) {
  return (
    <div aria-hidden="true" data-slot="work-art" class={cn('overflow-hidden bg-muted', className)}>
      {art ? <ArtImage art={art} sizes={sizes} eager={eager} /> : <FacetArt style={facets} />}
    </div>
  )
}

export function WorkHero({ art, facets, sizes }: { art: KeyArt | null; facets: string; sizes: string }) {
  return (
    <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-0 -z-10">
      {art ? (
        <div data-slot="work-glow" class="absolute inset-x-0 top-0 h-375 overflow-hidden max-sm:h-275">
          <ArtImage art={art} sizes={sizes} eager />
        </div>
      ) : null}
      <div data-slot="work-hero" class="absolute inset-x-0 top-0 h-175 overflow-hidden max-sm:h-135">
        {art ? <ArtImage art={art} sizes={sizes} eager class="object-[50%_26%]" /> : <FacetArt style={facets} />}
      </div>
    </div>
  )
}

export function SlotArt({ picture }: { picture: string | null }) {
  return picture ? (
    <img
      src={picture}
      alt=""
      loading="lazy"
      decoding="async"
      class="absolute inset-0 size-full object-cover object-[50%_16%]"
    />
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
