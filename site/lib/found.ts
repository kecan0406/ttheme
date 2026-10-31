import type { KeyArt } from '@/lib/art'
import { type CastMember, type NameHit, type TaggedWork, type WorkName, workSlugOf } from '../../src/core/names.ts'

export const MOST_FOUND = 4

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const NATIVE_LANGS = ['ja', 'zh-Hant', 'zh-Hans', 'zh', 'ko']

const ANIME = /^anilist:(\d+)$/

const MANGA = /^anilist:manga\/(\d+)$/

const STEAM = /^steam:(\d+)$/

const IGDB = /^igdb:([a-z0-9-]+)$/

const LATIN_LANGS = ['en', 'ja-Latn']

export interface FoundWork {
  id: string
  name: string
  native: string | null
  lang: string | null
  art: KeyArt | null
}

export interface FoundCast {
  name: string
  native: string | null
  picture: string | null
}

export interface FoundPage {
  work: FoundWork
  cast: FoundCast[]
}

export interface Title {
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
    const tag = hit.kind === 'work' ? hit.tags[0] : hit.home
    const slug = tag === undefined ? undefined : workSlugOf(tag)

    if (slug && !taken.has(slug) && !slugs.includes(slug)) slugs.push(slug)
  }

  return slugs.slice(0, MOST_FOUND)
}

export function membersOf(slug: string, works: readonly TaggedWork[]): TaggedWork[] {
  return works.filter((work) => work.tags.some((tag) => workSlugOf(tag) === slug))
}

function shortest(names: readonly WorkName[], keep: (name: WorkName) => boolean): WorkName | undefined {
  let best: WorkName | undefined

  for (const name of names) {
    if (keep(name) && (!best || [...name.text].length < [...best.text].length)) best = name
  }

  return best
}

export function titleOf(members: readonly TaggedWork[]): Title {
  const names = members.flatMap((member) => member.names)
  const head = members[0]

  const name =
    shortest(names, (each) => each.official && each.lang === 'en')?.text ??
    head?.names.find((each) => each.official && each.lang === null)?.text ??
    head?.label ??
    ''

  const native = NATIVE_LANGS.map((lang) => shortest(names, (each) => each.official && each.lang === lang)).find(
    (each) => each !== undefined,
  )

  return native && native.text !== name
    ? { name, native: native.text, lang: native.lang }
    : { name, native: null, lang: null }
}

export function tmdbOf(members: readonly TaggedWork[]): string | null {
  const refs = members.flatMap((member) => member.refs)
  const ref = refs.find((each) => each.startsWith('tmdb:tv/')) ?? refs.find((each) => each.startsWith('tmdb:movie/'))

  return ref ? ref.slice('tmdb:'.length) : null
}

export function anilistOf(members: readonly TaggedWork[]): number | null {
  const series = (member: TaggedWork) => member.refs.some((ref) => ref.startsWith('tmdb:tv/'))
  const refs = members.toSorted((a, b) => Number(series(b)) - Number(series(a))).flatMap((member) => member.refs)
  const found = refs.map((ref) => ANIME.exec(ref)).find(Boolean) ?? refs.map((ref) => MANGA.exec(ref)).find(Boolean)

  return found?.[1] ? Number(found[1]) : null
}

function first(members: readonly { refs: string[] }[], pattern: RegExp): string | null {
  return (
    members
      .flatMap((member) => member.refs)
      .map((ref) => pattern.exec(ref)?.[1])
      .find(Boolean) ?? null
  )
}

export function steamOf(members: readonly TaggedWork[]): string | null {
  return first(members, STEAM)
}

export function igdbOf(members: readonly TaggedWork[]): string | null {
  return first(members, IGDB)
}

export function anilistCharacterOf(member: CastMember): number | null {
  const id = first([member], ANIME)

  return id ? Number(id) : null
}

function shown(text: string): string {
  const base = text.replace(/\s*\([^)]*\)$/, '')

  return /^[\x20-\x7e]+$/.test(base) && base === base.toLowerCase()
    ? base.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    : base
}

export function castFrom(members: readonly CastMember[], pictures: ReadonlyMap<number, string>): FoundCast[] {
  const seen = new Set<string>()

  return members.flatMap((member) => {
    const latin = shortest(member.names, (name) => name.official && LATIN_LANGS.includes(name.lang ?? ''))
    const plain = member.names.find((name) => name.official && name.lang === null)
    const name = latin?.text ?? shown(plain?.text ?? member.label)

    const native = NATIVE_LANGS.map((lang) =>
      shortest(member.names, (each) => each.official && each.lang === lang),
    ).find((each) => each !== undefined)?.text

    const key = `${name}\u0000${native ?? ''}`

    if (seen.has(key)) return []
    seen.add(key)
    const id = anilistCharacterOf(member)

    return [
      {
        name,
        native: native === undefined || native === name ? null : native,
        picture: id === null ? null : (pictures.get(id) ?? null),
      },
    ]
  })
}
