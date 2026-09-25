import { type ManifestEntry, type Theme, toTheme } from '@/lib/themes'

const TOPIC = 'ttheme-market'

interface Repository {
  full_name: string
  description: string | null
  stargazers_count: number
  pushed_at: string
  license: { spdx_id: string } | null
  owner: { login: string }
}

interface Index {
  owner?: string
  name?: string
  palettes?: ManifestEntry[]
}

export interface Market {
  id: string
  repo: string
  add: string
  about: string
  stars: number
  pushedAt: string
  license: string | null
  palettes: Theme[]
}

async function json<T>(url: string): Promise<T | undefined> {
  const token = process.env.GITHUB_TOKEN
  try {
    const response = await fetch(url, {
      headers: token && url.startsWith('https://api.github.com/') ? { authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(15_000),
    })
    return response.ok ? ((await response.json()) as T) : undefined
  } catch {
    return undefined
  }
}

async function fetchMarkets(): Promise<Market[]> {
  const found = await json<{ items: Repository[] }>(
    `https://api.github.com/search/repositories?q=topic:${TOPIC}&sort=stars&per_page=100`,
  )
  const markets = await Promise.all(
    (found?.items ?? []).map(async (r): Promise<Market | undefined> => {
      const index = await json<Index>(`https://raw.githubusercontent.com/${r.full_name}/HEAD/ttheme-market.json`)
      if (typeof index?.name !== 'string' || !Array.isArray(index.palettes) || index.palettes.length === 0) {
        return undefined
      }
      const owner = typeof index.owner === 'string' ? index.owner : r.owner.login.toLowerCase()
      const id = `${owner}@${index.name}`
      return {
        id,
        repo: r.full_name,
        add: r.full_name.toLowerCase(),
        about: r.description ?? '',
        stars: r.stargazers_count,
        pushedAt: r.pushed_at.slice(0, 10),
        license: r.license && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id : null,
        palettes: index.palettes.map((entry) => toTheme(entry, id)),
      }
    }),
  )
  return markets.filter((m): m is Market => m !== undefined)
}

let loaded: Promise<Market[]> | undefined

export function loadMarkets(): Promise<Market[]> {
  loaded ??= fetchMarkets()
  return loaded
}
