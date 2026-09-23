import type { ReactNode, Ref } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type Slot, slotOf } from '@/lib/sheet'
import type { Theme } from '@/lib/themes'

export interface Tab {
  id: number
  theme: Theme
}

function Line({ children }: { children?: ReactNode }) {
  return <div className="term-line">{children}</div>
}

function Paint({
  slot,
  focus,
  className,
  children,
}: {
  slot?: Slot
  focus: Slot | null
  className?: string
  children?: ReactNode
}) {
  return (
    <span className={className} data-mark={slot} data-hl={slot !== undefined && slot === focus ? '' : undefined}>
      {children}
    </span>
  )
}

function Prompt({ focus, cwd, branch }: { focus: Slot | null; cwd?: Slot; branch?: Slot }) {
  return (
    <>
      <span className="term-c2">{'➜  '}</span>
      <Paint slot={cwd} focus={focus} className="term-c6">
        ttheme
      </Paint>
      <span className="term-c4">{' git:('}</span>
      <Paint slot={branch} focus={focus} className="term-c1">
        main
      </Paint>
      <span className="term-c4">{') '}</span>
    </>
  )
}

function Session({ theme, focus }: { theme: Theme; focus: Slot | null }) {
  const file = `themes/${theme.name}.toml`

  return (
    <>
      <Line>
        <Prompt focus={focus} branch="a1" />
        {`ttheme ${theme.name}`}
      </Line>
      <Line>
        <Paint slot="se" focus={focus} className="term-on-se">{` ${theme.group} `}</Paint>
      </Line>
      <Line>
        <span className="term-on-cu">{` ${theme.name} `}</span>
        {'  '}
        <Paint slot="a8" focus={focus} className="term-c8">{`ANSI ${theme.ansiSource}`}</Paint>
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
        <Paint slot="a7" focus={focus} className="term-c7">
          {theme.signatureSlots.join(' ')}
        </Paint>
      </Line>
      <Line>
        <Prompt focus={focus} />
        <Paint slot="fg" focus={focus}>
          git log --oneline -2
        </Paint>
      </Line>
      <Line>
        <span className="term-c3">b699337</span> <span className="term-c6 font-bold">{'(HEAD -> '}</span>
        <Paint slot="a2" focus={focus} className="term-c2 font-bold">
          main
        </Paint>
        <span className="term-c6 font-bold">)</span>
        {' Harmonize every palette'}
      </Line>
      <Line>
        <Paint slot="a3" focus={focus} className="term-c3">
          ff9cb92
        </Paint>
        {' Pin palettes to directories'}
      </Line>
      <Line>
        <Prompt focus={focus} cwd="a6" />
        {'ls ~/.config/ttheme'}
      </Line>
      <Line>
        <Paint slot="a4" focus={focus} className="term-c4 font-bold">
          ghostty/
        </Paint>
        {'  '}
        <span className="term-c4 font-bold">kitty/</span>
        {'  '}
        <span className="term-c4 font-bold">shell/</span>
        {'  pins'}
      </Line>
      <Line>
        <Prompt focus={focus} />
        {`grep -H '^cursor' ${file}`}
      </Line>
      <Line>
        <Paint slot="a5" focus={focus} className="term-c5">
          {file}
        </Paint>
        <span className="term-c6">:</span>
        <span className="term-c1 font-bold">cursor</span>
        {` = "${theme.cursor}"`}
      </Line>
      <Line>
        {'      '}
        <Paint slot="bg" focus={focus}>
          {' '.repeat(22)}
        </Paint>
      </Line>
      <Line>
        <Prompt focus={focus} />
        <Paint slot="cu" focus={focus} className="term-caret" />
      </Line>
    </>
  )
}

export function TerminalWindow({
  theme,
  tabs,
  active,
  focus,
  onSelect,
  onOpen,
  windowRef,
  viewportRef,
  backdrop,
}: {
  theme: Theme
  tabs: Tab[]
  active: number
  focus: Slot | null
  onSelect: (id: number) => void
  onOpen: () => void
  windowRef?: Ref<HTMLDivElement>
  viewportRef?: Ref<HTMLDivElement>
  backdrop?: ReactNode
}) {
  return (
    <Card ref={windowRef} className="gap-0 rounded-lg py-0 shadow-[0_40px_80px_-52px_rgb(0_0_0/.75)] ring-input">
      <Tabs value={active} onValueChange={(value) => onSelect(Number(value))}>
        <div className="flex min-w-0 border-b bg-muted text-xs">
          <TabsList aria-label="terminal tabs" className="flex-1">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="-mb-px flex-[0_1_136px] gap-[7px] py-[7px]">
                <i className="size-[7px] flex-none rounded-full" style={{ background: tab.theme.cursor }} />
                <span className="min-w-0 truncate">{tab.theme.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="new tab on the next sheet"
            className="h-auto w-[38px] flex-none rounded-none text-base text-muted-foreground hover:text-primary"
            onClick={onOpen}
          >
            +
          </Button>
        </div>
      </Tabs>
      <div className="relative">
        {backdrop}
        <ScrollArea
          viewportRef={viewportRef}
          orientation="horizontal"
          contentClassName="term w-max min-w-full px-[18px] pt-3.5 pb-4"
        >
          <Session theme={theme} focus={focus} />
        </ScrollArea>
      </div>
    </Card>
  )
}
