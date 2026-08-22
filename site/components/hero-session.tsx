'use client'

import { Collapsible } from '@base-ui/react/collapsible'
import { ContextMenu } from '@base-ui/react/context-menu'
import { Menu } from '@base-ui/react/menu'
import { ScrollArea } from '@base-ui/react/scroll-area'
import { Tabs } from '@base-ui/react/tabs'
import { Toolbar } from '@base-ui/react/toolbar'
import { type CSSProperties, type FocusEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import type { GateRule, Theme } from '@/lib/themes'
import { CopyCommand } from './copy-command'
import { gateScore, Inspector } from './hero-inspector'
import { GitSurface, ListSurface, NvimStatus, NvimSurface } from './hero-surfaces'
import { Tip } from './palette-sidebar'

const SURFACES = [
  { value: 'ttheme', label: 'ttheme' },
  { value: 'nvim', label: 'nvim' },
  { value: 'git', label: 'git' },
]
const REPO = 'https://github.com/kecan0406/ttheme/blob/main/themes'
const NOTICE_MS = 1600

function paletteStyle(theme: Theme): CSSProperties {
  const style: Record<string, string> = {
    '--bg': theme.background,
    '--fg': theme.foreground,
    '--cu': theme.cursor,
    '--se': theme.selectionBackground,
  }
  for (const [index, color] of theme.ansi.entries()) style[`--a${index}`] = color
  return style as CSSProperties
}

function Scrollback({ active, tail, children }: { active: boolean; tail?: boolean; children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = viewport.current
    if (element && active && tail) element.scrollTop = element.scrollHeight
  }, [active, tail])

  return (
    <ScrollArea.Root className="min-h-0 min-w-0">
      <ScrollArea.Viewport ref={viewport} className="hero-view">
        <ScrollArea.Content className={tail ? 'hero-scr hero-scr-tail' : 'hero-scr'}>{children}</ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar className="hero-bar" orientation="vertical">
        <ScrollArea.Thumb className="hero-thumb" />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar className="hero-bar hero-bar-x" orientation="horizontal">
        <ScrollArea.Thumb className="hero-thumb" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
}

function Actions({
  theme,
  kind,
  paused,
  onPausedChange,
  onNotice,
}: {
  theme: Theme
  kind: 'menu' | 'context'
  paused: boolean
  onPausedChange: (paused: boolean) => void
  onNotice: (notice: string) => void
}) {
  const Item = kind === 'context' ? ContextMenu.Item : Menu.Item
  const Separator = kind === 'context' ? ContextMenu.Separator : Menu.Separator

  const copy = async (text: string, notice: string) => {
    try {
      await navigator.clipboard.writeText(text)
      onNotice(notice)
    } catch {
      onNotice('clipboard blocked')
    }
  }

  return (
    <>
      <Item className="hero-item" onClick={() => copy(`ttheme ${theme.name}`, `copied ttheme ${theme.name}`)}>
        copy <code>ttheme {theme.name}</code>
      </Item>
      <Item className="hero-item" onClick={() => copy(theme.ansi.join('\n'), 'copied 16 ansi colors')}>
        copy the 16 ansi colors
      </Item>
      <Separator className="hero-sep" />
      <Item className="hero-item" render={<a href={`${REPO}/${theme.name}.toml`} target="_blank" rel="noreferrer" />}>
        open themes/{theme.name}.toml
      </Item>
      <Item className="hero-item" onClick={() => onPausedChange(!paused)}>
        {paused ? 'resume cycling' : 'keep this palette'}
      </Item>
    </>
  )
}

export function HeroSession({
  theme,
  themes,
  gate,
  position,
  paused,
  onPausedChange,
  onHoldChange,
  cycleMs,
  cycleKey,
}: {
  theme: Theme
  themes: Theme[]
  gate: GateRule[]
  position: string
  paused: boolean
  onPausedChange: (paused: boolean) => void
  onHoldChange: (held: boolean) => void
  cycleMs: number
  cycleKey: number
}) {
  const [surface, setSurface] = useState('ttheme')
  const [inspector, setInspector] = useState(false)
  const [held, setHeld] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!notice) return
    const clear = window.setTimeout(() => setNotice(''), NOTICE_MS)
    return () => clearTimeout(clear)
  }, [notice])

  const hold = (value: boolean) => {
    setHeld(value)
    onHoldChange(value)
  }
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) hold(false)
  }

  const score = gateScore(theme, gate)
  const running = !paused && !held
  const actions = { theme, paused, onPausedChange, onNotice: setNotice }

  return (
    <section className="@container grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_44px] px-3.5 pt-3.5 max-md:pr-[3.125rem]">
      <Collapsible.Root
        open={inspector}
        onOpenChange={setInspector}
        className="term hero-win"
        style={paletteStyle(theme)}
        onPointerEnter={() => hold(true)}
        onPointerLeave={() => hold(false)}
        onFocusCapture={() => hold(true)}
        onBlurCapture={onBlur}
      >
        <div className="hero-cycle" aria-hidden="true">
          <i
            key={cycleKey}
            style={{ animationDuration: `${cycleMs}ms`, animationPlayState: running ? 'running' : 'paused' }}
          />
        </div>

        <Tabs.Root value={surface} onValueChange={(value) => setSurface(String(value))} className="hero-body">
          <div className="hero-strip">
            <Tabs.List className="hero-tablist">
              {SURFACES.map((entry) => (
                <Tabs.Tab key={entry.value} value={entry.value} className="hero-tab">
                  {entry.label}
                </Tabs.Tab>
              ))}
              <Tabs.Indicator className="hero-tabind" />
            </Tabs.List>
            <span className="hero-title max-md:hidden">
              {theme.name} — {theme.group}
            </span>
            <Toolbar.Root className="hero-tools" aria-label="terminal">
              <Tip label={paused ? 'resume cycling' : 'keep this palette'}>
                <Toolbar.Button
                  className="hero-tool"
                  aria-label={paused ? 'resume cycling' : 'stop cycling'}
                  aria-pressed={!paused}
                  onClick={() => onPausedChange(!paused)}
                >
                  {paused ? '▶' : '❚❚'}
                </Toolbar.Button>
              </Tip>
              <Toolbar.Separator className="hero-tsep" />
              <Menu.Root>
                <Toolbar.Button render={<Menu.Trigger />} className="hero-tool" aria-label="palette actions">
                  ⋯
                </Toolbar.Button>
                <Menu.Portal>
                  <Menu.Positioner align="end" sideOffset={6} className="outline-none">
                    <Menu.Popup className="hero-menu">
                      <Actions kind="menu" {...actions} />
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </Toolbar.Root>
          </div>

          <ContextMenu.Root>
            <ContextMenu.Trigger className="hero-panels">
              <Tabs.Panel keepMounted value="ttheme" className="hero-panel">
                <Scrollback active={surface === 'ttheme'} tail>
                  <ListSurface theme={theme} themes={themes} />
                </Scrollback>
              </Tabs.Panel>
              <Tabs.Panel keepMounted value="nvim" className="hero-panel">
                <Scrollback active={surface === 'nvim'}>
                  <NvimSurface theme={theme} />
                </Scrollback>
                <NvimStatus theme={theme} />
              </Tabs.Panel>
              <Tabs.Panel keepMounted value="git" className="hero-panel">
                <Scrollback active={surface === 'git'} tail>
                  <GitSurface theme={theme} score={score} rules={gate.length} count={themes.length} />
                </Scrollback>
              </Tabs.Panel>
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Positioner className="outline-none">
                <ContextMenu.Popup className="hero-menu">
                  <Actions kind="context" {...actions} />
                </ContextMenu.Popup>
              </ContextMenu.Positioner>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        </Tabs.Root>

        <div className="hero-status">
          <b className="hero-status-name">◆ {theme.name}</b>
          <span className="hero-status-dim max-sm:hidden">
            {theme.group}
            {theme.native ? ` ${theme.native}` : ''}
          </span>
          <span className="hero-status-dim max-lg:hidden">ANSI {theme.ansiSource}</span>
          <span className="hero-status-notice">{notice}</span>
          <span className="hero-status-pos tabular-nums">{position}</span>
          <Collapsible.Trigger className="hero-gate" aria-label="contrast gate">
            <span className={score === gate.length ? 'term-c2' : 'term-c1'}>●</span> gate {score}/{gate.length}
          </Collapsible.Trigger>
        </div>

        <Collapsible.Panel className="hero-drawer">
          <Inspector theme={theme} gate={gate} />
        </Collapsible.Panel>
      </Collapsible.Root>

      <footer className="flex min-w-0 items-center gap-3.5 text-xs whitespace-nowrap text-muted">
        <span className="min-w-0 truncate max-md:hidden">
          <kbd>←</kbd> <kbd>→</kbd> browse · <kbd>\</kbd> sidebar · <kbd>/</kbd> find · <kbd>right-click</kbd> actions
        </span>
        <span className="ml-auto flex-none">
          <CopyCommand command="npx @kecan0406/ttheme init" />
        </span>
      </footer>
    </section>
  )
}
