import type { PropsWithChildren } from '@kitajs/html'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Theme } from '@/lib/themes'
import { cn } from '@/lib/utils'
import { paneLines, paneTiles } from '../../src/builder-layout.ts'
import { SCENES, sceneParts } from '../../src/scenes.ts'
import { SceneLines } from './terminal-preview'

const COLS = 83

const ROWS = 24

const ADVANCE = (COLS * 6) / 10

const VIEWS = ['zsh', 'git', 'logs', 'nvim', 'htop'] as const

type View = (typeof VIEWS)[number]

type Run = [text: string, role: string]

const SHOWN: Record<View, string> = {
  zsh: 'group-has-[input[value=zsh]:checked]/scene:visible',
  git: 'group-has-[input[value=git]:checked]/scene:visible',
  logs: 'group-has-[input[value=logs]:checked]/scene:visible',
  nvim: 'group-has-[input[value=nvim]:checked]/scene:visible',
  htop: 'group-has-[input[value=htop]:checked]/scene:visible',
}

function sceneRuns(name: string): Run[][] {
  const scene = SCENES.find((candidate) => candidate.name === name)
  return (scene?.lines ?? []).map((line) => sceneParts(line, COLS)).filter((parts) => parts !== undefined)
}

function paneRuns(id: string): Run[][] {
  const tile = paneTiles(COLS, ROWS).find((candidate) => candidate.id === id)
  return tile ? paneLines(tile).map((line) => line.map((part): Run => [part.text, part.role])) : []
}

function Part({ text, role }: { text: string; role: string }) {
  const color = /^(B?)(\d+)$/.exec(role)
  const ground = /^K(\d+)$/.exec(role)
  if (color) {
    return (
      <span class={color[1] ? 'font-bold' : undefined} style={`color:var(--a${color[2]})`} safe>
        {text}
      </span>
    )
  }
  if (ground) {
    return (
      <span style={`background:var(--a${ground[1]});color:var(--a0)`} safe>
        {text}
      </span>
    )
  }
  const named: Record<string, string> = {
    d: 'text-(--fg)/60',
    b: 'font-bold',
    s: 'bg-(--se)',
    c: 'bg-(--cu) text-(--bg)',
  }
  return (
    <span class={named[role]} safe>
      {text}
    </span>
  )
}

function Lines({ lines }: { lines: Run[][] }) {
  return (
    <>
      {lines.map((line, at) => (
        <>
          {at > 0 ? '\n' : ''}
          {line.map(([text, role]) => (
            <Part text={text} role={role} />
          ))}
        </>
      ))}
    </>
  )
}

function Pane({ view, children }: PropsWithChildren<{ view: View }>) {
  return (
    <pre
      translate="no"
      class={cn(
        'invisible col-start-1 row-start-1 overflow-hidden px-5 pt-3 pb-5 font-mono whitespace-pre text-(--fg)',
        SHOWN[view],
      )}
    >
      {children}
    </pre>
  )
}

function SceneTabs() {
  return (
    <div class="flex items-center px-3 pb-2">
      <ToggleGroup variant="tab" label="preview scene">
        {VIEWS.map((view) => (
          <ToggleGroupItem variant="tab" name="scene" value={view} checked={view === 'zsh'} class="max-[480px]:px-1.5">
            <span data-mark aria-hidden="true">
              ❯
            </span>
            {view}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

export function HeroScenes({ theme }: { theme: Theme }) {
  return (
    <div class="group/scene @container">
      <SceneTabs />
      <div
        data-lead-preview
        aria-hidden="true"
        class="grid leading-relaxed"
        style={`font-size:clamp(8px,calc((100cqi - 2.5rem) / ${ADVANCE}),13px)`}
      >
        <Pane view="zsh">
          <SceneLines theme={theme} scene="shell" own />
        </Pane>
        <Pane view="git">
          <Lines lines={sceneRuns('Diff')} />
        </Pane>
        <Pane view="logs">
          <Lines lines={sceneRuns('Logs')} />
        </Pane>
        <Pane view="nvim">
          <Lines lines={paneRuns('code')} />
        </Pane>
        <Pane view="htop">
          <Lines lines={paneRuns('monitor')} />
        </Pane>
      </div>
    </div>
  )
}
