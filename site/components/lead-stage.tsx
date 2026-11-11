import { ArrowRight } from 'lucide'
import { LinkButton } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { CREDITS_PATH } from '@/lib/art'
import { marketplacePath } from '@/lib/gallery'
import { BrandIcon, Icon } from '@/lib/icons'
import { CAST, OTHER_ART, STICKER_CREDITS, STICKER_SIZES, stickerSet } from '@/lib/lead-cast'
import { OWN_NAME } from '@/lib/sessions'
import { type Line, linesOf } from '@/lib/terminal'
import { BUILTIN, paint, type Theme } from '@/lib/themes'
import { headlineEm, wearStyle } from '@/lib/wear'
import { ArtCallPill, ArtCallTab } from './art-call'
import { InitRow } from './command-row'
import { TerminalScreen } from './terminal'
import { TerminalFrame, WINDOW_TITLE } from './terminal-frame'

const LEAD = 'use'

const PROMPT = '«6»~/dotfiles «8»main «13»❯ «»'

const USE: Line = [...(linesOf([`${PROMPT}ttheme use `])[0] ?? []), OWN_NAME]

const WINDOW_LINES: Line[] = [
  USE,
  ...linesOf([
    '«8»this tab only',
    `${PROMPT}ls -F`,
    '«12»shell/«»  «12»themes/«»  «10»setup.sh*«»  «6»zshrc@«»  «1»dist.tgz«»  todo.md',
    `${PROMPT}«c» `,
  ]),
]

export function LeadWorld({ stickers }: { stickers: Record<string, string> }) {
  return (
    <div data-lead-world aria-hidden="true">
      <div data-lead-field>
        <i data-lead-was />
        <i data-lead-solid />
      </div>
      <div data-lead-cast>
        {CAST.map((member, at) => (
          <img
            data-lead-sticker={member.name}
            data-on={String(at === 0)}
            src={at === 0 ? stickers[member.name] : undefined}
            srcset={at === 0 ? stickerSet(stickers, member.name) : undefined}
            data-src={at === 0 ? undefined : stickers[member.name]}
            data-srcset={at === 0 ? undefined : stickerSet(stickers, member.name)}
            sizes={STICKER_SIZES}
            alt=""
            width="1410"
            height="756"
            decoding="async"
            fetchpriority={at === 0 ? 'high' : undefined}
            style={`--face:${member.face.toFixed(4)};--scale:${member.scale.toFixed(4)}`}
          />
        ))}
      </div>
      <div data-lead-photo hidden />
    </div>
  )
}

export function LeadCredits() {
  return (
    <div data-lead-credits>
      {STICKER_CREDITS.map((credit, at) => (
        <p data-lead-credit={credit.name} data-on={String(at === 0)}>
          <span class="sr-only" safe>{`${credit.verb} `}</span>
          {credit.artist === null ? null : (
            <>
              <span lang={credit.japanese ? 'ja' : undefined} translate="no" safe>
                {credit.artist}
              </span>{' '}
            </>
          )}
          <a href={credit.profile} target="_blank" rel="noopener">
            <b translate="no" safe>
              {credit.handle}
            </b>
            <span class="sr-only" safe>{` on ${credit.site}`}</span>
            <span class="sr-only">, opens in a new tab</span>
          </a>
          <a href={credit.post} target="_blank" rel="noopener">
            <BrandIcon icon={credit.siteIcon} />
            <span class="sr-only" safe>{`Original post on ${credit.site}`}</span>
            <span class="sr-only">, opens in a new tab</span>
          </a>
          {credit.license === null ? null : (
            <a data-lead-license href={credit.license.url} target="_blank" rel="noopener">
              <BrandIcon icon={credit.license.icon} />
              <span class="sr-only" safe>{`${credit.license.brand} `}</span>
              <span safe>{credit.license.terms}</span>
              <span class="sr-only">, opens in a new tab</span>
            </a>
          )}
          {credit.after === null ? null : (
            <span data-lead-after>
              <span>After </span>
              <span class="sr-only" safe>{`the ${credit.after.work} cover by `}</span>
              <span lang="ja" translate="no" safe>
                {credit.after.artist}
              </span>{' '}
              <a href={credit.after.url} target="_blank" rel="noopener">
                <b translate="no" safe>
                  {credit.after.handle}
                </b>
                <span class="sr-only" safe>{` on ${credit.after.site}`}</span>
                <span class="sr-only">, opens in a new tab</span>
              </a>
            </span>
          )}
        </p>
      ))}
      <p data-lead-credit={OTHER_ART} data-on="false">
        <a href={CREDITS_PATH}>
          <b>Art credits</b>
        </a>
      </p>
    </div>
  )
}

