import { readdirSync, rmSync, statSync } from 'node:fs'
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'
import { join } from 'node:path'
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
import { cacheRoot } from '../store/paths.ts'

const CACHE_BYTES = 512 * 1024 * 1024

export const HEAD = 8191

export const TIMEOUT = 20_000

const LEND_TIMEOUT = 5_000

const SUGGEST_TIMEOUT = 3_000

const SUGGESTED = 8

const RELATED = 8

const RELATED_TIMEOUT = 8_000

const CONNECT = 3_000

const MAX_WAIT = 60_000

const TRIES = 3

const HOPS = 3

export const HELD = ['orig', 'tile', 'thumb', 'cut']

const paused = new Map<string, number>()

setDefaultAutoSelectFamilyAttemptTimeout(CONNECT)

export function listing(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

export function cacheDir(site: Site): string {
  return join(cacheRoot(), site.key)
}

export function sweepCache(limit = CACHE_BYTES, root = cacheRoot()): void {
  const files: { path: string; size: number; at: number }[] = []
  let total = 0

  for (const site of listing(root)) {
    for (const kind of HELD) {
      const dir = join(root, site, kind)

      for (const name of listing(dir)) {
        const path = join(dir, name)

        try {
          const { size, mtimeMs } = statSync(path)
          files.push({ path, size, at: mtimeMs })
          total += size
        } catch {}
      }
    }
  }

  files.sort((a, b) => a.at - b.at)

  for (const file of files) {
    if (total <= limit) {
      return
    }

    try {
      rmSync(file.path, { force: true })
      total -= file.size
    } catch {}
  }
}

export function retryAfter(value: string | null, now: number): number {
  if (value !== null && /^\s*\d+\s*$/.test(value)) {
    return Number(value) * 1000
  }

  const at = value === null ? Number.NaN : Date.parse(value)

  return Number.isNaN(at) ? MAX_WAIT : Math.max(0, at - now)
}

export function pausedUntil(site: Site): number {
  return paused.get(site.key) ?? 0
}

export function reset(error: unknown): boolean {
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

export async function get(
  site: Site,
  url: string,
  signal: AbortSignal,
  headers: Record<string, string> = {},
  timeout = TIMEOUT,
) {
  let at = url

  for (let tries = 1, hops = 0; ; tries++) {
    const wait = pausedUntil(site) - Date.now()

    if (wait > 0) {
      await sleep(wait, undefined, { signal })
    }

    let response: Response

    try {
      response = await fetch(at, {
        headers: { 'User-Agent': AGENT, Referer: `${site.origin}/`, ...headers },
        redirect: 'manual',
        signal: timeout ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : signal,
      })
    } catch (error) {
      if (tries < TRIES && !signal.aborted && reset(error)) {
        continue
      }

      throw error
    }

    const to = response.headers.get('location')

    if (to && response.status >= 300 && response.status < 400 && hops < HOPS) {
      await response.body?.cancel()
      at = redirected(at, to)
      hops++
      tries--
      continue
    }

    if (response.status === 429 && tries < TRIES) {
      await response.body?.cancel()
      const delay = retryAfter(response.headers.get('retry-after'), Date.now())

      if (delay > MAX_WAIT) {
        throw new Error(`${site.name} asks to wait ${Math.ceil(delay / 1000)}s`)
      }

      paused.set(site.key, Math.max(pausedUntil(site), Date.now() + delay))
      continue
    }

    if (!response.ok) {
      await response.body?.cancel()
      throw Object.assign(
        new Error(
          challenged(response)
            ? `${site.name} is behind a Cloudflare challenge`
            : `${site.name} answered ${response.status}`,
        ),
        { status: response.status },
      )
    }

    return response
  }
}

export async function listed(site: Site, url: string, signal: AbortSignal): Promise<string> {
  try {
    return await (await get(site, url, signal)).text()
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

export async function fetchLent(md5s: readonly string[], signal: AbortSignal): Promise<Map<string, Lent>> {
  const lent = new Map<string, Lent>()

  if (pausedUntil(LENDER) > Date.now()) {
    return lent
  }

  for (let at = 0; at < md5s.length; at += PAGE) {
    const text = await (await get(LENDER, lentUrl(md5s.slice(at, at + PAGE)), signal, {}, LEND_TIMEOUT)).text()

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

export async function fetchArtistUrls(names: readonly string[], signal: AbortSignal): Promise<Map<string, string[]>> {
  const found = new Map<string, string[]>()

  if (pausedUntil(LENDER) > Date.now()) {
    return found
  }

  for (let at = 0; at < names.length; at += PAGE) {
    const text = await (await get(LENDER, artistsUrl(names.slice(at, at + PAGE)), signal, {}, LEND_TIMEOUT)).text()

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
      const response = await get(site, url, signal, { Range: `bytes=0-${HEAD}` })
      const head = pngHead(new Uint8Array(await response.arrayBuffer()))
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
  if (pausedUntil(LENDER) <= Date.now()) {
    try {
      const params = new URLSearchParams({
        'search[query]': prefix,
        'search[type]': 'tag_query',
        limit: String(SUGGESTED),
      })

      const url = `${LENDER.origin}/autocomplete.json?${params}`

      return parseSuggestions(await (await get(LENDER, url, signal, {}, SUGGEST_TIMEOUT)).text())
    } catch (error) {
      if (signal.aborted) {
        throw error
      }
    }
  }

  const yande = SITES.find((s) => s.key === 'yande') as Site
  const params = new URLSearchParams({ name: prefix, order: 'count', limit: String(SUGGESTED) })

  return parseTagList(
    await (await get(yande, `${yande.origin}/tag.json?${params}`, signal, {}, SUGGEST_TIMEOUT)).text(),
  )
}

export async function fetchRelated(tag: string, signal: AbortSignal): Promise<Suggestion[]> {
  if (pausedUntil(LENDER) > Date.now()) {
    return []
  }

  const params = new URLSearchParams({
    'search[query]': tag,
    'search[category]': 'character',
    limit: String(RELATED),
  })

  return parseRelated(
    await (await get(LENDER, `${LENDER.origin}/related_tag.json?${params}`, signal, {}, RELATED_TIMEOUT)).text(),
  )
}

export async function headOf(site: Site, url: string, signal: AbortSignal): Promise<ReturnType<typeof pngHead>> {
  const response = await get(site, url, signal, { Range: `bytes=0-${HEAD}` })

  return pngHead(new Uint8Array(await response.arrayBuffer()))
}

export async function fetchBytes(
  site: Site,
  url: string,
  signal: AbortSignal,
  progress?: (got: number, size: number) => void,
): Promise<Uint8Array> {
  const response = await get(site, url, signal, {}, 0)
  const size = Number(response.headers.get('content-length')) || 0
  const reader = response.body?.getReader()

  if (!reader) {
    return new Uint8Array(await response.arrayBuffer())
  }

  const chunks: Uint8Array[] = []
  let got = 0

  for (;;) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    chunks.push(value)
    got += value.length
    progress?.(got, size)
  }

  const bytes = new Uint8Array(got)
  let at = 0

  for (const chunk of chunks) {
    bytes.set(chunk, at)
    at += chunk.length
  }

  return bytes
}

export async function fetchProfiles(names: readonly string[], signal: AbortSignal): Promise<Map<string, string[]>> {
  const found = await fetchArtistUrls(names, signal)

  return new Map(names.map((name) => [name, profilesOf(found.get(name) ?? [])]))
}

export interface PostCredit {
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
