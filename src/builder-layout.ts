import { cells } from './ansi.ts'
import { SCENES, sceneParts } from './scenes.ts'

export const FULL_COLS = 130
export const FULL_ROWS = 38
export const TABS_COLS = 96
export const TABS_ROWS = 28
export const STRIP_ID = 'ansi'

const STRIP = [
  '«d»normal  «K0»  0 «» «K1»  1 «» «K2»  2 «» «K3»  3 «» «K4»  4 «» «K5»  5 «» «K6»  6 «» «K7»  7 «»   «s» selection «»  «c» «» cursor',
  '«d»bright  «K8»  8 «» «K9»  9 «» «K10» 10 «» «K11» 11 «» «K12» 12 «» «K13» 13 «» «K14» 14 «» «K15» 15 «»',
]

const PICKS: Record<string, number[]> = {
  Shell: [0, 1, 2, 3, 4, 6, 7, 9, 10, 12],
  Code: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  Diff: [0, 1, 3, 4, 6, 7, 8, 9, 10, 15],
  Logs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  Monitor: [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11],
}

export interface Part {
  text: string
  role: string
  col: number
}

export interface Tile {
  id: string
  name: string
  col: number
  title: number
  row: number
  width: number
  rows: number
}

export interface Layout {
  tier: 'full' | 'tabs'
  side: number
  divider: number
  width: number
  tiles: Tile[]
}

export interface Spot {
  pane: string
  line: number
  run: number
}

export interface Slots {
  text: number
  ground: number
}

export function sceneId(index: number): string {
  const count = SCENES.length + 1
  const at = ((index % count) + count) % count
  return at === SCENES.length ? STRIP_ID : (SCENES[at]?.name ?? STRIP_ID).toLowerCase()
}

export function sceneName(id: string): string {
  return id === STRIP_ID ? 'ANSI' : (SCENES.find((s) => s.name.toLowerCase() === id)?.name ?? id)
}

export function tabNames(): string[] {
  return [...SCENES.map((s) => s.name), 'ANSI']
}

export function layoutOf(cols: number, rows: number, scene: number): Layout | undefined {
  if (cols >= FULL_COLS && rows >= FULL_ROWS) {
    const side = cols >= 140 ? 44 : 38
    const width = cols - side - 1
    const left = Math.floor((width - 1) / 2)
    const right = width - 1 - left
    const content = rows - 3 - 3 - 3
    const half = Math.min(10, Math.floor((content * 10) / 31))
    const last = Math.min(11, Math.max(1, content - 2 * half))
    const at = side + 1
    const first = 2 + 3
    const second = first + 1 + half
    const third = second + 1 + half
    return {
      tier: 'full',
      side,
      divider: side,
      width,
      tiles: [
        { id: STRIP_ID, name: 'ANSI 16 · selection · cursor', col: at, title: 2, row: 3, width, rows: 2 },
        { id: 'shell', name: 'Shell', col: at, title: first, row: first + 1, width: left, rows: half },
        { id: 'code', name: 'Code', col: at + left + 1, title: first, row: first + 1, width: right, rows: half },
        { id: 'diff', name: 'Diff', col: at, title: second, row: second + 1, width: left, rows: half },
        { id: 'logs', name: 'Logs', col: at + left + 1, title: second, row: second + 1, width: right, rows: half },
        { id: 'monitor', name: 'Monitor', col: at, title: third, row: third + 1, width, rows: last },
      ],
    }
  }
  if (cols >= TABS_COLS && rows >= TABS_ROWS) {
    const side = 36
    const width = cols - side - 1
    const id = sceneId(scene)
    return {
      tier: 'tabs',
      side,
      divider: side,
      width,
      tiles: [{ id, name: sceneName(id), col: side + 1, title: -1, row: 3, width, rows: rows - 4 }],
    }
  }
  return undefined
}

function markup(id: string, tier: Layout['tier']): string[] {
  if (id === STRIP_ID) {
    return STRIP
  }
  const scene = SCENES.find((s) => s.name.toLowerCase() === id)
  if (!scene) {
    return []
  }
  const pick = tier === 'full' ? PICKS[scene.name] : undefined
  return pick ? pick.map((i) => scene.lines[i] ?? '') : scene.lines
}

export function linesOf(id: string, tier: Layout['tier'], width: number): Part[][] {
  const lines: Part[][] = []
  for (const text of markup(id, tier)) {
    const parts = sceneParts(text, width)
    if (!parts) {
      continue
    }
    let col = 0
    lines.push(
      parts.map(([t, role]) => {
        const part = { text: t, role, col }
        col += cells(t)
        return part
      }),
    )
  }
  return lines
}

