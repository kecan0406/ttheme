'use client'

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, GaugeIcon, ListIcon, SwatchBookIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { gatePassed, seriesOf, sheetNumber } from '@/lib/sheet'
import type { GateRule, Theme } from '@/lib/themes'
import { cn } from '@/lib/utils'
import { useSettling, wearStyle } from '@/lib/wear'
import { CommandRow } from './command-row'
import { GateList, PropertyList, SectionLabel, Signature, SwatchGrid } from './palette-parts'
import { SiteHeader } from './site-header'
import { type Tab, TerminalWindow } from './terminal-window'

interface OpenTab {
  id: number
  index: number
}

function typing(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('input, textarea, [role="tablist"]') !== null
}

export function Sheets({ themes, gate }: { themes: Theme[]; gate: GateRule[] }) {
  const series = useMemo(() => seriesOf(themes), [themes])
  const [openTabs, setOpenTabs] = useState<OpenTab[]>(() => themes.slice(0, 3).map((_, id) => ({ id, index: id })))
  const [active, setActive] = useState(0)
  const [details, setDetails] = useState(false)
  const nextId = useRef(openTabs.length)
  const strip = useRef<HTMLDivElement>(null)
  const at = (openTabs.find((tab) => tab.id === active) ?? (openTabs[0] as OpenTab)).index
  const theme = themes[at] as Theme
  const root = useSettling<HTMLDivElement>(theme.name)
  const tabs: Tab[] = openTabs.map(({ id, index }) => ({ id, theme: themes[index] as Theme }))
  const passed = gatePassed(theme, gate)

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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return
      if (event.key === 'ArrowRight') step(1)
      if (event.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  useEffect(() => {
    const tile = strip.current?.querySelector<HTMLElement>(`[data-sheet="${theme.name}"]`)
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
    tile?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: smooth ? 'smooth' : 'auto' })
  }, [theme.name])

  const scrollStrip = (direction: number) => {
    const element = strip.current
    if (element) element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <div ref={root} className="wear ground flex min-h-dvh flex-col" style={wearStyle(theme)}>
      <div className="mx-auto grid w-[min(1280px,calc(100%-40px))] flex-1 grid-cols-[minmax(0,1fr)] content-start gap-5 pt-4.5">
        <SiteHeader current="/sheets" themeToggle={false} />

        <section aria-label={theme.name} className="grid justify-items-center gap-6 pt-8 pb-10">
          <div className="grid w-full max-w-[880px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
            <Button variant="outline" size="icon" aria-label="previous sheet" onClick={() => step(-1)}>
              <ChevronLeftIcon />
            </Button>
            <div className="grid justify-items-center gap-2 text-center">
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {sheetNumber(themes, theme)} / {themes.length}
              </span>
              <h1 className="font-display text-display-lg font-black text-primary [overflow-wrap:anywhere]">
                {theme.name}
              </h1>
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-soft-foreground">
                <span>
                  {theme.group}
                  {theme.lead ? ' · lead' : ''}
                </span>
                <Signature theme={theme} />
                <Badge variant={passed === gate.length ? 'success' : 'warning'}>
                  {passed} / {gate.length} floors
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="icon" aria-label="next sheet" onClick={() => step(1)}>
              <ChevronRightIcon />
            </Button>
          </div>

          <div className="w-full max-w-[880px]">
            <TerminalWindow theme={theme} tabs={tabs} active={active} onSelect={setActive} onOpen={openTab} />
          </div>

          <div className="grid w-full max-w-[880px] gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CommandRow command={`ttheme use ${theme.name}`} className="min-w-70 flex-1 bg-card" />
              <Button
                variant="outline"
                aria-expanded={details}
                aria-controls="sheet-details"
                onClick={() => setDetails((open) => !open)}
              >
                slots and contrast
                <ChevronDownIcon className={cn('transition-transform', details && 'rotate-180')} />
              </Button>
            </div>
            {details ? (
              <div
                id="sheet-details"
                className="grid grid-cols-2 gap-6 rounded-3xl border bg-glass-panel p-6 shadow-md backdrop-blur-[22px] backdrop-saturate-170 motion-safe:animate-enter max-[760px]:grid-cols-1"
              >
                <div className="grid content-start gap-6">
                  <section>
                    <SectionLabel icon={<ListIcon />}>Properties</SectionLabel>
                    <PropertyList
                      rows={[
                        ['Series', `${theme.group}${theme.lead ? ' · lead' : ''}`],
                        ['ANSI from', theme.ansiSource],
                        ['Signature', theme.signatureSlots.join(' · ')],
                      ]}
                    />
                  </section>
                  <section>
                    <SectionLabel icon={<GaugeIcon />}>Contrast gate</SectionLabel>
                    <GateList theme={theme} gate={gate} />
                  </section>
                </div>
                <section>
                  <SectionLabel icon={<SwatchBookIcon />}>Slots</SectionLabel>
                  <SwatchGrid theme={theme} />
                </section>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <nav
        aria-label="every sheet"
        className="sticky bottom-4 mx-auto mb-4 flex w-[min(1280px,calc(100%-40px))] items-center gap-2 rounded-xl border bg-glass p-2 shadow-md backdrop-blur-[14px]"
      >
        <Button variant="ghost" size="icon-sm" aria-label="scroll back" onClick={() => scrollStrip(-1)}>
          <ChevronLeftIcon />
        </Button>
        <div ref={strip} className="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
          {series.map((entry) => (
            <div key={entry.name} className="flex flex-none items-stretch gap-2">
              <span className="flex flex-none items-center pr-1 pl-2 text-2xs font-bold tracking-caps whitespace-nowrap text-muted-foreground uppercase">
                {entry.name}
              </span>
              {entry.themes.map((sheet) => (
                <button
                  key={sheet.name}
                  type="button"
                  data-sheet={sheet.name}
                  aria-current={sheet === theme ? 'true' : undefined}
                  onClick={() => paint(themes.indexOf(sheet))}
                  style={{ background: sheet.background, color: sheet.foreground }}
                  className="grid w-32 flex-none snap-center gap-1 rounded-2xl border border-[color-mix(in_oklab,currentColor_14%,transparent)] px-3 py-2 text-left transition-transform duration-200 outline-none hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring active:scale-98 active:duration-500 active:ease-spring aria-[current=true]:ring-2 aria-[current=true]:ring-ring motion-reduce:hover:translate-y-0"
                >
                  <span className="truncate font-display text-sm font-extrabold" style={{ color: sheet.cursor }}>
                    {sheet.name}
                  </span>
                  <Signature theme={sheet} />
                </button>
              ))}
            </div>
          ))}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="scroll on" onClick={() => scrollStrip(1)}>
          <ChevronRightIcon />
        </Button>
      </nav>
    </div>
  )
}
