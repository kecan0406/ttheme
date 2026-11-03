import {
  anilistCharacter,
  bangumiCharacter,
  type Keys,
  keyArtOf,
  liveCharacterFile,
  liveCover,
  type Picks,
  picksOf,
  picturesOf,
  type Reach,
} from '@kecan0406/aninames/pictures'
import type { Art, WorkArt } from '@/lib/art'
import { type Place, placesFrom, placesOf } from '@/lib/categories'
import {
  anilistIdsOf,
  type Casts,
  type CastWork,
  castFrom,
  castLeads,
  MOST_CAST,
  membersOf,
  type People,
  untaken,
} from '@/lib/found'
import { langOf } from '@/lib/theme-entry'
import { AGENT } from '../../src/core/booru.ts'
import type { Character, Work } from '../../src/core/commons.ts'
import { type CastMember, slugOfTag, type TaggedWork } from '../../src/core/names.ts'
import { liveSource, nameIndex } from '../../src/store/names.ts'

export const LIVE: Reach = { tries: 1, timeout: 3000, agent: AGENT }

const BUILD: Reach = { tries: 3, timeout: 15000, agent: AGENT }

const AT_ONCE = 6

const MOST_UNSETTLED = 0.1

export interface RecordedCharacter extends Character {
  anilist?: number
  bangumi?: number
  picture?: string
  person?: string
}

export interface Recorded extends Omit<Work, 'characters'> {
  art?: Picks
  characters: RecordedCharacter[]
}

