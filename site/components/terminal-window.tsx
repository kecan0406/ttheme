import type { PropsWithChildren } from '@kitajs/html'
import { Plus } from 'lucide'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Icon } from '@/lib/icons'
import type { Theme } from '@/lib/themes'
import { TerminalFrame } from './terminal-frame'

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

function File() {
  return (
    <>
      themes/
      <span data-text="name" />
      .toml
    </>
  )
}

export function Session() {
  return (
    <>
      <Line>
        <Prompt />
        ttheme use <span data-text="name" />
      </Line>
      <Line>
        <span class="term-on-se">
          {' '}
          <span data-text="catalog" />{' '}
        </span>
      </Line>
      <Line>
        <span class="term-on-cu">
          {' '}
          <span data-text="name" />{' '}
        </span>
        {'  '}
        <span class="term-c8">
          ANSI <span data-text="ansi" />
        </span>
      </Line>
      <Line>
        {' '}
        <span data-mark="0" />
        <span data-mark="1" />
        <span data-mark="2" />
        {'  '}
        <span class="term-c7" data-text="slots" />
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
        grep -H '^cursor' <File />
      </Line>
      <Line>
        <span class="term-c5">
          <File />
        </span>
        <span class="term-c6">:</span>
        <span class="term-c1 font-bold">cursor</span> = "<span data-text="cursor" />"
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
    <TabsList label="terminal tabs" variant="track" class="flex-1">
      {tabs.map((tab) => (
        <TabsTrigger variant="track" selected={tab.id === active} data-tab={String(tab.id)}>
          {tab.id === active ? (
            <>
              <i class="size-2 flex-none rounded-full bg-(--cu)" />
              <span class="min-w-0 truncate" style={`--tab-name:sheet-tab-${tab.id}`} data-text="name" />
            </>
          ) : (
            <>
              <i class="size-2 flex-none rounded-full" style={`background:${tab.theme.cursor}`} />
              <span class="min-w-0 truncate" safe>
                {tab.theme.name}
              </span>
            </>
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}

export function TerminalWindow({ tabs, active }: { tabs: Tab[]; active: number }) {
  return (
    <TerminalFrame
      raised
      class="w-full"
      tabs={
        <div data-tabs class="flex min-w-0 flex-1 items-center gap-2">
          <TerminalTabs tabs={tabs} active={active} />
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="new tab on the next sheet"
            data-new-tab
            class="flex-none text-muted-foreground hover:text-primary"
          >
            <Icon node={Plus} />
          </Button>
        </div>
      }
    >
      <div class="relative">
        <ScrollArea contentClass="term w-max min-w-full px-4.5 pt-3.5 pb-4">
          <div data-session>
            <Session />
          </div>
        </ScrollArea>
      </div>
    </TerminalFrame>
  )
}
