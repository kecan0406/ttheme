import { runOf } from '@/lib/terminal'
import type { Pane } from '@/lib/view-types'
import { footerRows, lights, paneLines, paneTiles } from '../../src/core/builder-layout.ts'

export interface Scenes {
  panes: Pane[]
  uses: number[][]
}

export function scenePanes(cols: number, rows: number): Scenes {
  const tiles = paneTiles(cols, rows)
  const lines = tiles.map((tile) => paneLines(tile))
  const parts = lines.map((pane) => pane.flat())

  const panes = tiles.map((tile, i): Pane => {
    const runs = (lines[i] ?? []).map((line) => line.map((part) => runOf(part.text, part.role)))
    const footer = footerRows(tile)

    return { name: tile.name, body: runs.slice(0, runs.length - footer), footer: runs.slice(runs.length - footer) }
  })

  const uses = Array.from({ length: 20 }, (_, slot) =>
    parts.map((pane) => pane.filter((part) => lights(part.role, slot)).length),
  )

  return { panes, uses }
}
