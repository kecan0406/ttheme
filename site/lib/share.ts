import { official } from '@/lib/official'
import { pictureOf } from '@/lib/pictures'
import type { GateLine, Pane, Picture, Run, ShareView } from '@/lib/share-view'
import { GRID } from '@/lib/share-view'
import { gateLinesOf, slotViewOf, viewOf } from '@/lib/slot-view'
import { toTheme } from '@/lib/theme-entry'
import type { Theme } from '@/lib/themes'
import { footerRows, lights, type Part, paneLines, paneTiles, slotsOfRole } from '../../src/core/builder-layout.ts'
import { shareLink } from '../../src/core/draft.ts'
import type { PaletteEntry } from '../../src/core/manifest.ts'
import { readCodes } from '../../src/core/own.ts'
import { listOf, misses } from '../../src/core/slots.ts'
import { marketplaceOf, slugOf } from '../../src/core/theme.ts'

export interface Shared {
  code: string
  link: string
  entry: PaletteEntry
  theme: Theme
  pictures: Picture[]
  index: number
  palettes: Theme[]
}

export interface Builder {
  panes: Pane[]
  gate: GateLine[]
  view: ShareView
}

function themeOf(entry: PaletteEntry): Theme {
  const marketplace = marketplaceOf(entry.name) ?? null

  return toTheme({ ...entry, name: marketplace ? slugOf(entry.name) : entry.name }, marketplace)
}

export function readShared(code: string, index = 0): Shared {
  const entries = readCodes(code, official)
  const at = Number.isInteger(index) && index >= 0 && index < entries.length ? index : 0
  const entry = entries[at] as PaletteEntry
  const palettes = entries.map(themeOf)

  return {
    code,
    link: shareLink(code),
    entry,
    theme: palettes[at] as Theme,
    pictures: (entry.pictures ?? []).map(pictureOf),
    index: at,
    palettes,
  }
}

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

export interface Scenes {
  panes: Pane[]
  uses: number[][]
}

export function scenePanes(): Scenes {
  const tiles = paneTiles(GRID.cols, GRID.rows)
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

export function builderOf(shared: Shared): Builder {
  const { entry } = shared

  const list = listOf({
    background: entry.background,
    foreground: entry.foreground,
    cursor: entry.cursor,
    selection: entry.selection,
    ansi: entry.ansi,
  })

  const signature = entry.signatureSlots
  const waive = entry.waived ?? []
  const missed = misses(list, signature, waive)
  const { panes, uses } = scenePanes()
  const slots = list.map((_, slot) => slotViewOf(list, signature, waive, missed, slot, uses[slot] ?? []))

  return {
    panes,
    gate: gateLinesOf(list, signature, waive),
    view: viewOf(
      list,
      panes.map((pane) => pane.name),
      slots,
    ),
  }
}
