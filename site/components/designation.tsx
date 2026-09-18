'use client'

import { type PointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  CALLS,
  type Call,
  callNumber,
  floorOf,
  formatReading,
  hexOf,
  passes,
  type Reading,
  readingsFor,
  type Side,
  type Slot,
  weakestAccent,
} from '@/lib/sheet'
import type { GateRule, Theme } from '@/lib/themes'
import { cn } from '@/lib/utils'
import { Chip, Tag } from './sheet-parts'
import { type Tab, TerminalWindow } from './terminal-window'

interface Leader {
  key: Slot
  x: number
  y: number
  outer: string
  inner: string
}

interface Badge {
  key: Slot
  x: number
  y: number
}

interface Geometry {
  wide: boolean
  tops: Partial<Record<Slot, number>>
  floor: Record<Side, number>
  leaders: Leader[]
  badges: Badge[]
}

const SIDES: Side[] = ['l', 'r']
const WIDE = 980

const round = (value: number) => Math.round(value * 10) / 10

function measureGeometry(stage: HTMLElement, board: HTMLElement, frame: DOMRect): Geometry {
  const wide = stage.clientWidth >= WIDE
  const box = board.getBoundingClientRect()
  const geometry: Geometry = { wide, tops: {}, floor: { l: 0, r: 0 }, leaders: [], badges: [] }

  for (const side of SIDES) {
    const list = board.querySelector<HTMLElement>(`[data-calls="${side}"]`)
    if (!list) continue
    const rect = list.getBoundingClientRect()
    let floor = 0

    for (const item of list.querySelectorAll<HTMLElement>('[data-call]')) {
      const key = item.dataset.call as Slot
      const target = board.querySelector(`[data-mark="${key}"]`)?.getBoundingClientRect()
      const badge = item.querySelector<HTMLElement>('[data-num]')
      if (!target || !badge) continue
      const gap = round(target.top - box.top - 2)
      const x = round(target.left + target.width / 2 - box.left)

      if (!wide) {
        if (target.right > frame.left && target.left < frame.right) {
          geometry.badges.push({ key, x: round(Math.min(target.right + 6, frame.right - 12) - box.left), y: gap + 3 })
        }
        continue
      }

      const offset = badge.offsetTop + badge.offsetHeight / 2
      const top = round(Math.max(floor, target.top - 2 - rect.top - offset))
      floor = top + item.offsetHeight + 12
      geometry.tops[key] = top
      const anchorX = round(side === 'l' ? rect.right - box.left + 8 : rect.left - box.left - 8)
      const anchorY = round(rect.top - box.top + top + offset)
      const edge = round((side === 'l' ? frame.left : frame.right) - box.left)
      const bend = side === 'l' ? edge - 18 : edge + 18
      geometry.leaders.push({
        key,
        x,
        y: gap,
        outer: `M${anchorX} ${anchorY}H${bend}L${edge} ${gap}`,
        inner: `M${edge} ${gap}H${x}`,
      })
    }

    geometry.floor[side] = round(floor)
  }

  return geometry
}

function ReadingText({ reading }: { reading: Reading }) {
  const ok = passes(reading)
  const floor = floorOf(reading)

  return (
    <span>
      {reading.of ? <span className="text-muted-foreground/70">{reading.of} </span> : null}
      <b className={ok ? 'text-foreground' : 'text-(--a3)'}>{formatReading(reading)}</b>
      {floor ? ` ${floor}` : null}
      {ok ? null : ' waived'}
    </span>
  )
}

function Callout({
  call,
  side,
  theme,
  gate,
  weakest,
  top,
  on,
}: {
  call: Call
  side: Side
  theme: Theme
  gate: GateRule[]
  weakest: Slot
  top: number | undefined
  on: boolean
}) {
  const align = side === 'l' ? 'justify-end @max-[980px]:justify-start' : undefined

  return (
    <li
      data-call={call.key}
      data-on={on ? '' : undefined}
      style={top === undefined ? undefined : { top }}
      className={cn(
        'absolute inset-x-0 flex items-start gap-[9px] transition-opacity in-data-[focus]:not-data-[on]:opacity-40 @max-[980px]:static',
        side === 'l' && 'flex-row-reverse text-right @max-[980px]:flex-row @max-[980px]:text-left',
      )}
    >
      <span
        data-num
        className="mt-px grid size-5 flex-none place-items-center rounded-full bg-foreground text-[10.5px] font-bold text-background tabular-nums"
      >
        {callNumber(call.key)}
      </span>
      <Chip slots={call.slots} className="h-[34px] w-[42px]" />
      <span className="grid min-w-0 flex-1 leading-[1.4]">
        <span className={cn('flex flex-wrap items-baseline gap-x-[.8ch]', align)}>
          <b className="text-[13.5px]">{call.role}</b>
          {call.slots.length > 1 ? (
            <span className="text-[11px] text-muted-foreground">
              {call.slots.map((slot) => `ansi${slot.slice(1)}`).join(' · ')}
            </span>
          ) : null}
        </span>
        <span className={cn('flex flex-wrap gap-x-[1ch] text-[11.5px] tabular-nums', align)}>
          {call.slots.map((slot, index) => (
            <span key={slot} className={index > 0 ? 'text-muted-foreground' : undefined}>
              {hexOf(theme, slot)}
            </span>
          ))}
        </span>
        <span
          className={cn(
            'flex flex-wrap items-baseline gap-x-[1.1ch] text-[11px] text-muted-foreground tabular-nums',
            align,
          )}
        >
          {readingsFor(theme, gate, call.key).map((reading) => (
            <ReadingText key={`${reading.unit}-${reading.of ?? ''}`} reading={reading} />
          ))}
          {weakest === call.key ? <Tag>weakest</Tag> : null}
        </span>
      </span>
    </li>
  )
}

