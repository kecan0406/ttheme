import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'
import { profilesOf } from '../core/artists.ts'
import {
  AGENT,
  type Credit,
  credit,
  extension,
  LENDER,
  type Lent,
  lend,
  lentUrl,
  PAGE,
  type Post,
  parseArtistUrls,
  parseLent,
  parseRelated,
  parseSuggestions,
  parseTagList,
  SITES,
  type Site,
  type Suggestion,
  sourcePage,
  uncredited,
} from '../core/booru.ts'
import { pngHead } from '../core/png.ts'
import { bodyWithin, firstBytes } from '../store/available.ts'

const HEAD = 8191

const ANSWER_MOST = 32 * 1024 * 1024

const FILE_MOST = 256 * 1024 * 1024

const TIMEOUT = 20_000

const LEND_TIMEOUT = 5_000

const SUGGEST_TIMEOUT = 3_000

const SUGGESTED = 8

const RELATED = 8

const RELATED_TIMEOUT = 8_000

const CONNECT = 3_000

const MAX_WAIT = 60_000

const TRIES = 3

const HOPS = 3

const WEB = /^https?:/i

const paused = new Map<string, { site: string; until: number }>()

const walled = new Map<string, number>()

interface Ask {
  headers?: Record<string, string>
  timeout?: number
  spare?: boolean
}

setDefaultAutoSelectFamilyAttemptTimeout(CONNECT)

export function retryAfter(value: string | null, now: number): number {
  if (value !== null && /^\s*\d+\s*$/.test(value)) {
    return Number(value) * 1000
  }

  const at = value === null ? Number.NaN : Date.parse(value)

  return Number.isNaN(at) ? MAX_WAIT : Math.max(0, at - now)
}

export function pausedUntil(site: Site): number {
  let until = 0

  for (const held of paused.values()) {
    if (held.site === site.key && held.until > until) {
      until = held.until
    }
  }

  return until
}

function reset(error: unknown): boolean {
  for (let at: unknown = error; at instanceof Error; at = at.cause) {
    if ((at as NodeJS.ErrnoException).code === 'ECONNRESET') {
      return true
    }
  }

  return false
}

function challenged(response: Response): boolean {
  return (
    (response.headers.get('server') ?? '').startsWith('cloudflare') &&
    response.headers.get('cf-mitigated') === 'challenge'
  )
}

export function redirected(from: string, to: string): string {
  const next = new URL(to, from)

  if (!next.search) {
    next.search = new URL(from).search
  }

  return next.href
}

async function get(
  site: Site,
  url: string,
  signal: AbortSignal,
  { headers = {}, timeout = TIMEOUT, spare = false }: Ask = {},
) {
  let at = url

  for (let tries = 1, hops = 0; ; tries++) {
    if (!WEB.test(at)) {
      throw new Error(`${site.name} pointed at something that is not a web address`)
    }

    const host = new URL(at).host
    const now = Date.now()

    if (spare && (walled.get(host) ?? 0) > now) {
      throw new Error(`${site.name} is behind a Cloudflare challenge`)
    }

    const wait = (paused.get(host)?.until ?? 0) - now

    if (wait > MAX_WAIT || (spare && wait > 0)) {
      throw new Error(`${site.name} asks to wait ${Math.ceil(wait / 1000)}s`)
    }

    if (wait > 0) {
      await sleep(wait, undefined, { signal })
    }

    const first = timeout ? undefined : new AbortController()
    const clock = first && setTimeout(() => first.abort(new DOMException('no answer in time', 'TimeoutError')), TIMEOUT)
    let response: Response

    try {
      response = await fetch(at, {
        headers: { 'User-Agent': AGENT, Referer: `${site.origin}/`, ...headers },
        redirect: 'manual',
        signal: AbortSignal.any([signal, first ? first.signal : AbortSignal.timeout(timeout)]),
      })
    } catch (error) {
      if (tries < TRIES && !signal.aborted && reset(error)) {
        continue
      }

      throw error
    } finally {
      clearTimeout(clock)
    }

    const to = response.headers.get('location')

    if (to && response.status >= 300 && response.status < 400 && hops < HOPS) {
      await response.body?.cancel()
      at = redirected(at, to)
      hops++
      tries--
      continue
    }

    if (response.status === 429) {
      await response.body?.cancel()
      const delay = retryAfter(response.headers.get('retry-after'), Date.now())
      paused.set(host, { site: site.key, until: Math.max(paused.get(host)?.until ?? 0, Date.now() + delay) })

      if (delay > MAX_WAIT) {
        throw new Error(`${site.name} asks to wait ${Math.ceil(delay / 1000)}s`)
      }

      if (!spare && tries < TRIES) {
        continue
      }

      throw Object.assign(new Error(`${site.name} answered 429`), { status: 429 })
    }

    if (!response.ok) {
      await response.body?.cancel()
      const wall = challenged(response)

      if (wall) {
        walled.set(host, Date.now() + MAX_WAIT)
      }

      throw Object.assign(
        new Error(wall ? `${site.name} is behind a Cloudflare challenge` : `${site.name} answered ${response.status}`),
        { status: response.status },
      )
    }

    return response
  }
}

