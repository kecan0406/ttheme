import {
  credit,
  fetchArtistUrls,
  fetchCredits,
  fetchLent,
  fetchPost,
  LENDER,
  lend,
  type Site,
  sourcePage,
  uncredited,
} from './booru.ts'

export const PROFILE_KINDS = ['pixiv', 'x', 'bsky', 'fanbox', 'skeb', 'patreon', 'fantia'] as const

export type ProfileKind = (typeof PROFILE_KINDS)[number]

export interface Profile {
  kind: ProfileKind
  url: string
}

export interface Page {
  label: string
  url: string
}

export interface Credited {
  artist?: string[]
  profiles?: Record<string, string[]>
  source?: string
  from?: string
}

const FORMS: [ProfileKind, RegExp, (id: string) => string][] = [
  [
    'pixiv',
    /^https?:\/\/(?:www\.)?pixiv\.net\/(?:en\/)?users\/(\d+)\/?$/i,
    (id) => `https://www.pixiv.net/users/${id}`,
  ],
  ['pixiv', /^https?:\/\/(?:www\.)?pixiv\.net\/member\.php\?id=(\d+)$/i, (id) => `https://www.pixiv.net/users/${id}`],
  [
    'x',
    /^https?:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com\/(?!(?:i|intent|home|search|explore|hashtag|share|settings)\/?$)(\w{1,15})\/?$/i,
    (id) => `https://x.com/${id}`,
  ],
  ['bsky', /^https?:\/\/bsky\.app\/profile\/(?!did:)([\w.-]+)\/?$/i, (id) => `https://bsky.app/profile/${id}`],
  ['fanbox', /^https?:\/\/([\w-]+)\.fanbox\.cc\/?$/i, (id) => `https://${id}.fanbox.cc`],
  [
    'fanbox',
    /^https?:\/\/(?:www\.)?pixiv\.net\/fanbox\/creator\/(\d+)\/?$/i,
    (id) => `https://www.pixiv.net/fanbox/creator/${id}`,
  ],
  ['skeb', /^https?:\/\/skeb\.jp\/@([\w-]+)\/?$/i, (id) => `https://skeb.jp/@${id}`],
  [
    'patreon',
    /^https?:\/\/(?:www\.)?patreon\.com\/(?:c\/)?(?!(?:user|posts|join|home|login|search)\/?$)([\w-]+)\/?$/i,
    (id) => `https://www.patreon.com/${id}`,
  ],
  ['fantia', /^https?:\/\/fantia\.jp\/fanclubs\/(\d+)\/?$/i, (id) => `https://fantia.jp/fanclubs/${id}`],
]

const PAGES: [RegExp, (match: RegExpExecArray) => string][] = [
  [/^https?:\/\/(?:www\.)?pixiv\.net\/(?:en\/)?artworks\/(\d+)/i, (m) => `pixiv ${m[1]}`],
  [/^https?:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com\/(\w{1,15})\/status\/\d+/i, (m) => `x ${m[1]}`],
  [/^https?:\/\/bsky\.app\/profile\/([\w.-]+)\/post\//i, (m) => `bsky ${m[1]}`],
  [/^https?:\/\/([\w-]+)\.fanbox\.cc\/posts\/\d+/i, (m) => `fanbox ${m[1]}`],
]

const PAGE_KINDS: [RegExp, ProfileKind][] = [
  [/^https?:\/\/(?:www\.)?pixiv\.net\//i, 'pixiv'],
  [/^https?:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com\//i, 'x'],
  [/^https?:\/\/bsky\.app\//i, 'bsky'],
]

const FOLLOWS: ProfileKind[] = ['x', 'pixiv', 'bsky']

const CANONICAL: Record<string, string> = { 'shima.donmai.us': 'danbooru.donmai.us' }

const SAFE_URL = /^https?:\/\/[^\s\p{Cc}]+$/u

export function safeUrl(url: string): boolean {
  return SAFE_URL.test(url)
}

export function profileKind(url: string): ProfileKind | undefined {
  return FORMS.find(([, form]) => form.test(url))?.[0]
}

export function profilesOf(urls: readonly string[]): string[] {
  return PROFILE_KINDS.flatMap((kind) => {
    for (const [, form, canonical] of FORMS.filter(([of]) => of === kind)) {
      for (const url of urls) {
        const id = form.exec(url)?.[1]
        if (id) {
          return [canonical(id)]
        }
      }
    }
    return []
  })
}

export function linksOf(urls: readonly string[] | undefined): Profile[] {
  return (urls ?? []).flatMap((url) => {
    const kind = profileKind(url)
    return kind ? [{ kind, url }] : []
  })
}

export function pageLabel(url: string): string {
  for (const [form, label] of PAGES) {
    const match = form.exec(url)
    if (match) {
      return label(match)
    }
  }
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function publicUrl(url: string): string {
  try {
    const at = new URL(url)
    const host = CANONICAL[at.hostname]
    if (host) {
      at.hostname = host
    }
    return at.href
  } catch {
    return url
  }
}

function bare(url: string): string {
  return url.replace(/^https?:\/\/(?:www\.)?/, '')
}

export function artworkOf(picture: Credited): Page | undefined {
  const source = picture.source ?? ''
  return safeUrl(source) ? { label: pageLabel(source), url: source } : undefined
}

export function postOf(picture: Credited): Page | undefined {
  const words = (picture.from ?? '').split(' ')
  const url = words[2] ?? ''
  return safeUrl(url) ? { label: words.slice(0, 2).join(' '), url } : undefined
}

export function followOf(urls: readonly string[] | undefined, page: string | undefined): string | undefined {
  const on = page ? PAGE_KINDS.find(([form]) => form.test(page))?.[1] : undefined
  const links = linksOf(urls)
  const kind = FOLLOWS.find((each) => each !== on && links.some((link) => link.kind === each))
  return links.find((link) => link.kind === kind)?.url
}

export function creditLine(picture: Credited): string | undefined {
  const page = artworkOf(picture)?.url ?? postOf(picture)?.url
  const artists = picture.artist ?? []
  if (!page && artists.length === 0) {
    return undefined
  }
  const by =
    artists.length > 0
      ? `Background art by ${artists
          .map((name) => {
            const follow = followOf(picture.profiles?.[name], page)
            return follow ? `${name} (${bare(follow)})` : name
          })
          .join(', ')}`
      : 'Background art (artist unknown)'
  return page ? `${by} · ${publicUrl(page)}` : by
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
