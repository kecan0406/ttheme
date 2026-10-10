import type { PropsWithChildren } from '@kitajs/html'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide'
import { Badge } from '@/components/ui/badge'
import { Button, LinkButton } from '@/components/ui/button'
import { Icon } from '@/lib/icons'
import { json } from '@/lib/render'
import type { Theme } from '@/lib/themes'
import { wearStyle } from '@/lib/wear'
import { CommandRow, INIT } from './command-row'
import { Signature } from './palette-parts'
import { SiteHeader } from './site-header'
import { TerminalPreview } from './terminal-preview'

const SLOTS = Array.from({ length: 16 }, (_, index) => index)

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
      text: "Tint a picture into the palette's background, as faint as its contrast floors allow.",
    },
    {
      emoji: '✅',
      title: 'readable by design',
      text: 'Every official palette clears the contrast gate: nine floors, measured on every build.',
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
    <li class="grid content-start gap-3 rounded-3xl border bg-muted p-6">
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

export function LeadPreview({ theme }: { theme: Theme }) {
  return (
    <div data-lead-preview>
      <TerminalPreview theme={theme} scene="shell" worn class="min-h-60 px-6 pt-5 pb-6 text-sm" />
    </div>
  )
}

export function LeadUse({ theme }: { theme: Theme }) {
  return <CommandRow command={`ttheme use ${theme.name}`} class="bg-card" />
}

export function Home({ themes, catalogs }: { themes: Theme[]; catalogs: number }) {
  const leads = themes.filter((theme) => theme.lead)
  const theme = leads[0] as Theme

  return (
    <lead-showcase class="wear ground block min-h-dvh" style={wearStyle(theme)}>
      <div class="mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-5 pt-4.5">
        <SiteHeader current="/" themeToggle={false} />

        <section
          aria-label="ttheme"
          class="grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-center gap-12 pt-14 pb-10 max-[960px]:grid-cols-[minmax(0,1fr)] max-[960px]:pt-8"
        >
          <div class="grid justify-items-start gap-6">
            <Badge variant="sticker">
              {themes.length} palettes · {catalogs} catalogs ✦
            </Badge>
            <h1 class="font-display text-display-xl font-black">
              wear{' '}
              <sparkle-burst class="relative inline-block" data-colors={JSON.stringify(theme.signature)}>
                <span data-lead-name class="text-primary" safe>
                  {theme.name}
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

          <div class="grid gap-4">
            <div class="overflow-hidden rounded-3xl border border-input bg-card shadow-lg">
              <div class="flex items-center gap-2 border-b px-4 py-2.5">
                <span aria-hidden="true" class="flex gap-1.5">
                  <i class="size-2.5 rounded-full bg-(--a1)" />
                  <i class="size-2.5 rounded-full bg-(--a3)" />
                  <i class="size-2.5 rounded-full bg-(--a2)" />
                </span>
                <span
                  data-lead-title
                  class="min-w-0 flex-1 truncate text-center font-mono text-xs text-muted-foreground"
                  safe
                >
                  {`ttheme · ${theme.name} · ${theme.catalog ?? ''}`}
                </span>
                <Button variant="ghost" size="icon-sm" aria-label="previous palette" data-pick="-1">
                  <Icon node={ChevronLeft} />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="next palette" data-pick="1">
                  <Icon node={ChevronRight} />
                </Button>
              </div>
              <LeadPreview theme={theme} />
            </div>
            <div aria-hidden="true" class="flex flex-wrap items-center gap-1.5 px-1">
              {SLOTS.map((slot) => (
                <i
                  class="block h-2.5 rounded-full motion-safe:animate-dance"
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
            {features(themes.length, catalogs).map((feature) => (
              <article class="grid content-start gap-2 rounded-3xl border bg-muted p-6">
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
          <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {leads.map((lead, index) => (
              <button
                type="button"
                data-lead={String(index)}
                aria-pressed={String(index === 0)}
                style={`background:${lead.background};color:${lead.foreground}`}
                class="grid grid-cols-[minmax(0,1fr)] gap-1 rounded-2xl border border-[color-mix(in_oklab,currentColor_14%,transparent)] px-4 pt-3.5 pb-4 text-left transition-transform duration-200 outline-none hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-98 active:duration-500 active:ease-spring aria-pressed:ring-2 aria-pressed:ring-ring aria-pressed:ring-offset-2 aria-pressed:ring-offset-background motion-reduce:hover:translate-y-0"
              >
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
                  <Signature theme={lead} />
                </span>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="install" class="grid gap-6 py-12">
          <h2 id="install" class="font-display text-display-lg font-black">
            three commands
          </h2>
          <ol class="grid grid-cols-3 gap-4 max-[960px]:grid-cols-1">
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

        <footer class="flex flex-wrap items-center justify-between gap-4 border-t py-8 text-sm text-muted-foreground">
          <span>free and open, MIT</span>
          <nav aria-label="more" class="flex flex-wrap gap-4">
            <a href="/marketplace" class="hover:text-foreground">
              marketplace
            </a>
            <a href="/sheets" class="hover:text-foreground">
              sheets
            </a>
            <a href="https://github.com/kecan0406/ttheme" class="hover:text-foreground">
              github
            </a>
            <a href="https://www.npmjs.com/package/@kecan0406/ttheme" class="hover:text-foreground">
              npm
            </a>
          </nav>
        </footer>
      </div>
      <kaomoji-rain>
        <div aria-hidden="true" class="pointer-events-none fixed inset-0 z-50 overflow-hidden" />
      </kaomoji-rain>
      <script type="application/json" data-leads>
        {json(leads)}
      </script>
    </lead-showcase>
  )
}
