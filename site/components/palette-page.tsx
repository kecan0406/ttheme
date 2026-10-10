import { escapeHtml, type PropsWithChildren } from '@kitajs/html'
import { Layers, Store } from 'lucide'
import { Badge, badgeVariants } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Facts } from '@/lib/facts'
import { catalogPath, marketplacePath, OFFICIAL } from '@/lib/gallery'
import { Icon } from '@/lib/icons'
import { gatePassed, lightness } from '@/lib/sheet'
import type { GateRule, Marketplace, Theme } from '@/lib/themes'
import { cn } from '@/lib/utils'
import { isLight, wearStyle } from '@/lib/wear'
import { CommandRow, INIT } from './command-row'
import { type Crumb, Crumbs, MarketplaceFrame } from './marketplace-frame'
import { GateList, SectionHead, Signature, SLOTS, Swatch } from './palette-parts'
import { PaletteRow } from './palette-rows'
import { SCENES, type Scene, TerminalPreview } from './terminal-preview'

type Step = 'add' | 'use' | 'init'

const STEP_SHOWN: Record<Step, string> = {
  add: 'group-has-[input[value=add]:checked]/install:grid',
  use: 'group-has-[input[value=use]:checked]/install:grid',
  init: 'group-has-[input[value=init]:checked]/install:grid',
}

const SCENE_SHOWN: Record<Scene, string> = {
  shell: 'group-has-[input[value=shell]:checked]/preview:block',
  git: 'group-has-[input[value=git]:checked]/preview:block',
  test: 'group-has-[input[value=test]:checked]/preview:block',
  colors: 'group-has-[input[value=colors]:checked]/preview:block',
}

const LIGHTS = ['--a1', '--a3', '--a2']

function steps(
  theme: Theme,
  marketplace: Marketplace | null,
): { step: Step; label: string; command: string; note: string }[] {
  return [
    {
      step: 'add',
      label: 'add',
      command: marketplace ? `ttheme add ${theme.name} --marketplace ${marketplace.add}` : `ttheme add ${theme.name}`,
      note: marketplace
        ? `Adds ${marketplace.id} to your marketplaces, then installs ${theme.name} from it.`
        : `Installs ${theme.name} from the official marketplace, which comes with ttheme.`,
    },
    {
      step: 'use',
      label: 'use',
      command: `ttheme use ${theme.id}`,
      note: 'Paints this tab once it is installed. Every other tab keeps its own.',
    },
    {
      step: 'init',
      label: 'first time',
      command: INIT,
      note: "New to ttheme? This sets up the shell layer and your terminal's config, then asks which palettes to bring.",
    },
  ]
}

