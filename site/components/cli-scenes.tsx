import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { OWN_NAME, sceneLines } from '@/lib/sessions'
import { type Line, linesOf, runOf } from '@/lib/terminal'
import { cn } from '@/lib/utils'
import { paneLines, paneTiles } from '../../src/core/builder-layout.ts'
import { SCENES } from '../../src/core/scenes.ts'
import { TerminalScreen } from './terminal'

const COLS = 83

const ROWS = 24

const VIEWS = ['zsh', 'git', 'logs', 'nvim', 'htop'] as const

type View = (typeof VIEWS)[number]

const SHOWN: Record<View, string> = {
  zsh: 'group-has-[input[value=zsh]:checked]/scene:visible',
  git: 'group-has-[input[value=git]:checked]/scene:visible',
  logs: 'group-has-[input[value=logs]:checked]/scene:visible',
  nvim: 'group-has-[input[value=nvim]:checked]/scene:visible',
  htop: 'group-has-[input[value=htop]:checked]/scene:visible',
}

function sceneOf(name: string): Line[] {
  return linesOf(SCENES.find((scene) => scene.name === name)?.lines ?? [], COLS)
}

function paneOf(id: string): Line[] {
  const tile = paneTiles(COLS, ROWS).find((candidate) => candidate.id === id)

  return tile ? paneLines(tile).map((line) => line.map((part) => runOf(part.text, part.role))) : []
}

const LINES: Record<View, () => Line[]> = {
  zsh: () => sceneLines('shell', OWN_NAME),
  git: () => sceneOf('Diff'),
  logs: () => sceneOf('Logs'),
  nvim: () => paneOf('code'),
  htop: () => paneOf('monitor'),
}

function SceneTabs() {
  return (
    <div class="flex items-center px-3 pb-2">
      <RadioGroup variant="tab" label="preview scene">
        {VIEWS.map((view) => (
          <RadioGroupItem variant="tab" name="scene" value={view} checked={view === 'zsh'} class="max-[480px]:px-1.5">
            <span data-mark aria-hidden="true">
              ❯
            </span>
            {view}
          </RadioGroupItem>
        ))}
      </RadioGroup>
    </div>
  )
}

export function HeroScenes() {
  return (
    <div class="group/scene">
      <SceneTabs />
      <div data-lead-preview aria-hidden="true" class="@container grid px-5">
        {VIEWS.map((view) => (
          <TerminalScreen
            lines={LINES[view]()}
            cols={COLS}
            class={cn('invisible col-start-1 row-start-1 overflow-hidden pt-3 pb-5', SHOWN[view])}
          />
        ))}
      </div>
    </div>
  )
}
