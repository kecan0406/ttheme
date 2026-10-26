import type { BuilderData, Start } from '@/lib/builder'
import { fallback, official } from '@/lib/official'
import { gridText, scenePanes } from '@/lib/scene-panes'
import type { Shared } from '@/lib/share'
import { shelfOf } from '@/lib/themes'
import type { Pane } from '@/lib/view-types'
import snapshot from '@/marketplaces.json' with { type: 'json' }
import { type Draft, draftOf } from '../../src/core/draft.ts'
import { listed, type PaletteEntry } from '../../src/core/manifest.ts'
import type { Shown } from '../../src/store/marketplace-index.ts'

function startOf(entry: PaletteEntry, name: string, shelf: string): Start {
  return {
    name,
    shelf,
    native: entry.native ?? null,
    lead: entry.lead === true,
    dots: entry.signature,
    draft: draftOf(entry, name),
  }
}

export function starts(): Start[] {
  const shelf = (entry: PaletteEntry) => entry.catalog ?? 'official'

  return [
    ...listed(official).map((entry) => startOf(entry, entry.name, shelf(entry))),
    ...(snapshot as Shown[]).flatMap((marketplace) =>
      marketplace.palettes.map((entry) =>
        startOf(
          entry,
          `${marketplace.id}/${entry.name}`,
          entry.catalog ? `${marketplace.id} · ${entry.catalog}` : marketplace.id,
        ),
      ),
    ),
  ]
}

export interface BuilderPageData {
  data: BuilderData
  panes: Pane[]
  grid: string
}

const GRID = { cols: 120, rows: 34 }

function linkStart({ drafts, index, entry, theme }: Shared): Start {
  const draft = drafts[index] as Draft

  return {
    name: draft.name,
    shelf: shelfOf(theme),
    native: null,
    lead: false,
    dots: entry.signature,
    draft,
  }
}

export function builderData(shared: Shared | null): BuilderPageData {
  const lead = official.find((entry) => entry.name === fallback.name) as PaletteEntry
  const { panes, uses } = scenePanes(GRID.cols, GRID.rows)

  return {
    data: {
      first: shared ? linkStart(shared) : startOf(lead, lead.name, lead.catalog ?? 'official'),
      link: shared?.code ?? null,
      panes: panes.map((pane) => pane.name),
      uses,
      official: listed(official).map((entry) => entry.name),
    },
    panes,
    grid: gridText(GRID.cols, GRID.rows),
  }
}
