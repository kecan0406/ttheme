'use client'

import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { type CSSProperties, useMemo, useState } from 'react'
import { PaletteBoard } from '@/components/palette-board'
import type { Theme } from '@/lib/themes'

const stripSlots = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan']
const sigSlots = ['signature', 'support', 'accent']
const ansiSlots = Array.from({ length: 16 }, (_, index) => `a${index}`)

const pillClass =
  'cursor-pointer border border-line px-3 py-[5px] text-xs text-muted transition-colors ' +
  'hover:text-ink data-pressed:border-accent data-pressed:font-bold data-pressed:text-ink'

const cardClass =
  'cursor-pointer flex-col gap-[9px] rounded-lg border border-line bg-(--cbg) p-[13px] pb-3 text-left ' +
  'text-(--cfg) outline-offset-2 transition-transform hover:-translate-y-0.5 motion-reduce:transition-none ' +
  'motion-reduce:hover:translate-y-0'

interface Band {
  group: string
  native: string | null
  accent: string
  themes: Theme[]
}

function cardVars(theme: Theme): CSSProperties {
  return {
    '--cbg': theme.background,
    '--cfg': theme.foreground,
    '--cmut': theme.ansi[8],
  } as CSSProperties
}

function bandsOf(themes: Theme[]): Band[] {
  const bands: Band[] = []
  for (const theme of themes) {
    const open = bands.at(-1)
    if (open?.group === theme.group) open.themes.push(theme)
    else bands.push({ group: theme.group, native: theme.native, accent: theme.signature[0] as string, themes: [theme] })
  }
  for (const band of bands) {
    band.accent = (band.themes.find((theme) => theme.lead) ?? band.themes[0])?.signature[0] as string
  }
  return bands
}

function Signature({ theme, className }: { theme: Theme; className: string }) {
  return (
    <span className={`flex gap-1 ${className}`}>
      {theme.signature.map((color, index) => (
        <i
          key={sigSlots[index]}
          className={`rounded-[3px] ${index === 0 ? 'flex-[2.4]' : 'flex-1'}`}
          style={{ background: color }}
        />
      ))}
    </span>
  )
}

function Strip({ theme }: { theme: Theme }) {
  return (
    <span className="flex h-1.5 gap-[3px] opacity-70">
      {theme.ansi.slice(1, 7).map((color, index) => (
        <i key={stripSlots[index]} className="flex-1 rounded-[2px]" style={{ background: color }} />
      ))}
    </span>
  )
}

function Card({ theme, onWear }: { theme: Theme; onWear: () => void }) {
  return (
    <button type="button" onClick={onWear} style={cardVars(theme)} className={`flex ${cardClass}`}>
      <Signature theme={theme} className="h-10" />
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-bold">{theme.name}</span>
        <span className="text-[10.5px] text-(--cmut)">{theme.native ?? theme.group}</span>
      </span>
      <Strip theme={theme} />
    </button>
  )
}

function OpenCard({ theme, onWear }: { theme: Theme; onWear: () => void }) {
  return (
    <button
      type="button"
      onClick={onWear}
      style={cardVars(theme)}
      className={`col-span-2 grid ${cardClass} outline-2 outline-accent`}
    >
      <span className="flex items-baseline gap-2">
        <span className="text-[13px] font-bold">{theme.name}</span>
        <span className="overflow-hidden text-[10.5px] text-ellipsis whitespace-nowrap text-(--cmut)">
          {theme.native ?? theme.group}
        </span>
      </span>
      <Signature theme={theme} className="h-10" />
      <span className="flex flex-col py-0.5 text-[11px] leading-[1.7]">
        <span className="truncate">
          <span style={{ color: theme.ansi[2] }}>➜</span> ~ ttheme {theme.name}
        </span>
        <span className="truncate text-(--cmut)">
          {theme.name} · {theme.group} · ANSI {theme.ansiSource}
        </span>
      </span>
      <span className="flex h-2 gap-[2px]">
        {theme.ansi.map((color, index) => (
          <i key={ansiSlots[index]} className="flex-1 rounded-[1px]" style={{ background: color }} />
        ))}
      </span>
    </button>
  )
}

function Grid({ list, current, onWear }: { list: Theme[]; current: Theme; onWear: (theme: Theme) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5">
      {list.map((theme) =>
        theme === current ? (
          <OpenCard key={theme.name} theme={theme} onWear={() => onWear(theme)} />
        ) : (
          <Card key={theme.name} theme={theme} onWear={() => onWear(theme)} />
        ),
      )}
    </div>
  )
}

export function PaletteWall({
  themes,
  group,
  list,
  current,
  onGroup,
  onWear,
}: {
  themes: Theme[]
  group: string
  list: Theme[]
  current: Theme
  onGroup: (group: string) => void
  onWear: (theme: Theme) => void
}) {
  const [view, setView] = useState<'cards' | 'board'>('cards')

  const bands = useMemo(() => bandsOf(themes), [themes])

  return (
    <section className="mx-auto max-w-[1160px] px-6 pt-24">
      <div className="mb-[18px] flex items-baseline gap-3.5">
        <h2 className="text-[15px] font-bold">palettes</h2>
        <span className="text-xs text-muted tabular-nums">
          {list.length}/{themes.length}
        </span>
        <ToggleGroup
          value={[view]}
          onValueChange={(value) => setView((value[0] as 'cards' | 'board') ?? 'cards')}
          className="ml-auto flex gap-2"
        >
          <Toggle value="cards" className={pillClass}>
            cards
          </Toggle>
          <Toggle value="board" className={pillClass}>
            board
          </Toggle>
        </ToggleGroup>
        <span className="text-xs text-muted max-sm:hidden">
          {view === 'cards' ? 'click a card to wear it' : 'click a row to wear it'}
        </span>
      </div>
      <ToggleGroup
        value={[group]}
        onValueChange={(value) => onGroup((value[0] as string) ?? 'all')}
        className="mb-[26px] flex flex-wrap gap-2"
      >
        <Toggle value="all" className={pillClass}>
          all<span className="ml-[7px] opacity-55">{themes.length}</span>
        </Toggle>
        {bands.map((band) => (
          <Toggle key={band.group} value={band.group} className={pillClass}>
            <span
              className="mr-2 inline-block size-[7px] rounded-[2px] align-middle"
              style={{ background: band.accent }}
            />
            {band.group}
            <span className="ml-[7px] opacity-55">{band.themes.length}</span>
          </Toggle>
        ))}
      </ToggleGroup>
      {view === 'board' ? (
        <PaletteBoard list={list} current={current} onWear={onWear} />
      ) : group === 'all' ? (
        <div className="flex flex-col gap-9">
          {bands.map((band) => (
            <div key={band.group}>
              <div className="mb-3 flex items-baseline gap-3 border-b border-line pb-2">
                <span className="size-[9px] self-center rounded-[2px]" style={{ background: band.accent }} />
                <span className="text-[13px] font-bold">{band.group}</span>
                {band.native ? <span className="text-xs text-muted">{band.native}</span> : null}
                <span className="ml-auto text-[11px] text-muted tabular-nums">{band.themes.length}</span>
              </div>
              <Grid list={band.themes} current={current} onWear={onWear} />
            </div>
          ))}
        </div>
      ) : (
        <Grid list={list} current={current} onWear={onWear} />
      )}
    </section>
  )
}
