import { readdirSync, rmSync, statSync } from 'node:fs'
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import pkg from '../package.json' with { type: 'json' }
import { pngHead } from './png.ts'

export const PAGE = 100
export const MAX_PIXELS = 25_000_000
const CACHE_BYTES = 512 * 1024 * 1024

export type Rating = 'safe' | 'questionable' | 'explicit'
export type Block = 'nudity' | 'underwear'
export type Kind = 'comic' | 'monochrome' | 'sketch' | 'chibi'

export const RATINGS: Rating[] = ['safe', 'questionable', 'explicit']
export const BLOCKS: Block[] = ['nudity', 'underwear']
export const KINDS: Kind[] = ['comic', 'monochrome', 'sketch', 'chibi']
export const SCORES = ['off', '5', '10', '25', '50', '100']
export const SIZES = ['off', '720', '1080', '1440', '1800', '2560']

const EXPOSED: Record<Block, Set<string>> = {
  nudity: new Set(['nude', 'naked', 'topless', 'bottomless', 'nipples', 'naked_towel', 'undressing']),
  underwear: new Set(['underwear', 'panties', 'pantsu', 'bra', 'lingerie', 'pantyshot']),
}
const KIND_TAGS: Record<Kind, Set<string>> = {
  comic: new Set(['comic', '4koma']),
  monochrome: new Set(['monochrome', 'greyscale']),
  sketch: new Set(['sketch', 'lineart', 'line_art']),
  chibi: new Set(['chibi']),
}
const FREE = /^(?:rating|score|width|height|filetype|dimension):/
const MOEBOORU: Record<Rating, string> = { safe: 's', questionable: 'q', explicit: 'e' }
const HEAD = 8191
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
const ZEROCHAN_FILES = 'https://static.zerochan.net'
const ZEROCHAN_SAMPLES = 'https://s1.zerochan.net'
export const AGENT = `ttheme/${pkg.version} (+${pkg.homepage})`

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

export interface Named {
  artist: string[]
  character: string[]
  copyright: string[]
}

const ROLES = ['artist', 'character', 'copyright'] as const

export interface Credit {
  named: Named
  source: string
  owner: string
  posted?: string
}

export interface Post extends Rendition {
  id: number
  preview: string
  owner: string
  score: number
  rating: string
  md5: string
  source: string
  tags: string[]
  named: Named
  posted?: string
  solo: boolean | undefined
  family: number
  smaller: Rendition[]
  mirror?: { file: string; preview: string }
}

export interface Narrow {
  score: number
  size: number
  png: boolean
}

export interface Site {
  key: string
  name: string
  origin: string
  moved: boolean
  cutouts: string
  best: string
  tagBudget: number
  ors: boolean
  vouched: boolean
  scored: boolean
  ansi: number
  missing?: number
  ratings: Record<Rating, Set<string>>
  rate(levels: readonly Rating[]): string
  narrow(filters: Narrow): string[]
  postsUrl(tags: string, page: number): string
  countUrl(tags: string): string
  postUrl(id: number): string
  pageUrl(id: number): string
  parse(text: string): Post[]
  count(text: string): number
  guesses?(post: Post): string[]
  counts?(tags: string): boolean
  uploadedBy?(owner: string): string
  credits?(page: string): Credit
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

function words(text: unknown): string[] {
  return String(text ?? '')
    .split(/\s+/)
    .filter(Boolean)
}

function day(at: unknown): string | undefined {
  const when = typeof at === 'number' ? new Date(at * 1000) : typeof at === 'string' ? new Date(at) : undefined
  return when && !Number.isNaN(when.getTime()) ? when.toISOString().slice(0, 10) : undefined
}

interface Raw {
  preview: unknown
  file: string
  ext: string
  owner: unknown
  md5: unknown
  tags: string
  named: Named
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
      score: Number(p.score) || 0,
      rating: String(p.rating ?? ''),
      md5: String(raw.md5 ?? ''),
      source: String(p.source ?? ''),
      tags: words(raw.tags),
      named: raw.named,
      ...(day(p.created_at) ? { posted: day(p.created_at) } : {}),
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
    const typed = (type: string) => words(tags).filter((tag) => types.get(tag) === type)
    return post(p, {
      preview: p.preview_url,
      file,
      ext: String(p.file_ext || extension(file)).toLowerCase(),
      owner: p.author,
      md5: p.md5,
      tags,
      named: { artist: typed('artist'), character: typed('character'), copyright: typed('copyright') },
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
      md5: p.md5,
      tags,
      named: {
        artist: words(p.tag_string_artist),
        character: words(p.tag_string_character),
        copyright: words(p.tag_string_copyright),
      },
      solo: tags.split(/\s+/).includes('solo'),
      versions: (asset.variants ?? [])
        .map((v) => version(v.url, v.width, v.height))
        .filter((v) => v.ext === 'jpg' || v.ext === 'png')
        .sort((a, b) => b.width * b.height - a.width * a.height),
    })
  })
}