async function answerOf(site: Site, response: Response): Promise<string> {
  const bytes = await bodyWithin(
    response,
    ANSWER_MOST,
    `${site.name} answered more than ${ANSWER_MOST / 1024 / 1024} MB`,
  )

  return new TextDecoder().decode(bytes)
}

async function listed(site: Site, url: string, signal: AbortSignal): Promise<string> {
  try {
    return await answerOf(site, await get(site, url, signal))
  } catch (error) {
    if (site.missing !== undefined && (error as { status?: number }).status === site.missing) {
      return ''
    }

    throw error
  }
}

export async function fetchPosts(site: Site, tags: string, page: number, signal: AbortSignal): Promise<Post[]> {
  return site.parse(await listed(site, site.postsUrl(tags, page), signal))
}

export async function fetchCount(site: Site, tags: string, signal: AbortSignal): Promise<number> {
  return site.count(await listed(site, site.countUrl(tags), signal))
}

export async function fetchPost(site: Site, id: number, signal: AbortSignal): Promise<Post | undefined> {
  const [found] = site.parse(await listed(site, site.postUrl(id), signal))

  return found
}

export async function fetchCredits(site: Site, id: number, signal: AbortSignal): Promise<Credit | undefined> {
  return site.credits?.(await listed(site, site.pageUrl(id), signal))
}

export async function fetchLent(
  md5s: readonly string[],
  signal: AbortSignal,
  spare = false,
): Promise<Map<string, Lent>> {
  const lent = new Map<string, Lent>()

  for (let at = 0; at < md5s.length; at += PAGE) {
    const text = await answerOf(
      LENDER,
      await get(LENDER, lentUrl(md5s.slice(at, at + PAGE)), signal, { timeout: LEND_TIMEOUT, spare }),
    )

    for (const [md5, found] of parseLent(text)) {
      lent.set(md5, found)
    }
  }

  return lent
}

function artistsUrl(names: readonly string[]): string {
  const params = new URLSearchParams([
    ...names.map((name): [string, string] => ['search[name_array][]', name]),
    ['only', 'name,is_deleted,urls'],
    ['limit', String(names.length)],
  ])

  return `${LENDER.origin}/artists.json?${params}`
}

async function fetchArtistUrls(
  names: readonly string[],
  signal: AbortSignal,
  spare: boolean,
): Promise<Map<string, string[]>> {
  const found = new Map<string, string[]>()

  for (let at = 0; at < names.length; at += PAGE) {
    const text = await answerOf(
      LENDER,
      await get(LENDER, artistsUrl(names.slice(at, at + PAGE)), signal, { timeout: LEND_TIMEOUT, spare }),
    )

    for (const [name, urls] of parseArtistUrls(text)) {
      found.set(name, urls)
    }
  }

  return found
}

