import type { PropsWithChildren } from '@kitajs/html'
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide'
import { Badge } from '@/components/ui/badge'
import { Button, LinkButton } from '@/components/ui/button'
import type { Facts } from '@/lib/facts'
import { INIT, marketplacePath } from '@/lib/gallery'
import { Icon } from '@/lib/icons'
import { json } from '@/lib/render'
import { paint, type Theme } from '@/lib/themes'
import { headlineEm } from '@/lib/wear'
import { HeroScenes } from './cli-scenes'
import { CommandRow } from './command-row'
import { Signature } from './palette-parts'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'
import { FIRST_TABS, TabWindow } from './tab-window'
import { TerminalFrame, WINDOW_TITLE } from './terminal-frame'

const SLOTS = Array.from({ length: 16 }, (_, index) => index)

const LEAD = 'wear'

function features(palettes: number, catalogs: number) {
  return [
    {
      emoji: '🎨',
      title: 'a palette per character',
      text: `${palettes} palettes across ${catalogs} catalogs, each measured from the character's official art, with three signature colors you will recognise.`,
    },
    {
      emoji: '🖥️',
      title: 'every terminal you use',
      text: 'Ghostty, iTerm2, WezTerm, kitty, Alacritty, Windows Terminal, Warp, Konsole and Terminal.app, all wired by one init.',
    },
    {
      emoji: '🖼️',
      title: 'a picture behind the text',
      text: "Tint a picture into the palette's background and set how strongly it shows behind the text.",
    },
    {
      emoji: '🛠️',
      title: 'make your own',
      text: 'ttheme new opens a palette editor in your terminal, and ttheme share turns the result into a link anyone can open.',
    },
    {
      emoji: '🍀',
      title: 'free and open',
      text: 'MIT licensed, and anyone can publish a marketplace of their own palettes from a GitHub repository.',
    },
  ]
}

const STEPS = [
  {
    title: 'install',
    text: 'Needs Node 22+ and zsh. Asks which terminals and palettes to bring, shows every file it will change, and writes nothing until you confirm.',
    command: INIT,
  },
  {
    title: 'browse',
    text: 'Pick more in Browse, the second tab of ttheme, catalog by catalog.',
    command: 'ttheme',
  },
]

function Step({ number, title, text, children }: PropsWithChildren<{ number: number; title: string; text: string }>) {
  return (
    <li class="row-span-3 grid grid-rows-subgrid gap-3 rounded-3xl border bg-muted p-6">
      <span class="flex items-center gap-3">
        <span class="grid size-8 place-items-center rounded-full bg-primary font-display text-sm font-black text-primary-foreground">
          {number}
        </span>
        <span class="font-display text-base font-extrabold" safe>
          {title}
        </span>
      </span>
      <p class="text-sm text-soft-foreground" safe>
        {text}
      </p>
      {children}
    </li>
  )
}

export function LeadUse({ theme }: { theme: Theme }) {
  return <CommandRow command={`ttheme use ${theme.name}`} class="bg-card" />
}

function PerTab({ leads }: { leads: Theme[] }) {
  const tabs = leads.slice(0, FIRST_TABS).map((theme, id) => ({ id, theme }))

  return (
    <article class="col-span-2 row-span-2 grid content-start gap-4.5 rounded-3xl border bg-muted p-6 max-[640px]:col-span-1">
      <div class="grid gap-2">
        <span class="text-3xl" role="img" aria-hidden="true">
          🗂️
        </span>
        <h3 class="font-display text-base font-extrabold">a different one per tab</h3>
      </div>
      <tab-showcase class="grid gap-2.5">
        <TabWindow tabs={tabs} active={0} next={leads[FIRST_TABS % leads.length] as Theme} />
        <p class="text-xs text-muted-foreground">+ opens a tab on the next palette</p>
      </tab-showcase>
    </article>
  )
}

