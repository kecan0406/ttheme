import { escapeHtml } from '@kitajs/html'
import { ArrowLeft, ArrowRight, Check, ChevronRight, Search, Star, TriangleAlert } from 'lucide'
import { type SimpleIcon, siGithub, siNpm } from 'simple-icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { catalogsOf, nativeLang } from '@/lib/catalogs'
import type { Facts } from '@/lib/facts'
import { INIT, NPM_URL, OFFICIAL, OFFICIAL_URL, palettePath, searchable } from '@/lib/gallery'
import { BrandIcon, Icon, NewTab } from '@/lib/icons'
import { json } from '@/lib/render'
import { gatePassed } from '@/lib/sheet'
import { type GateRule, type Marketplace, paint, type Theme } from '@/lib/themes'
import { cn, plural } from '@/lib/utils'
import { wearStyle } from '@/lib/wear'
import { leadOf, neighbors, type Where, type WorkspaceData } from '@/lib/workspace'
import { ByMode } from './by-mode'
import { CommandRow } from './command-row'
import { GateList, SwatchGrid } from './palette-parts'
import { SiteHeader } from './site-header'
import { TerminalFrame } from './terminal-frame'
import { SCENES, type Scene, TerminalPreview } from './terminal-preview'

type Step = 'add' | 'use' | 'init'

const STEPS: { step: Step; label: string }[] = [
  { step: 'add', label: 'add' },
  { step: 'use', label: 'use' },
  { step: 'init', label: 'first time' },
]

const STEP_SHOWN: Record<Step, string> = {
  add: 'group-has-[input[value=add]:checked]/install:flex',
  use: 'group-has-[input[value=use]:checked]/install:flex',
  init: 'group-has-[input[value=init]:checked]/install:flex',
}

type View = 'all' | Scene

const VIEWS: View[] = ['all', ...SCENES]

const VIEW_SHOWN: Record<View, string> = {
  all: 'group-has-[input[value=all]:checked]/preview:grid',
  shell: 'group-has-[input[value=shell]:checked]/preview:block',
  git: 'group-has-[input[value=git]:checked]/preview:block',
  test: 'group-has-[input[value=test]:checked]/preview:block',
  colors: 'group-has-[input[value=colors]:checked]/preview:block',
}

const LINKS: { label: string; href: string; brand?: SimpleIcon }[] = [
  { label: 'github', href: OFFICIAL_URL, brand: siGithub },
  { label: 'npm', href: NPM_URL, brand: siNpm },
  { label: 'report a bug', href: `${OFFICIAL_URL}/issues/new/choose` },
]

const POPOVER =
  'm-0 w-96 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg inset-auto open:flex'

function commandOf(step: Step, theme: Theme, where: Where): string {
  if (step === 'init') return INIT

  if (step === 'use') return `ttheme use ${theme.id}`

  return where ? `ttheme marketplace add ${where.add} && ttheme add ${theme.id}` : `ttheme add ${theme.name}`
}

function signs(theme: Theme): string[] {
  return [0, 1, 2].map((index) => `--sg${index}:${paint(theme, (shade) => shade.signature[index] as string)}`)
}

function Dots({ theme }: { theme: Theme }) {
  return <span aria-hidden="true" data-slot="signature-dots" style={signs(theme).join(';')} />
}

function ribbon(theme: Theme): string {
  const step = 100 / theme.ansi.length

  const stops = theme.ansi.map((_, index) => {
    const color = paint(theme, (shade) => shade.ansi[index] as string)

    return `${color} ${index * step}% ${(index + 1) * step}%`
  })

  return `linear-gradient(90deg,${stops.join(',')})`
}

function CatalogTile({ theme }: { theme: Theme }) {
  return (
    <span
      aria-hidden="true"
      data-slot="catalog-tile"
      style={[`--bg:${paint(theme, (shade) => shade.background)}`, ...signs(theme)].join(';')}
    />
  )
}

export function WorkspaceHead({ theme, heading }: { theme: Theme; heading?: string }) {
  const name = 'truncate font-display text-display-sm font-black'

  return (
    <>
      {heading ? (
        <>
          <h1 class="sr-only" safe>
            {heading}
          </h1>
          <h2 class={name} translate="no" safe>
            {theme.name}
          </h2>
        </>
      ) : (
        <h1 class={name} translate="no" safe>
          {theme.name}
        </h1>
      )}
      <p class="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
        {theme.catalog ? (
          <span class="text-soft-foreground" safe>
            {theme.catalog}
          </span>
        ) : null}
        {theme.native ? (
          <span lang={nativeLang(theme)} safe>
            {theme.native}
          </span>
        ) : null}
        <span class="truncate font-mono" translate="no" safe>
          {palettePath(theme)}
        </span>
      </p>
    </>
  )
}

