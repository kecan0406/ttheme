import { anilistCharacter, bangumiCharacter, characterPicture } from '@kecan0406/aninames/pictures'
import type { KeyArt } from '@/lib/art'
import { GENRES, type Place } from '@/lib/categories'
import { type CastMember, type NameHit, slugOfTag, type TaggedWork, type WorkName } from '../../src/core/names.ts'
import { containsText } from '../../src/core/text.ts'

export const MOST_FOUND = 4

export const SHOWN_CAST = 24

export const SHOWN_FAMILY = 5

export const MOST_CAST = 400

const FEW_CAST = 6

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const ORIGIN_LANGS = new Map<string, readonly string[]>([
  ['JP', ['ja']],
  ['KR', ['ko']],
  ['CN', ['zh-Hans', 'zh', 'zh-Hant']],
  ['TW', ['zh-Hant', 'zh', 'zh-Hans']],
  ['HK', ['zh-Hant', 'zh', 'zh-Hans']],
  ['MO', ['zh-Hant', 'zh', 'zh-Hans']],
])

const HANGUL = /\p{Script=Hangul}/u

const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u

const HAN_LANG = /^(?:ja|zh)(?:-|$)/

export interface FoundWork {
  id: string
  name: string
  native: string | null
  lang: string | null
  art: KeyArt | null
  places: readonly Place[]
}

export interface FoundCast {
  name: string
  native: string | null
  picture: string | null
}

export interface FoundMember extends FoundCast {
  palette: string | null
}

export interface Holder {
  id: string
  keys: string[]
}

export interface CastWork {
  id: string
  tag: string
  lang: string | null
  held: Holder[]
}

export type Casts = Record<string, FoundCast[]>

export type People = Record<string, string>

export interface FamilyWork {
  name: string
  year: number | null
  medium: string | null
}

export interface FoundPage {
  work: FoundWork
  cast: FoundCast[]
  family: FamilyWork[]
}

interface Title {
  name: string
  native: string | null
  lang: string | null
}

export function slugLike(text: string): boolean {
  return text.length <= 40 && SLUG.test(text)
}

export function foundSlugs(unknown: readonly NameHit[], taken: ReadonlySet<string>): string[] {
  const slugs: string[] = []

  for (const hit of unknown) {
    const key = hit.tags[0] ?? hit.family
    const slug = key === undefined ? undefined : slugOfTag(key)

    if (slug && !taken.has(slug) && !slugs.includes(slug)) slugs.push(slug)
  }

  return slugs.slice(0, MOST_FOUND)
}

export function membersOf(slug: string, works: readonly TaggedWork[]): TaggedWork[] {
  return works.filter((work) => [...work.tags, work.family ?? ''].some((key) => slugOfTag(key) === slug))
}

function shortest(names: readonly WorkName[], keep: (name: WorkName) => boolean): WorkName | undefined {
  let best: WorkName | undefined

  for (const name of names) {
    if (keep(name) && (!best || [...name.text].length < [...best.text].length)) best = name
  }

  return best
}

function preferredOf(names: readonly WorkName[], lang: string): WorkName | undefined {
  return names.find((name) => name.preferred && name.lang === lang)
}

function latinKey(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join(' ')
}

function nativeLangs(members: readonly TaggedWork[]): string[] {
  const origin = members.find((member) => member.origin.length > 0)?.origin ?? ['JP']

  return origin.flatMap((country) => ORIGIN_LANGS.get(country) ?? [])
}

function eldestOf(members: readonly TaggedWork[]): TaggedWork | undefined {
  return members.toSorted((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity))[0]
}

function sameTitle(a: TaggedWork, b: TaggedWork): boolean {
  return a.label.normalize('NFKC').toLowerCase() === b.label.normalize('NFKC').toLowerCase()
}

function spellingIn(text: string, key: string): string | undefined {
  const words = [...text.matchAll(/[\p{L}\p{N}\p{M}]+/gu)]
  const wanted = key.split(' ')

  for (let at = 0; at + wanted.length <= words.length; at++) {
    const first = words[at]
    const last = words[at + wanted.length - 1]

    if (
      first &&
      last &&
      !text.slice(0, first.index).includes(':') &&
      wanted.every((word, index) => latinKey(words[at + index]?.[0] ?? '') === word)
    ) {
      return text.slice(first.index, last.index + last[0].length)
    }
  }

  return undefined
}