export function Home({ themes, facts }: { themes: Theme[]; facts: Facts }) {
  const leads = themes.filter((theme) => theme.lead)
  const theme = leads[0] as Theme

  return (
    <lead-showcase class="ground flex min-h-dvh flex-col">
      <SiteHeader current="/" facts={facts} />
      <main id="content" class="mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-5 pt-5">
        <section
          aria-label="ttheme"
          data-lead-hero
          class="grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-center gap-12 pt-14 pb-10 max-[960px]:grid-cols-[minmax(0,1fr)] max-[960px]:pt-8"
        >
          <div class="@container grid justify-items-start gap-6">
            <Badge variant="sticker">
              {facts.palettes} palettes · {facts.catalogs} catalogs <span aria-hidden="true">✦</span>
            </Badge>
            <h1 class="font-display text-display-xl font-black" style={`--lead-prefix:${headlineEm(`${LEAD} `)}`}>
              {LEAD}{' '}
              <sparkle-burst class="relative inline-block">
                <span data-lead-name translate="no" class="text-primary">
                  <span class="sr-only" safe>
                    {theme.name}
                  </span>
                </span>
              </sparkle-burst>
              <br />
              in your terminal
            </h1>
            <p class="max-w-[52ch] text-base text-soft-foreground">
              Character color palettes, measured from official art, for Ghostty, iTerm2, WezTerm, kitty, Alacritty,
              Windows Terminal, Warp, Konsole and Terminal.app. One command, then every tab can show its own.
            </p>
            <div class="grid w-full gap-2.5">
              <div class="flex w-full flex-wrap items-center gap-3">
                <LinkButton variant="pop" size="lg" href={marketplacePath(null)}>
                  browse the palettes
                  <Icon node={ArrowRight} />
                </LinkButton>
                <CommandRow command={INIT} class="min-w-70 flex-1 bg-card" />
              </div>
              <p class="text-xs text-muted-foreground">
                Needs Node 22+ and zsh · shows every file it changes before writing ·{' '}
                <code class="font-mono">uninstall</code> in place of <code class="font-mono">init</code> undoes it
              </p>
            </div>
          </div>

          <div class="grid grid-cols-[minmax(0,1fr)] gap-4">
            <TerminalFrame
              data-lead-window
              raised
              heading={
                <span data-lead-title aria-hidden="true" translate="no" class={WINDOW_TITLE}>
                  ttheme · <span data-text="name" /> · <span data-text="catalog" />
                </span>
              }
              controls={
                <>
                  <Button variant="ghost" size="icon-sm" data-lead-rotate data-cycle="on" class="motion-reduce:hidden">
                    <span data-when="on" class="contents">
                      <Icon node={Pause} />
                      <span class="sr-only">stop the palette cycle</span>
                    </span>
                    <span data-when="off" class="contents">
                      <Icon node={Play} />
                      <span class="sr-only">start the palette cycle</span>
                    </span>
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="previous palette" data-pick="-1">
                    <Icon node={ChevronLeft} />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="next palette" data-pick="1">
                    <Icon node={ChevronRight} />
                  </Button>
                  <i
                    data-lead-progress
                    aria-hidden="true"
                    class="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 origin-left scale-x-0 bg-primary opacity-0 transition-opacity duration-150 ease-[ease]"
                  />
                </>
              }
            >
              <HeroScenes theme={theme} />
            </TerminalFrame>
            <div aria-hidden="true" class="flex items-center justify-center gap-1.5 px-1">
              {SLOTS.map((slot) => (
                <i
                  class="block h-2.5 min-w-1.5 rounded-full inset-ring inset-ring-foreground/16 forced-color-adjust-none motion-safe:animate-dance"
                  style={`background:var(--a${slot});width:${slot % 3 === 0 ? 28 : 12}px;animation-delay:${slot * -0.6}s`}
                />
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="features" class="grid gap-6 py-12">
          <h2 id="features" class="font-display text-display-lg font-black">
            everything a tab needs
          </h2>
          <div class="grid grid-cols-3 gap-4 max-[960px]:grid-cols-2 max-[640px]:grid-cols-1">
            <PerTab leads={leads} />
            {features(facts.palettes, facts.catalogs).map((feature) => (
              <article class="grid content-start gap-2 rounded-3xl border bg-muted p-6 max-[960px]:last:col-span-2 max-[640px]:last:col-span-1">
                <span class="text-3xl" role="img" aria-hidden="true" safe>
                  {feature.emoji}
                </span>
                <h3 class="font-display text-base font-extrabold" safe>
                  {feature.title}
                </h3>
                <p class="text-sm text-soft-foreground" safe>
                  {feature.text}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="characters" class="grid gap-6 py-12">
          <div class="grid gap-2">
            <h2 id="characters" class="font-display text-display-lg font-black">
              pick a character
            </h2>
            <p class="text-soft-foreground">The page shows whichever you pick, the way your terminal would.</p>
          </div>
          <div
            role="radiogroup"
            aria-labelledby="characters"
            class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3"
          >
            {leads.map((lead, index) => (
              <label
                translate="no"
                style={`background:${paint(lead, (shade) => shade.background)};color:${paint(lead, (shade) => shade.foreground)}`}
                class="grid cursor-pointer grid-cols-[minmax(0,1fr)] gap-1 rounded-2xl border border-[color-mix(in_oklab,currentColor_14%,transparent)] px-4 pt-3.5 pb-4 shadow-sm transition-[translate,scale,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-98 active:duration-500 active:ease-spring has-checked:ring-2 has-checked:ring-ring has-checked:ring-offset-2 has-checked:ring-offset-background has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-ring motion-reduce:hover:translate-y-0"
              >
                <input
                  type="radio"
                  name="lead"
                  value={lead.name}
                  checked={index === 0}
                  autocomplete="off"
                  class="sr-only"
                />
                <span
                  class="font-display text-display-sm font-black [overflow-wrap:anywhere]"
                  style={`color:${paint(lead, (shade) => shade.cursor)}`}
                  safe
                >
                  {lead.name}
                </span>
                <span class="flex items-center justify-between gap-2">
                  <span class="min-w-0 truncate text-xs opacity-70" safe>
                    {lead.catalog}
                  </span>
                  <span aria-hidden="true">
                    <Signature theme={lead} />
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section aria-labelledby="install" class="grid gap-6 py-12">
          <h2 id="install" class="font-display text-display-lg font-black">
            three commands
          </h2>
          <ol class="grid grid-cols-3 gap-4 max-[1080px]:grid-cols-1">
            {STEPS.map((step, index) => (
              <Step number={index + 1} title={step.title} text={step.text}>
                <CommandRow command={step.command} class="bg-card" />
              </Step>
            ))}
            <Step number={3} title="use" text="This tab only. Every other tab keeps its own.">
              <div data-lead-use class="contents">
                <LeadUse theme={theme} />
              </div>
            </Step>
          </ol>
        </section>
      </main>
      <SiteFooter facts={facts} current="/" landing />
      <kaomoji-rain>
        <div aria-hidden="true" class="pointer-events-none fixed inset-0 z-50 overflow-hidden" />
      </kaomoji-rain>
      <script type="application/json" data-leads>
        {json(leads)}
      </script>
    </lead-showcase>
  )
}
