import type { Pane, Run } from '@/lib/view-types'
import { footerRows, lights, type Part, paneLines, paneTiles, slotsOfRole } from '../../src/core/builder-layout.ts'

function runOf(part: Part): Run {
  const { text, ground } = slotsOfRole(part.role)

  return {
    text: part.text,
    t: text,
    g: ground,
    bold: part.role === 'b' || /^B\d+$/.test(part.role),
    faint: part.role === 'd',
    cursor: part.role === 'c',
  }
}

export function gridText(cols: number, rows: number): string {
  return `${cols}×${rows}`
}

export interface Scenes {
  panes: Pane[]
  uses: number[][]
}

export function scenePanes(cols: number, rows: number): Scenes {
  const tiles = paneTiles(cols, rows)
  const lines = tiles.map((tile) => paneLines(tile))
  const parts = lines.map((pane) => pane.flat())

  const panes = tiles.map((tile, i): Pane => {
    const runs = (lines[i] ?? []).map((line) => line.map(runOf))
    const footer = footerRows(tile)

    return { name: tile.name, body: runs.slice(0, runs.length - footer), footer: runs.slice(runs.length - footer) }
  })

  const uses = Array.from({ length: 20 }, (_, slot) =>
    parts.map((pane) => pane.filter((part) => lights(part.role, slot)).length),
  )

  return { panes, uses }
}
