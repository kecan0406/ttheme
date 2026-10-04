import { reach } from './catalog.ts'
import { listed, type PaletteEntry } from './manifest.ts'
import { type Repository, repositorySource } from './markets.ts'
import { fetchArchive, fromArchive } from './refresh.ts'
import { TOPIC } from './sources.ts'
import { slugOf } from './theme.ts'

interface Found extends Repository {
  pushed_at: string
  license: { spdx_id: string } | null
}

export interface Shown {
  id: string
  repo: string
  add: string
  about: string
  stars: number
  pushedAt: string
  license: string | null
  palettes: PaletteEntry[]
}

async function found(token: string | undefined): Promise<Found[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(`topic:${TOPIC}`)}&sort=stars&per_page=100`
  const response = await reach(url, undefined, undefined, token ? { authorization: `Bearer ${token}` } : {})
  return ((await response.json()) as { items: Found[] }).items
}

async function shown(r: Found, official: PaletteEntry[]): Promise<Shown[]> {
  const source = repositorySource(r)
  try {
    const archive = await fetchArchive(source)
    if (!archive) {
      return []
    }
    const { id, entries, info } = fromArchive(source, archive, official)
    const palettes = listed(entries).map((e) => ({ ...e, name: slugOf(e.name) }))
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
          },
        ]
  } catch (error) {
    process.stderr.write(`showcase: skipping ${source} — ${(error as Error).message}\n`)
    return []
  }
}

export async function showcase(official: PaletteEntry[], token?: string): Promise<Shown[]> {
  return (await Promise.all((await found(token)).map((r) => shown(r, official)))).flat()
}
