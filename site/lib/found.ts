import type { KeyArt } from '@/lib/art'
import { type NameHit, type TaggedWork, type WorkName, workSlugOf } from '../../src/core/names.ts'

export const MOST_FOUND = 4

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const NATIVE_LANGS = ['ja', 'zh-Hant', 'zh-Hans', 'zh', 'ko']

const ANIME = /^anilist:(\d+)$/

const MANGA = /^anilist:manga\/(\d+)$/

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
    const works = hit.kind === 'work' ? [hit] : hit.works.filter((work) => work.tags.length > 0).slice(0, 1)

    for (const work of works) {
      const slug = work.tags[0] === undefined ? undefined : workSlugOf(work.tags[0])

      if (slug && !taken.has(slug) && !slugs.includes(slug)) slugs.push(slug)
    }
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
  const refs = members.flatMap((member) => member.refs)
  const found = refs.map((ref) => ANIME.exec(ref)).find(Boolean) ?? refs.map((ref) => MANGA.exec(ref)).find(Boolean)

  return found?.[1] ? Number(found[1]) : null
}