export async function locate(
  site: Site,
  post: Post,
  signal: AbortSignal,
): Promise<ReturnType<typeof pngHead> | undefined> {
  if (post.file || !site.guesses) {
    return undefined
  }

  for (const url of site.guesses(post)) {
    try {
      const response = await get(site, url, signal, { headers: { Range: `bytes=0-${HEAD}` } })
      const head = pngHead(await firstBytes(response, HEAD + 1))
      post.file = url
      post.ext = extension(url)

      return head
    } catch (error) {
      if (signal.aborted || (error as { status?: number }).status !== 404) {
        throw error
      }
    }
  }

  throw new Error(`${site.name} keeps no png or jpg of ${post.id}`)
}

export async function fetchSuggestions(prefix: string, signal: AbortSignal): Promise<Suggestion[]> {
  const ask = { timeout: SUGGEST_TIMEOUT, spare: true }

  try {
    const params = new URLSearchParams({
      'search[query]': prefix,
      'search[type]': 'tag_query',
      limit: String(SUGGESTED),
    })

    const url = `${LENDER.origin}/autocomplete.json?${params}`

    return parseSuggestions(await answerOf(LENDER, await get(LENDER, url, signal, ask)))
  } catch (error) {
    if (signal.aborted) {
      throw error
    }
  }

  const yande = SITES.find((s) => s.key === 'yande') as Site
  const params = new URLSearchParams({ name: prefix, order: 'count', limit: String(SUGGESTED) })

  return parseTagList(await answerOf(yande, await get(yande, `${yande.origin}/tag.json?${params}`, signal, ask)))
}

export async function fetchRelated(tag: string, signal: AbortSignal): Promise<Suggestion[]> {
  const params = new URLSearchParams({
    'search[query]': tag,
    'search[category]': 'character',
    limit: String(RELATED),
  })

  const url = `${LENDER.origin}/related_tag.json?${params}`

  return parseRelated(await answerOf(LENDER, await get(LENDER, url, signal, { timeout: RELATED_TIMEOUT, spare: true })))
}

export async function headOf(site: Site, url: string, signal: AbortSignal): Promise<ReturnType<typeof pngHead>> {
  const response = await get(site, url, signal, { headers: { Range: `bytes=0-${HEAD}` } })

  return pngHead(await firstBytes(response, HEAD + 1))
}

export async function fetchBytes(
  site: Site,
  url: string,
  signal: AbortSignal,
  progress?: (got: number, size: number) => void,
): Promise<Uint8Array> {
  const response = await get(site, url, signal, { timeout: 0 })
  const tooLarge = `${site.name} sent a file over ${FILE_MOST / 1024 / 1024} MB`

  return bodyWithin(response, FILE_MOST, tooLarge, progress, TIMEOUT)
}

export async function fetchProfiles(
  names: readonly string[],
  signal: AbortSignal,
  spare = false,
): Promise<Map<string, string[]>> {
  const found = await fetchArtistUrls(names, signal, spare)

  return new Map(names.map((name) => [name, profilesOf(found.get(name) ?? [])]))
}

interface PostCredit {
  artist: string[]
  source: string
  profiles: Record<string, string[]>
}

export async function postCredit(site: Site, id: number, signal: AbortSignal): Promise<PostCredit | undefined> {
  const post = await fetchPost(site, id, signal)

  if (!post) {
    return undefined
  }

  if (site !== LENDER && post.md5) {
    try {
      lend([post], await fetchLent([post.md5], signal))
    } catch {}
  }

  if (uncredited(site, post)) {
    try {
      const found = await fetchCredits(site, post.id, signal)

      if (found) {
        credit(post, found)
      }
    } catch {}
  }

  let profiles = new Map<string, string[]>()

  if (post.named.artist.length > 0) {
    try {
      profiles = await fetchProfiles(post.named.artist, signal)
    } catch {}
  }

  return {
    artist: post.named.artist,
    source: sourcePage(post.source),
    profiles: Object.fromEntries(profiles.entries().filter(([, urls]) => urls.length > 0)),
  }
}
