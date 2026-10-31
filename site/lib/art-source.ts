import type { Art, WorkArt } from '@/lib/art'
import type { FoundCast } from '@/lib/found'
import type { Work } from '../../src/core/commons.ts'
import { inert } from '../../src/core/text.ts'

export interface ArtIds {
  tmdb: string
  anilist: number
  cast: Record<string, number>
}

export const ART_IDS = {
  'black-bullet': {
    tmdb: 'tv/60834',
    anilist: 20457,
    cast: { rentaro: 74619, enju: 74621, kisara: 83523, tina: 88336, kohina: 88339, kagetane: 83505 },
  },
  'bocchi-the-rock': {
    tmdb: 'tv/119100',
    anilist: 130003,
    cast: { bocchi: 257562, nijika: 261674, ryo: 264529, kita: 266041 },
  },
  'call-of-the-night': {
    tmdb: 'tv/138357',
    anilist: 141391,
    cast: { nazuna: 168774, kou: 168866, seri: 175658, anko: 175659 },
  },
  chuunibyou: {
    tmdb: 'tv/45501',
    anilist: 14741,
    cast: { rikka: 65865, yuuta: 65863, shinka: 65871, dekomori: 67215, kumin: 67213 },
  },
  'code-geass': {
    tmdb: 'tv/31724',
    anilist: 1575,
    cast: { lelouch: 417, suzaku: 559, cc: 1111, kallen: 558, nunnally: 1110, euphemia: 1114 },
  },
  'cyberpunk-edgerunners': {
    tmdb: 'tv/105248',
    anilist: 120377,
    cast: { david: 284158, lucy: 284157, rebecca: 284163 },
  },
  evangelion: { tmdb: 'tv/890', anilist: 30, cast: { asuka: 94, rei: 86, kaworu: 1261, misato: 1259 } },
  higurashi: { tmdb: 'tv/25760', anilist: 934, cast: { rena: 1427, mion: 1611, rika: 1534, satoko: 1612 } },
  'jujutsu-kaisen': {
    tmdb: 'tv/95479',
    anilist: 113415,
    cast: { gojo: 127691, yuji: 127212, megumi: 126635, nobara: 133700, nanami: 133704, geto: 133699, sukuna: 133701 },
  },
  'k-on': {
    tmdb: 'tv/42253',
    anilist: 5680,
    cast: { yui: 19565, ritsu: 19567, mio: 19566, mugi: 19568, azusa: 21173 },
  },
  lain: { tmdb: 'tv/1087', anilist: 339, cast: { lain: 2219 } },
  'lucky-star': { tmdb: 'tv/42500', anilist: 1887, cast: { konata: 2169, kagami: 2171, tsukasa: 2170, miyuki: 2172 } },
  'madoka-magica': {
    tmdb: 'tv/39218',
    anilist: 9756,
    cast: { madoka: 37832, homura: 38005, sayaka: 38395, kyoko: 40006, mami: 38194, nagisa: 87785, kyubey: 38566 },
  },
  monogatari: {
    tmdb: 'tv/46195',
    anilist: 5081,
    cast: { hitagi: 22037, shinobu: 23602, tsubasa: 22055, nadeko: 22050 },
  },
  nichijou: {
    tmdb: 'tv/44684',
    anilist: 10165,
    cast: { yukko: 10418, naganohara: 40081, mai: 10421, nano: 10422, hakase: 41055, sakamoto: 41069 },
  },
  'no-game-no-life': {
    tmdb: 'tv/60808',
    anilist: 19815,
    cast: { sora: 82523, shiro: 82525, steph: 82527, jibril: 87887, izuna: 88003, tet: 88004 },
  },
  oregairu: {
    tmdb: 'tv/65676',
    anilist: 14813,
    cast: { hachiman: 67065, yukino: 67067, yuigahama: 67069, iroha: 88727, komachi: 67075, haruno: 79589 },
  },
  'persona-5': {
    tmdb: 'tv/77701',
    anilist: 99693,
    cast: { joker: 121590, skull: 122974, panther: 120335, fox: 122975, queen: 122977, oracle: 121635 },
  },
  'sailor-moon': {
    tmdb: 'tv/3570',
    anilist: 530,
    cast: { moon: 2030, mercury: 2366, mars: 2367, jupiter: 2825, venus: 2826 },
  },
  'steins-gate': { tmdb: 'tv/42509', anilist: 9253, cast: { kurisu: 34470, mayuri: 35253, suzuha: 35255 } },
  'sword-art-online': {
    tmdb: 'tv/45782',
    anilist: 11757,
    cast: { kirito: 36765, asuna: 36828, sinon: 55147, leafa: 36831, alice: 75450, yuuki: 64523 },
  },
  'the-devil-is-a-part-timer': {
    tmdb: 'tv/45997',
    anilist: 15809,
    cast: { maou: 70733, emi: 70735, chiho: 70739, ashiya: 70737, urushihara: 83103, suzuno: 83105 },
  },
  umineko: {
    tmdb: 'tv/25499',
    anilist: 4896,
    cast: { battler: 14040, beatrice: 10285, bernkastel: 11840, lambdadelta: 10196 },
  },
} satisfies Record<string, ArtIds>