function table(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function shown(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function counted(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

function address(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('https://') ? value : undefined
}

function picksIn(value: unknown): Picks {
  const art = table(value)
  const picture = address(art.picture)
  const tmdb = shown(art.tmdb)
  const anilist = counted(art.anilist)
  const steam = shown(art.steam)
  const igdb = shown(art.igdb)
  const bangumi = counted(art.bangumi)

  return {
    ...(picture ? { picture } : {}),
    ...(tmdb ? { tmdb } : {}),
    ...(anilist ? { anilist } : {}),
    ...(steam ? { steam } : {}),
    ...(igdb ? { igdb } : {}),
    ...(bangumi ? { bangumi } : {}),
  }
}

function recordedCharacter(value: unknown): RecordedCharacter[] {
  const raw = table(value)
  const id = shown(raw.id)

  if (!id) return []
  const danbooru = shown(raw.danbooru)
  const anilist = counted(raw.anilist)
  const bangumi = counted(raw.bangumi)
  const picture = address(raw.picture)
  const person = shown(raw.person)
  const native = Array.isArray(raw.native) ? raw.native.flatMap((name) => shown(name) ?? []) : []
  const also = Array.isArray(raw.also) ? raw.also.flatMap((work) => shown(work) ?? []) : []

  return [
    {
      id,
      ...(native.length > 0 ? { native } : {}),
      ...(danbooru ? { danbooru } : {}),
      ...(also.length > 0 ? { also } : {}),
      ...(raw.sites ? { sites: raw.sites as Record<string, string[]> } : {}),
      ...(anilist ? { anilist } : {}),
      ...(bangumi ? { bangumi } : {}),
      ...(picture ? { picture } : {}),
      ...(person ? { person } : {}),
    },
  ]
}

export function recordedWorks(doc: unknown): Recorded[] {
  const works = table(doc).works

  return (Array.isArray(works) ? works : []).flatMap((value) => {
    const raw = table(value)
    const id = shown(raw.id)
    const name = shown(raw.name)

    if (!id || !name) return []
    const native = shown(raw.native)
    const danbooru = shown(raw.danbooru)

    return [
      {
        id,
        name,
        ...(native ? { native } : {}),
        ...(danbooru ? { danbooru } : {}),
        art: picksIn(raw.art),
        characters: (Array.isArray(raw.characters) ? raw.characters : []).flatMap(recordedCharacter),
      },
    ]
  })
}

type Index = ReturnType<typeof nameIndex>

let shared: Index | undefined

function theIndex(): Index {
  shared ??= nameIndex(liveSource())

  return shared
}

async function eachOf<T>(items: readonly T[], run: (item: T) => Promise<void>): Promise<void> {
  const waiting = [...items]

  await Promise.all(
    Array.from({ length: AT_ONCE }, async () => {
      for (let item = waiting.shift(); item; item = waiting.shift()) {
        await run(item)
      }
    }),
  )
}

async function membersIn(index: Index, work: Recorded): Promise<TaggedWork[]> {
  const slug = work.danbooru ? slugOfTag(work.danbooru) : undefined

  if (slug) return membersOf(slug, await index.tagged(slug, AbortSignal.timeout(BUILD.timeout)))
  const title = await index.title(work.native ?? work.name, AbortSignal.timeout(BUILD.timeout))

  return title ? [title] : []
}

async function coverOfTag(index: Index, tag: string): Promise<string | null> {
  const slug = slugOfTag(tag)
  const tagged = slug ? membersOf(slug, await index.tagged(slug, AbortSignal.timeout(BUILD.timeout))) : []
  const title = await index.title(tag.replace(/_/g, ' '), AbortSignal.timeout(BUILD.timeout))
  const subject = picksOf([...tagged, ...(title ? [title] : [])]).bangumi

  return subject ? (await liveCover(subject, BUILD, 'common')).value : null
}

async function slotOf(index: Index, character: RecordedCharacter, pictures: ReadonlyMap<number, string>) {
  if (character.picture) return character.picture
  const held = character.anilist ? pictures.get(character.anilist) : undefined

  if (held) return held

  if (character.bangumi) {
    const file = (await liveCharacterFile(character.bangumi, BUILD)).value

    if (file) return file
  }

  if (!character.danbooru) return null
  const member = await index.person(character.danbooru, AbortSignal.timeout(BUILD.timeout))

  if (!member) return coverOfTag(index, character.danbooru)
  const bangumi = bangumiCharacter(member)
  const file = bangumi ? (await liveCharacterFile(bangumi, BUILD)).value : null

  if (file) return file
  const anilist = anilistCharacter(member)

  return anilist ? ((await picturesOf([anilist], BUILD)).get(anilist) ?? null) : null
}

async function artOf(
  index: Index,
  work: Recorded,
  keys: Keys,
  pictures: ReadonlyMap<number, string>,
): Promise<{ art: WorkArt; settled: boolean }> {
  const members = await membersIn(index, work)
  const key = await keyArtOf([work.art ?? {}, picksOf(members)], keys, BUILD)
  const cast: WorkArt['cast'] = {}

  await eachOf(work.characters, async (character) => {
    const picture = await slotOf(index, character, pictures)

    if (picture) cast[character.id] = picture
  })

  return { art: { art: key.value, cast }, settled: key.settled }
}

export async function fetchArt(works: readonly Recorded[], keys: Keys, warn: (message: string) => void): Promise<Art> {
  const index = theIndex()

  if (!keys.tmdb) warn('no key art from TMDB — TMDB_TOKEN is not set')

  if (!keys.twitch) warn('no key art from IGDB — TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET are not set')

  const pictures = await picturesOf(
    works.flatMap((work) => work.characters.flatMap((character) => character.anilist ?? [])),
    BUILD,
  )

  const art: Art = {}
  const unsettled: string[] = []

  await eachOf(works, async (work) => {
    const found = await artOf(index, work, keys, pictures)

    art[work.id] = found.art

    if (!found.settled) unsettled.push(work.id)
  })

  if (unsettled.length > MOST_UNSETTLED * works.length) {
    throw new Error(`the key art of ${unsettled.length} works did not answer: ${unsettled.join(', ')}`)
  }

  if (unsettled.length > 0) warn(`the key art of ${unsettled.join(', ')} did not answer`)

  return art
}

export async function fetchCasts(works: readonly CastWork[], warn: (message: string) => void): Promise<Casts> {
  const index = theIndex()
  const found = new Map<string, CastMember[]>()

  for (const work of works) {
    const slug = slugOfTag(work.tag)

    if (!slug) continue

    const members = await index.cast(slug, AbortSignal.timeout(BUILD.timeout), MOST_CAST)

    found.set(work.id, untaken(castLeads(members), work.held))
  }

  const pictures = await picturesOf(anilistIdsOf([...found.values()].flat()), BUILD).catch((error: unknown) => {
    warn(`no AniList pictures for the casts — ${error instanceof Error ? error.message : String(error)}`)

    return new Map<number, string>()
  })

  const casts: Casts = {}

  for (const work of works) {
    const members = found.get(work.id) ?? []

    if (members.length > 0) casts[work.id] = castFrom(members, pictures, work.lang)
  }

  return casts
}

export async function fetchPlaces(
  works: readonly Pick<Work, 'id' | 'danbooru'>[],
): Promise<Record<string, readonly Place[]>> {
  const index = theIndex()
  const found: Record<string, readonly Place[]> = {}

  for (const work of works) {
    const slug = work.danbooru ? slugOfTag(work.danbooru) : undefined

    if (!slug || placesOf(work.id, []).length > 0) continue
    const places = placesFrom(membersOf(slug, await index.tagged(slug, AbortSignal.timeout(BUILD.timeout))))

    if (places.length > 0) found[work.id] = places
  }

  return found
}

export async function fetchPeople(works: readonly Recorded[]): Promise<People> {
  const index = theIndex()
  const people: People = {}

  for (const work of works) {
    const lang = work.native ? langOf(work.native, true) : null

    for (const character of work.characters) {
      const subject = `${work.id}/${character.id}`

      if (character.person) {
        people[subject] = character.person
      } else if (character.danbooru) {
        const member = await index.person(character.danbooru, AbortSignal.timeout(BUILD.timeout))
        const name = member ? castFrom([member], new Map(), lang)[0]?.name : undefined

        if (name) people[subject] = name
      }
    }
  }

  return people
}

export function castWorks(works: readonly Work[]): CastWork[] {
  return works.flatMap((work) =>
    work.danbooru
      ? [
          {
            id: work.id,
            tag: work.danbooru,
            lang: work.native ? langOf(work.native, true) : null,
            held: work.characters.map((character) => ({
              id: character.id,
              keys: [
                ...(character.danbooru ? [character.danbooru] : []),
                ...Object.values(character.sites ?? {}).flat(),
                ...(character.native ?? []),
              ],
            })),
          },
        ]
      : [],
  )
}
