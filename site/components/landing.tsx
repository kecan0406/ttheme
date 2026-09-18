'use client'

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import type { GateRule, Theme } from '@/lib/themes'
import { Designation } from './designation'
import { SheetHead } from './sheet-head'
import { SheetLegend } from './sheet-legend'
import { SheetSidebar } from './sheet-sidebar'
import type { Tab } from './terminal-window'

const COMMAND = 'npx @kecan0406/ttheme init'

interface OpenTab {
  id: number
  index: number
}

function wearStyle(theme: Theme): CSSProperties {
  const style: Record<string, string> = {
    '--bg': theme.background,
    '--fg': theme.foreground,
    '--cu': theme.cursor,
    '--se': theme.selectionBackground,
  }
  for (const [index, color] of theme.ansi.entries()) style[`--a${index}`] = color
  return style as CSSProperties
}

function ownsArrows(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('input, textarea, [role="tablist"], [data-slot="scroll-area-viewport"]') !== null
  )
}

export function Landing({ themes, gate, version }: { themes: Theme[]; gate: GateRule[]; version: string }) {
  const [openTabs, setOpenTabs] = useState<OpenTab[]>(() => themes.slice(0, 3).map((_, id) => ({ id, index: id })))
  const [active, setActive] = useState(0)
  const [drawer, setDrawer] = useState(false)
  const nextId = useRef(openTabs.length)
  const at = (openTabs.find((tab) => tab.id === active) ?? (openTabs[0] as OpenTab)).index
  const current = themes[at] as Theme
  const tabs: Tab[] = openTabs.map(({ id, index }) => ({ id, theme: themes[index] as Theme }))

  const paint = useCallback(
    (index: number) => setOpenTabs((list) => list.map((tab) => (tab.id === active ? { ...tab, index } : tab))),
    [active],
  )

  const step = useCallback(
    (delta: number) => paint((at + delta + themes.length) % themes.length),
    [themes.length, at, paint],
  )

  const openTab = () => {
    const tab = { id: nextId.current++, index: ((openTabs.at(-1) as OpenTab).index + 1) % themes.length }
    setOpenTabs([...openTabs, tab].slice(-4))
    setActive(tab.id)
  }

  const pick = (theme: Theme) => {
    paint(themes.indexOf(theme))
    setDrawer(false)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawer(false)
      if (event.metaKey || event.ctrlKey || event.altKey || ownsArrows(event.target)) return
      if (event.key === 'ArrowRight') step(1)
      if (event.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  return (
    <div
      className="wear grid h-dvh grid-cols-[288px_minmax(0,1fr)] overflow-hidden text-[13px]/[1.55] max-[860px]:grid-cols-1"
      style={wearStyle(current)}
    >
      <SheetSidebar themes={themes} current={current} version={version} command={COMMAND} open={drawer} onPick={pick} />
      {drawer ? (
        <button
          type="button"
          aria-label="close sheets"
          className="fixed inset-0 z-20 hidden cursor-default bg-black/45 max-[860px]:block"
          onClick={() => setDrawer(false)}
        />
      ) : null}
      <main className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto]">
        <SheetHead theme={current} themes={themes} gate={gate} onStep={step} onOpenSheets={() => setDrawer(true)} />
        <Designation theme={current} gate={gate} tabs={tabs} active={active} onSelect={setActive} onOpen={openTab} />
        <SheetLegend />
      </main>
    </div>
  )
}