const TMDB_API = 'https://api.themoviedb.org/3'

const ANILIST_API = 'https://graphql.anilist.co'

const ANILIST_FILE = /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/[\w./-]+$/

const TMDB_FILE = /^\/\w+\.(?:jpg|png)$/

const WIDEST = 1280

const PAGE = 50

const PAUSE_MS = 2000

const MOST_CAST = 12

interface Reach {
  tries: number
  timeout: number
}

const BUILD: Reach = { tries: 3, timeout: 15000 }

const LIVE: Reach = { tries: 1, timeout: 3000 }

export interface Live<T> {
  value: T
  settled: boolean
}

export interface Media {
  banner: string | null
  cast: FoundCast[]
}

class Refused extends Error {
  readonly status: number

  constructor(url: string, status: number) {
    super(`${url} answered ${status}`)
    this.status = status
  }
}

interface Backdrop {
  file_path?: unknown
  iso_639_1?: unknown
  vote_average?: unknown
  vote_count?: unknown
  width?: unknown
}

function pause(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms))
}

async function reach(url: string, init: RequestInit = {}, how: Reach = BUILD): Promise<unknown> {
  let failure = new Error('no answer')

  for (let tried = 0; tried < how.tries; tried += 1) {
    if (tried > 0) await pause(PAUSE_MS * tried)

    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(how.timeout) })

      if (response.ok) return await response.json()
      failure = new Refused(url, response.status)

      if (response.status < 500 && response.status !== 429) break
    } catch (error) {
      failure = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw failure
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function bestOf(backdrops: Backdrop[]): string | null {
  const usable = backdrops.filter(
    (backdrop): backdrop is Backdrop & { file_path: string } =>
      typeof backdrop.file_path === 'string' && TMDB_FILE.test(backdrop.file_path) && count(backdrop.width) >= WIDEST,
  )

  const bare = usable.filter((backdrop) => backdrop.iso_639_1 === null || backdrop.iso_639_1 === 'xx')

  const [best] = (bare.length > 0 ? bare : usable).toSorted(
    (a, b) => count(b.vote_average) - count(a.vote_average) || count(b.vote_count) - count(a.vote_count),
  )

  return best?.file_path ?? null
}

async function backdropOf(tmdb: string, token: string, how: Reach = BUILD): Promise<string | null> {
  const init = { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } }
  const details = (await reach(`${TMDB_API}/${tmdb}`, init, how)) as { backdrop_path?: unknown }

  if (typeof details?.backdrop_path === 'string' && TMDB_FILE.test(details.backdrop_path)) return details.backdrop_path

  const found = (await reach(`${TMDB_API}/${tmdb}/images?include_image_language=null,xx,en,ja`, init, how)) as {
    backdrops?: unknown
  }

  return Array.isArray(found?.backdrops) ? bestOf(found.backdrops as Backdrop[]) : null
}

async function anilist(
  query: string,
  variables: Record<string, unknown>,
  how: Reach = BUILD,
): Promise<Record<string, unknown>> {
  const answer = (await reach(
    ANILIST_API,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    },
    how,
  )) as { data?: Record<string, unknown> }

  if (!answer?.data) throw new Error('AniList answered no data')

  return answer.data
}

function file(value: unknown): string | null {
  return typeof value === 'string' && ANILIST_FILE.test(value) && !value.includes('/default.') ? value : null
}

function nodes(data: Record<string, unknown>, field: string): Record<string, unknown>[] {
  const list = (data.page as Record<string, unknown> | undefined)?.[field]

  return Array.isArray(list) ? (list as Record<string, unknown>[]) : []
}

