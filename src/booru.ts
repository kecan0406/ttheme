import { readdirSync, rmSync, statSync } from 'node:fs'
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import pkg from '../package.json' with { type: 'json' }
import { pngHead } from './png.ts'

export const PAGE = 100
export const MAX_PIXELS = 25_000_000
export const CACHE_BYTES = 512 * 1024 * 1024

export type Rating = 'safe' | 'questionable' | 'explicit'
export type Block = 'nudity' | 'underwear'

export const RATINGS: Rating[] = ['safe', 'questionable', 'explicit']
export const BLOCKS: Block[] = ['nudity', 'underwear']

const EXPOSED: Record<Block, Set<string>> = {
  nudity: new Set(['nude', 'naked', 'topless', 'bottomless', 'nipples', 'naked_towel', 'undressing']),
  underwear: new Set(['underwear', 'panties', 'pantsu', 'bra', 'lingerie', 'pantyshot']),
}
const MOEBOORU: Record<Rating, string> = { safe: 's', questionable: 'q', explicit: 'e' }
const HEAD = 8191
const TIMEOUT = 20_000
const LEND_TIMEOUT = 5_000
const SUGGEST_TIMEOUT = 3_000
const SUGGESTED = 8
const CONNECT = 3_000
const MAX_WAIT = 60_000
const TRIES = 3
const AGENT = `ttheme/${pkg.version} (+${pkg.homepage})`

const HELD = ['orig', 'tile', 'thumb', 'cut']

const paused = new Map<string, number>()
const HOSTS = hostMap(process.env.TTHEME_FIND_HOSTS)
const CUTOUTS = cutoutMap(process.env.TTHEME_FIND_CUTOUTS)

setDefaultAutoSelectFamilyAttemptTimeout(CONNECT)

export interface Rendition {
  file: string
  width: number
  height: number
  ext: string
}

export interface Post extends Rendition {
  id: number
  preview: string
  owner: string
  artist: string
  score: number
  rating: string
  md5: string
  source: string
  tags: string[]
  solo: boolean | undefined
  family: number
  smaller: Rendition[]
}

export interface Site {
  key: string
  name: string
  origin: string
  moved: boolean
  cutouts: string
  best: string
  tagBudget: number
  vouched: boolean
  tunneled: boolean
  ansi: number
  ratings: Record<Rating, Set<string>>
  rate(levels: readonly Rating[]): string
  postsUrl(tags: string, page: number): string
  countUrl(tags: string): string
  postUrl(id: number): string
  pageUrl(id: number): string
  parse(text: string): Post[]
  count(text: string): number
}

