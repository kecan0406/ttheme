import { homedir } from 'node:os'
import { join } from 'node:path'
import pkg from '../package.json' with { type: 'json' }
import { pngHead } from './png.ts'

export const PAGE = 100

const SAFE = new Set(['safe', 'general', 's', 'g'])
const MIRRORS = new Set(['danbooru', 'gelbooru', 'konachan', 'yande.re', 'sankaku'])
const HEAD = 8191
const TIMEOUT = 20_000
const AGENT = `ttheme/${pkg.version} (+${pkg.homepage})`

export interface Post {
  id: number
  width: number
  height: number
  file: string
  preview: string
  ext: string
  owner: string
  rating: string
  md5: string
  source: string
  tags: string[]
}

export interface Site {
  key: string
  name: string
  origin: string
  cutouts: string
  vouched: boolean
  ansi: number
  postsUrl(tags: string, page: number): string
  countUrl(tags: string): string
  postUrl(id: number): string
  pageUrl(id: number): string
  parse(text: string): Post[]
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
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []
}

function post(p: Record<string, unknown>, file: string, ext: string, owner: unknown, md5: unknown): Post[] {
  const preview = absolute(String(p.preview_url ?? ''))
  if (!file || !preview || !Number(p.id)) {
    return []
  }
  return [
    {
      id: Number(p.id),
      width: Number(p.width) || 0,
      height: Number(p.height) || 0,
      file,
      preview,
      ext,
      owner: String(owner ?? ''),
      rating: String(p.rating ?? ''),
      md5: String(md5 ?? ''),
      source: String(p.source ?? ''),
      tags: String(p.tags ?? '')
        .split(/\s+/)
        .filter(Boolean),
    },
  ]
}

export function parseGelbooru(text: string, origin = 'https://safebooru.org'): Post[] {
  return records(text).flatMap((p) => {
    const stored = p.directory && p.image ? `${origin}/images/${p.directory}/${p.image}` : ''
    const file = absolute(String(p.file_url || stored))
    return post(p, file, extension(file), p.owner, p.hash ?? p.md5)
  })
}

export function parseMoebooru(text: string): Post[] {
  return records(text).flatMap((p) => {
    const file = absolute(String(p.file_url ?? ''))
    return post(p, file, String(p.file_ext || extension(file)).toLowerCase(), p.author, p.md5)
  })
}

export function parseCount(xml: string): number {
  return Number(/count="(\d+)"/.exec(xml)?.[1] ?? 0)
}

function gelbooru(key: string, name: string, origin: string, cutouts: string, vouched: boolean, ansi: number): Site {
  const api = (params: Record<string, string>) =>
    `${origin}/index.php?${new URLSearchParams({ page: 'dapi', s: 'post', q: 'index', ...params })}`
  return {
    key,
    name,
    origin,
    cutouts,
    vouched,
    ansi,
    postsUrl: (tags, page) => api({ json: '1', limit: String(PAGE), pid: String(page), tags }),
    countUrl: (tags) => api({ limit: '0', tags }),
    postUrl: (id) => api({ json: '1', id: String(id) }),
    pageUrl: (id) => `${origin}/index.php?page=post&s=view&id=${id}`,
    parse: (text) => parseGelbooru(text, origin),
  }
}

function moebooru(key: string, name: string, origin: string, cutouts: string, vouched: boolean, ansi: number): Site {
  const safe = (tags: string) => `${tags} rating:s`
  return {
    key,
    name,
    origin,
    cutouts,
    vouched,
    ansi,
    postsUrl: (tags, page) =>
      `${origin}/post.json?${new URLSearchParams({ limit: String(PAGE), page: String(page + 1), tags: safe(tags) })}`,
    countUrl: (tags) => `${origin}/post.xml?${new URLSearchParams({ limit: '1', tags: safe(tags) })}`,
    postUrl: (id) => `${origin}/post.json?${new URLSearchParams({ tags: `id:${id}` })}`,
    pageUrl: (id) => `${origin}/post/show/${id}`,
    parse: parseMoebooru,
  }
}

export function siteNamed(name: string): Site | undefined {
  return SITES.find((site) => site.name === name || new URL(site.origin).host === name)
}

export const SITES: Site[] = [
  gelbooru('safebooru', 'safebooru', 'https://safebooru.org', '( transparent_background ~ vector_trace )', false, 4),
  moebooru('yande', 'yande.re', 'https://yande.re', 'transparent_png', true, 5),
  moebooru('konachan', 'konachan', 'https://konachan.net', '~transparent ~vector', false, 6),
]

export function originHost(source: string): string {
  let host: string
  try {
    host = new URL(source).hostname
  } catch {
    return ''
  }
  return host.split('.').slice(-2).join('.')
}

export function safe(post: Pick<Post, 'rating'>): boolean {
  return SAFE.has(post.rating)
}

export function mates(owners: ReadonlyMap<string, string>): Map<string, string[]> {
  const byOwner = new Map<string, string[]>()
  for (const [palette, owner] of [...owners].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (owner === '' || MIRRORS.has(owner)) {
      continue
    }
    byOwner.set(owner, [...(byOwner.get(owner) ?? []), palette])
  }
  return byOwner
}

export function cacheDir(site: Site): string {
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'ttheme', site.key)
}

async function get(
  site: Site,
  url: string,
  signal: AbortSignal,
  headers: Record<string, string> = {},
  timeout = TIMEOUT,
) {
  const response = await fetch(url, {
    headers: { 'User-Agent': AGENT, Referer: `${site.origin}/`, ...headers },
    signal: timeout ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : signal,
  })
  if (!response.ok) {
    throw new Error(`${site.name} answered ${response.status}`)
  }
  return response
}

export async function fetchPosts(site: Site, tags: string, page: number, signal: AbortSignal): Promise<Post[]> {
  return site.parse(await (await get(site, site.postsUrl(tags, page), signal)).text())
}

export async function fetchCount(site: Site, tags: string, signal: AbortSignal): Promise<number> {
  return parseCount(await (await get(site, site.countUrl(tags), signal)).text())
}

export async function fetchPost(site: Site, id: number, signal: AbortSignal): Promise<Post | undefined> {
  const [found] = site.parse(await (await get(site, site.postUrl(id), signal)).text())
  return found
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