export function Designation({
  theme,
  gate,
  tabs,
  active,
  onSelect,
  onOpen,
}: {
  theme: Theme
  gate: GateRule[]
  tabs: Tab[]
  active: number
  onSelect: (id: number) => void
  onOpen: () => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const firstName = useRef(theme.name)
  const [geometry, setGeometry] = useState<Geometry | null>(null)
  const [focus, setFocus] = useState<Slot | null>(null)

  const measure = useCallback(() => {
    const stage = stageRef.current
    const board = boardRef.current
    const frame = windowRef.current
    if (!stage || !board || !frame) return
    const next = measureGeometry(stage, board, frame.getBoundingClientRect())
    setGeometry((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next))
  }, [])

  useLayoutEffect(() => {
    measure()
  })

  useEffect(() => {
    const stage = stageRef.current
    const board = boardRef.current
    const viewport = viewportRef.current
    if (!stage || !board) return
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    observer.observe(board)
    viewport?.addEventListener('scroll', measure, { passive: true })
    document.fonts.ready.then(measure)
    return () => {
      observer.disconnect()
      viewport?.removeEventListener('scroll', measure)
    }
  }, [measure])

  const hover = (event: PointerEvent<HTMLDivElement>) => {
    const node = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-call], [data-mark]') : null
    setFocus((node?.dataset.call ?? node?.dataset.mark ?? null) as Slot | null)
  }

  const wide = geometry?.wide === true
  const weakest = weakestAccent(theme)

  const callouts = (side: Side) => (
    <ol
      data-calls={side}
      aria-label={side === 'l' ? 'ground, text and neutrals' : 'accents'}
      className="relative @max-[980px]:grid @max-[980px]:content-start @max-[980px]:gap-3.5"
      style={wide ? { minHeight: geometry.floor[side] } : undefined}
    >
      {CALLS[side].map((call) => (
        <Callout
          key={call.key}
          call={call}
          side={side}
          theme={theme}
          gate={gate}
          weakest={weakest}
          top={wide ? geometry.tops[call.key] : undefined}
          on={focus === call.key}
        />
      ))}
    </ol>
  )

  return (
    <div ref={stageRef} className="board-grid @container flex min-h-0 flex-col overflow-auto">
      <div
        ref={boardRef}
        data-focus={focus ?? undefined}
        onPointerOver={hover}
        onPointerLeave={() => setFocus(null)}
        className="relative my-auto grid grid-cols-[minmax(196px,1fr)_minmax(0,40rem)_minmax(196px,1fr)] items-start gap-x-[clamp(28px,3.2cqi,56px)] px-5 py-6 @max-[980px]:my-0 @max-[980px]:grid-cols-2 @max-[980px]:gap-x-7 @max-[980px]:gap-y-[26px] @max-[560px]:grid-cols-1 @max-[560px]:px-4"
      >
        {callouts('l')}
        <div className="min-w-0 @max-[980px]:col-span-full @max-[980px]:row-start-1">
          <TerminalWindow
            theme={theme}
            tabs={tabs}
            active={active}
            focus={focus}
            onSelect={onSelect}
            onOpen={onOpen}
            windowRef={windowRef}
            viewportRef={viewportRef}
          />
        </div>
        {callouts('r')}
        <svg
          key={theme.name}
          aria-hidden="true"
          className={cn(
            'leaders pointer-events-none absolute inset-0 size-full overflow-visible',
            theme.name !== firstName.current && 'draw',
          )}
        >
          {geometry?.leaders.map((leader) => (
            <g key={leader.key} data-on={focus === leader.key ? '' : undefined}>
              <path className="leader-out" pathLength={1} d={leader.outer} />
              <path className="leader-in" d={leader.inner} />
              <circle cx={leader.x} cy={leader.y} r={2.5} />
            </g>
          ))}
          {geometry?.badges.map((badge) => (
            <g key={badge.key} className="leader-badge">
              <circle cx={badge.x} cy={badge.y} r={8} />
              <text x={badge.x} y={badge.y} textAnchor="middle" dominantBaseline="central">
                {callNumber(badge.key)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