function listing(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

function absolute(url: string): string {
  return url.startsWith('//') ? `https:${url}` : url
}

export function extension(url: string): string {
  return (/\.([a-z0-9]+)(?:\?.*)?$/i.exec(url)?.[1] ?? '').toLowerCase()
}

function records(text: string): Record<string, unknown>[] {
  const body = text.trim()
  if (!body) {
    return []
  }
  const raw: unknown = JSON.parse(body)
  if (Array.isArray(raw)) {
    return raw as Record<string, unknown>[]
  }
  const posts = (raw as { posts?: unknown }).posts
  return Array.isArray(posts) ? (posts as Record<string, unknown>[]) : []
}

function tagTypes(text: string): Map<string, string> {
  const body = text.trim()
  const raw: unknown = body ? JSON.parse(body) : {}
  const tags = (raw as { tags?: Record<string, unknown> }).tags ?? {}
  return new Map(Object.entries(tags).map(([name, type]) => [name, String(type)]))
}

function version(url: unknown, width: unknown, height: unknown): Rendition {
  const file = absolute(String(url ?? ''))
  return { file, width: Number(width) || 0, height: Number(height) || 0, ext: extension(file) }
}

interface Raw {
  preview: unknown
  file: string
  ext: string
  owner: unknown
  artist: string
  md5: unknown
  tags: string
  solo: boolean | undefined
  versions: Rendition[]
}

function post(p: Record<string, unknown>, raw: Raw): Post[] {
  const preview = absolute(String(raw.preview ?? ''))
  if (!raw.file || !preview || !Number(p.id)) {
    return []
  }
  const width = Number(p.width ?? p.image_width) || 0
  const height = Number(p.height ?? p.image_height) || 0
  return [
    {
      id: Number(p.id),
      width,
      height,
      file: raw.file,
      preview,
      ext: raw.ext,
      owner: String(raw.owner ?? ''),
      artist: raw.artist,
      score: Number(p.score) || 0,
      rating: String(p.rating ?? ''),
      md5: String(raw.md5 ?? ''),
      source: String(p.source ?? ''),
      tags: raw.tags.split(/\s+/).filter(Boolean),
      solo: raw.solo,
      family: Number(p.parent_id) || (p.has_children === true ? Number(p.id) : 0),
      smaller: raw.versions.filter((v) => v.file && v.width > 0 && v.height > 0 && v.width * v.height < width * height),
    },
  ]
}

export function parseMoebooru(text: string): Post[] {
  const types = tagTypes(text)
  return records(text).flatMap((p) => {
    const file = absolute(String(p.file_url ?? ''))
    const tags = String(p.tags ?? '')
    return post(p, {
      preview: p.preview_url,
      file,
      ext: String(p.file_ext || extension(file)).toLowerCase(),
      owner: p.author,
      artist: tags.split(/\s+/).find((tag) => types.get(tag) === 'artist') ?? '',
      md5: p.md5,
      tags,
      solo: undefined,
      versions: [
        version(p.jpeg_url, p.jpeg_width, p.jpeg_height),
        version(p.sample_url, p.sample_width, p.sample_height),
      ],
    })
  })
}

export function parseDanbooru(text: string): Post[] {
  return records(text).flatMap((p) => {
    const file = absolute(String(p.file_url ?? ''))
    const tags = String(p.tag_string ?? '')
    const asset = (p.media_asset ?? {}) as { variants?: { type: string; width: number; height: number; url: string }[] }
    return post(p, {
      preview: asset.variants?.find((v) => v.type === '360x360')?.url ?? p.preview_file_url,
      file,
      ext: String(p.file_ext || extension(file)).toLowerCase(),
      owner: '',
      artist: String(p.tag_string_artist ?? '').split(/\s+/)[0] ?? '',
      md5: p.md5,
      tags,
      solo: tags.split(/\s+/).includes('solo'),
      versions: (asset.variants ?? [])
        .map((v) => version(v.url, v.width, v.height))
        .filter((v) => v.ext === 'jpg' || v.ext === 'png')
        .sort((a, b) => b.width * b.height - a.width * a.height),
    })
  })
}

export interface Suggestion {
  value: string
  count: number
}

export function parseSuggestions(text: string): Suggestion[] {
  return records(text).flatMap((item) => {
    const value = String(item.value ?? '')
    return value ? [{ value, count: Number(item.post_count) || 0 }] : []
  })
}

export function parseTagList(text: string): Suggestion[] {
  return records(text).flatMap((item) => {
    const value = String(item.name ?? '')
    return value ? [{ value, count: Number(item.count) || 0 }] : []
  })
}

export function parseCount(xml: string): number {
  return Number(/count="(\d+)"/.exec(xml)?.[1] ?? 0)
}

export function parseCounts(text: string): number {
  const raw: unknown = text.trim() ? JSON.parse(text) : {}
  return Number((raw as { counts?: { posts?: unknown } }).counts?.posts) || 0
}

interface Spec {
  key: string
  name: string
  origin: string
  cutouts: string[]
  vouched: boolean
  tunneled: boolean
  ansi: number
}

export function cutoutMap(spec: string | undefined): Map<string, string[]> {
  const cutouts = new Map<string, string[]>()
  for (const entry of (spec ?? '').split(/\s+/).filter(Boolean)) {
    const at = entry.indexOf('=')
    if (at > 0) {
      cutouts.set(
        entry.slice(0, at),
        entry
          .slice(at + 1)
          .split(',')
          .filter(Boolean),
      )
    }
  }
  return cutouts
}

export function hostMap(spec: string | undefined): Map<string, string> {
  const hosts = new Map<string, string>()
  for (const entry of (spec ?? '').split(/[\s,]+/).filter(Boolean)) {
    const at = entry.indexOf('=')
    const key = entry.slice(0, at)
    try {
      const url = new URL(entry.slice(at + 1))
      if (key && url.protocol === 'https:') {
        hosts.set(key, url.origin)
      }
    } catch {}
  }
  return hosts
}

function chosen<T extends string>(
  value: string | undefined,
  all: readonly T[],
  fallback: readonly T[],
  none?: string,
): T[] {
  const words = (value ?? '').split(/\s+/)
  if (none !== undefined && words.includes(none)) {
    return []
  }
  const picked = all.filter((item) => words.includes(item))
  return picked.length > 0 ? picked : [...fallback]
}

export function ratingSet(value: string | undefined): Rating[] {
  return chosen(value, RATINGS, ['safe'])
}

export function blockSet(value: string | undefined): Block[] {
  return chosen(value, BLOCKS, BLOCKS, 'none')
}

function tiers(safe: string[], questionable: string[], explicit: string[]): Record<Rating, Set<string>> {
  return { safe: new Set(safe), questionable: new Set(questionable), explicit: new Set(explicit) }
}

function based(spec: Spec): Spec & { moved: boolean } {
  const origin = HOSTS.get(spec.key)
  const cutouts = CUTOUTS.get(spec.key)
  return {
    ...spec,
    origin: origin ?? spec.origin,
    moved: origin !== undefined && origin !== spec.origin,
    cutouts: cutouts ?? spec.cutouts,
    vouched: spec.vouched && cutouts === undefined,
  }
}

function anyOf(tags: string[]): string {
  return tags.length < 2 ? tags.join('') : tags.map((tag) => `~${tag}`).join(' ')
}

function moebooru(raw: Spec): Site {
  const spec = based(raw)
  const params = (rest: Record<string, string>) => new URLSearchParams({ api_version: '2', include_tags: '1', ...rest })
  return {
    ...spec,
    cutouts: anyOf(spec.cutouts),
    ratings: tiers([MOEBOORU.safe], [MOEBOORU.questionable], [MOEBOORU.explicit]),
    rate: (levels) => {
      const [only] = levels
      if (levels.length === 1 && only) {
        return `rating:${MOEBOORU[only]}`
      }
      const missing = RATINGS.filter((level) => !levels.includes(level))
      const [left] = missing
      return missing.length === 1 && left ? `-rating:${MOEBOORU[left]}` : ''
    },
    best: 'order:score',
    tagBudget: Number.POSITIVE_INFINITY,
    postsUrl: (tags, page) =>
      `${spec.origin}/post.json?${params({ limit: String(PAGE), page: String(page + 1), tags })}`,
    countUrl: (tags) => `${spec.origin}/post.xml?${new URLSearchParams({ limit: '1', tags })}`,
    postUrl: (id) => `${spec.origin}/post.json?${params({ tags: `id:${id}` })}`,
    pageUrl: (id) => `${spec.origin}/post/show/${id}`,
    parse: parseMoebooru,
    count: parseCount,
  }
}

function danbooru(raw: Spec): Site {
  const spec = based(raw)
  const ratings = tiers(['g'], ['s', 'q'], ['e'])
  return {
    ...spec,
    cutouts: anyOf(spec.cutouts),
    ratings,
    rate: (levels) =>
      levels.length === RATINGS.length ? '' : `rating:${levels.flatMap((level) => [...ratings[level]]).join(',')}`,
    best: 'order:score',
    tagBudget: 2,
    postsUrl: (tags, page) =>
      `${spec.origin}/posts.json?${new URLSearchParams({ limit: String(PAGE), page: String(page + 1), tags })}`,
    countUrl: (tags) => `${spec.origin}/counts/posts.json?${new URLSearchParams({ tags })}`,
    postUrl: (id) => `${spec.origin}/posts.json?${new URLSearchParams({ limit: '1', tags: `id:${id}` })}`,
    pageUrl: (id) => `${spec.origin}/posts/${id}`,
    parse: parseDanbooru,
    count: parseCounts,
  }
}

function siteNamed(name: string): Site | undefined {
  return SITES.find((site) => site.key === name || site.name === name || new URL(site.origin).host === name)
}

export function tagsOf(query: string): number {
  return query.split(/\s+/).filter((tag) => tag && !tag.startsWith('rating:')).length
}

export function postRef(text: string, fallback: Site): { site: Site; id: number } | undefined {
  const query = text.trim()
  if (/^\d+$/.test(query)) {
    return { site: fallback, id: Number(query) }
  }
  const named = /^([\w.]+):(\d+)$/.exec(query)
  if (named) {
    const site = SITES.find((s) => s.key === named[1] || s.name === named[1])
    return site && { site, id: Number(named[2]) }
  }
  let url: URL
  try {
    url = new URL(query)
  } catch {
    return undefined
  }
  const site = siteNamed(url.host)
  const id = Number(url.searchParams.get('id') ?? url.pathname.split('/').filter(Boolean).at(-1))
  return site && id > 0 ? { site, id } : undefined
}

export const SITES: Site[] = [
  danbooru({
    key: 'danbooru',
    name: 'danbooru',
    origin: 'https://danbooru.donmai.us',
    cutouts: ['transparent_background'],
    vouched: false,
    tunneled: true,
    ansi: 2,
  }),
  moebooru({
    key: 'konachan',
    name: 'konachan',
    origin: 'https://konachan.net',
    cutouts: ['transparent', 'vector'],
    vouched: false,
    tunneled: false,
    ansi: 6,
  }),
  moebooru({
    key: 'yande',
    name: 'yande.re',
    origin: 'https://yande.re',
    cutouts: ['transparent_png'],
    vouched: true,
    tunneled: false,
    ansi: 5,
  }),
]

export const KEY_SPAN = 2 ** 27

export function postKey(site: Site, id: number): number {
  return SITES.indexOf(site) * KEY_SPAN + id
}

export function originHost(source: string): string {
  let host: string
  try {
    host = new URL(source).hostname
  } catch {
    return ''
  }
  return host.split('.').slice(-2).join('.')
}

export function untunneled(): string {
  return SITES.filter((site) => !site.tunneled)
    .map((site) => originHost(site.origin))
    .flatMap((domain) => [domain, `.${domain}`])
    .join(',')
}

export function exposed(post: Pick<Post, 'tags'>, blocks: readonly Block[] = BLOCKS): string[] {
  return post.tags.filter((tag) => blocks.some((block) => EXPOSED[block].has(tag)))
}

export function rated(site: Site, post: Pick<Post, 'rating'>, levels: readonly Rating[] = ['safe']): boolean {
  return levels.some((level) => site.ratings[level].has(post.rating))
}

export function rendition(post: Post): Rendition | undefined {
  return [post, ...post.smaller].find((v) => v.width * v.height <= MAX_PIXELS)
}

export function mates(owners: ReadonlyMap<string, string>): Map<string, string[]> {
  const byOwner = new Map<string, string[]>()
  for (const [palette, owner] of [...owners].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (owner === '') {
      continue
    }
    byOwner.set(owner, [...(byOwner.get(owner) ?? []), palette])
  }
  return byOwner
}

function cacheRoot(): string {
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'ttheme')
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

async function get(
  site: Site,
  url: string,
  signal: AbortSignal,
  headers: Record<string, string> = {},
  timeout = TIMEOUT,
) {
  for (let tries = 1; ; tries++) {
    const wait = pausedUntil(site) - Date.now()
    if (wait > 0) {
      await sleep(wait, undefined, { signal })
    }
    let response: Response
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': AGENT, Referer: `${site.origin}/`, ...headers },
        signal: timeout ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : signal,
      })
    } catch (error) {
      if (tries < TRIES && !signal.aborted && reset(error)) {
        continue
      }
      throw error
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
      throw new Error(
        challenged(response)
          ? `${site.name} is behind a Cloudflare challenge`
          : `${site.name} answered ${response.status}`,
      )
    }
    return response
  }
}

