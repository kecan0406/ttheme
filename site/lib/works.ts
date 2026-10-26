import { BUILTIN, type Theme, type WorkRef } from '@/lib/themes'

export const FIRST = 'ttheme/miku'

export interface WorkShelf {
  key: string
  work: WorkRef | null
  publisher: string | null
  themes: Theme[]
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

export function leadsOf(themes: readonly Theme[]): Theme[] {
  const leads = byWork(themes).map(leadOf)
  const first = themes.find((theme) => theme.id === FIRST)

  return first ? [first, ...leads.filter((theme) => theme !== first)] : leads
}

export function worksIn(themes: readonly Theme[]): number {
  return byWork(themes).filter((shelf) => shelf.work !== null).length
}
