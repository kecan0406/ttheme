import type { PropsWithChildren } from '@kitajs/html'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide'
import { Badge } from '@/components/ui/badge'
import { Button, LinkButton } from '@/components/ui/button'
import type { Facts } from '@/lib/facts'
import { Icon } from '@/lib/icons'
import { json } from '@/lib/render'
import type { Theme } from '@/lib/themes'
import { headlineEm } from '@/lib/wear'
import { CommandRow, INIT } from './command-row'
import { Signature } from './palette-parts'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'
import { TerminalPreview } from './terminal-preview'

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
      emoji: '🗂️',
      title: 'a different one per tab',
      text: 'ttheme use paints just this tab, and ttheme pin keeps a palette for a folder.',
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
    text: "Sets up the shell layer and your terminal's config, then asks which palettes to bring.",
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

function LeadPreview({ theme }: { theme: Theme }) {
  return (
    <div data-lead-preview>
      <TerminalPreview
        theme={theme}
        scene="shell"
        worn
        own
        class="min-h-60 px-6 pt-5 pb-6 text-sm [overflow-wrap:anywhere] whitespace-pre-wrap max-[640px]:px-4.5 max-[400px]:min-h-62"
      />
    </div>
  )
}

export function LeadUse({ theme }: { theme: Theme }) {
  return <CommandRow command={`ttheme use ${theme.name}`} class="bg-card" />
}

export function Home({ themes, facts }: { themes: Theme[]; facts: Facts }) {
  const leads = themes.filter((theme) => theme.lead)
  const theme = leads[0] as Theme

  return (
    <lead-showcase class="ground flex min-h-dvh flex-col">
      <SiteHeader current="/" />
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
              Windows Terminal, Warp, Konsole and Terminal.app. One command, then every tab can wear its own.
            </p>
            <div class="flex w-full flex-wrap items-center gap-3">
              <LinkButton variant="pop" size="lg" href="/marketplace">
                browse the palettes
                <Icon node={ArrowRight} />
              </LinkButton>
              <CommandRow command={INIT} class="min-w-70 flex-1 bg-card" />
            </div>
          </div>

          <div class="grid grid-cols-[minmax(0,1fr)] gap-4">
            <div data-lead-window class="overflow-hidden rounded-3xl border border-input bg-card shadow-lg">
              <div class="relative flex items-center gap-2 border-b px-4 py-2.5">
                <span aria-hidden="true" class="flex gap-1.5">
                  <i class="size-2.5 rounded-full bg-(--a1)" />
                  <i class="size-2.5 rounded-full bg-(--a3)" />
                  <i class="size-2.5 rounded-full bg-(--a2)" />
                </span>
                <span
                  data-lead-title
                  aria-hidden="true"
                  translate="no"
                  class="min-w-0 flex-1 truncate text-center font-mono text-xs text-muted-foreground"
                >
                  ttheme · <span data-text="name" /> · <span data-text="catalog" />
                </span>
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
              </div>
              <LeadPreview theme={theme} />
            </div>
            <div aria-hidden="true" class="flex items-center justify-center gap-1.5 px-1">
              {SLOTS.map((slot) => (
                <i
                  class="block h-2.5 min-w-1.5 rounded-full inset-ring inset-ring-foreground/16 motion-safe:animate-dance"
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
            {features(facts.palettes, facts.catalogs).map((feature) => (
              <article class="row-span-3 grid grid-rows-subgrid gap-2 rounded-3xl border bg-muted p-6">
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
            <p class="text-soft-foreground">The page wears whichever you pick, the way your terminal would.</p>
          </div>
          <div
            role="radiogroup"
            aria-labelledby="characters"
            class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3"
          >
            {leads.map((lead, index) => (
              <label
                data-lead={String(index)}
                translate="no"
                style={`background:${lead.background};color:${lead.foreground}`}
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
                  style={`color:${lead.cursor}`}
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
            <Step number={3} title="wear" text="Paints this tab. Every other tab keeps its own.">
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