function zerochanTag(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_')
}

function zerochanTags(raw: unknown): string[] {
  return (Array.isArray(raw) ? raw : []).map((tag) => zerochanTag(String(tag)))
}

function sampleName(tag: unknown): string {
  return (
    String(tag ?? '')
      .replace(/[^0-9a-z]+/gi, '.')
      .replace(/^\.+|\.+$/g, '') || 'zerochan'
  )
}

export function parseZerochan(text: string): Post[] {
  const body = text.trim()
  const raw = (body ? JSON.parse(body) : {}) as Record<string, unknown>
  const items = Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]) : raw.id ? [raw] : []
  return items.flatMap((item): Post[] => {
    const id = Number(item.id)
    if (!id) {
      return []
    }
    const tags = zerochanTags(item.tags)
    const file = absolute(String(item.full ?? ''))
    return [
      {
        id,
        width: Number(item.width) || 0,
        height: Number(item.height) || 0,
        file,
        ext: extension(file),
        preview: `${ZEROCHAN_SAMPLES}/${sampleName(item.tag ?? item.primary)}.600.${id}.jpg`,
        owner: '',
        score: 0,
        rating: tags.some((tag) => EXPOSED.nudity.has(tag)) ? 'q' : 'g',
        md5: String(item.md5 ?? item.hash ?? ''),
        source: String(item.source ?? ''),
        tags,
        named: { artist: [], character: [], copyright: [] },
        solo: tags.includes('solo'),
        family: 0,
        smaller: [],
      },
    ]
  })
}

const ZEROCHAN_ROLES: Record<string, keyof Named> = {
  mangaka: 'artist',
  studio: 'artist',
  character: 'character',
  series: 'copyright',
  game: 'copyright',
}

