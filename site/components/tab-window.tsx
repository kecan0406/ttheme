import { Plus } from 'lucide'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Icon } from '@/lib/icons'
import { tabLines } from '@/lib/sessions'
import { paint, type Theme } from '@/lib/themes'
import { wearStyle } from '@/lib/wear'
import { TerminalScreen } from './terminal'
import { TerminalFrame } from './terminal-frame'

export const FIRST_TABS = 3

export const MOST_TABS = 4

export interface WindowTab {
  id: number
  theme: Theme
}

export function newTabLabel(next: Theme): string {
  return `new tab on ${next.name}`
}

export function TabSession({ theme }: { theme: Theme }) {
  return <TerminalScreen lines={tabLines(theme)} decorative class="overflow-hidden px-4.5 pt-3 pb-4 text-code" />
}

export function WindowTabs({ tabs, active }: { tabs: WindowTab[]; active: number }) {
  return (
    <RadioGroup variant="tab" label="terminal tabs">
      {tabs.map((tab) => (
        <RadioGroupItem variant="tab" name="terminal-tab" value={String(tab.id)} checked={tab.id === active}>
          <i
            aria-hidden="true"
            class="size-2 flex-none rounded-full forced-color-adjust-none"
            style={`background:${paint(tab.theme, (shade) => shade.cursor)}`}
          />
          <span class="min-w-0 truncate" translate="no" safe>
            {tab.theme.name}
          </span>
        </RadioGroupItem>
      ))}
    </RadioGroup>
  )
}

export function TabWindow({ tabs, active, next }: { tabs: WindowTab[]; active: number; next: Theme }) {
  const shown = (tabs.find((tab) => tab.id === active) ?? tabs[0]) as WindowTab

  return (
    <TerminalFrame
      data-tab-window
      style={wearStyle(shown.theme)}
      raised
      recolor
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
