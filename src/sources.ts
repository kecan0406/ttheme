import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { parse } from 'smol-toml'
import { nameProblem } from './theme.ts'

export const OFFICIAL = 'official'
export const MARKET_FILE = 'ttheme-market.toml'
export const MARKET_SCHEMA_URL = 'https://www.schemastore.org/ttheme-market.json'
export const PALETTE_SCHEMA_URL = 'https://www.schemastore.org/ttheme-palette.json'
export const MARKET_KEYS = [
  '$schema',
  'name',
  'description',
  'owner',
  'renames',
  'force_remove_deleted_palettes',
  'metadata',
]
export const OWNER_KEYS = ['name', 'email', 'url']
export const TOPIC = 'ttheme-market'

const OWNER = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i
const REPO_NAME = /^[\w.-]{1,100}$/
const REF = /^\w[\w.+/-]{0,199}$/

export function installedPath(configHome: string): string {
  return join(configHome, 'ttheme', 'installed.json')
}

export function marketsOf(markets: string[] | undefined): string[] {
  return markets ?? [OFFICIAL]
}

export function marketSources(configHome: string): string[] {
  try {
    const { markets } = JSON.parse(readFileSync(installedPath(configHome), 'utf8')) as { markets?: unknown }
    return marketsOf(Array.isArray(markets) ? markets.filter((m): m is string => typeof m === 'string') : undefined)
  } catch {
    return [OFFICIAL]
  }
}

export function isLocal(source: string): boolean {
  return isAbsolute(source)
}

export function isRemote(source: string): boolean {
  return source !== OFFICIAL && !isLocal(source)
}

export function repoOf(source: string): string {
  const at = source.indexOf('#')
  return isRemote(source) && at >= 0 ? source.slice(0, at) : source
}

export function refOf(source: string): string | undefined {
  const at = source.indexOf('#')
  return isRemote(source) && at >= 0 ? source.slice(at + 1) : undefined
}

export function sameMarket(a: string, b: string): boolean {
  return repoOf(a) === repoOf(b)
}

export function autoUpdates(source: string, updates: Readonly<Record<string, boolean>> | undefined): boolean {
  return !isLocal(source) && (updates?.[source] ?? source === OFFICIAL)
}

function refProblem(ref: string): boolean {
  return !REF.test(ref) || ref.includes('..') || ref.includes('//') || /(?:[./]|\.lock)$/.test(ref)
}

