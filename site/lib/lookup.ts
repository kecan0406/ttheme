import { answerOf } from '@/lib/answer'
import { heroArtOf, igdbArtOf, keyArtOf } from '@/lib/art'
import {
  type Live,
  liveArtwork,
  liveBackdrop,
  liveHero,
  liveMedia,
  livePictures,
  type Media,
  type Twitch,
} from '@/lib/art-source'
import { commons, themes } from '@/lib/builtin'
import {
  anilistIdsOf,
  anilistOf,
  castFrom,
  type FamilyWork,
  type FoundCast,
  type FoundPage,
  type FoundWork,
  familyOf,
  foundSlugs,
  igdbOf,
  MOST_CAST,
  membersOf,
  slugLike,
  steamOf,
  titleOf,
  tmdbOf,
} from '@/lib/found'
import { listedWorks, marketplaces } from '@/lib/marketplaces'
import type { NamesAnswer } from '@/lib/names'
import { mergeWorks, workOfListed } from '../../src/core/commons.ts'
import { namedWorks } from '../../src/core/names.ts'
import { liveSource, nameIndex } from '../../src/store/names.ts'

const KEEP_MS = 6 * 60 * 60 * 1000

const MOST_KEPT = 500

const FOUND_MS = 6000

const TOKEN = process.env.TMDB_TOKEN

const TWITCH: Twitch | undefined =
  process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET
    ? { id: process.env.TWITCH_CLIENT_ID, secret: process.env.TWITCH_CLIENT_SECRET }
    : undefined

const NONE: Live<string | null> = { value: null, settled: true }

const index = nameIndex(liveSource())

const works = mergeWorks(commons.works, listedWorks.map(workOfListed))

const taken = new Set(works.map((work) => work.id))

const shelved = new Set(
  [...themes, ...marketplaces.flatMap((marketplace) => marketplace.palettes)].flatMap((theme) =>
    [theme.work, ...theme.also].flatMap((work) => (work ? [work.id] : [])),
  ),
)

interface Kept<T> {
  at: number
  value: Promise<T>
}

interface Resolved {
  work: FoundWork
  family: FamilyWork[]
  settled: boolean
}

const resolved = new Map<string, Kept<Resolved | null>>()

const media = new Map<number, Kept<Live<Media>>>()

const casts = new Map<string, Kept<Live<FoundCast[]>>>()

function kept<K, T>(store: Map<K, Kept<T>>, key: K, make: () => Promise<T>, settled: (value: T) => boolean) {
  const now = Date.now()
  const known = store.get(key)

  if (known && now - known.at < KEEP_MS) return known.value
  const value = make()
  store.set(key, { at: now, value })

  for (const old of store.keys()) {
    if (store.size <= MOST_KEPT) break
    store.delete(old)
  }

  const forget = () => {
    if (store.get(key)?.value === value) store.delete(key)
  }

  value.then((done) => (settled(done) ? undefined : forget()), forget)

  return value
}

function mediaOf(id: number): Promise<Live<Media>> {
  return kept(
    media,
    id,
    () => liveMedia(id),
    (done) => done.settled,
  )
}

function resolve(slug: string): Promise<Resolved | null> {
  return kept(
    resolved,
    slug,
    async () => {
      const members = membersOf(slug, await index.tagged(slug, AbortSignal.timeout(FOUND_MS)))

      if (members.length === 0) return null
      const tmdb = tmdbOf(members)
      const anilist = anilistOf(members)
      const steam = steamOf(members)
      const igdb = igdbOf(members)
      const backdrop = tmdb && TOKEN ? await liveBackdrop(tmdb, TOKEN) : NONE
      const banner = !backdrop.value && anilist ? await mediaOf(anilist) : undefined
      const found = backdrop.value ?? banner?.value.banner ?? null
      const hero = !found && steam ? await liveHero(steam) : NONE
      const artwork = !found && !hero.value && igdb && TWITCH ? await liveArtwork(igdb, TWITCH) : NONE

      const art =
        keyArtOf({ backdrop: backdrop.value, banner: banner?.value.banner ?? null, cast: {} }) ??
        (hero.value ? heroArtOf(hero.value) : null) ??
        (artwork.value ? igdbArtOf(artwork.value) : null)

      return {
        work: { id: slug, ...titleOf(members), art },
        family: familyOf(members),
        settled: backdrop.settled && (banner?.settled ?? true) && hero.settled && artwork.settled,
      }
    },
    (done) => done === null || done.settled,
  )
}

export async function lookUp(query: string, signal: AbortSignal): Promise<{ answer: NamesAnswer; settled: boolean }> {
  const hits = await index.search(query, signal, works)
  const named = namedWorks(hits, works)
  const slugs = named.works.some((work) => shelved.has(work.id)) ? [] : foundSlugs(named.unknown, taken)
  const looked = await Promise.all(slugs.map((slug) => resolve(slug).catch(() => undefined)))
  const found = looked.flatMap((each) => (each ? [each.work] : []))

  return {
    answer: answerOf(query, hits, works, shelved, found),
    settled: looked.every((each) => each !== undefined && (each === null || each.settled)),
  }
}

function castOf(slug: string, lang: string | null): Promise<Live<FoundCast[]>> {
  return kept(
    casts,
    slug,
    async () => {
      const members = await index.cast(slug, AbortSignal.timeout(FOUND_MS), MOST_CAST)
      const ids = anilistIdsOf(members)
      const pictures = ids.length > 0 ? await livePictures(ids) : { value: new Map<number, string>(), settled: true }

      return { value: castFrom(members, pictures.value, lang), settled: pictures.settled }
    },
    (done) => done.settled,
  )
}

export async function foundPage(slug: string): Promise<{ page: FoundPage; settled: boolean } | null> {
  if (!slugLike(slug) || taken.has(slug)) return null
  const found = await resolve(slug)

  if (!found) return null
  const cast = await castOf(slug, found.work.lang)

  return {
    page: { work: found.work, cast: cast.value, family: found.family },
    settled: found.settled && cast.settled,
  }
}

export function prime(signal: AbortSignal): Promise<void> {
  return index.open(signal)
}