function Fact({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <div class="grid gap-2">
      <dt class="text-2xs font-bold tracking-caps text-muted-foreground uppercase" safe>
        {label}
      </dt>
      <dd class="grid gap-1 text-base font-semibold [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

function Install({ theme, marketplace }: { theme: Theme; marketplace: Marketplace | null }) {
  const all = steps(theme, marketplace)
  return (
    <section aria-labelledby="install" class="group/install grid grid-cols-[minmax(0,1fr)] gap-4">
      <SectionHead title="install" id="install">
        <ToggleGroup label="install step">
          {all.map(({ step, label }) => (
            <ToggleGroupItem name="install" value={step} checked={step === 'add'}>
              {escapeHtml(label)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </SectionHead>
      {all.map(({ step, command, note }) => (
        <div class={cn('hidden gap-2', STEP_SHOWN[step])}>
          <CommandRow command={command} class="bg-card" />
          <p class="text-xs text-muted-foreground" safe>
            {note}
          </p>
        </div>
      ))}
    </section>
  )
}

function Preview({ theme }: { theme: Theme }) {
  return (
    <section aria-labelledby="preview" class="group/preview grid grid-cols-[minmax(0,1fr)] gap-4">
      <SectionHead title="preview" id="preview">
        <ToggleGroup label="scene">
          {SCENES.map((scene) => (
            <ToggleGroupItem name="scene" value={scene} checked={scene === 'shell'}>
              {scene}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </SectionHead>
      <div class="overflow-hidden rounded-3xl border border-input bg-card shadow-lg" style={wearStyle(theme)}>
        <div class="flex items-center gap-2 border-b px-4 py-2.5">
          <span aria-hidden="true" class="flex gap-1.5">
            {LIGHTS.map((slot) => (
              <i class="size-2.5 rounded-full" style={`background:var(${slot})`} />
            ))}
          </span>
          <span class="min-w-0 flex-1 truncate text-center font-mono text-xs text-muted-foreground" safe>
            {`ttheme use ${theme.id}`}
          </span>
          <span aria-hidden="true" class="w-10" />
        </div>
        {SCENES.map((scene) => (
          <div class={cn('hidden', SCENE_SHOWN[scene])}>
            <TerminalPreview theme={theme} scene={scene} worn class="min-h-60 px-6 pt-5 pb-6 text-sm" />
          </div>
        ))}
      </div>
    </section>
  )
}

function Slots({ theme }: { theme: Theme }) {
  const base = [theme.background, theme.foreground, theme.cursor, theme.selectionBackground]
  return (
    <section aria-labelledby="slots" class="grid grid-cols-[minmax(0,1fr)] gap-4">
      <SectionHead title="slots" id="slots">
        <span class="text-xs text-muted-foreground">click a color to copy it</span>
      </SectionHead>
      <div class="grid grid-cols-4 gap-2">
        {base.map((color, index) => (
          <Swatch name={SLOTS[index] ?? ''} color={color} />
        ))}
      </div>
      {[0, 8].map((start) => (
        <div class="grid grid-cols-8 gap-2 max-[760px]:grid-cols-4">
          {theme.ansi.slice(start, start + 8).map((color, index) => (
            <Swatch name={`ansi${start + index}`} color={color} />
          ))}
        </div>
      ))}
    </section>
  )
}

function About({ theme, marketplace, gate }: { theme: Theme; marketplace: Marketplace | null; gate: GateRule[] }) {
  const passed = gatePassed(theme, gate)
  return (
    <aside aria-label="about this palette">
      <dl class="grid gap-8">
        <Fact label="signature">
          <Signature theme={theme} size="lg" />
        </Fact>
        <Fact label="marketplace">
          <a
            href={marketplacePath(theme.marketplace)}
            class="inline-flex items-center gap-1.5 transition-colors hover:text-primary [&_svg]:size-4 [&_svg]:text-muted-foreground"
          >
            <Icon node={marketplace ? Store : Layers} />
            {escapeHtml(marketplace?.id ?? OFFICIAL)}
          </a>
          {marketplace ? (
            <a
              href={`https://github.com/${marketplace.repo}`}
              class="font-mono text-xs font-normal text-muted-foreground transition-colors hover:text-foreground"
              safe
            >
              {marketplace.repo}
            </a>
          ) : null}
        </Fact>
        {theme.catalog ? (
          <Fact label="catalog">
            <a href={catalogPath(theme)} class="transition-colors hover:text-primary" safe>
              {theme.catalog}
            </a>
            {theme.native ? (
              <span class="text-sm font-normal text-muted-foreground" safe>
                {theme.native}
              </span>
            ) : null}
          </Fact>
        ) : null}
        <Fact label="ANSI from">{escapeHtml(theme.ansiSource)}</Fact>
        <Fact label="background">
          {escapeHtml(`${isLight(theme) ? 'light' : 'dark'} · L* ${lightness(theme.background)}`)}
        </Fact>
        {marketplace ? (
          <>
            <Fact label="GitHub stars">{escapeHtml(String(marketplace.stars))}</Fact>
            <Fact label="license">
              {marketplace.license ? escapeHtml(marketplace.license) : <Badge variant="warning">none stated</Badge>}
            </Fact>
            <Fact label="last push">{escapeHtml(marketplace.pushedAt)}</Fact>
          </>
        ) : null}
        <Fact label="contrast gate">
          <span class="text-sm font-normal text-soft-foreground" safe>
            {`${passed} of ${gate.length} floors${marketplace ? ' · advisory, never enforced' : ''}`}
          </span>
          <GateList theme={theme} gate={gate} />
        </Fact>
      </dl>
    </aside>
  )
}

export function PalettePage({
  theme,
  marketplace,
  palettes,
  gate,
  facts,
}: {
  theme: Theme
  marketplace: Marketplace | null
  palettes: Theme[]
  gate: GateRule[]
  facts: Facts
}) {
  const id = marketplace?.id ?? OFFICIAL
  const siblings = palettes.filter((other) => other.catalog === theme.catalog && other !== theme)
  const trail: Crumb[] = [
    { label: 'marketplace', href: '/marketplace' },
    { label: id, href: marketplacePath(theme.marketplace) },
    { label: theme.name },
  ]

  return (
    <MarketplaceFrame facts={facts} ribbon={theme}>
      <header class="grid gap-4">
        <Crumbs trail={trail} />
        <h1 class="font-display text-display-lg font-black [overflow-wrap:anywhere]" safe>
          {theme.name}
        </h1>
        <div class="flex flex-wrap items-center gap-2">
          {marketplace ? (
            <span class="mr-1 font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]" safe>
              {theme.id}
            </span>
          ) : null}
          {theme.catalog ? (
            <a
              href={catalogPath(theme)}
              class={cn(badgeVariants({ variant: 'tag' }), 'transition-colors hover:text-foreground')}
              safe
            >
              {theme.catalog}
            </a>
          ) : null}
          {theme.lead ? <Badge variant="tag">lead</Badge> : null}
          <Badge variant="tag">{isLight(theme) ? 'light' : 'dark'}</Badge>
        </div>
      </header>
      <div class="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-16 max-[1024px]:grid-cols-[minmax(0,1fr)]">
        <div class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-12">
          <Install theme={theme} marketplace={marketplace} />
          <Preview theme={theme} />
          <Slots theme={theme} />
          {siblings.length > 0 ? (
            <section aria-labelledby="more" class="grid grid-cols-[minmax(0,1fr)] gap-4">
              <SectionHead title={`more in ${theme.catalog ?? id}`} id="more" />
              <div class="grid grid-cols-[minmax(0,1fr)]">
                {siblings.map((other) => (
                  <PaletteRow theme={other} gate={gate} where={marketplace !== null} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <About theme={theme} marketplace={marketplace} gate={gate} />
      </div>
    </MarketplaceFrame>
  )
}

export function NoSuchPalette({ id, name, facts }: { id: string; name: string; facts: Facts }) {
  return (
    <MarketplaceFrame facts={facts}>
      <div class="grid justify-items-start gap-3">
        <Crumbs
          trail={[
            { label: 'marketplace', href: '/marketplace' },
            { label: id, href: marketplacePath(id === OFFICIAL ? null : id) },
            { label: name },
          ]}
        />
        <h1 class="font-display text-display-lg font-black">no such palette</h1>
        <p class="max-w-[68ch] text-soft-foreground">
          {escapeHtml(`${id} has no palette named ${name}.`)} It may have been renamed or removed. ( ˘ω˘ )
        </p>
        <a
          href={marketplacePath(id === OFFICIAL ? null : id)}
          class="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          back to its marketplace
        </a>
      </div>
    </MarketplaceFrame>
  )
}