export function slotsOfRole(role: string): Slots {
  if (role === 's') {
    return { text: 1, ground: 3 }
  }
  if (role === 'c') {
    return { text: 1, ground: 2 }
  }
  const m = /^([BK]?)(\d+)$/.exec(role)
  if (!m) {
    return { text: 1, ground: 0 }
  }
  const slot = 4 + Number(m[2])
  return m[1] === 'K' ? { text: 4, ground: slot } : { text: slot, ground: 0 }
}

export function usesSlot(role: string, slot: number): boolean {
  if (slot >= 4) {
    const m = /^([BK]?)(\d+)$/.exec(role)
    return m !== null && Number(m[2]) === slot - 4
  }
  return (slot === 3 && role === 's') || (slot === 2 && role === 'c')
}

function runsOf(layout: Layout): { spot: Spot; col: number; tile: Tile }[] {
  const out: { spot: Spot; col: number; tile: Tile }[] = []
  for (const tile of layout.tiles) {
    linesOf(tile.id, layout.tier, tile.width)
      .slice(0, tile.rows)
      .forEach((line, l) => {
        line.forEach((part, r) => {
          out.push({ spot: { pane: tile.id, line: l, run: r }, col: part.col, tile })
        })
      })
  }
  return out
}

function same(a: Spot, b: Spot): boolean {
  return a.pane === b.pane && a.line === b.line && a.run === b.run
}

export function firstSpot(layout: Layout, slot: number): Spot | undefined {
  const runs = runsOf(layout)
  const ordered = [...runs.filter((r) => r.spot.pane !== STRIP_ID), ...runs.filter((r) => r.spot.pane === STRIP_ID)]
  for (const { spot, tile } of ordered) {
    const part = linesOf(tile.id, layout.tier, tile.width)[spot.line]?.[spot.run]
    if (part && usesSlot(part.role, slot)) {
      return spot
    }
  }
  return ordered[0]?.spot
}

export function validSpot(layout: Layout, spot: Spot | undefined): Spot | undefined {
  return spot && runsOf(layout).find((r) => same(r.spot, spot))?.spot
}

export function moveSpot(
  layout: Layout,
  spot: Spot | undefined,
  way: 'left' | 'right' | 'up' | 'down' | 'next' | 'previous',
): Spot | undefined {
  const runs = runsOf(layout)
  if (runs.length === 0) {
    return undefined
  }
  const at = spot ? runs.findIndex((r) => same(r.spot, spot)) : -1
  if (at < 0) {
    return runs[0]?.spot
  }
  const here = runs[at] as (typeof runs)[number]
  if (way === 'left' || way === 'right') {
    return runs[(at + (way === 'left' ? runs.length - 1 : 1)) % runs.length]?.spot
  }
  if (way === 'next' || way === 'previous') {
    const panes = layout.tiles.map((t) => t.id)
    const k = panes.indexOf(here.spot.pane)
    const target = panes[(k + (way === 'next' ? 1 : panes.length - 1)) % panes.length]
    return runs.find((r) => r.spot.pane === target)?.spot
  }
  const step = way === 'up' ? -1 : 1
  const inPane = runs.filter((r) => r.spot.pane === here.spot.pane)
  const lines = [...new Set(inPane.map((r) => r.spot.line))]
  const line = lines[lines.indexOf(here.spot.line) + step]
  if (line === undefined) {
    const order = layout.tiles.map((t) => t.id)
    const k = order.indexOf(here.spot.pane) + step
    const target = order[(k + order.length) % order.length]
    const there = runs.filter((r) => r.spot.pane === target)
    const edge = step < 0 ? (there.at(-1)?.spot.line ?? 0) : (there[0]?.spot.line ?? 0)
    const row = there.filter((r) => r.spot.line === edge)
    return (row.find((r) => r.col >= here.col) ?? row.at(-1))?.spot
  }
  const row = inPane.filter((r) => r.spot.line === line)
  const exact = row.find((r) => r.col <= here.col && r.col + cells(partText(layout, r)) > here.col)
  return (exact ?? row.find((r) => r.col >= here.col) ?? row.at(-1))?.spot
}

function partText(layout: Layout, r: { spot: Spot; tile: Tile }): string {
  return linesOf(r.tile.id, layout.tier, r.tile.width)[r.spot.line]?.[r.spot.run]?.text ?? ''
}

export function slotsAt(layout: Layout, spot: Spot): Slots | undefined {
  const tile = layout.tiles.find((t) => t.id === spot.pane)
  const part = tile ? linesOf(tile.id, layout.tier, tile.width)[spot.line]?.[spot.run] : undefined
  return part ? slotsOfRole(part.role) : undefined
}
