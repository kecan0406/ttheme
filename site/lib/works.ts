import { type KeyArt, keyArtOf, type WorkArt } from '@/lib/art'
import { searchText } from '@/lib/gallery'
import { BUILTIN, faceOf, isBuiltin, paint, type Shade, type Theme, type WorkRef } from '@/lib/themes'

export const FIRST = 'ttheme/miku'

export const WORN_FACETS = '--k0:var(--bg);--k1:var(--a0);--k2:var(--se);--k3:var(--cu);--k4:var(--a1);--k5:var(--a5)'

export interface WorkShelf {
  key: string
  work: WorkRef | null
  publisher: string | null
  themes: Theme[]
}

export interface WorkEntry {
  id: string
  name: string
  native: string | null
  lang: string | null
  path: string
  art: KeyArt | null
  facets: string
  palettes: number
  builtin: boolean
  community: boolean
  search: string
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

export function ribbon(theme: Theme): string {
  const step = 100 / theme.ansi.length

  const stops = theme.ansi.map((_, index) => {
    const color = paint(theme, (shade) => shade.ansi[index] as string)

    return `${color} ${index * step}% ${(index + 1) * step}%`
  })

  return `linear-gradient(90deg,${stops.join(',')})`
}

export function workEntries(themes: readonly Theme[], artOf: (work: string) => WorkArt | undefined): WorkEntry[] {
  return byWork(themes).flatMap((shelf) => {
    if (!shelf.work) return []
    const { id, name, native, lang } = shelf.work

    return [
      {
        id,
        name,
        native,
        lang,
        path: workPath(id),
        art: keyArtOf(artOf(id)),
        facets: facetStyle(leadOf(shelf)),
        palettes: shelf.themes.length,
        builtin: shelf.themes.some(isBuiltin),
        community: !shelf.themes.every(isBuiltin),
        search: [id, name, native ?? '', ...shelf.themes.map(searchText)].join('\n').toLowerCase(),
      },
    ]
  })
}

export function leadsOf(themes: readonly Theme[]): Theme[] {
  const leads = byWork(themes).map(leadOf)
  const first = themes.find((theme) => theme.id === FIRST)

  return first ? [first, ...leads.filter((theme) => theme !== first)] : leads
}