async function bannersOf(ids: number[]): Promise<Map<number, string>> {
  const banners = new Map<number, string>()

  for (let at = 0; at < ids.length; at += PAGE) {
    const data = await anilist(
      'query ($ids: [Int]) { page: Page(perPage: 50) { media(id_in: $ids) { id bannerImage } } }',
      { ids: ids.slice(at, at + PAGE) },
    )

    for (const media of nodes(data, 'media')) {
      const banner = file(media.bannerImage)

      if (typeof media.id === 'number' && banner) banners.set(media.id, banner)
    }
  }

  return banners
}

async function picturesOf(ids: number[]): Promise<Map<number, string>> {
  const pictures = new Map<number, string>()

  for (let at = 0; at < ids.length; at += PAGE) {
    const data = await anilist(
      'query ($ids: [Int]) { page: Page(perPage: 50) { characters(id_in: $ids) { id image { large } } } }',
      { ids: ids.slice(at, at + PAGE) },
    )

    for (const character of nodes(data, 'characters')) {
      const picture = file((character.image as Record<string, unknown> | undefined)?.large)

      if (typeof character.id === 'number' && picture) pictures.set(character.id, picture)
    }
  }

  return pictures
}

async function settle<T>(run: () => Promise<T>, none: T): Promise<Live<T>> {
  try {
    return { value: await run(), settled: true }
  } catch (error) {
    return { value: none, settled: error instanceof Refused && error.status === 404 }
  }
}

function said(value: unknown): string | null {
  const shown = typeof value === 'string' ? inert(value).trim() : ''

  return shown || null
}

function castOf(media: Record<string, unknown> | undefined): FoundCast[] {
  const characters = media?.characters as { edges?: unknown } | undefined
  const edges = Array.isArray(characters?.edges) ? (characters.edges as Record<string, unknown>[]) : []

  return edges.flatMap((edge) => {
    const node = edge?.node as Record<string, unknown> | undefined
    const names = node?.name as Record<string, unknown> | undefined
    const name = said(names?.full)
    const native = said(names?.native)

    if (!name) return []

    return [
      {
        name,
        native: native === name ? null : native,
        picture: file((node?.image as Record<string, unknown> | undefined)?.large),
      },
    ]
  })
}

export function liveBackdrop(tmdb: string, token: string): Promise<Live<string | null>> {
  return settle(() => backdropOf(tmdb, token, LIVE), null)
}

export function liveMedia(id: number): Promise<Live<Media>> {
  return settle(
    async () => {
      const data = await anilist(
        `query ($id: Int) { media: Media(id: $id) { bannerImage characters(sort: [ROLE, RELEVANCE, ID], perPage: ${MOST_CAST}) { edges { node { name { full native } image { large } } } } } }`,
        { id },
        LIVE,
      )

      const media = data.media as Record<string, unknown> | undefined

      return { banner: file(media?.bannerImage), cast: castOf(media) }
    },
    { banner: null, cast: [] },
  )
}

export function artProblems(works: readonly Work[]): string[] {
  return Object.entries(ART_IDS).flatMap(([id, ids]) => {
    const work = works.find((entry) => entry.id === id)

    if (!work) return [`${id}: the commons holds no such work`]

    return Object.keys(ids.cast).flatMap((character) =>
      work.characters.some((entry) => entry.id === character)
        ? []
        : [`${id}/${character}: the commons holds no such character`],
    )
  })
}

export async function fetchArt(token: string | undefined, warn: (message: string) => void): Promise<Art> {
  const works = Object.entries(ART_IDS)

  if (!token) warn('no key art from TMDB — TMDB_TOKEN is not set')

  const [backdrops, banners, pictures] = await Promise.all([
    Promise.all(works.map(([, ids]) => (token ? backdropOf(ids.tmdb, token) : null))),
    bannersOf(works.map(([, ids]) => ids.anilist)),
    picturesOf(works.flatMap(([, ids]) => Object.values(ids.cast))),
  ])

  const art: Art = {}

  for (const [index, [id, ids]] of works.entries()) {
    const cast: WorkArt['cast'] = {}

    for (const [character, anilist] of Object.entries(ids.cast)) {
      const picture = pictures.get(anilist)

      if (picture) cast[character] = picture
    }

    art[id] = { backdrop: backdrops[index] ?? null, banner: banners.get(ids.anilist) ?? null, cast }
  }

  return art
}