export function InstallPanes({ theme, where }: { theme: Theme; where: Where }) {
  return (
    <>
      {STEPS.map(({ step }) => (
        <CommandRow command={commandOf(step, theme, where)} class={cn('hidden bg-card', STEP_SHOWN[step])} />
      ))}
    </>
  )
}

export function ScenePanes({ theme }: { theme: Theme }) {
  return (
    <>
      <div
        class={cn(
          'hidden min-h-full grid-cols-1 gap-px bg-[color-mix(in_oklab,var(--bg)_55%,black)] app:h-full app:grid-cols-2 app:grid-rows-[minmax(0,1fr)_minmax(0,1fr)_auto]',
          VIEW_SHOWN.all,
        )}
      >
        {SCENES.map((scene) => (
          <TerminalPreview theme={theme} scene={scene} worn class="min-h-0 px-5 pt-4 pb-3.5" />
        ))}
        <p
          aria-hidden="true"
          class="col-span-full flex h-6 items-center justify-between gap-4 bg-(--a2) px-2.5 font-mono text-xs text-(--bg)"
        >
          <span>
            <b>[ttheme]</b> 0:all*
          </span>
          <span class="truncate" translate="no" safe>
            {`"${theme.name}"${theme.catalog ? ` ${theme.catalog}` : ''}`}
          </span>
        </p>
      </div>
      {SCENES.map((scene) => (
        <div class={cn('hidden', VIEW_SHOWN[scene])}>
          <TerminalPreview theme={theme} scene={scene} worn class="min-h-0 bg-transparent px-6 pt-5 pb-6 text-sm" />
        </div>
      ))}
    </>
  )
}

function GateButton({ theme, gate }: { theme: Theme; gate: GateRule[] }) {
  const passed = gatePassed(theme, gate)
  const clear = passed === gate.length

  return (
    <Button
      variant="outline"
      size="sm"
      popovertarget="workspace-gate"
      aria-label={`contrast gate, ${passed} of ${gate.length} floors`}
    >
      <Icon node={clear ? Check : TriangleAlert} class={clear ? 'text-success' : 'text-warning'} />
      {escapeHtml(`gate ${passed}/${gate.length}`)}
    </Button>
  )
}

export function PaletteFacts({ theme, palettes, gate }: { theme: Theme; palettes: Theme[]; gate: GateRule[] }) {
  const { at, count } = neighbors(theme, palettes)

  return (
    <>
      <Button variant="outline" size="sm" popovertarget="workspace-slots" aria-label="slots, copy a color">
        <span
          aria-hidden="true"
          class="h-2 w-16 rounded-full forced-color-adjust-none"
          style={`background:${ribbon(theme)}`}
        />
        slots
      </Button>
      <ByMode theme={theme} render={(shown) => <GateButton theme={shown} gate={gate} />} />
      {theme.from ? (
        <span class="text-xs text-muted-foreground" safe>
          {`from ${theme.from}`}
        </span>
      ) : null}
      <span class="text-xs text-muted-foreground" safe>
        {`ansi from ${theme.ansiSource}`}
      </span>
      <span class="ml-auto font-mono text-xs text-muted-foreground" safe>
        {`${at} of ${count}${theme.catalog ? ` in ${theme.catalog}` : ''}`}
      </span>
    </>
  )
}

export function GatePanel({ theme, gate, where }: { theme: Theme; gate: GateRule[]; where: Where }) {
  return (
    <ByMode
      theme={theme}
      render={(shown) => (
        <>
          <div class="grid gap-0.5">
            <p class="text-2xs font-bold tracking-caps text-muted-foreground uppercase">contrast gate</p>
            <p class="text-sm text-soft-foreground" safe>
              {`${shown.name} clears ${gatePassed(shown, gate)} of ${gate.length} floors${where ? ' · advisory, never enforced' : ''}`}
            </p>
          </div>
          <GateList theme={shown} gate={gate} />
        </>
      )}
    />
  )
}

export function SlotsPanel({ theme }: { theme: Theme }) {
  return (
    <>
      <div class="flex items-baseline justify-between gap-3">
        <p class="text-2xs font-bold tracking-caps text-muted-foreground uppercase">slots</p>
        <p class="text-xs text-muted-foreground">click a color to copy it</p>
      </div>
      <ByMode theme={theme} render={(shown) => <SwatchGrid theme={shown} />} />
    </>
  )
}

