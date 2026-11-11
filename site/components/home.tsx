import type { PropsWithChildren } from '@kitajs/html'
import type { Facts } from '@/lib/facts'
import type { HomeFeatures } from '@/lib/home-features'
import { castOf } from '@/lib/lead-cast'
import { json } from '@/lib/render'
import type { Theme } from '@/lib/themes'
import { leadsOf } from '@/lib/works'
import { ArtCallDialog } from './art-call'
import { CommandRow, InitRow } from './command-row'
import { CharacterCard, CommunityCard, FreeCard, MakeCard, PictureCard } from './home-features'
import { LeadCredits, LeadHero, LeadWorld } from './lead-stage'
import { LandingFooter } from './site-footer'
import { SiteHeader } from './site-header'
import { FIRST_TABS, TabWindow } from './tab-window'
import { TerminalList } from './terminal-list'

const STEPS = [
  {
    title: 'install',
    text: 'Needs Node 22+ and zsh. Asks which terminals and palettes to bring, shows every file it will change, and writes nothing until you confirm.',
  },
  {
    title: 'browse',
    text: 'Pick more in Browse, the second tab of ttheme, work by work.',
    command: 'ttheme',
  },
]

function Step({ number, title, text, children }: PropsWithChildren<{ number: number; title: string; text: string }>) {
  return (
    <li class="flex min-w-0 flex-col gap-2.5 p-6 not-first:border-l max-[1080px]:not-first:border-t max-[1080px]:not-first:border-l-0">
      <span class="flex items-baseline gap-2.5">
        <span class="font-mono text-sm text-muted-foreground">{number}</span>
        <span class="font-display text-display-sm font-black" safe>
          {title}
        </span>
      </span>
      <p class="text-sm text-pretty text-soft-foreground" safe>
        {text}
      </p>
      <div class="mt-auto pt-1">{children}</div>
    </li>
  )
}

export function LeadUse({ theme }: { theme: Theme }) {
  return <CommandRow command={`ttheme use ${theme.name}`} />
}

function PerTab({ leads }: { leads: Theme[] }) {
  const tabs = leads.slice(0, FIRST_TABS).map((theme, id) => ({ id, theme }))

  return (
    <tab-showcase class="col-span-2 row-span-2 flex min-w-0 flex-col max-[640px]:col-span-1">
      <TabWindow tabs={tabs} active={0} next={leads[FIRST_TABS % leads.length] as Theme} />
    </tab-showcase>
  )
}

export function Home({
  themes,
  features,
  facts,
  terminals,
  stickers,
}: {
  themes: Theme[]
  features: HomeFeatures
  facts: Facts
  terminals: Record<string, string>
  stickers: Record<string, string>
}) {
  const leads = leadsOf(themes)
  const cast = castOf(themes)
  const theme = cast[0] as Theme

  return (
    <lead-showcase class="flex min-h-dvh flex-col">
      <SiteHeader current="/" facts={facts} />
      <main id="content" class="grid grid-cols-[minmax(0,1fr)]">
        <div data-lead-stage>
          <LeadWorld stickers={stickers} />
          <LeadCredits />
          <LeadHero cast={cast} />
          <div data-lead-sheet>
            <section
              aria-labelledby="features"
              class="mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-12 py-12 lead-stacked:gap-4 lead-stacked:pt-18"
            >
              <h2 id="features" class="font-display text-display-lg font-black">
                everything a tab needs
              </h2>
              <feature-cards class="grid auto-rows-[16.75rem] grid-cols-3 gap-4 max-[960px]:grid-cols-2 max-[640px]:grid-cols-1">
                <PerTab leads={leads} />
                <CharacterCard characters={features.characters} />
                <CommunityCard community={features.community} />
                <PictureCard picture={features.picture} />
                <MakeCard />
                <FreeCard />
              </feature-cards>
            </section>
          </div>
        </div>

        <div class="mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-5">
          <TerminalList icons={terminals} />

          <section aria-labelledby="install" class="grid gap-6 py-12">
            <h2 id="install" class="font-display text-display-lg font-black">
              three commands
            </h2>
            <ol class="grid grid-cols-3 rounded-3xl border bg-card shadow-sm max-[1080px]:grid-cols-1">
              {STEPS.map((step, index) => (
                <Step number={index + 1} title={step.title} text={step.text}>
                  {step.command ? <CommandRow command={step.command} /> : <InitRow />}
                </Step>
              ))}
              <Step number={3} title="use" text="This tab only. Every other tab keeps its own.">
                <div data-lead-use class="contents">
                  <LeadUse theme={theme} />
                </div>
              </Step>
            </ol>
          </section>
        </div>
      </main>
      <LandingFooter facts={facts} />
      <ArtCallDialog lead={theme} sticker={stickers[theme.name] as string} />
      <kaomoji-rain>
        <div aria-hidden="true" class="pointer-events-none fixed inset-0 z-50 overflow-hidden" />
      </kaomoji-rain>
      <script type="application/json" data-leads>
        {json(leads)}
      </script>
      <script type="application/json" data-cast>
        {json(cast)}
      </script>
    </lead-showcase>
  )
}
