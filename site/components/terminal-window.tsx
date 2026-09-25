import { PlusIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { slotOf } from '@/lib/sheet'
import type { Theme } from '@/lib/themes'

export interface Tab {
  id: number
  theme: Theme
}

function Line({ children }: { children?: ReactNode }) {
  return <div className="term-line">{children}</div>
}

function Prompt() {
  return (
    <>
      <span className="term-c2">{'➜  '}</span>
      <span className="term-c6">ttheme</span>
      <span className="term-c4">{' git:('}</span>
      <span className="term-c1">main</span>
      <span className="term-c4">{') '}</span>
    </>
  )
}

function Session({ theme }: { theme: Theme }) {
  const file = `themes/${theme.name}.toml`

  return (
    <>
      <Line>
        <Prompt />
        {`ttheme use ${theme.name}`}
      </Line>
      <Line>
        <span className="term-on-se">{` ${theme.group} `}</span>
      </Line>
      <Line>
        <span className="term-on-cu">{` ${theme.name} `}</span>
        {'  '}
        <span className="term-c8">{`ANSI ${theme.ansiSource}`}</span>
      </Line>
      <Line>
        {' '}
        {theme.signatureSlots.map((slot) =>
          slot === 'selection' ? (
            <span key={slot} className="term-on-se">
              {' sel '}
            </span>
          ) : (
            <span key={slot} style={{ color: `var(--${slotOf(slot)})` }}>
              ●
            </span>
          ),
        )}
        {'  '}
        <span className="term-c7">{theme.signatureSlots.join(' ')}</span>
      </Line>
      <Line>
        <Prompt />
        <span>git log --oneline -2</span>
      </Line>
      <Line>
        <span className="term-c3">b699337</span> <span className="term-c6 font-bold">{'(HEAD -> '}</span>
        <span className="term-c2 font-bold">main</span>
        <span className="term-c6 font-bold">)</span>
        {' Harmonize every palette'}
      </Line>
      <Line>
        <span className="term-c3">ff9cb92</span>
        {' Pin palettes to directories'}
      </Line>
      <Line>
        <Prompt />
        {'ls ~/.config/ttheme'}
      </Line>
      <Line>
        <span className="term-c4 font-bold">ghostty/</span>
        {'  '}
        <span className="term-c4 font-bold">kitty/</span>
        {'  '}
        <span className="term-c4 font-bold">shell/</span>
        {'  pins'}
      </Line>
      <Line>
        <Prompt />
        {`grep -H '^cursor' ${file}`}
      </Line>
      <Line>
        <span className="term-c5">{file}</span>
        <span className="term-c6">:</span>
        <span className="term-c1 font-bold">cursor</span>
        {` = "${theme.cursor}"`}
      </Line>
      <Line>
        <Prompt />
        <span className="term-caret" />
      </Line>
    </>
  )
}

export function TerminalWindow({
  theme,
  tabs,
  active,
  onSelect,
  onOpen,
}: {
  theme: Theme
  tabs: Tab[]
  active: number
  onSelect: (id: number) => void
  onOpen: () => void
}) {
  return (
    <Card className="w-full border-input shadow-lg">
      <Tabs value={active} onValueChange={(value) => onSelect(Number(value))}>
        <div className="flex min-w-0 border-b bg-muted text-xs">
          <TabsList aria-label="terminal tabs" className="flex-1">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="-mb-px flex-[0_1_136px] gap-2 py-2 text-xs">
                <i className="size-2 flex-none rounded-full" style={{ background: tab.theme.cursor }} />
                <span className="min-w-0 truncate">{tab.theme.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="new tab on the next sheet"
            className="h-auto w-9.5 flex-none rounded-none text-muted-foreground hover:text-primary"
            onClick={onOpen}
          >
            <PlusIcon />
          </Button>
        </div>
      </Tabs>
      <div className="relative">
        <ScrollArea orientation="horizontal" contentClassName="term w-max min-w-full px-4.5 pt-3.5 pb-4">
          <Session theme={theme} />
        </ScrollArea>
      </div>
    </Card>
  )
}
