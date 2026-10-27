import { escapeHtml } from '@kitajs/html'
import { ChevronRight, Search, Star } from 'lucide'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Facts, Repo } from '@/lib/facts'
import { BUILTIN_URL, INIT, palettePath, REPO, repoUrl, searchText } from '@/lib/gallery'
import { gatePassed } from '@/lib/gate'
import { Icon } from '@/lib/icons'
import { json } from '@/lib/render'
import { type GateRule, type Marketplace, paint, type Theme } from '@/lib/themes'
import { cn, plural } from '@/lib/utils'
import { wearStyle } from '@/lib/wear'
import { byWork, leadOf, leadsOf } from '@/lib/works'
import { neighbors, type Where, type WorkspaceData } from '@/lib/workspace'
import { ByMode } from './by-mode'
import { CommandRow } from './command-row'
import { GateList, SwatchGrid } from './palette-parts'
import { RepoLink } from './repo-link'
import { TerminalFrame } from './terminal-frame'
import { SCENES, type Scene, TerminalPreview } from './terminal-preview'
import {
  GateButton,
  TITLE,
  TitleDots,
  TitleLine,
  TitleMeta,
  WorkspaceBar,
  WorkspacePage,
  WorkspaceSide,
  WorkspaceStage,
} from './workspace-shell'

type View = 'all' | Scene

const VIEWS: View[] = ['all', ...SCENES]

const VIEW_SHOWN: Record<View, string> = {
  all: 'group-has-[input[value=all]:checked]/preview:grid',
  shell: 'group-has-[input[value=shell]:checked]/preview:block',
  git: 'group-has-[input[value=git]:checked]/preview:block',
  test: 'group-has-[input[value=test]:checked]/preview:block',
  colors: 'group-has-[input[value=colors]:checked]/preview:block',
}

const POPOVER =
  'm-0 w-96 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg inset-auto open:flex'