function CastTabs({ cast }: { cast: Theme[] }) {
  return (
    <div class="mx-2 flex flex-none items-center gap-1.5">
      <RadioGroup variant="fit" label="terminal tabs" class="flex-none">
        {cast.map((theme, at) => (
        <RadioGroupItem variant="fit" name="lead-tab" value={theme.name} checked={at === 0}>
          <i
            aria-hidden="true"
            class="size-1.5 flex-none rounded-full forced-color-adjust-none"
            style={`background:${paint(theme, (shade) => shade.cursor)}`}
          />
          <span translate="no" safe>
            {theme.name}
          </span>
        </RadioGroupItem>
        ))}
      </RadioGroup>
      <ArtCallTab />
    </div>
  )
}

function CastPills({ cast }: { cast: Theme[] }) {
  return (
    <div data-lead-pills>
      <RadioGroup variant="wear" label="try a character">
        {cast.map((theme, at) => (
          <RadioGroupItem variant="wear" name="lead-pill" value={theme.name} checked={at === 0}>
            <span style={wearStyle(theme)} class="contents">
              <i aria-hidden="true" />
              <span translate="no" safe>
                {theme.name}
              </span>
            </span>
          </RadioGroupItem>
        ))}
      </RadioGroup>
      <ArtCallPill />
    </div>
  )
}

export function LeadHero({ cast }: { cast: Theme[] }) {
  const theme = cast[0] as Theme

  return (
    <section aria-label="ttheme" data-lead-hero>
      <div data-lead-copy class="@container">
        <h1 class="font-display text-display-hero font-black" style={`--lead-prefix:${headlineEm(`${LEAD} `)}`}>
          {LEAD}{' '}
          <sparkle-burst class="relative inline-block">
            <span data-lead-name translate="no">
              <span class="sr-only" safe>
                {theme.name}
              </span>
            </span>
          </sparkle-burst>
          <br />
          in your terminal
        </h1>
      </div>
      <p data-lead-about class="text-base text-pretty text-soft-foreground">
        Who's your favorite? The one from the game you keep replaying, or the anime you rewatch every year? Now you can
        be together in your terminal!
      </p>
      <div data-lead-actions>
        <LinkButton variant="lead" size="xl" href={marketplacePath(BUILTIN)}>
          Browse Palettes
          <Icon node={ArrowRight} />
        </LinkButton>
        <InitRow class="bg-muted" />
      </div>
      <CastPills cast={cast} />
      <TerminalFrame
        data-lead-window
        raised
        roomy
        heading={
          <span data-lead-title aria-hidden="true" translate="no" class={WINDOW_TITLE}>
            ttheme / <span data-text="name" /> / <span data-text="work" />
          </span>
        }
        controls={
          cast.length > 1 ? (
            <i
              data-lead-progress
              aria-hidden="true"
              class="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 origin-left scale-x-0 bg-primary opacity-0 transition-opacity duration-150 ease-[ease]"
            />
          ) : undefined
        }
      >
        <CastTabs cast={cast} />
        <TerminalScreen
          lines={WINDOW_LINES}
          decorative
          class="overflow-hidden px-4.5 pt-3 pb-4 text-code [--term-leading:1.6]"
        />
      </TerminalFrame>
    </section>
  )
}
