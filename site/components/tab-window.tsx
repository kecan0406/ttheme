import type { PropsWithChildren } from '@kitajs/html'
import { Plus } from 'lucide'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Icon } from '@/lib/icons'
import { paint, type Theme } from '@/lib/themes'
import { wearStyle } from '@/lib/wear'
import { TerminalFrame } from './terminal-frame'

export const FIRST_TABS = 3

export const MOST_TABS = 4

export interface WindowTab {
  id: number
  theme: Theme
}

const NAMED = new Map([
  ['background', '--bg'],
  ['foreground', '--fg'],
  ['cursor', '--cu'],
  ['selection', '--se'],
])

function slotVar(slot: string): string {
  return NAMED.get(slot) ?? `--a${slot.slice(4)}`
}

export function newTabLabel(next: Theme): string {
  return `new tab on ${next.name}`
}

function Line({ children }: PropsWithChildren) {
  return <div>{children}</div>
}

function Prompt() {
  return (
    <>
      <span class="term-c2">{'➜  '}</span>
      <span class="term-c6">ttheme</span>
      <span class="term-c4">{' git:('}</span>
      <span class="term-c1">main</span>
      <span class="term-c4">{') '}</span>
    </>
  )
}

function Mark({ slot }: { slot: string }) {
  return slot === 'selection' ? (
    <span class="bg-(--se) text-(--fg)">{' sel '}</span>
  ) : (
    <span style={`color:var(${slotVar(slot)})`}>●</span>
  )
}

export function TabSession({ theme }: { theme: Theme }) {
  const file = `builtin/palettes/${theme.name}.toml`

  return (
    <pre translate="no" class="overflow-hidden px-4.5 pt-3 pb-4 font-mono text-code whitespace-pre text-(--fg)">
      <Line>
        <Prompt />
        ttheme use <span safe>{theme.name}</span>
      </Line>
      <Line>
        <span class="bg-(--se)" safe>
          {` ${theme.work?.name ?? ''} `}
        </span>
      </Line>
      <Line>
        <span class="bg-(--cu) font-bold text-(--bg)" safe>
          {` ${theme.name} `}
        </span>
        {'  '}
        <span class="term-c8" safe>
          {`ANSI ${theme.ansiSource}`}
        </span>
      </Line>
      <Line>
        {' '}
        {theme.signatureSlots.slice(0, 3).map((slot) => (
          <Mark slot={slot} />
        ))}
        {'  '}
        <span class="term-c7" safe>
          {theme.signatureSlots.join(' ')}
        </span>
      </Line>
      <Line>
        <Prompt />
        git log --oneline -2
      </Line>
      <Line>
        <span class="term-c3">b699337</span> <span class="term-c6 font-bold">{'(HEAD -> '}</span>
        <span class="term-c2 font-bold">main</span>
        <span class="term-c6 font-bold">)</span>
        {' Harmonize every palette'}
      </Line>
      <Line>
        <span class="term-c3">ff9cb92</span>
        {' Pin palettes to directories'}
      </Line>
      <Line>
        <Prompt />
        <span safe>{`grep -H '^cursor' ${file}`}</span>
      </Line>
      {[theme.cursor, theme.other.cursor].map((cursor) => (
        <Line>
          <span class="term-c5" safe>
            {file}
          </span>
          <span class="term-c6">:</span>
          <span class="term-c1 font-bold">cursor</span>
          <span safe>{` = "${cursor}"`}</span>
        </Line>
      ))}
      <Line>
        <Prompt />
        <span class="inline-block w-[1ch] bg-(--cu)">&nbsp;</span>
      </Line>
    </pre>
  )
}

export function WindowTabs({ tabs, active }: { tabs: WindowTab[]; active: number }) {
  return (
    <ToggleGroup variant="tab" label="terminal tabs">
      {tabs.map((tab) => (
        <ToggleGroupItem variant="tab" name="terminal-tab" value={String(tab.id)} checked={tab.id === active}>
          <i
            aria-hidden="true"
            class="size-2 flex-none rounded-full forced-color-adjust-none"
            style={`background:${paint(tab.theme, (shade) => shade.cursor)}`}
          />
          <span class="min-w-0 truncate" translate="no" safe>
            {tab.theme.name}
          </span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export function TabWindow({ tabs, active, next }: { tabs: WindowTab[]; active: number; next: Theme }) {
  const shown = (tabs.find((tab) => tab.id === active) ?? tabs[0]) as WindowTab

  return (
    <TerminalFrame
      data-slot="tab-window"
      data-tab-window
      style={wearStyle(shown.theme)}
      raised
      tabs={
        <div class="flex min-w-0 flex-1 items-center gap-1.5">
          <WindowTabs tabs={tabs} active={active} />
          <Button variant="scene" size="icon-sm" aria-label={newTabLabel(next)} data-new-tab>
            <Icon node={Plus} />
          </Button>
        </div>
      }
    >
      <div data-tab-session>
        <TabSession theme={shown.theme} />
      </div>
    </TerminalFrame>
  )
}
