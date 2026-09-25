import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { nameProblem, ownerOf } from './theme.ts'

export const OFFICIAL = 'official'
export const INDEX = 'ttheme-market.json'
export const REPO = 'ttheme-palettes'
export const TOPIC = 'ttheme-market'

const OWNER = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i
const REPO_NAME = /^[\w.-]{1,100}$/

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
  const [owner, repo, ...rest] = arg
    .replace(/^https:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .split('/')
  if (!owner || !OWNER.test(owner) || rest.length > 0 || (repo !== undefined && !REPO_NAME.test(repo))) {
    throw new Error(
      `${arg} is not a market — give a GitHub handle (alice), a repository (alice/palettes) or a path (./my-market)`,
    )
  }
  return `${owner.toLowerCase()}/${repo ?? REPO}`
}

export function rawUrl(source: string): string {
  return `https://raw.githubusercontent.com/${source}/HEAD/${INDEX}`
}

export function remoteOwner(source: string): string {
  return source.slice(0, source.indexOf('/'))
}

export function marketsDir(configHome: string): string {
  return join(configHome, 'ttheme', 'markets')
}

export function cachePath(configHome: string, source: string): string {
  return join(marketsDir(configHome), `${remoteOwner(source)}.json`)
}

export function defaultLocal(configHome: string): string {
  return join(configHome, 'ttheme', 'market')
}

export function localOwner(dir: string): string {
  const path = join(dir, INDEX)
  if (!existsSync(path)) {
    throw new Error(`${dir} has no ${INDEX} — \`ttheme market init ${dir}\` makes one`)
  }
  let owner: unknown
  try {
    owner = (JSON.parse(readFileSync(path, 'utf8')) as { owner?: unknown }).owner
  } catch {
    throw new Error(`${path} is not valid JSON`)
  }
  if (typeof owner !== 'string' || nameProblem(`x@${owner}`) || ownerOf(`x@${owner}`) !== owner) {
    throw new Error(`${path} has no "owner" — the GitHub handle its palettes are named after`)
  }
  return owner
}

export function marketName(source: string): string {
  return source === OFFICIAL ? OFFICIAL : isLocal(source) ? localOwner(source) : remoteOwner(source)
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
