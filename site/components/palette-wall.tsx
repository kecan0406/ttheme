'use client'

import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { type CSSProperties, useMemo, useState } from 'react'
import { PaletteBoard } from '@/components/palette-board'
import type { Theme } from '@/lib/themes'

const stripSlots = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan']

const pillClass =
  'cursor-pointer border border-line px-3 py-[5px] text-xs text-muted transition-colors ' +
  'hover:text-ink data-pressed:border-accent data-pressed:font-bold data-pressed:text-ink'

function cardVars(theme: Theme): CSSProperties {
  return {
    '--cbg': theme.background,
    '--cfg': theme.foreground,
    '--cmut': theme.ansi[8],
  } as CSSProperties
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

  const groups = useMemo(() => {
    const counts = new Map<string, number>()
    for (const theme of themes) {
      counts.set(theme.group, (counts.get(theme.group) ?? 0) + 1)
    }
    return [...counts.entries()]
  }, [themes])

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
        {groups.map(([name, count]) => (
          <Toggle key={name} value={name} className={pillClass}>
            {name}
            <span className="ml-[7px] opacity-55">{count}</span>
          </Toggle>
        ))}
      </ToggleGroup>
      {view === 'board' ? (
        <PaletteBoard list={list} current={current} onWear={onWear} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5">
          {list.map((theme) => (
            <button
              key={theme.name}
              type="button"
              data-active={theme === current || undefined}
              onClick={() => onWear(theme)}
              style={cardVars(theme)}
              className="flex cursor-pointer flex-col gap-[9px] rounded-lg border border-line bg-(--cbg) p-[13px] pb-3 text-left text-(--cfg) outline-offset-2 transition-transform hover:-translate-y-0.5 data-active:outline-2 data-active:outline-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span className="text-[13px] font-bold">{theme.name}</span>
              <span className="text-[10.5px] text-(--cmut)">{theme.group}</span>
              <span className="mt-0.5 flex h-2 gap-[3px]">
                {theme.ansi.slice(1, 7).map((color, index) => (
                  <i key={stripSlots[index]} className="flex-1 rounded-[2px]" style={{ background: color }} />
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
