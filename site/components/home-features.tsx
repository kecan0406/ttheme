import { escapeHtml, type PropsWithChildren } from '@kitajs/html'
import { Badge } from '@/components/ui/badge'
import { MeltCard, MeltLink } from '@/components/ui/melt-card'
import { MARKETPLACES_PATH } from '@/lib/gallery'
import type { FeatureCharacter, FeatureCommunity, FeaturePicture } from '@/lib/home-features'
import { linesOf } from '@/lib/terminal'
import { wearStyle } from '@/lib/wear'
import { TerminalScreen } from './terminal'
import { WorkArt } from './work-art'

const ART = 'absolute inset-x-0 top-0 -z-10 h-[72%]'

const SIZES = '(min-width: 960px) 400px, (min-width: 640px) 50vw, 100vw'

const PROMPT = '«2»~ «B5»❯ «»'

function Copy({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <>
      <h3 class="font-display text-display-sm font-black" safe>
        {title}
      </h3>
      <p class="text-sm text-pretty text-soft-foreground">{children}</p>
    </>
  )
}

export function CharacterCard({ characters }: { characters: FeatureCharacter[] }) {
  return (
    <MeltCard data-who-card style={characters[0]?.look}>
      {characters.map((one, at) => (
        <WorkArt
          art={one.art}
          facets={one.facets}
          focus={one.focus}
          sizes={SIZES}
          melt
          data-who-art={String(at)}
          data-off={at === 0 ? undefined : ''}
          class={ART}
        />
      ))}
      <div class="relative grid gap-1 px-5.5 pb-5">
        <div role="radiogroup" aria-label="try a character" class="mb-2 flex gap-1.75">
          {characters.map((one, at) => (
            <label
              class="relative size-2.25 cursor-pointer rounded-full ring-2 ring-background/60 transition-[width] duration-200 ease-spring forced-color-adjust-none before:absolute before:-inset-x-1 before:-inset-y-3.5 has-checked:w-6.5 has-focus-visible:ring-2 has-focus-visible:ring-foreground motion-reduce:transition-none"
              style={`background:${one.dot}`}
            >
              <input
                type="radio"
                class="sr-only"
                name="who-card"
                value={String(at)}
                checked={at === 0}
                aria-label={one.name}
                data-look={one.look}
              />
            </label>
          ))}
        </div>
        <Copy title="a palette per character">
          Each one built around the character, with three signature colors you'll recognise at a glance.
        </Copy>
      </div>
    </MeltCard>
  )
}

export function CommunityCard({ community }: { community: FeatureCommunity | null }) {
  return (
    <MeltLink href={MARKETPLACES_PATH} style={community?.look}>
      {community ? (
        <>
          <span data-melt aria-hidden="true" class={`${ART} grid grid-cols-2 grid-rows-2 gap-0.5`}>
            {community.covers.map((cover) => (
              <WorkArt art={cover.art} facets={cover.facets} focus={cover.focus} sizes="200px" class="relative" />
            ))}
          </span>
          <Badge variant="glass" translate="no" class="absolute top-3 left-3 font-mono">
            {escapeHtml(community.id)}
          </Badge>
        </>
      ) : null}
      <div class="relative grid gap-1 px-5.5 pb-5">
        <Copy title="more from the community">
          Browse palettes other fans publish, and add a whole marketplace with one command.
        </Copy>
      </div>
    </MeltLink>
  )
}

export function PictureCard({ picture }: { picture: FeaturePicture | null }) {
  return (
    <MeltCard
      data-strength-card
      style={picture ? `${wearStyle(picture.theme)};--strength:0.55;--pictured:88% 30%` : undefined}
    >
      {picture ? (
        <>
          <span
            data-slot="tint"
            aria-hidden="true"
            class="absolute inset-0 -z-20 overflow-hidden bg-(--cu) opacity-(--strength)"
          >
            <img
              src={picture.art.src}
              srcset={picture.art.srcset ?? undefined}
              sizes={picture.art.srcset ? SIZES : undefined}
              alt=""
              loading="lazy"
              decoding="async"
              class="size-full object-cover object-(--pictured) mix-blend-luminosity"
            />
          </span>
          <span data-slot="tint-fade" aria-hidden="true" class="absolute inset-0 -z-10" />
          <TerminalScreen
            decorative
            lines={linesOf([`${PROMPT}ttheme use ${picture.theme.name}`, '«8»this tab only', `${PROMPT}«c» `])}
            class="pointer-events-none absolute top-3.5 left-5.5 text-code"
          />
          <label class="absolute top-23 left-5.5 inline-flex h-7 items-center gap-2 rounded-full bg-glass px-3 text-xs font-medium inset-ring inset-ring-foreground/14 backdrop-blur-[14px] backdrop-saturate-130">
            strength
            <input
              type="range"
              min="15"
              max="100"
              value="55"
              autocomplete="off"
              aria-label="how strongly the picture shows"
              data-strength
              class="w-21 accent-primary"
            />
          </label>
        </>
      ) : null}
      <div class="relative grid gap-1 px-5.5 pb-5">
        <Copy title="a picture behind the text">
          Tint a picture into the palette's background and set how strongly it shows behind the text.
        </Copy>
      </div>
    </MeltCard>
  )
}

export function MakeCard() {
  return (
    <MeltLink href="/builder">
      <span data-slot="stripes" data-melt aria-hidden="true" class="absolute inset-x-0 top-0 -z-10 h-2/3" />
      <div class="relative grid gap-1 px-5.5 pb-5">
        <Copy title="make your own">
          <code class="font-mono text-code text-foreground">ttheme new</code> opens a palette editor in your terminal,
          and <code class="font-mono text-code text-foreground">ttheme share</code> turns the result into a link anyone
          can open.
        </Copy>
      </div>
    </MeltLink>
  )
}

export function FreeCard() {
  return (
    <MeltCard class="justify-between max-[960px]:col-span-2 max-[640px]:col-span-1">
      <span aria-hidden="true" class="px-5.5 pt-4.5 font-display text-display-xl font-black text-foreground/18">
        MIT
      </span>
      <div class="grid gap-1 px-5.5 pb-5">
        <Copy title="free and open">MIT licensed, free to use and to change.</Copy>
      </div>
    </MeltCard>
  )
}