function unescaped(text: string): string {
  return text.replace(/&(?:#(\d+)|amp|quot|apos|lt|gt);/g, (entity, code: string | undefined) =>
    code
      ? String.fromCharCode(Number(code))
      : ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' }[entity] ?? entity),
  )
}

export function parseZerochanPage(html: string): Credit {
  const named: Named = { artist: [], character: [], copyright: [] }
  for (const [, kind, tag] of html.matchAll(/<li class="([a-z]+)[^"]*"[^>]*\bdata-tag="([^"]*)"/g)) {
    const role = ZEROCHAN_ROLES[kind as string]
    const name = zerochanTag(unescaped(tag as string))
    if (role && !named[role].includes(name)) {
      named[role].push(name)
    }
  }
  const posted = day(/"datePublished":\s*"([^"]+)"/.exec(html)?.[1])
  return {
    named,
    source: '',
    owner: unescaped(/\buploader = \{\s*name: '([^']*)'/.exec(html)?.[1] ?? ''),
    ...(posted ? { posted } : {}),
  }
}

export function parseZerochanCount(text: string): number {
  return Number(/Zerochan has ([\d,]+) /.exec(text)?.[1]?.replace(/,/g, '') ?? 0)
}

interface Suggestion {
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
  const posts = (raw as { counts?: { posts?: unknown } }).counts?.posts
  return posts === null ? Number.NaN : Number(posts) || 0
}

interface Spec {
  key: string
  name: string
  origin: string
  cutouts: string[]
  vouched: boolean
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

export function kindSet(value: string | undefined): Kind[] {
  return chosen(value, KINDS, [], 'none')
}

export function siteSet(value: string | undefined): string[] {
  const names = SITES.map((site) => site.name)
  return chosen(value, names, names)
}

export function narrowOf(score: string | undefined, size: string | undefined, png: string | undefined): Narrow {
  return { score: Number(score) || 0, size: Number(size) || 0, png: png === 'on' }
}

export function tagList(value: string | undefined): string[] {
  return [
    ...new Set(
      (value ?? '')
        .toLowerCase()
        .split(/[\s,]+/)
        .map((tag) => tag.replace(/^-+/, ''))
        .filter(Boolean),
    ),
  ]
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

function sized(size: number): string[] {
  return size > 0 ? [`width:>=${size}`, `height:>=${size}`] : []
}

function moebooru(raw: Spec): Site {
  const spec = based(raw)
  const params = (rest: Record<string, string>) => new URLSearchParams({ api_version: '2', include_tags: '1', ...rest })
  return {
    ...spec,
    scored: true,
    narrow: ({ score, size }) => [...(score > 0 ? [`score:>=${score}`] : []), ...sized(size)],
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
    ors: true,
    postsUrl: (tags, page) =>
      `${spec.origin}/post.json?${params({ limit: String(PAGE), page: String(page + 1), tags })}`,
    countUrl: (tags) => `${spec.origin}/post.xml?${new URLSearchParams({ limit: '1', tags })}`,
    postUrl: (id) => `${spec.origin}/post.json?${params({ tags: `id:${id}` })}`,
    pageUrl: (id) => `${spec.origin}/post/show/${id}`,
    parse: parseMoebooru,
    count: parseCount,
    uploadedBy: (owner) => `user:${owner}`,
  }
}

function danbooru(raw: Spec): Site {
  const spec = based(raw)
  const ratings = tiers(['g'], ['s', 'q'], ['e'])
  return {
    ...spec,
    scored: true,
    narrow: ({ score, size, png }) => [
      ...(score > 0 ? [`score:>=${score}`] : []),
      ...sized(size),
      ...(png ? ['filetype:png'] : []),
    ],
    cutouts: anyOf(spec.cutouts),
    ratings,
    rate: (levels) =>
      levels.length === RATINGS.length ? '' : `rating:${levels.flatMap((level) => [...ratings[level]]).join(',')}`,
    best: 'order:score',
    tagBudget: 2,
    ors: true,
    postsUrl: (tags, page) =>
      `${spec.origin}/posts.json?${new URLSearchParams({ limit: String(PAGE), page: String(page + 1), tags })}`,
    countUrl: (tags) => `${spec.origin}/counts/posts.json?${new URLSearchParams({ tags })}`,
    postUrl: (id) => `${spec.origin}/posts.json?${new URLSearchParams({ limit: '1', tags: `id:${id}` })}`,
    pageUrl: (id) => `${spec.origin}/posts/${id}`,
    parse: parseDanbooru,
    count: parseCounts,
    uploadedBy: (owner) => `user:${owner}`,
  }
}

function zerochanPath(tags: string): string {
  return tags
    .split(/\s+/)
    .filter((tag) => tag && !/^(?:order|dimension):/.test(tag))
    .map((tag) => tag.split('_').map(encodeURIComponent).join('+'))
    .join(',')
}

function zerochanParams(tags: string): Record<string, string> {
  const words = tags.split(/\s+/)
  const dimension = words.find((tag) => tag.startsWith('dimension:'))?.slice('dimension:'.length)
  return { s: words.includes('order:fav') ? 'fav' : 'id', ...(dimension ? { d: dimension } : {}) }
}

function zerochan(raw: Spec): Site {
  const spec = based(raw)
  return {
    ...spec,
    scored: false,
    narrow: ({ size }) => (size >= 1800 ? ['dimension:huge'] : size > 0 ? ['dimension:large'] : []),
    cutouts: spec.cutouts[0] ?? '',
    ratings: tiers(['g'], ['q'], ['e']),
    rate: () => '',
    best: 'order:fav',
    tagBudget: 3,
    ors: false,
    missing: 404,
    postsUrl: (tags, page) =>
      `${spec.origin}/${zerochanPath(tags)}?${new URLSearchParams({
        json: '',
        l: String(PAGE),
        p: String(page + 1),
        ...zerochanParams(tags),
      })}`,
    countUrl: (tags) => `${spec.origin}/${zerochanPath(tags)}?${new URLSearchParams({ xml: '', l: '1' })}`,
    postUrl: (id) => `${spec.origin}/${id}?json=`,
    pageUrl: (id) => `${spec.origin}/${id}`,
    parse: parseZerochan,
    count: parseZerochanCount,
    credits: parseZerochanPage,
    counts: (tags) => zerochanPath(tags).split(',').length === 1 && !('d' in zerochanParams(tags)),
    guesses: (post) =>
      (post.tags.includes('transparent_background') ? ['png', 'jpg'] : ['jpg', 'png']).map((ext) =>
        post.preview.replace(ZEROCHAN_SAMPLES, ZEROCHAN_FILES).replace(/\.600\.(\d+)\.jpg$/, `.full.$1.${ext}`),
      ),
  }
}

function siteNamed(host: string): Site | undefined {
  const domain = originHost(`https://${host}`)
  return SITES.find((site) => originHost(site.origin) === domain)
}

export function tagsOf(query: string): number {
  return query.split(/\s+/).filter((tag) => tag && !FREE.test(tag)).length
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
    origin: 'https://shima.donmai.us',
    cutouts: ['transparent_background'],
    vouched: false,
    ansi: 2,
  }),
  moebooru({
    key: 'konachan',
    name: 'konachan',
    origin: 'https://konachan.net',
    cutouts: ['transparent', 'vector'],
    vouched: false,
    ansi: 6,
  }),
  moebooru({
    key: 'yande',
    name: 'yande.re',
    origin: 'https://yande.re',
    cutouts: ['transparent_png'],
    vouched: true,
    ansi: 5,
  }),
  zerochan({
    key: 'zerochan',
    name: 'zerochan',
    origin: 'https://www.zerochan.net',
    cutouts: ['transparent_background'],
    vouched: false,
    ansi: 3,
  }),
]

export const LENDER = SITES.find((site) => site.key === 'danbooru') as Site

export const KEY_SPAN = 2 ** 27

export function postKey(site: Site, id: number): number {
  const at = SITES.indexOf(site)
  return (at === -1 ? SITES.length : at) * KEY_SPAN + id
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

interface Copy {
  site: Site
  url: string
}

export function fileOf(site: Site, post: Post, version: Rendition = post): Copy {
  return post.mirror && version === post ? { site: LENDER, url: post.mirror.file } : { site, url: version.file }
}

export function previewOf(site: Site, post: Post): Copy {
  return post.mirror ? { site: LENDER, url: post.mirror.preview } : { site, url: post.preview }
}

export function exposed(post: Pick<Post, 'tags'>, blocks: readonly Block[] = BLOCKS): string[] {
  return post.tags.filter((tag) => blocks.some((block) => EXPOSED[block].has(tag)))
}

export function hidden(post: Pick<Post, 'tags'>, kinds: readonly Kind[]): string[] {
  return post.tags.filter((tag) => kinds.some((kind) => KIND_TAGS[kind].has(tag)))
}

export function rated(site: Site, post: Pick<Post, 'rating'>, levels: readonly Rating[] = ['safe']): boolean {
  return levels.some((level) => site.ratings[level].has(post.rating))
}

export function ratingOf(site: Site, post: Pick<Post, 'rating'>): Rating | undefined {
  return site.rate(['safe']) === '' ? undefined : RATINGS.find((level) => site.ratings[level].has(post.rating))
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

export function cacheRoot(): string {
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

async function listed(site: Site, url: string, signal: AbortSignal): Promise<string> {
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

const PIXIV_FILE =
  /^https?:\/\/(?:i\.pximg\.net|i\d*\.pixiv\.net|img\d*\.pixiv\.net)\/\S*\/(\d+)(?:_p\d+)?(?:_\w+)?\.\w+(?:[?#]\S*)?$/i
const PIXIV_ILLUST = /^https?:\/\/(?:www\.)?pixiv\.net\/member_illust\.php\?\S*\billust_id=(\d+)/i

export function sourcePage(source: string): string {
  const id = PIXIV_FILE.exec(source)?.[1] ?? PIXIV_ILLUST.exec(source)?.[1]
  return id ? `https://www.pixiv.net/artworks/${id}` : source
}

export function uncredited(site: Site, post: Post): boolean {
  return site.credits !== undefined && post.named.artist.length === 0
}

export function credit(post: Post, found: Partial<Credit>): void {
  for (const role of ROLES) {
    const named = found.named?.[role] ?? []
    if (post.named[role].length === 0 && named.length > 0) {
      post.named[role] = named
    }
  }
  post.source ||= found.source ?? ''
  post.owner ||= found.owner ?? ''
  if (!post.posted && found.posted) {
    post.posted = found.posted
  }
}

interface Lent {
  tags: string[]
  named: Named
  source: string
  file: string
}

export function lentUrl(md5s: readonly string[]): string {
  const params = new URLSearchParams({
    limit: String(2 * PAGE),
    only: 'md5,tag_string,tag_string_artist,tag_string_character,tag_string_copyright,source,file_url',
    tags: `md5:${md5s.join(',')}`,
  })
  return `${LENDER.origin}/posts.json?${params}`
}

export function parseLent(text: string): Map<string, Lent> {
  return new Map(
    records(text).flatMap((p): [string, Lent][] => {
      const md5 = String(p.md5 ?? '')
      return md5
        ? [
            [
              md5,
              {
                tags: words(p.tag_string),
                named: {
                  artist: words(p.tag_string_artist),
                  character: words(p.tag_string_character),
                  copyright: words(p.tag_string_copyright),
                },
                source: String(p.source ?? ''),
                file: absolute(String(p.file_url ?? '')),
              },
            ],
          ]
        : []
    }),
  )
}

export function lend(posts: readonly Post[], lent: ReadonlyMap<string, Lent>): void {
  for (const post of posts) {
    const found = lent.get(post.md5)
    if (!found) {
      continue
    }
    post.tags = [...new Set([...post.tags, ...found.tags])]
    credit(post, found)
    post.solo = found.tags.includes('solo')
    if (found.file.includes('/original/')) {
      post.mirror = {
        file: found.file,
        preview: found.file.replace('/original/', '/360x360/').replace(/\.[a-z0-9]+$/i, '.jpg'),
      }
      if (!post.file) {
        post.file = found.file
        post.ext = extension(found.file)
      }
    }
  }
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

export function artistsUrl(names: readonly string[]): string {
  const params = new URLSearchParams([
    ...names.map((name): [string, string] => ['search[name_array][]', name]),
    ['only', 'name,is_deleted,urls'],
    ['limit', String(names.length)],
  ])
  return `${LENDER.origin}/artists.json?${params}`
}

export function parseArtistUrls(text: string): Map<string, string[]> {
  return new Map(
    records(text).flatMap((artist): [string, string[]][] => {
      const name = String(artist.name ?? '')
      if (!name || artist.is_deleted === true) {
        return []
      }
      const urls = Array.isArray(artist.urls) ? (artist.urls as Record<string, unknown>[]) : []
      return [[name, urls.flatMap((url) => (url.is_active === false || !url.url ? [] : [String(url.url)]))]]
    }),
  )
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

export function parseRelated(text: string): Suggestion[] {
  try {
    const body = JSON.parse(text) as { related_tags?: { tag?: { name?: string; post_count?: number } }[] }
    return (body.related_tags ?? []).flatMap(({ tag }) =>
      tag?.name ? [{ value: tag.name, count: Number(tag.post_count) || 0 }] : [],
    )
  } catch {
    return []
  }
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

export function pickedNames(site: Pick<Site, 'ors' | 'tagBudget'>, chosen: readonly string[]): string[] {
  return chosen.slice(0, site.ors ? site.tagBudget : 1)
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