export function titleOf(slug: string, members: readonly TaggedWork[]): Title {
  const key = latinKey(slug)
  const eldest = eldestOf(members)
  const every = members.flatMap((member) => member.names)
  const names = members.filter((member) => eldest && sameTitle(member, eldest)).flatMap((member) => member.names)
  const english = every.filter((each) => each.official && each.lang === 'en')
  const exact = english.find((each) => latinKey(each.text) === key)?.text
  const within = exact ? undefined : english.map((each) => spellingIn(each.text, key)).find(Boolean)

  const langs = nativeLangs(members)

  if (within) return { name: within, native: null, lang: langs[0] ?? null }

  const spoken = every.find((each) => each.official && each.lang === null && latinKey(each.text) === key)?.text

  const name =
    (exact && shown(exact)) ??
    shortest(names, (each) => each.official && each.lang === 'en')?.text ??
    shortest(every, (each) => each.official && each.lang === 'en')?.text ??
    (spoken && shown(spoken)) ??
    shown(eldest?.names.find((each) => each.official && each.lang === null)?.text ?? eldest?.label ?? '')

  const native = langs
    .map(
      (lang) =>
        (eldest && preferredOf(eldest.names, lang)) ??
        shortest(names, (each) => each.official && each.lang === lang) ??
        shortest(every, (each) => each.official && each.lang === lang),
    )
    .find((each) => each !== undefined)

  const spelling = native ? latinKey(native.text) : ''
  const lang = native?.lang ?? langs[0] ?? null

  return native && native.text !== name && (spelling === '' || spelling !== latinKey(name))
    ? { name, native: native.text, lang }
    : { name, native: null, lang }
}

export function nativeLang(text: string, work: string | null): string | null {
  if (HANGUL.test(text)) return 'ko'

  if (KANA.test(text)) return 'ja'

  return work !== null && HAN_LANG.test(work) ? work : null
}

export function anilistIdsOf(members: readonly CastMember[]): number[] {
  return members.flatMap((member) => (bangumiCharacter(member) === null ? (anilistCharacter(member) ?? []) : []))
}

function mediumLabel(member: TaggedWork): string | null {
  return GENRES.find((genre) => member.genres.includes(genre.fact))?.label ?? member.medium
}

export function familyOf(members: readonly TaggedWork[]): FamilyWork[] {
  const seen = new Set<string>()

  return members
    .flatMap((member) => {
      const name =
        (preferredOf(member.names, 'en') ?? shortest(member.names, (each) => each.official && each.lang === 'en'))
          ?.text ?? member.label

      const medium = mediumLabel(member)
      const key = `${name}\u0000${member.year ?? ''}\u0000${medium ?? ''}`

      if (seen.has(key)) return []
      seen.add(key)

      return [{ name, year: member.year, medium }]
    })
    .toSorted((a, b) => Number(a.year === null) - Number(b.year === null) || (a.year ?? 0) - (b.year ?? 0))
}

function shown(text: string): string {
  const base = text.replace(/\s*\([^)]*\)$/, '')

  return /^[\x20-\x7e]+$/.test(base) && base === base.toLowerCase()
    ? base.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    : base
}

export function castLeads(members: readonly CastMember[]): CastMember[] {
  const leads = members.filter((member) => member.lead)

  return leads.length > 0 ? leads : members.slice(0, FEW_CAST)
}

function holderOf(member: CastMember, held: readonly Holder[]): string | null {
  const holder = held.find(
    (each) =>
      member.tags.some((tag) => each.keys.includes(tag)) || member.names.some((name) => each.keys.includes(name.text)),
  )

  return holder?.id ?? null
}

export function heldNamed(query: string, held: readonly Holder[]): Holder[] {
  return held.filter((holder) => containsText([holder.id, ...holder.keys], query))
}

export function untaken(members: readonly CastMember[], held: readonly Holder[]): CastMember[] {
  return members.filter((member) => holderOf(member, held) === null)
}

export function membersFound(
  members: readonly CastMember[],
  held: readonly Holder[],
  lang: string | null,
): FoundMember[] {
  const palettes = new Set<string>()

  const holding = members.flatMap((member) => {
    const palette = holderOf(member, held)

    if (palette === null || palettes.has(palette)) return []
    palettes.add(palette)

    return castFrom([member], new Map(), lang).map((cast) => ({ ...cast, palette }))
  })

  const free = castFrom(untaken(members, held), new Map(), lang).map((cast) => ({ ...cast, palette: null }))

  return [...holding, ...free]
}

export function castFrom(
  members: readonly CastMember[],
  pictures: ReadonlyMap<number, string>,
  lang: string | null,
): FoundCast[] {
  const seen = new Set<string>()

  return members.flatMap((member) => {
    const latin = preferredOf(member.names, 'en') ?? preferredOf(member.names, 'ja-Latn')
    const plain = shortest(member.names, (each) => each.official && each.lang === null)
    const name = latin?.text ?? shown(plain?.text ?? member.label)

    const native =
      lang === null
        ? undefined
        : (preferredOf(member.names, lang) ?? shortest(member.names, (each) => each.official && each.lang === lang))
            ?.text

    const key = `${name}\u0000${native ?? ''}`

    if (seen.has(key)) return []
    seen.add(key)
    const bangumi = bangumiCharacter(member)
    const anilist = anilistCharacter(member)

    return [
      {
        name,
        native: native === undefined || native === name ? null : native,
        picture:
          bangumi === null ? (anilist === null ? null : (pictures.get(anilist) ?? null)) : characterPicture(bangumi),
      },
    ]
  })
}
