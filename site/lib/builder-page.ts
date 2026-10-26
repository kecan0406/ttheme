import type { BuilderData, Opening, Start } from '@/lib/builder'
import { entries, fallback, themes } from '@/lib/builtin'
import { searchText } from '@/lib/gallery'
import { stocks } from '@/lib/marketplaces'
import { gridText, scenePanes } from '@/lib/scene-panes'
import type { Shared } from '@/lib/share'
import type { Theme } from '@/lib/themes'
import type { Pane } from '@/lib/view-types'
import { byWork, leadOf } from '@/lib/works'
import { type Draft, draftOf } from '../../src/core/draft.ts'
import type { PaletteEntry } from '../../src/core/manifest.ts'

export function starts(): Start[] {
  const listed = [
    ...entries.map((entry, at) => [themes[at] as Theme, entry] as const),
    ...stocks.flatMap((stock) =>
      stock.entries.map((entry, at) => [stock.marketplace.palettes[at] as Theme, entry] as const),
    ),
  ]

  const entryOf = new Map(listed)

  return byWork(listed.map(([theme]) => theme)).flatMap((shelf) => {
    const lead = leadOf(shelf)
    const work = shelf.work && { name: shelf.work.name, native: shelf.work.native, lang: shelf.work.lang }

    return shelf.themes.map(
      (theme): Start => ({
        name: theme.id,
        draft: draftOf(entryOf.get(theme) as PaletteEntry, theme.id),
        shelf: shelf.key,
        work,
        publisher: theme.marketplace,
        lead: work !== null && theme === lead,
        words: searchText(theme),
        dots: theme.signature,
      }),
    )
  })
}

export interface BuilderPageData {
  data: BuilderData
  panes: Pane[]
  grid: string
}

const GRID = { cols: 120, rows: 34 }

function opening(shared: Shared | null): Opening {
  if (shared) {
    const draft = shared.drafts[shared.index] as Draft

    return { name: draft.name, draft }
  }

  const lead = entries.find((entry) => entry.name === fallback.id) as PaletteEntry

  return { name: lead.name, draft: draftOf(lead) }
}

export function builderData(shared: Shared | null): BuilderPageData {
  const { panes, uses } = scenePanes(GRID.cols, GRID.rows)

  return {
    data: {
      first: opening(shared),
      link: shared?.code ?? null,
      panes: panes.map((pane) => pane.name),
      uses,
    },
    panes,
    grid: gridText(GRID.cols, GRID.rows),
  }
}
