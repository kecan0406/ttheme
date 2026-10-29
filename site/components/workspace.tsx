import { escapeHtml } from '@kitajs/html'
import { ChevronRight, Search, Star } from 'lucide'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { Popover, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { Facts, Repo } from '@/lib/facts'
import { BUILTIN_URL, palettePath, REPO, repoUrl, searchText } from '@/lib/gallery'
import { gatePassed } from '@/lib/gate'
import { Icon } from '@/lib/icons'
import { json } from '@/lib/render'
import { SCENES, type Scene, sceneLines, useOf } from '@/lib/sessions'
import { faceOf, type GateRule, type Marketplace, paint, type Theme } from '@/lib/themes'
import { cn, plural } from '@/lib/utils'
import { wearStyle } from '@/lib/wear'
import { byWork, leadOf, leadsOf } from '@/lib/works'
import type { Where, WorkspaceData } from '@/lib/workspace'
import { ByMode } from './by-mode'
import { CommandRow, InitRow } from './command-row'
import { ChecksHead, GateList, SwatchGrid } from './palette-parts'
import { RepoLink } from './repo-link'
import { TerminalScreen } from './terminal'
import { TerminalFrame } from './terminal-frame'
import {
  GateButton,
  TitleDots,
  TitleFacts,
  TitleLine,
  WorkspaceBar,
  WorkspacePage,
  WorkspaceSide,
  WorkspaceStage,
  WorkspaceTitle,
} from './workspace-shell'

type View = 'all' | Scene

const VIEWS: View[] = ['all', ...SCENES]

const SHOWN: Record<Scene, string> = {
  shell: 'group-has-[input[value=shell]:checked]/preview:block',
  git: 'group-has-[input[value=git]:checked]/preview:block',
  test: 'group-has-[input[value=test]:checked]/preview:block',
  colors: 'group-has-[input[value=colors]:checked]/preview:block',
}

function InstallRow({ where }: { where: Where }) {
  return where ? (
    <CommandRow command={`ttheme marketplace add ${where.add}`} class="bg-card" />
  ) : (
    <InitRow class="bg-card" />
  )
}

function signs(theme: Theme): string[] {
  return [0, 1, 2].map((index) => `--sg${index}:${paint(theme, (shade) => faceOf(shade)[index] as string)}`)
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

export function WorkspaceHead({ theme, heading }: { theme: Theme; heading?: string }) {
  const name = 'truncate font-display text-display-sm font-black'
  const dots = [0, 1, 2].map((index) => paint(theme, (shade) => faceOf(shade)[index] as string))

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
    </>
  )
}

export function statusOf(theme: Theme): string {
  return `"${theme.name}"${theme.work ? ` ${theme.work.name}` : ''}`
}

export function ScenePanes({ theme }: { theme: Theme }) {
  const use = useOf(theme)

  return (
    <div class="split:grid split:min-h-full split:grid-cols-1 split:gap-px split:bg-[color-mix(in_oklab,var(--bg)_55%,black)] app:split:h-full app:split:grid-cols-2 app:split:grid-rows-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      {SCENES.map((scene) => (
        <TerminalScreen
          lines={sceneLines(scene, use)}
          class={cn(
            'hidden overflow-hidden px-6 pt-5 pb-6 text-sm split:block split:min-h-0 split:bg-(--bg) split:px-5 split:pt-4 split:pb-3.5 split:text-code',
            SHOWN[scene],
          )}
        />
      ))}
      <p
        aria-hidden="true"
        class="col-span-full hidden h-6 items-center justify-between gap-4 bg-(--a2) px-2.5 font-mono text-xs text-(--bg) split:flex"
      >
        <span>
          <b>[ttheme]</b> 0:all*
        </span>
        <span data-status class="truncate" translate="no" safe>
          {statusOf(theme)}
        </span>
      </p>
    </div>
  )
}

