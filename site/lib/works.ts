import { palettePath, searchText } from '@/lib/gallery'
import { BUILTIN, faceOf, paint, shortName, type Theme, type WorkRef } from '@/lib/themes'

export const FIRST = 'ttheme/miku'

export interface WorkShelf {
  key: string
  work: WorkRef | null
  publisher: string | null
  themes: Theme[]
}

export interface RowPalette {
  name: string
  path: string
  marketplace: string
  search: string
  swatch: string
}

export interface WorkRow {
  id: string
  name: string
  native: string | null
  lang: string | null
  palettes: RowPalette[]
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function byPublisher(a: string, b: string): number {
  return Number(a !== BUILTIN) - Number(b !== BUILTIN) || cmp(a, b)
}

function within(a: Theme, b: Theme): number {
  return (
    cmp(a.character?.id ?? `~${a.name}`, b.character?.id ?? `~${b.name}`) ||
    byPublisher(a.marketplace, b.marketplace) ||
    cmp(a.name, b.name)
  )
}

function across(a: WorkShelf, b: WorkShelf): number {
  if (a.work && b.work) return cmp(a.work.name.toLowerCase(), b.work.name.toLowerCase()) || cmp(a.work.id, b.work.id)

  return Number(a.work === null) - Number(b.work === null) || byPublisher(a.publisher ?? '', b.publisher ?? '')
}

export function byWork(themes: readonly Theme[]): WorkShelf[] {
  const shelves = new Map<string, WorkShelf>()

  const put = (key: string, work: WorkRef | null, publisher: string | null, theme: Theme) => {
    const shelf = shelves.get(key)

    if (shelf) shelf.themes.push(theme)
    else shelves.set(key, { key, work, publisher, themes: [theme] })
  }

  for (const theme of themes) {
    if (!theme.work) put(`~${theme.marketplace}`, null, theme.marketplace, theme)
    else for (const work of [theme.work, ...theme.also]) put(work.id, work, null, theme)
  }

  return [...shelves.values()].sort(across).map((shelf) => ({ ...shelf, themes: shelf.themes.toSorted(within) }))
}

export function leadOf(shelf: WorkShelf): Theme {
  return shelf.themes.find((theme) => theme.subject === shelf.work?.lead) ?? (shelf.themes[0] as Theme)
}

export function swatchStyle(theme: Theme): string {
  return [
    `--bg:${paint(theme, (shade) => shade.background)}`,
    ...faceOf(theme).map((_, index) => `--sg${index}:${paint(theme, (shade) => faceOf(shade)[index] as string)}`),
  ].join(';')
}

export function workRows(themes: readonly Theme[]): WorkRow[] {
  return byWork(themes).flatMap((shelf) => {
    if (!shelf.work) return []
    const lead = leadOf(shelf)

    return [
      {
        id: shelf.work.id,
        name: shelf.work.name,
        native: shelf.work.native,
        lang: shelf.work.lang,
        palettes: [lead, ...shelf.themes.filter((theme) => theme !== lead)].map((theme) => ({
          name: shortName(theme.id),
          path: palettePath(theme),
          marketplace: theme.marketplace,
          search: searchText(theme),
          swatch: swatchStyle(theme),
        })),
      },
    ]
  })
}

export function leadsOf(themes: readonly Theme[]): Theme[] {
  const leads = byWork(themes).map(leadOf)
  const first = themes.find((theme) => theme.id === FIRST)

  return first ? [first, ...leads.filter((theme) => theme !== first)] : leads
}
