import { escapeHtml, type PropsWithChildren } from '@kitajs/html'
import { Plus } from 'lucide'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Icon } from '@/lib/icons'
import { slotOf } from '@/lib/sheet'
import { shelfOf, type Theme } from '@/lib/themes'

export interface Tab {
  id: number
  theme: Theme
}

function Line({ children }: PropsWithChildren) {
  return <div class="term-line">{children}</div>
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

export function Session({ theme }: { theme: Theme }) {
  const file = `themes/${theme.name}.toml`

  return (
    <>
      <Line>
        <Prompt />
        {escapeHtml(`ttheme use ${theme.name}`)}
      </Line>
      <Line>
        <span class="term-on-se" safe>{` ${shelfOf(theme)} `}</span>
      </Line>
      <Line>
        <span class="term-on-cu" safe>{` ${theme.name} `}</span>
        {'  '}
        <span class="term-c8" safe>{`ANSI ${theme.ansiSource}`}</span>
      </Line>
      <Line>
        {' '}
        {theme.signatureSlots.map((slot) =>
          slot === 'selection' ? (
            <span class="term-on-se">{' sel '}</span>
          ) : (
            <span style={`color:var(--${slotOf(slot)})`}>●</span>
          ),
        )}
        {'  '}
        <span class="term-c7" safe>
          {theme.signatureSlots.join(' ')}
        </span>
      </Line>
      <Line>
        <Prompt />
        <span>git log --oneline -2</span>
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
        {'ls ~/.config/ttheme'}
      </Line>
      <Line>
        <span class="term-c4 font-bold">ghostty/</span>
        {'  '}
        <span class="term-c4 font-bold">kitty/</span>
        {'  '}
        <span class="term-c4 font-bold">shell/</span>
        {'  pins'}
      </Line>
      <Line>
        <Prompt />
        {escapeHtml(`grep -H '^cursor' ${file}`)}
      </Line>
      <Line>
        <span class="term-c5" safe>
          {file}
        </span>
        <span class="term-c6">:</span>
        <span class="term-c1 font-bold">cursor</span>
        {escapeHtml(` = "${theme.cursor}"`)}
      </Line>
      <Line>
        <Prompt />
        <span class="term-caret" />
      </Line>
    </>
  )
}

export function TerminalTabs({ tabs, active }: { tabs: Tab[]; active: number }) {
  return (
    <TabsList label="terminal tabs" class="flex-1">
      {tabs.map((tab) => (
        <TabsTrigger
          selected={tab.id === active}
          data-tab={String(tab.id)}
          class="-mb-px flex-[0_1_136px] gap-2 py-2 text-xs"
        >
          <i class="size-2 flex-none rounded-full" style={`background:${tab.theme.cursor}`} />
          <span class="min-w-0 truncate" safe>
            {tab.theme.name}
          </span>
        </TabsTrigger>
      ))}
    </TabsList>
  )
}

export function TerminalWindow({ theme, tabs, active }: { theme: Theme; tabs: Tab[]; active: number }) {
  return (
    <Card class="w-full border-input shadow-lg">
      <div data-slot="tabs" class="flex flex-col">
        <div data-tabs class="flex min-w-0 border-b bg-muted text-xs">
          <TerminalTabs tabs={tabs} active={active} />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="new tab on the next sheet"
            data-new-tab
            class="h-auto w-9.5 flex-none rounded-none text-muted-foreground hover:text-primary"
          >
            <Icon node={Plus} />
          </Button>
        </div>
      </div>
      <div class="relative">
        <ScrollArea contentClass="term w-max min-w-full px-4.5 pt-3.5 pb-4">
          <div data-session>
            <Session theme={theme} />
          </div>
        </ScrollArea>
      </div>
    </Card>
  )
}