function installOf(where: Where): string {
  return where ? `ttheme marketplace add ${where.add}` : INIT
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

function WorkTile({ theme }: { theme: Theme }) {
  return (
    <span
      aria-hidden="true"
      data-slot="work-tile"
      style={[`--bg:${paint(theme, (shade) => shade.background)}`, ...signs(theme)].join(';')}
    />
  )
}

export function WorkspaceHead({ theme, place, heading }: { theme: Theme; place: string; heading?: string }) {
  const name = 'truncate font-display text-display-sm font-black'
  const dots = [0, 1, 2].map((index) => paint(theme, (shade) => shade.signature[index] as string))

  return (
    <>
      {heading ? (
        <h1 class="sr-only" safe>
          {heading}
        </h1>
      ) : null}
      <TitleLine>
        {heading ? (
          <h2 class={name} translate="no" safe>
            {theme.name}
          </h2>
        ) : (
          <h1 class={name} translate="no" safe>
            {theme.name}
          </h1>
        )}
        <span aria-hidden="true" class="flex flex-none gap-1">
          <TitleDots dots={dots} />
        </span>
      </TitleLine>
      <TitleMeta>
        {theme.work ? (
          <span class="flex-none text-soft-foreground" safe>
            {theme.work.name}
          </span>
        ) : null}
        {theme.work?.native ? (
          <span class="flex-none" lang={theme.work.lang ?? undefined} safe>
            {theme.work.native}
          </span>
        ) : null}
        <span class="flex-none font-mono tabular-nums" safe>
          {place}
        </span>
      </TitleMeta>
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
            {`"${theme.name}"${theme.work ? ` ${theme.work.name}` : ''}`}
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

export function PaletteFacts({ theme, gate }: { theme: Theme; gate: GateRule[] }) {
  return (
    <>
      <Button variant="outline" size="sm" popovertarget="workspace-slots" aria-label="colors, copy one">
        <span
          aria-hidden="true"
          class="h-2 w-16 rounded-full forced-color-adjust-none"
          style={`background:${ribbon(theme)}`}
        />
        colors
      </Button>
      <ByMode
        theme={theme}
        render={(shown) => (
          <GateButton passed={gatePassed(shown, gate)} total={gate.length} popovertarget="workspace-gate" />
        )}
      />
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
            <p class="text-2xs font-bold tracking-caps text-muted-foreground uppercase">contrast checks</p>
            <p class="text-sm text-soft-foreground" safe>
              {`${shown.name} passes ${gatePassed(shown, gate)} of ${gate.length}${where ? ', which only advise' : ''}`}
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
        <p class="text-2xs font-bold tracking-caps text-muted-foreground uppercase">colors</p>
        <p class="text-xs text-muted-foreground">click a color to copy it</p>
      </div>
      <ByMode theme={theme} render={(shown) => <SwatchGrid theme={shown} />} />
      <p class="text-xs text-muted-foreground" safe>
        {`ansi from ${theme.ansiSource}${theme.from ? ` · from ${theme.from}` : ''}`}
      </p>
    </>
  )
}

function Tree({ palettes, current }: { palettes: Theme[]; current: Theme }) {
  return (
    <nav
      aria-label="works"
      data-tree
      class="grid max-h-80 min-h-0 content-start gap-px overflow-y-auto overscroll-contain px-3 pt-3 pb-2 app:max-h-none app:flex-1"
    >
      {byWork(palettes).map((shelf, index) => {
        const { work, themes } = shelf
        const lead = leadOf(shelf)
        const open = themes.includes(current)
        const list = `workspace-work-${index}`
        const title = work?.name ?? 'originals'

        return (
          <div data-group data-name={`${title} ${work?.native ?? ''}`.toLowerCase()} class="grid">
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
              <WorkTile theme={lead} />
              <span class="min-w-0 flex-1 truncate" safe>
                {title}
              </span>
              <span data-count class="flex-none font-mono text-xs font-normal text-muted-foreground tabular-nums">
                {escapeHtml(String(themes.length))}
              </span>
            </button>
            <ul id={list} hidden={!open} class="grid gap-px pt-0.5 pb-2 pl-7.5">
              {work?.native ? (
                <li class="px-2.5 pb-1 text-xs text-muted-foreground" lang={work.lang ?? undefined} safe>
                  {work.native}
                </li>
              ) : null}
              {themes.map((theme) => (
                <li data-search={searchText(theme)}>
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
                    {work && theme === lead ? (
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

function MarketplaceFacts({
  marketplace,
  count,
  repo,
}: {
  marketplace: Marketplace | null
  count: number
  repo: Repo | null
}) {
  const stars = marketplace ? marketplace.stars : (repo?.stars ?? null)
  const facts = [plural(count, 'palette'), ...(stars === null ? [] : [plural(stars, 'GitHub star')])]

  return (
    <span class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      <RepoLink
        href={marketplace ? repoUrl(marketplace.repo) : BUILTIN_URL}
        repo={marketplace ? marketplace.repo : REPO}
      />
      <span safe>{`· ${[...facts, ...(marketplace ? [] : ['built in'])].join(' · ')}`}</span>
      {!marketplace ? null : marketplace.license ? (
        <span safe>{`· ${marketplace.license}`}</span>
      ) : (
        <Badge variant="warning">no license stated</Badge>
      )}
    </span>
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
  const data: WorkspaceData = { where, gate, start: (leadsOf(palettes)[0] as Theme).name, current: theme.name }
  const { at, count } = neighbors(theme, palettes)

  return (
    <WorkspacePage
      current="/marketplace"
      facts={facts}
      status={<MarketplaceFacts marketplace={marketplace} count={palettes.length} repo={facts.repo} />}
    >
      <marketplace-workspace class="workspace">
        <WorkspaceSide
          aria-label="works and palettes"
          head={
            <search class="w-full">
              <InputGroup class="h-9">
                <InputGroupAddon>
                  <Icon node={Search} />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  name="query"
                  placeholder="search works, palettes"
                  aria-label="search works and palettes"
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
          }
        >
          <Tree palettes={palettes} current={theme} />
        </WorkspaceSide>
        <main id="content" data-mode-scope class="flex min-w-0 flex-col [grid-area:bar/bar/stage/stage] app:min-h-0">
          <WorkspaceBar class="flex-wrap">
            <div data-head class={cn(TITLE, 'flex-[1_1_14rem]')}>
              <WorkspaceHead theme={theme} place={`${at} of ${count}`} heading={heading} />
            </div>
            <div class="min-w-0 flex-[1_1_20rem]">
              <CommandRow command={installOf(where)} class="bg-card" />
            </div>
          </WorkspaceBar>
          <WorkspaceStage facts={<PaletteFacts theme={theme} gate={gate} />}>
            <TerminalFrame
              role="region"
              aria-label="preview"
              data-palette-preview
              style={wearStyle(theme)}
              mode
              raised
              class="group/preview flex min-h-96 flex-col app:min-h-0 app:flex-1"
              tabs={
                <ToggleGroup
                  variant="tab"
                  label="view"
                  class="max-[560px]:overflow-x-auto max-[560px]:[scrollbar-width:none]"
                >
                  {VIEWS.map((view) => (
                    <ToggleGroupItem
                      variant="tab"
                      name="scene"
                      value={view}
                      checked={view === 'all'}
                      class="max-[560px]:flex-none"
                    >
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
          </WorkspaceStage>
          <div
            id="workspace-gate"
            popover="auto"
            role="dialog"
            aria-label="contrast checks"
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
    </WorkspacePage>
  )
}
