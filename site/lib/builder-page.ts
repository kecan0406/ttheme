import type { BuilderData, Start } from '@/lib/builder'
import { fallback, official } from '@/lib/official'
import { scenePanes } from '@/lib/share'
import type { Pane } from '@/lib/share-view'
import snapshot from '@/marketplaces.json' with { type: 'json' }
import { draftOf } from '../../src/core/draft.ts'
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
}

export function builderData(): BuilderPageData {
  const first = official.find((entry) => entry.name === fallback.name) as PaletteEntry
  const { panes, uses } = scenePanes()

  return {
    data: {
      first: startOf(first, first.name, first.catalog ?? 'official'),
      panes: panes.map((pane) => pane.name),
      uses,
      official: listed(official).map((entry) => entry.name),
    },
    panes,
  }
}
