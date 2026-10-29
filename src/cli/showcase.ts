import type { Work } from '../core/commons.ts'
import type { PaletteEntry } from '../core/manifest.ts'
import { inert } from '../core/text.ts'
import { slugOf } from '../core/theme.ts'
import { reach } from '../store/available.ts'
import type { Listed, ListedPalette, ListedWork, Shown } from '../store/marketplace-index.ts'
import { TOPIC } from '../store/sources.ts'
import { fetchArchive, fromArchive } from './refresh.ts'

interface Found {
  full_name: string
  name: string
  description: string | null
  stargazers_count: number
  owner: { login: string }
  pushed_at: string
  license: { spdx_id: string } | null
}

export interface RepoFacts {
  stars: number
  pushedAt: string
}

function authorized(token: string | undefined): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {}
}

async function found(token: string | undefined): Promise<Found[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(`topic:${TOPIC}`)}&sort=stars&per_page=100`
  const response = await reach(url, undefined, undefined, authorized(token))

  return ((await response.json()) as { items: Found[] }).items
}

export async function repoFacts(repo: string, token?: string): Promise<RepoFacts> {
  const response = await reach(`https://api.github.com/repos/${repo}`, undefined, undefined, authorized(token))
  const r = (await response.json()) as Pick<Found, 'stargazers_count' | 'pushed_at'>

  return { stars: r.stargazers_count, pushedAt: r.pushed_at.slice(0, 10) }
}

function listedWork({ id, name, native }: Work): ListedWork {
  return { id, name, ...(native ? { native } : {}) }
}

async function shown(r: Found): Promise<Shown[]> {
  const source = `${r.owner.login.toLowerCase()}/${r.name}`

  try {
    const archive = await fetchArchive(source)

    if (!archive) {
      return []
    }

    const { id, entries, works, info } = fromArchive(source, archive)

    const palettes = entries.map(({ upstream, ...e }) => ({
      ...e,
      name: slugOf(e.name),
      ...(upstream ? { upstream: { palette: upstream.palette } } : {}),
    }))

    return palettes.length === 0
      ? []
      : [
          {
            id,
            repo: r.full_name,
            add: source,
            about: info.description ?? r.description ?? '',
            stars: r.stargazers_count,
            pushedAt: r.pushed_at.slice(0, 10),
            license: r.license && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id : null,
            palettes,
            works: works.map(listedWork),
          },
        ]
  } catch (error) {
    process.stderr.write(`showcase: skipping ${source} — ${(error as Error).message}\n`)

    return []
  }
}

export async function showcase(token?: string): Promise<Shown[]> {
  return (await Promise.all((await found(token)).map(shown))).flat()
}

function listedPalette(entry: PaletteEntry): ListedPalette {
  return {
    name: entry.name,
    ...(entry.subject ? { subject: entry.subject } : {}),
    background: entry.background,
    foreground: entry.foreground,
    cursor: entry.cursor,
    selection: entry.selection,
    ansi: entry.ansi,
    signatureSlots: entry.signatureSlots,
  }
}

export function indexText(shown: Shown[]): string {
  const marketplaces: Listed[] = shown
    .map((m) => ({
      id: m.id,
      source: m.add,
      about: inert(m.about),
      stars: m.stars,
      updated: m.pushedAt,
      palettes: m.palettes.map(listedPalette),
      works: m.works,
    }))
    .sort((a, b) => b.stars - a.stars || a.id.localeCompare(b.id))

  return `${JSON.stringify({ marketplaces })}\n`
}

export async function buildIndex(token?: string): Promise<string> {
  return indexText(await showcase(token))
}