export function parseSource(arg: string, cwd = process.cwd()): string {
  if (arg === OFFICIAL) {
    return OFFICIAL
  }
  if (arg === '~' || arg.startsWith('~/')) {
    return join(homedir(), arg.slice(1))
  }
  if (arg.startsWith('.') || isAbsolute(arg)) {
    return resolve(cwd, arg)
  }
  const [spec = '', ref, ...extra] = arg.split('#')
  const [owner, repo, ...rest] = spec
    .replace(/^https:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .split('/')
  if (
    !owner ||
    !OWNER.test(owner) ||
    !repo ||
    !REPO_NAME.test(repo) ||
    rest.length > 0 ||
    extra.length > 0 ||
    (ref !== undefined && refProblem(ref))
  ) {
    throw new Error(
      `${arg} is not a market — give a repository (alice/ttheme-dust, #v1 pins a tag or branch) or a path (./my-market)`,
    )
  }
  return `${owner.toLowerCase()}/${repo}${ref === undefined ? '' : `#${ref}`}`
}

export function archiveUrl(source: string): string {
  const ref = refOf(source)?.split('/').map(encodeURIComponent).join('/') ?? 'HEAD'
  return `https://codeload.github.com/${repoOf(source)}/tar.gz/${ref}`
}

export function remoteOwner(source: string): string {
  return source.slice(0, source.indexOf('/'))
}

export function marketsDir(configHome: string): string {
  return join(configHome, 'ttheme', 'markets')
}

export function cachePath(configHome: string, source: string): string {
  return join(marketsDir(configHome), `${repoOf(source).replace('/', '--')}.json`)
}

export function localRoot(configHome: string): string {
  return join(configHome, 'ttheme', 'market')
}

export function defaultLocal(configHome: string, name: string): string {
  return join(localRoot(configHome), name)
}

export function marketProblem(owner: unknown, name: unknown): string | undefined {
  if (typeof owner !== 'string' || typeof name !== 'string') {
    return 'needs a "name" and an [owner] table whose name is the GitHub handle'
  }
  return nameProblem(`${owner}@${name}/x`)
}

export interface Identity {
  owner: string
  name: string
}

export function marketId({ owner, name }: Identity): string {
  return `${owner}@${name}`
}

export interface Owner {
  name: string
  email?: string
  url?: string
}

export interface MarketInfo extends Identity {
  about: Owner
  description?: string
  renames: Record<string, string | false>
  forceRemove: boolean
}

export function marketToml({ owner, name }: Identity): string {
  return `"$schema" = ${JSON.stringify(MARKET_SCHEMA_URL)}\nname = ${JSON.stringify(name)}\n\n[owner]\nname = ${JSON.stringify(owner)}\n`
}

function shown(where: string, key: string, value: unknown, kind: string): string {
  if (typeof value !== 'string' || value === '' || /\p{Cc}/u.test(value) || value.length > 200) {
    throw new Error(`${where}: ${key} must be ${kind}`)
  }
  return value
}

function optional(where: string, key: string, value: unknown): string | undefined {
  return value === undefined ? undefined : shown(where, key, value, 'one line of text, 200 characters at most')
}

function renamesOf(where: string, raw: unknown): Record<string, string | false> {
  if (raw === undefined) {
    return {}
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${where}: [renames] maps an old palette name to its new name, or to false once it is gone`)
  }
  const renames: Record<string, string | false> = {}
  for (const [from, to] of Object.entries(raw)) {
    if (nameProblem(from) || (to !== false && (typeof to !== 'string' || nameProblem(to)))) {
      throw new Error(`${where}: renames.${from} must map a palette name to a palette name, or to false`)
    }
    renames[from] = to
  }
  return renames
}

export function readMarketInfo(text: string, where: string): MarketInfo {
  let doc: Record<string, unknown>
  try {
    doc = parse(text)
  } catch (error) {
    throw new Error(`${where} is not valid TOML — ${(error as Error).message.split('\n')[0]}`)
  }
  const name = shown(where, 'name', doc.name, 'the market name')
  const raw = doc.owner
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${where}: owner is a table — [owner] with name = "<GitHub handle>"`)
  }
  const owner = raw as Record<string, unknown>
  const about: Owner = { name: shown(where, 'owner.name', owner.name, 'the GitHub handle') }
  const email = optional(where, 'owner.email', owner.email)
  const url = optional(where, 'owner.url', owner.url)
  const description = optional(where, 'description', doc.description)
  const force = doc.force_remove_deleted_palettes
  if (force !== undefined && typeof force !== 'boolean') {
    throw new Error(`${where}: force_remove_deleted_palettes must be true or false`)
  }
  const problem = marketProblem(about.name, name)
  if (problem) {
    throw new Error(`${where} ${problem}`)
  }
  return {
    owner: about.name,
    name,
    about: { ...about, ...(email ? { email } : {}), ...(url ? { url } : {}) },
    ...(description ? { description } : {}),
    renames: renamesOf(where, doc.renames),
    forceRemove: force === true,
  }
}

export function localIdentity(dir: string): MarketInfo {
  const path = join(dir, MARKET_FILE)
  if (!existsSync(path)) {
    throw new Error(`${dir} has no ${MARKET_FILE} — \`ttheme market init ${dir}\` makes one`)
  }
  return readMarketInfo(readFileSync(path, 'utf8'), path)
}

export function shownSource(source: string): string {
  if (source === OFFICIAL) {
    return 'the ttheme catalog'
  }
  if (!isLocal(source)) {
    return `github.com/${source}`
  }
  const home = homedir()
  return source === home || source.startsWith(`${home}/`) ? `~${source.slice(home.length)}` : source
}
