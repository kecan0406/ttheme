'use client'

import { type CSSProperties, useMemo } from 'react'
import type { Theme } from '@/lib/themes'

const CORE_SLOTS = ['bg', 'fg', 'cur', 'sel']
const ANSI_SLOTS = Array.from({ length: 16 }, (_, index) => `a${index}`)

const coreOf = (theme: Theme) => [theme.background, theme.foreground, theme.cursor, theme.selectionBackground]

function Swatch({ hex, className }: { hex: string; className: string }) {
  return <span className={`swcell h-[22px] rounded-[4px] ${className}`} data-hex={hex} style={{ background: hex }} />
}

function Chip({ theme }: { theme: Theme }) {
  return (
    <span
      className="overflow-hidden whitespace-nowrap rounded-md px-2.5 py-[5px] text-[10.5px] leading-normal"
      style={{ background: theme.background, color: theme.foreground }}
    >
      <span style={{ color: theme.ansi[2] }}>➜</span> ~ <span style={{ color: theme.ansi[4] }}>git:(</span>
      <span style={{ color: theme.ansi[1] }}>main</span>
      <span style={{ color: theme.ansi[4] }}>)</span> <span style={{ background: theme.selectionBackground }}>sel</span>{' '}
      <span className="inline-block h-[1em] w-[0.55em] align-text-bottom" style={{ background: theme.cursor }} />
    </span>
  )
}

const rowGrid = 'grid grid-cols-[150px_122px_1fr_240px] items-center gap-3.5'

function BoardRow({ theme, active, onWear }: { theme: Theme; active: boolean; onWear: () => void }) {
  return (
    <button
      type="button"
      data-active={active || undefined}
      onClick={onWear}
      style={{ '--rowcur': theme.cursor } as CSSProperties}
      className={`${rowGrid} cursor-pointer rounded-[7px] border border-transparent px-2 py-[5px] text-left outline-offset-1 hover:border-line hover:bg-[#171a22] data-active:border-(--rowcur) data-active:bg-[#171a22]`}
    >
      <span className="flex flex-col gap-px">
        <b className="text-[12.5px]">{theme.name}</b>
        <span className="overflow-hidden text-[10px] text-ellipsis whitespace-nowrap text-muted">
          {theme.ansiSource}
        </span>
      </span>
      <span className="flex gap-[3px]">
        {CORE_SLOTS.map((slot, index) => (
          <Swatch
            key={slot}
            hex={coreOf(theme)[index] ?? theme.background}
            className={slot === 'bg' ? 'w-10 border border-line' : 'w-[27px]'}
          />
        ))}
      </span>
      <span className="flex gap-[3px]">
        {ANSI_SLOTS.map((slot, index) => (
          <Swatch key={slot} hex={theme.ansi[index] ?? theme.foreground} className="w-[22px]" />
        ))}
      </span>
      <Chip theme={theme} />
    </button>
  )
}

export function PaletteBoard({
  list,
  current,
  onWear,
}: {
  list: Theme[]
  current: Theme
  onWear: (theme: Theme) => void
}) {
  const sections = useMemo(() => {
    const byGroup = new Map<string, Theme[]>()
    for (const theme of list) {
      const bucket = byGroup.get(theme.group)
      if (bucket) bucket.push(theme)
      else byGroup.set(theme.group, [theme])
    }
    return [...byGroup.entries()]
  }, [list])

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className={`${rowGrid} px-2 pt-4 pb-1.5 text-[10px] uppercase tracking-[0.07em] text-muted`}>
            <span>theme</span>
            <span>bg · fg · cur · sel</span>
            <span>ansi 0–15</span>
            <span>preview</span>
          </div>
          {sections.map(([group, themesInGroup]) => (
            <div key={group}>
              <div className="flex items-baseline gap-2.5 pt-3 pb-2 text-xs font-bold">
                {group}
                <span className="text-[11px] font-normal text-muted tabular-nums">{themesInGroup.length}</span>
              </div>
              <div className="flex flex-col gap-1">
                {themesInGroup.map((theme) => (
                  <BoardRow key={theme.name} theme={theme} active={theme === current} onWear={() => onWear(theme)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
