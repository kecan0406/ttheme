import { type KeyArt, keyArtOf, type WorkArt } from '@/lib/art'
import { marketplacePath, type Peek, palettePath, type Shelf, searchText } from '@/lib/gallery'
import { BUILTIN, faceOf, paint, type Shade, shortName, type Theme, type WorkRef } from '@/lib/themes'

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
  character: string | null
  lead: boolean
  search: string
  own: string
  swatch: string
}

export interface RowMarket {
  id: string
  path: string
  builtin: boolean
  repo: string
  stars: number | null
}

export interface WorkRow {
  id: string
  name: string
  native: string | null
  lang: string | null
  path: string
  lead: { name: string; path: string }
  art: KeyArt | null
  facets: string
  markets: RowMarket[]
  palettes: RowPalette[]
}

export interface WorkData {
  markets: Record<string, { peeks: Peek[]; who: (string | null)[] }>
}

export const WORK_PATH = '/works'

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

export function workPath(id: string): string {
  return `${WORK_PATH}/${encodeURIComponent(id)}`
}

export function facetStyle(theme: Theme): string {
  const tones = [
    (shade: Shade) => shade.background,
    (shade: Shade) => shade.ansi[0] ?? shade.background,
    (shade: Shade) => shade.selectionBackground,
    (shade: Shade) => shade.cursor,
    (shade: Shade) => shade.ansi[1] ?? shade.cursor,
    (shade: Shade) => shade.ansi[5] ?? shade.selectionBackground,
  ]

  return tones.map((tone, index) => `--k${index}:${paint(theme, tone)}`).join(';')
}

export function swatchStyle(theme: Theme): string {
  return [
    `--bg:${paint(theme, (shade) => shade.background)}`,
    ...faceOf(theme).map((_, index) => `--sg${index}:${paint(theme, (shade) => faceOf(shade)[index] as string)}`),
  ].join(';')
}

function marketOf(id: string, shelves: readonly Shelf[]): RowMarket {
  const shelf = shelves.find((entry) => entry.id === id)

  return {
    id,
    path: marketplacePath(id),
    builtin: id === BUILTIN,
    repo: shelf?.repo ?? id,
    stars: shelf?.stars ?? null,
  }
}

export function workRows(
  themes: readonly Theme[],
  shelves: readonly Shelf[],
  artOf: (work: string) => WorkArt | undefined,
): WorkRow[] {
  const order = shelves.map((shelf) => shelf.id)
  const rank = (id: string) => (id === BUILTIN ? -1 : order.includes(id) ? order.indexOf(id) : order.length)

  return byWork(themes).flatMap((shelf) => {
    if (!shelf.work) return []
    const lead = leadOf(shelf)
    const ids = [...new Set(shelf.themes.map((theme) => theme.marketplace))].sort((a, b) => rank(a) - rank(b))

    return [
      {
        id: shelf.work.id,
        name: shelf.work.name,
        native: shelf.work.native,
        lang: shelf.work.lang,
        path: workPath(shelf.work.id),
        lead: { name: shortName(lead.id), path: palettePath(lead) },
        art: keyArtOf(artOf(shelf.work.id)),
        facets: facetStyle(lead),
        markets: ids.map((id) => marketOf(id, shelves)),
        palettes: [lead, ...shelf.themes.filter((theme) => theme !== lead)].map((theme) => ({
          name: theme.name,
          path: palettePath(theme),
          marketplace: theme.marketplace,
          character: theme.character?.id ?? null,
          lead: theme.subject === shelf.work?.lead,
          search: searchText(theme),
          own: [theme.id, theme.character?.id ?? '', ...(theme.character?.native ?? [])].join(' ').toLowerCase(),
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
