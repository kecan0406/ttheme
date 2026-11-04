import type { KeyArt, WorkArt } from '@/lib/art'
import { type Place, placesOf } from '@/lib/categories'
import { BUILTIN, faceOf, paint, type Shade, type Theme, type WorkRef } from '@/lib/themes'
import { slugOf } from '../../src/core/theme.ts'

const FIRST = 'ttheme/hatsune-miku'

export const WORN_FACETS = '--k0:var(--bg);--k1:var(--a0);--k2:var(--se);--k3:var(--cu);--k4:var(--a1);--k5:var(--a5)'

const FOCUS = new Map([
  ['doki-doki-literature-club', '95% 50%'],
  ['jubeat', '50% 73%'],
  ['pop-n-music', '50% 9%'],
  ['sound-voltex', '36% 50%'],
  ['undertale', '75% 50%'],
  ['va-11-hall-a', '44% 50%'],
  ['vocaloid', '75% 50%'],
])

export function focusOf(work: string): string | null {
  return FOCUS.get(work) ?? null
}

const SHELF_FOCUS = new Map([
  ['black-bullet', '45% 50%'],
  ['bocchi-the-rock', '52% 50%'],
  ['call-of-the-night', '64% 50%'],
  ['chuunibyou', '0% 50%'],
  ['code-geass', '41% 50%'],
  ['cyberpunk-edgerunners', '41% 50%'],
  ['doki-doki-literature-club', '77% 50%'],
  ['evangelion', '35% 50%'],
  ['higurashi', '35% 50%'],
  ['jujutsu-kaisen', '72% 50%'],
  ['k-on', '41% 50%'],
  ['lain', '100% 50%'],
  ['lucky-star', '79% 50%'],
  ['madoka-magica', '41% 50%'],
  ['monogatari', '18% 50%'],
  ['nichijou', '25% 50%'],
  ['no-game-no-life', '60% 50%'],
  ['oregairu', '64% 50%'],
  ['persona-5', '25% 50%'],
  ['sailor-moon', '60% 50%'],
  ['steins-gate', '8% 50%'],
  ['sword-art-online', '75% 50%'],
  ['the-devil-is-a-part-timer', '25% 50%'],
  ['touhou-project', '46% 50%'],
  ['umineko', '25% 50%'],
  ['undertale', '63% 50%'],
  ['va-11-hall-a', '42% 50%'],
  ['vocaloid', '63% 50%'],
])

export function shelfFocusOf(work: string): string | null {
  return SHELF_FOCUS.get(work) ?? null
}

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
  look: string
  focus: string | null
  palettes: number
  search: string
  names: string
  places: readonly Place[]
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

export function tileLook(theme: Theme): string {
  const slots: [string, (shade: Shade) => string][] = [
    ['--bg', (shade) => shade.background],
    ['--fg', (shade) => shade.foreground],
    ['--cu', (shade) => shade.cursor],
    ['--se', (shade) => shade.selectionBackground],
  ]

  return slots.map(([slot, pick]) => `${slot}:${paint(theme, pick)}`).join(';')
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

export function workEntries(
  themes: readonly Theme[],
  artOf: (work: string) => WorkArt | undefined,
  foundPlaces: (work: string) => readonly Place[] | undefined,
): WorkEntry[] {
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
        art: artOf(id)?.art ?? null,
        facets: facetStyle(leadOf(shelf)),
        look: tileLook(leadOf(shelf)),
        focus: focusOf(id),
        palettes: shelf.themes.length,
        search: [id, name, native ?? ''].join('\n').toLowerCase(),
        names: shelf.themes.flatMap((theme) => [theme.id, slugOf(theme.id)]).join('\n'),
        places: placesOf(id, foundPlaces(id)),
      },
    ]
  })
}

export function leadsOf(themes: readonly Theme[]): Theme[] {
  const leads = byWork(themes).map(leadOf)
  const first = themes.find((theme) => theme.id === FIRST)

  return first ? [first, ...leads.filter((theme) => theme !== first)] : leads
}
