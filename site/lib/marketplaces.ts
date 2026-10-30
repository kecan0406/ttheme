import { commons, shelves } from '@/lib/builtin'
import { type Shelves, toTheme } from '@/lib/theme-entry'
import type { Marketplace } from '@/lib/themes'
import snapshot from '@/marketplaces.json' with { type: 'json' }
import { mergeWorks, type Work, worldOrder } from '../../src/core/commons.ts'
import type { PaletteEntry } from '../../src/core/manifest.ts'
import { slugOf } from '../../src/core/theme.ts'
import type { ListedWork, Shown } from '../../src/store/marketplace-index.ts'

export interface Stock {
  marketplace: Marketplace
  entries: PaletteEntry[]
  shelves: Shelves
}

function proposed({ id, name, native }: ListedWork): Work {
  return { id, name, ...(native ? { native } : {}), characters: [] }
}

function stockOf({ palettes, works, ...shown }: Shown): Stock {
  const known: Shelves = { works: mergeWorks(commons.works, works.map(proposed)), commons: shelves.commons }

  const entries = worldOrder(
    palettes.map((entry) => ({ ...entry, name: `${shown.id}/${slugOf(entry.name)}` })),
    known.works,
  )

  const themes = entries.map((entry) => toTheme(entry, known))

  return { marketplace: { ...shown, palettes: themes }, entries, shelves: known }
}

export const stocks: Stock[] = (snapshot as Shown[]).map(stockOf)

export const marketplaces: Marketplace[] = stocks.map((stock) => stock.marketplace)

export const listedWorks: ListedWork[] = (snapshot as Shown[]).flatMap((shown) => shown.works)

export function shelvesFor(publisher: string): Shelves {
  return stocks.find((stock) => stock.marketplace.id === publisher)?.shelves ?? shelves
}
