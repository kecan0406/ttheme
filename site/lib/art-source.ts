import type { Art, WorkArt } from '@/lib/art'
import {
  anilistIdsOf,
  type Casts,
  type CastWork,
  castFrom,
  castLeads,
  MOST_CAST,
  type People,
  untaken,
} from '@/lib/found'
import { langOf } from '@/lib/theme-entry'
import type { Work } from '../../src/core/commons.ts'
import { type CastMember, slugOfTag } from '../../src/core/names.ts'
import { liveSource, nameIndex } from '../../src/store/names.ts'

interface ArtIds {
  tmdb: string
  anilist: number
  cast: Record<string, number>
}

const PERSON_NAMES = new Map([
  ['black-bullet/aihara-enju', 'Enju Aihara'],
  ['call-of-the-night/kikyou-seri', 'Seri Kikyo'],
  ['call-of-the-night/uguisu-anko', 'Anko Uguisu'],
  ['chuunibyou/togashi-yuuta', 'Yuta Togashi'],
  ['chuunibyou/nibutani-shinka', 'Shinka Nibutani'],
  ['chuunibyou/dekomori-sanae', 'Sanae Dekomori'],
  ['chuunibyou/tsuyuri-kumin', 'Kumin Tsuyuri'],
  ['code-geass/kouzuki-kallen', 'Kallen Kozuki'],
  ['madoka-magica/momoe-nagisa', 'Nagisa Momoe'],
  ['nichijou/aioi-yuuko', 'Yuko Aioi'],
  ['nichijou/naganohara-mio', 'Mio Naganohara'],
  ['nichijou/minakami-mai', 'Mai Minakami'],
  ['nichijou/shinonome-nano', 'Nano Shinonome'],
  ['nichijou/sakamoto', 'Sakamoto'],
  ['sword-art-online/sinon', 'Sinon'],
  ['the-devil-is-a-part-timer/maou-sadao', 'Sadao Maou'],
  ['the-devil-is-a-part-timer/yusa-emi', 'Emi Yusa'],
  ['the-devil-is-a-part-timer/sasaki-chiho', 'Chiho Sasaki'],
  ['the-devil-is-a-part-timer/ashiya-shirou', 'Shiro Ashiya'],
  ['the-devil-is-a-part-timer/urushihara-hanzou', 'Hanzo Urushihara'],
  ['the-devil-is-a-part-timer/kamazuki-suzuno', 'Suzuno Kamazuki'],
  ['va-11-hall-a/jill-stingray', 'Jill Stingray'],
  ['va-11-hall-a/sei-asagiri', 'Sei Asagiri'],
])