function Tree({ palettes, current }: { palettes: Theme[]; current: Theme }) {
  return (
    <nav
      aria-label="catalogs"
      data-tree
      class="-mx-1 grid max-h-80 min-h-0 content-start gap-px overflow-y-auto overscroll-contain px-1 pb-2 app:max-h-none app:flex-1"
    >
      {catalogsOf(palettes).map(({ catalog, themes }, index) => {
        const lead = leadOf(themes)
        const open = themes.includes(current)
        const list = `workspace-catalog-${index}`

        return (
          <div data-group data-name={`${catalog ?? 'other palettes'} ${lead.native ?? ''}`.toLowerCase()} class="grid">
            <button
              type="button"
              data-toggle
              aria-expanded={String(open)}
              aria-controls={list}
              class="group/toggle flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-left text-sm font-semibold text-soft-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-expanded:text-foreground"
            >
              <Icon
                node={ChevronRight}
                class="size-3.5 flex-none text-faint-foreground transition-transform duration-150 group-aria-expanded/toggle:rotate-90 motion-reduce:transition-none"
              />
              <CatalogTile theme={lead} />
              <span class="min-w-0 flex-1 truncate" safe>
                {catalog ?? 'other palettes'}
              </span>
              <span data-count class="flex-none font-mono text-xs font-normal text-muted-foreground tabular-nums">
                {escapeHtml(String(themes.length))}
              </span>
            </button>
            <ul id={list} hidden={!open} class="grid gap-px pt-0.5 pb-2 pl-7.5">
              {catalog && lead.native ? (
                <li class="px-2.5 pb-1 text-xs text-muted-foreground" lang={nativeLang(lead)} safe>
                  {lead.native}
                </li>
              ) : null}
              {themes.map((theme) => (
                <li data-search={searchable(theme).text}>
                  <a
                    href={palettePath(theme)}
                    data-pick={theme.name}
                    aria-current={theme === current ? 'page' : undefined}
                    class="flex h-8 items-center gap-2.5 rounded-md px-2.5 font-display text-sm font-extrabold text-soft-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-accent aria-[current=page]:text-foreground"
                  >
                    <Dots theme={theme} />
                    <span class="min-w-0 flex-1 truncate" translate="no" safe>
                      {theme.name}
                    </span>
                    {theme.lead ? (
                      <>
                        <Icon node={Star} class="size-3 flex-none text-soft-foreground" />
                        <span class="sr-only">, lead</span>
                      </>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      <p data-empty hidden class="px-2 py-3 text-sm text-muted-foreground">
        no palette matches <span aria-hidden="true">( ˘ω˘ )</span>
      </p>
    </nav>
  )
}

function MarketplaceFacts({ marketplace, count }: { marketplace: Marketplace | null; count: number }) {
  if (!marketplace) return <span safe>{`${OFFICIAL} · ${plural(count, 'palette')} · comes with ttheme`}</span>

  return (
    <span class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      <a
        href={`https://github.com/${marketplace.repo}`}
        target="_blank"
        rel="noopener"
        class="inline-flex min-w-0 items-center gap-1.5 transition-colors hover:text-foreground"
      >
        <BrandIcon icon={siGithub} class="size-3 flex-none" />
        <span class="truncate" safe>
          {marketplace.repo}
        </span>
        <NewTab class="size-3 flex-none" />
      </a>
      <span safe>{`· ${plural(count, 'palette')} · ${plural(marketplace.stars, 'GitHub star')}`}</span>
      {marketplace.license ? (
        <span safe>{`· ${marketplace.license}`}</span>
      ) : (
        <Badge variant="warning">no license stated</Badge>
      )}
    </span>
  )
}

function AppBar({ facts, marketplace, count }: { facts: Facts; marketplace: Marketplace | null; count: number }) {
  return (
    <footer class="flex flex-none flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t bg-sidebar px-5 py-1.5 text-xs text-muted-foreground app:h-7 app:py-0">
      <MarketplaceFacts marketplace={marketplace} count={count} />
      <nav aria-label="project" class="flex flex-wrap items-center gap-x-3.5 gap-y-1">
        <span>MIT</span>
        <span class="font-mono" safe>
          {`v${facts.version}`}
        </span>
        {LINKS.map((link) => (
          <a
            href={link.href}
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            {link.brand ? <BrandIcon icon={link.brand} class="size-3 flex-none" /> : null}
            <span safe>{link.label}</span>
            <NewTab class="size-3 flex-none" />
          </a>
        ))}
      </nav>
    </footer>
  )
}

export function MarketplaceWorkspace({
  marketplace,
  palettes,
  theme,
  gate,
  facts,
  heading,
}: {
  marketplace: Marketplace | null
  palettes: Theme[]
  theme: Theme
  gate: GateRule[]
  facts: Facts
  heading?: string
}) {
  const where: Where = marketplace ? { id: marketplace.id, repo: marketplace.repo, add: marketplace.add } : null
  const first = catalogsOf(palettes)[0]?.themes ?? palettes
  const data: WorkspaceData = { where, palettes, gate, start: leadOf(first).name, current: theme.name }
  const { prev, next } = neighbors(theme, palettes)

  return (
    <div class="ground flex min-h-dvh flex-col app:h-dvh app:overflow-hidden">
      <SiteHeader current="/marketplace" fixed />
      <marketplace-workspace class="flex min-h-0 flex-1 flex-col app:flex-row">
        <aside
          aria-label="catalogs and palettes"
          class="flex flex-col gap-3 border-b bg-sidebar px-3 pt-3.5 app:min-h-0 app:w-74 app:flex-none app:border-r app:border-b-0"
        >
          <search>
            <InputGroup>
              <InputGroupAddon>
                <Icon node={Search} />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                name="query"
                placeholder="search catalogs, palettes"
                aria-label="search catalogs and palettes"
                aria-keyshortcuts="Meta+K Control+K"
                spellcheck="false"
                autocomplete="off"
                autocapitalize="none"
                autocorrect="off"
                enterkeyhint="search"
              />
              <InputGroupAddon align="inline-end">
                <Kbd>
                  <span data-key="apple">⌘</span>
                  <span data-key="other">ctrl</span>k
                </Kbd>
              </InputGroupAddon>
            </InputGroup>
          </search>
          <Tree palettes={palettes} current={theme} />
        </aside>
        <main id="content" class="flex min-w-0 flex-1 flex-col app:min-h-0">
          <div class="group/install flex flex-wrap items-center gap-x-5 gap-y-3 border-b px-5 py-3">
            <div data-head class="grid min-w-0 flex-[1_1_14rem] gap-0.5">
              <WorkspaceHead theme={theme} heading={heading} />
            </div>
            <div class="flex min-w-0 flex-[1_1_30rem] items-center gap-2.5">
              <ToggleGroup label="install step" class="flex-none">
                {STEPS.map(({ step, label }) => (
                  <ToggleGroupItem name="install" value={step} checked={step === 'add'}>
                    {escapeHtml(label)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <div data-install class="min-w-0 flex-1">
                <InstallPanes theme={theme} where={where} />
              </div>
            </div>
            <div class="flex flex-none gap-2">
              <Button variant="outline" size="icon" data-step="-1" aria-label={`previous palette, ${prev.name}`}>
                <Icon node={ArrowLeft} />
              </Button>
              <Button variant="outline" size="icon" data-step="1" aria-label={`next palette, ${next.name}`}>
                <Icon node={ArrowRight} />
              </Button>
            </div>
          </div>
          <div class="flex flex-col gap-3.5 bg-muted/60 px-8 pt-6 pb-4 max-[720px]:px-4 app:min-h-0 app:flex-1">
            <TerminalFrame
              role="region"
              aria-label="preview"
              data-palette-preview
              style={wearStyle(theme)}
              raised
              class="group/preview flex min-h-96 flex-col app:min-h-0 app:flex-1"
              tabs={
                <ToggleGroup variant="tab" label="view">
                  {VIEWS.map((view) => (
                    <ToggleGroupItem variant="tab" name="scene" value={view} checked={view === 'all'}>
                      <span data-mark aria-hidden="true">
                        ❯
                      </span>
                      {view}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              }
            >
              <div data-scenes class="min-h-0 flex-1 overflow-auto">
                <ScenePanes theme={theme} />
              </div>
            </TerminalFrame>
            <div data-facts class="flex flex-none flex-wrap items-center gap-x-3 gap-y-2">
              <PaletteFacts theme={theme} palettes={palettes} gate={gate} />
            </div>
          </div>
          <div
            id="workspace-gate"
            popover="auto"
            role="dialog"
            aria-label="contrast gate"
            data-gate-panel
            class={POPOVER}
          >
            <GatePanel theme={theme} gate={gate} where={where} />
          </div>
          <div id="workspace-slots" popover="auto" role="dialog" aria-label="slots" data-slots-panel class={POPOVER}>
            <SlotsPanel theme={theme} />
          </div>
        </main>
        <script type="application/json" data-workspace>
          {json(data)}
        </script>
      </marketplace-workspace>
      <AppBar facts={facts} marketplace={marketplace} count={palettes.length} />
    </div>
  )
}