export function PaletteFacts({ theme, gate }: { theme: Theme; gate: GateRule[] }) {
  return (
    <>
      <PopoverTrigger
        popover="workspace-slots"
        render={(props) => (
          <Button {...props} variant="muted" size="chip" aria-label="colors, copy one">
            <span
              aria-hidden="true"
              class="h-1.75 w-11 rounded-full forced-color-adjust-none"
              style={`background:${ribbon(theme)}`}
            />
            colors
          </Button>
        )}
      />
      <ByMode
        theme={theme}
        render={(shown) => (
          <PopoverTrigger
            popover="workspace-gate"
            render={(props) => <GateButton {...props} passed={gatePassed(shown, gate)} total={gate.length} />}
          />
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
          <ChecksHead
            summary={`${shown.name} passes ${gatePassed(shown, gate)} of ${gate.length}${where ? ', which only advise' : ''}`}
          />
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
      {theme.from && (
        <p class="text-xs text-muted-foreground" safe>
          {`from ${theme.from}`}
        </p>
      )}
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
      {byWork(palettes).map((shelf) => {
        const { work, themes } = shelf
        const lead = leadOf(shelf)
        const open = themes.includes(current)
        const title = work?.name ?? 'originals'

        return (
          <Collapsible
            open={open}
            data-group
            data-name={`${title} ${work?.native ?? ''}`.toLowerCase()}
            class="group/work"
          >
            <CollapsibleTrigger class="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm font-semibold text-soft-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring group-data-open/work:text-foreground">
              <Icon
                node={ChevronRight}
                class="size-3.5 flex-none text-faint-foreground transition-transform duration-150 group-data-open/work:rotate-90 motion-reduce:transition-none"
              />
              <WorkTile theme={lead} />
              <span class="min-w-0 flex-1 truncate" safe>
                {title}
              </span>
              <span data-count class="flex-none font-mono text-xs font-normal text-muted-foreground tabular-nums">
                {escapeHtml(String(themes.length))}
              </span>
            </CollapsibleTrigger>
            <CollapsiblePanel>
              <ul class="grid gap-px pt-0.5 pb-2 pl-7.5">
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
            </CollapsiblePanel>
          </Collapsible>
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
            <WorkspaceTitle class="flex-[1_1_14rem]">
              <div data-head class="contents">
                <WorkspaceHead theme={theme} heading={heading} />
              </div>
              <TitleFacts data-facts>
                <PaletteFacts theme={theme} gate={gate} />
              </TitleFacts>
            </WorkspaceTitle>
            <div class="max-w-full min-w-0 flex-[0_1_auto]">
              <InstallRow where={where} />
            </div>
          </WorkspaceBar>
          <WorkspaceStage>
            <TerminalFrame
              role="region"
              aria-label="preview"
              data-palette-preview
              style={wearStyle(theme)}
              mode
              raised
              class="group/preview flex min-h-96 flex-col app:min-h-0 app:flex-1"
              tabs={
                <RadioGroup
                  variant="tab"
                  label="view"
                  class="max-[560px]:overflow-x-auto max-[560px]:[scrollbar-width:none]"
                >
                  {VIEWS.map((view) => (
                    <RadioGroupItem
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
                    </RadioGroupItem>
                  ))}
                </RadioGroup>
              }
            >
              <div data-scenes class="min-h-0 flex-1 overflow-auto">
                <ScenePanes theme={theme} />
              </div>
            </TerminalFrame>
          </WorkspaceStage>
          <Popover id="workspace-gate" label="contrast checks" inset="padded" align="start" data-gate-panel>
            <GatePanel theme={theme} gate={gate} where={where} />
          </Popover>
          <Popover id="workspace-slots" label="slots" inset="padded" align="start" data-slots-panel>
            <SlotsPanel theme={theme} />
          </Popover>
        </main>
        <script type="application/json" data-workspace>
          {json(data)}
        </script>
      </marketplace-workspace>
    </WorkspacePage>
  )
}