const ART_IDS = {
  'black-bullet': {
    tmdb: 'tv/60834',
    anilist: 20457,
    cast: {
      'satomi-rentarou': 74619,
      'aihara-enju': 74621,
      'tendou-kisara': 83523,
      'tina-sprout': 88336,
      'hiruko-kohina': 88339,
      'hiruko-kagetane': 83505,
    },
  },
  'bocchi-the-rock': {
    tmdb: 'tv/119100',
    anilist: 130003,
    cast: { 'gotoh-hitori': 257562, 'ijichi-nijika': 261674, 'yamada-ryo': 264529, 'kita-ikuyo': 266041 },
  },
  'call-of-the-night': {
    tmdb: 'tv/138357',
    anilist: 141391,
    cast: { 'nanakusa-nazuna': 168774, 'yamori-kou': 168866, 'kikyou-seri': 175658, 'uguisu-anko': 175659 },
  },
  chuunibyou: {
    tmdb: 'tv/45501',
    anilist: 14741,
    cast: {
      'takanashi-rikka': 65865,
      'togashi-yuuta': 65863,
      'nibutani-shinka': 65871,
      'dekomori-sanae': 67215,
      'tsuyuri-kumin': 67213,
    },
  },
  'code-geass': {
    tmdb: 'tv/31724',
    anilist: 1575,
    cast: {
      'lelouch-vi-britannia': 417,
      'kururugi-suzaku': 559,
      'c-c': 1111,
      'kouzuki-kallen': 558,
      'nunnally-vi-britannia': 1110,
      'euphemia-li-britannia': 1114,
    },
  },
  'cyberpunk-edgerunners': {
    tmdb: 'tv/105248',
    anilist: 120377,
    cast: { 'david-martinez': 284158, lucy: 284157, rebecca: 284163 },
  },
  evangelion: {
    tmdb: 'tv/890',
    anilist: 30,
    cast: { 'souryuu-asuka-langley': 94, 'ayanami-rei': 86, 'nagisa-kaworu': 1261, 'katsuragi-misato': 1259 },
  },
  higurashi: {
    tmdb: 'tv/25760',
    anilist: 934,
    cast: { 'ryuuguu-rena': 1427, 'sonozaki-mion': 1611, 'furude-rika': 1534, 'houjou-satoko': 1612 },
  },
  'jujutsu-kaisen': {
    tmdb: 'tv/95479',
    anilist: 113415,
    cast: {
      'gojo-satoru': 127691,
      'itadori-yuji': 127212,
      'fushiguro-megumi': 126635,
      'kugisaki-nobara': 133700,
      'nanami-kento': 133704,
      'geto-suguru': 133699,
      'ryoumen-sukuna': 133701,
    },
  },
  'k-on': {
    tmdb: 'tv/42253',
    anilist: 5680,
    cast: {
      'hirasawa-yui': 19565,
      'tainaka-ritsu': 19567,
      'akiyama-mio': 19566,
      'kotobuki-tsumugi': 19568,
      'nakano-azusa': 21173,
    },
  },
  lain: { tmdb: 'tv/1087', anilist: 339, cast: { 'iwakura-lain': 2219 } },
  'lucky-star': {
    tmdb: 'tv/42500',
    anilist: 1887,
    cast: { 'izumi-konata': 2169, 'hiiragi-kagami': 2171, 'hiiragi-tsukasa': 2170, 'takara-miyuki': 2172 },
  },
  'madoka-magica': {
    tmdb: 'tv/39218',
    anilist: 9756,
    cast: {
      'kaname-madoka': 37832,
      'akemi-homura': 38005,
      'miki-sayaka': 38395,
      'sakura-kyoko': 40006,
      'tomoe-mami': 38194,
      'momoe-nagisa': 87785,
      kyubey: 38566,
    },
  },
  monogatari: {
    tmdb: 'tv/46195',
    anilist: 5081,
    cast: { 'senjougahara-hitagi': 22037, 'oshino-shinobu': 23602, 'hanekawa-tsubasa': 22055, 'sengoku-nadeko': 22050 },
  },
  nichijou: {
    tmdb: 'tv/44684',
    anilist: 10165,
    cast: {
      'aioi-yuuko': 10418,
      'naganohara-mio': 40081,
      'minakami-mai': 10421,
      'shinonome-nano': 10422,
      'professor-shinonome': 41055,
      sakamoto: 41069,
    },
  },
  'no-game-no-life': {
    tmdb: 'tv/60808',
    anilist: 19815,
    cast: { sora: 82523, shiro: 82525, 'stephanie-dora': 82527, jibril: 87887, 'hatsuse-izuna': 88003, teto: 88004 },
  },
  oregairu: {
    tmdb: 'tv/65676',
    anilist: 14813,
    cast: {
      'hikigaya-hachiman': 67065,
      'yukinoshita-yukino': 67067,
      'yuigahama-yui': 67069,
      'isshiki-iroha': 88727,
      'hikigaya-komachi': 67075,
      'yukinoshita-haruno': 79589,
    },
  },
  'persona-5': {
    tmdb: 'tv/77701',
    anilist: 99693,
    cast: {
      'amamiya-ren': 121590,
      'sakamoto-ryuji': 122974,
      'takamaki-ann': 120335,
      'kitagawa-yusuke': 122975,
      'niijima-makoto': 122977,
      'sakura-futaba': 121635,
    },
  },
  'sailor-moon': {
    tmdb: 'tv/3570',
    anilist: 530,
    cast: {
      'sailor-moon': 2030,
      'sailor-mercury': 2366,
      'sailor-mars': 2367,
      'sailor-jupiter': 2825,
      'sailor-venus': 2826,
    },
  },
  'steins-gate': {
    tmdb: 'tv/42509',
    anilist: 9253,
    cast: { 'makise-kurisu': 34470, 'shiina-mayuri': 35253, 'amane-suzuha': 35255 },
  },
  'sword-art-online': {
    tmdb: 'tv/45782',
    anilist: 11757,
    cast: { kirito: 36765, asuna: 36828, sinon: 55147, leafa: 36831, 'alice-zuberg': 75450, yuuki: 64523 },
  },
  'the-devil-is-a-part-timer': {
    tmdb: 'tv/45997',
    anilist: 15809,
    cast: {
      'maou-sadao': 70733,
      'yusa-emi': 70735,
      'sasaki-chiho': 70739,
      'ashiya-shirou': 70737,
      'urushihara-hanzou': 83103,
      'kamazuki-suzuno': 83105,
    },
  },
  umineko: {
    tmdb: 'tv/25499',
    anilist: 4896,
    cast: { 'ushiromiya-battler': 14040, beatrice: 10285, 'frederica-bernkastel': 11840, lambdadelta: 10196 },
  },
} satisfies Record<string, ArtIds>