export async function fetchPosts(site: Site, tags: string, page: number, signal: AbortSignal): Promise<Post[]> {
  return site.parse(await (await get(site, site.postsUrl(tags, page), signal)).text())
}

export async function fetchCount(site: Site, tags: string, signal: AbortSignal): Promise<number> {
  return site.count(await (await get(site, site.countUrl(tags), signal)).text())
}

export async function fetchPost(site: Site, id: number, signal: AbortSignal): Promise<Post | undefined> {
  const [found] = site.parse(await (await get(site, site.postUrl(id), signal)).text())
  return found
}

export function lentUrl(md5s: readonly string[]): string {
  const site = SITES.find((s) => s.key === 'danbooru') as Site
  const params = new URLSearchParams({ limit: String(2 * PAGE), only: 'md5,tag_string', tags: `md5:${md5s.join(',')}` })
  return `${site.origin}/posts.json?${params}`
}

export function parseLent(text: string): Map<string, string[]> {
  return new Map(
    records(text).flatMap((p) => {
      const md5 = String(p.md5 ?? '')
      return md5
        ? [
            [
              md5,
              String(p.tag_string ?? '')
                .split(/\s+/)
                .filter(Boolean),
            ] as [string, string[]],
          ]
        : []
    }),
  )
}

export function lend(posts: readonly Post[], lent: ReadonlyMap<string, string[]>): void {
  for (const post of posts) {
    const tags = lent.get(post.md5)
    if (tags) {
      post.tags = [...new Set([...post.tags, ...tags])]
      post.solo = tags.includes('solo')
    }
  }
}

export async function fetchLent(md5s: readonly string[], signal: AbortSignal): Promise<Map<string, string[]>> {
  const site = SITES.find((s) => s.key === 'danbooru') as Site
  const lent = new Map<string, string[]>()
  if (pausedUntil(site) > Date.now()) {
    return lent
  }
  for (let at = 0; at < md5s.length; at += PAGE) {
    const text = await (await get(site, lentUrl(md5s.slice(at, at + PAGE)), signal, {}, LEND_TIMEOUT)).text()
    for (const [md5, tags] of parseLent(text)) {
      lent.set(md5, tags)
    }
  }
  return lent
}

export async function fetchSuggestions(prefix: string, signal: AbortSignal): Promise<Suggestion[]> {
  const danbooru = SITES.find((s) => s.key === 'danbooru') as Site
  if (pausedUntil(danbooru) <= Date.now()) {
    try {
      const params = new URLSearchParams({
        'search[query]': prefix,
        'search[type]': 'tag_query',
        limit: String(SUGGESTED),
      })
      const url = `${danbooru.origin}/autocomplete.json?${params}`
      return parseSuggestions(await (await get(danbooru, url, signal, {}, SUGGEST_TIMEOUT)).text())
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
