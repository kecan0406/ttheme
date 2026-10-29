import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { parse } from 'smol-toml'
import { inert } from '../core/text.ts'
import { BUILTIN, type Identity, MARKETPLACE_FILE, nameProblem } from '../core/theme.ts'

export const MARKETPLACE_KEYS = ['$schema', 'name', 'description', 'owner']

export const OWNER_KEYS = ['name']
export const TOPIC = 'ttheme-marketplace'

const OWNER = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i
export const REPO_NAME = /^[\w.-]{1,100}$/
const REF = /^\w[\w.+/-]{0,199}$/

export function installedPath(configHome: string): string {
  return join(configHome, 'ttheme', 'installed.json')
}

export function marketplacesOf(marketplaces: string[] | undefined): string[] {
  return marketplaces ?? [BUILTIN]
}

export function marketplaceSources(configHome: string): string[] {
  try {
    const { marketplaces } = JSON.parse(readFileSync(installedPath(configHome), 'utf8')) as { marketplaces?: unknown }

    return marketplacesOf(
      Array.isArray(marketplaces) ? marketplaces.filter((m): m is string => typeof m === 'string') : undefined,
    )
  } catch {
    return [BUILTIN]
  }
}

export function isLocal(source: string): boolean {
  return isAbsolute(source)
}

export function isRemote(source: string): boolean {
  return source !== BUILTIN && !isLocal(source)
}

export function repoOf(source: string): string {
  const at = source.indexOf('#')

  return isRemote(source) && at >= 0 ? source.slice(0, at) : source
}

export function refOf(source: string): string | undefined {
  const at = source.indexOf('#')

  return isRemote(source) && at >= 0 ? source.slice(at + 1) : undefined
}

export function sameMarketplace(a: string, b: string): boolean {
  return repoOf(a) === repoOf(b)
}

export function autoUpdates(source: string, updates: Readonly<Record<string, boolean>> | undefined): boolean {
  return isRemote(source) && (updates?.[source] ?? false)
}

function refProblem(ref: string): boolean {
  return !REF.test(ref) || ref.includes('..') || ref.includes('//') || /(?:[./]|\.lock)$/.test(ref)
}

export function parseSource(arg: string, cwd = process.cwd()): string {
  if (arg === BUILTIN) {
    return BUILTIN
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
      `${arg} is not a marketplace — give a repository (alice/ttheme-dust, #v1 pins a tag or branch) or a path (./my-marketplace)`,
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

export function marketplacesDir(configHome: string): string {
  return join(configHome, 'ttheme', 'marketplaces')
}

export function cachePath(configHome: string, source: string): string {
  return join(marketplacesDir(configHome), `${repoOf(source).replace('/', '--')}.json`)
}

export function localRoot(configHome: string): string {
  return join(configHome, 'ttheme', 'marketplace')
}

export function defaultLocal(configHome: string, name: string): string {
  return join(localRoot(configHome), name)
}

function marketplaceProblem(owner: unknown, name: unknown): string | undefined {
  if (typeof owner !== 'string' || typeof name !== 'string') {
    return 'needs a "name" and an [owner] table whose name is the GitHub handle'
  }

  return nameProblem(`${owner}@${name}/x`)
}

export interface MarketplaceInfo extends Identity {
  description?: string
}

function shown(where: string, key: string, value: unknown, kind: string): string {
  if (typeof value !== 'string' || value === '' || /\p{Cc}/u.test(value) || value.length > 200) {
    throw new Error(`${where}: ${key} must be ${kind}`)
  }

  return value
}

function optional(where: string, key: string, value: unknown): string | undefined {
  return value === undefined ? undefined : inert(shown(where, key, value, 'one line of text, 200 characters at most'))
}

export function readMarketplaceInfo(text: string, where: string): MarketplaceInfo {
  let doc: Record<string, unknown>

  try {
    doc = parse(text)
  } catch (error) {
    throw new Error(`${where} is not valid TOML — ${(error as Error).message.split('\n')[0]}`)
  }

  const name = shown(where, 'name', doc.name, 'the marketplace name')
  const raw = doc.owner

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${where}: owner is a table — [owner] with name = "<GitHub handle>"`)
  }

  const owner = shown(where, 'owner.name', (raw as Record<string, unknown>).name, 'the GitHub handle')
  const description = optional(where, 'description', doc.description)
  const problem = marketplaceProblem(owner, name)

  if (problem) {
    throw new Error(`${where} ${problem}`)
  }

  return {
    owner,
    name,
    ...(description ? { description } : {}),
  }
}

export function localIdentity(dir: string): MarketplaceInfo {
  const path = join(dir, MARKETPLACE_FILE)

  if (!existsSync(path)) {
    throw new Error(`${dir} has no ${MARKETPLACE_FILE} — \`ttheme marketplace init ${dir}\` makes one`)
  }

  return readMarketplaceInfo(readFileSync(path, 'utf8'), path)
}

export function shownSource(source: string): string {
  if (source === BUILTIN) {
    return 'the built-in marketplace'
  }

  if (!isLocal(source)) {
    return `github.com/${source}`
  }

  const home = homedir()

  return source === home || source.startsWith(`${home}/`) ? `~${source.slice(home.length)}` : source
}