const TMDB_API = 'https://api.themoviedb.org/3'

const ANILIST_API = 'https://graphql.anilist.co'

const ANILIST_FILE = /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/[\w./-]+$/

const TMDB_FILE = /^\/\w+\.(?:jpg|png)$/

const WIDEST = 1280

const PAGE = 50

const PAUSE_MS = 2000

const STEAM_ASSETS = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps'

const TWITCH_TOKEN = 'https://id.twitch.tv/oauth2/token'

const IGDB_API = 'https://api.igdb.com/v4'

const STEAM_APP = /^[1-9]\d*$/

const IGDB_SLUG = /^[a-z0-9]+(?:-+[a-z0-9]+)*$/

const IGDB_IMAGE = /^[a-z0-9]+$/

const WIDE = 1.5

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
}

export interface Twitch {
  id: string
  secret: string
}

class Refused extends Error {
  readonly status: number

  constructor(url: string, status: number) {
    super(`${url} answered ${status}`)
    this.status = status
  }
}

interface Picture {
  image_id?: unknown
  width?: unknown
  height?: unknown
  alpha_channel?: unknown
  animated?: unknown
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

async function picturesOf(ids: number[], how: Reach = BUILD): Promise<Map<number, string>> {
  const pictures = new Map<number, string>()

  for (let at = 0; at < ids.length; at += PAGE) {
    const data = await anilist(
      'query ($ids: [Int]) { page: Page(perPage: 50) { characters(id_in: $ids) { id image { large } } } }',
      { ids: ids.slice(at, at + PAGE) },
      how,
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

export function liveBackdrop(tmdb: string, token: string): Promise<Live<string | null>> {
  return settle(() => backdropOf(tmdb, token, LIVE), null)
}

export function liveMedia(id: number): Promise<Live<Media>> {
  return settle(
    async () => {
      const data = await anilist('query ($id: Int) { media: Media(id: $id) { bannerImage } }', { id }, LIVE)
      const media = data.media as Record<string, unknown> | undefined

      return { banner: file(media?.bannerImage) }
    },
    { banner: null },
  )
}

export function livePictures(ids: number[]): Promise<Live<Map<number, string>>> {
  return settle(() => picturesOf(ids, LIVE), new Map())
}

export function liveHero(app: string): Promise<Live<string | null>> {
  return settle(async () => {
    if (!STEAM_APP.test(app)) return null
    const url = `${STEAM_ASSETS}/${app}/library_hero.jpg`
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(LIVE.timeout) })

    if (response.status === 404) return null

    if (!response.ok) throw new Refused(url, response.status)

    return url
  }, null)
}

let twitch: { token: string; until: number } | undefined

async function tokenOf(app: Twitch): Promise<string> {
  if (twitch && Date.now() < twitch.until) return twitch.token
  const query = new URLSearchParams({ client_id: app.id, client_secret: app.secret, grant_type: 'client_credentials' })

  const answer = (await reach(`${TWITCH_TOKEN}?${query}`, { method: 'POST' }, LIVE)) as {
    access_token?: unknown
    expires_in?: unknown
  }

  if (typeof answer?.access_token !== 'string') throw new Error('Twitch answered no token')
  twitch = { token: answer.access_token, until: Date.now() + Math.max(0, count(answer.expires_in) - 60) * 1000 }

  return twitch.token
}

function widest(pictures: unknown): string | null {
  const usable = (Array.isArray(pictures) ? (pictures as Picture[]) : []).filter(
    (picture): picture is Picture & { image_id: string } =>
      typeof picture?.image_id === 'string' &&
      IGDB_IMAGE.test(picture.image_id) &&
      picture.alpha_channel !== true &&
      picture.animated !== true &&
      count(picture.width) >= WIDEST &&
      count(picture.width) >= WIDE * count(picture.height),
  )

  return usable.toSorted((a, b) => count(b.width) - count(a.width))[0]?.image_id ?? null
}

export function liveArtwork(slug: string, app: Twitch): Promise<Live<string | null>> {
  return settle(async () => {
    if (!IGDB_SLUG.test(slug)) return null
    const token = await tokenOf(app)
    const fields = 'artworks.image_id,artworks.width,artworks.height,artworks.alpha_channel,artworks.animated'

    const found = await reach(
      `${IGDB_API}/games`,
      {
        method: 'POST',
        headers: { 'client-id': app.id, authorization: `Bearer ${token}`, accept: 'application/json' },
        body: `fields ${fields},screenshots.image_id,screenshots.width,screenshots.height; where slug = "${slug}"; limit 1;`,
      },
      LIVE,
    ).catch((error: unknown) => {
      if (error instanceof Refused && error.status === 401) twitch = undefined
      throw error
    })

    const game = Array.isArray(found) ? (found[0] as Record<string, unknown> | undefined) : undefined

    return widest(game?.artworks) ?? widest(game?.screenshots)
  }, null)
}

export function artProblems(works: readonly Work[]): string[] {
  const strays = [...PERSON_NAMES.keys()].flatMap((subject) => {
    const [work, character] = subject.split('/')

    return works.some((each) => each.id === work && each.characters.some((entry) => entry.id === character))
      ? []
      : [`${subject}: the commons holds no such character`]
  })

  return strays.concat(artOfWorks(works))
}

function artOfWorks(works: readonly Work[]): string[] {
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

export async function fetchCasts(works: readonly CastWork[], warn: (message: string) => void): Promise<Casts> {
  const index = nameIndex(liveSource())
  const found = new Map<string, CastMember[]>()

  for (const work of works) {
    const slug = slugOfTag(work.tag)

    if (!slug) continue

    const members = await index.cast(slug, AbortSignal.timeout(BUILD.timeout), MOST_CAST)

    found.set(work.id, untaken(castLeads(members), work.held))
  }

  const pictures = await picturesOf(anilistIdsOf([...found.values()].flat())).catch((error: unknown) => {
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

export async function fetchPeople(works: readonly Work[]): Promise<People> {
  const index = nameIndex(liveSource())
  const people: People = {}

  for (const work of works) {
    const lang = work.native ? langOf(work.native, true) : null

    for (const character of work.characters) {
      const subject = `${work.id}/${character.id}`
      const fixed = PERSON_NAMES.get(subject)

      if (fixed) {
        people[subject] = fixed
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
