const TOPIC = 'ttheme-market'

interface Repository {
  full_name: string
  name: string
  description: string | null
  stargazers_count: number
  owner: { login: string }
}

interface IndexEntry {
  name: string
  background: string
  signature: string[]
}

export interface Market {
  id: string
  repo: string
  add: string
  about: string
  stars: number
  palettes: { name: string; background: string; signature: string[] }[]
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

export async function loadMarkets(): Promise<Market[]> {
  const found = await json<{ items: Repository[] }>(
    `https://api.github.com/search/repositories?q=topic:${TOPIC}&sort=stars&per_page=100`,
  )
  const markets = await Promise.all(
    (found?.items ?? []).map(async (r): Promise<Market | undefined> => {
      const index = await json<{ name?: string; palettes?: IndexEntry[] }>(
        `https://raw.githubusercontent.com/${r.full_name}/HEAD/ttheme-market.json`,
      )
      if (typeof index?.name !== 'string' || !Array.isArray(index.palettes) || index.palettes.length === 0) {
        return undefined
      }
      const id = `${r.owner.login.toLowerCase()}@${index.name}`
      return {
        id,
        repo: r.full_name,
        add: r.full_name.toLowerCase(),
        about: r.description ?? '',
        stars: r.stargazers_count,
        palettes: index.palettes.map((p) => ({
          name: `${id}/${p.name}`,
          background: p.background,
          signature: p.signature,
        })),
      }
    }),
  )
  return markets.filter((m): m is Market => m !== undefined)
}
