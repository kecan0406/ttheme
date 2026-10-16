import { reach } from './available.ts'
import { listed, type PaletteEntry } from './manifest.ts'
import { inert, type Listed, type ListedPalette, type Shown } from './marketplace-index.ts'
import { fetchArchive, fromArchive } from './refresh.ts'
import { TOPIC } from './sources.ts'
import { slugOf } from './theme.ts'

interface Found {
  full_name: string
  name: string
  description: string | null
  stargazers_count: number
  owner: { login: string }
  pushed_at: string
  license: { spdx_id: string } | null
}

async function found(token: string | undefined): Promise<Found[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(`topic:${TOPIC}`)}&sort=stars&per_page=100`
  const response = await reach(url, undefined, undefined, token ? { authorization: `Bearer ${token}` } : {})

  return ((await response.json()) as { items: Found[] }).items
}

async function shown(r: Found, official: PaletteEntry[]): Promise<Shown[]> {
  const source = `${r.owner.login.toLowerCase()}/${r.name}`

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

function listedPalette(entry: PaletteEntry): ListedPalette {
  return {
    name: entry.name,
    ...(entry.catalog ? { catalog: entry.catalog } : {}),
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
    }))
    .sort((a, b) => b.stars - a.stars || a.id.localeCompare(b.id))

  return `${JSON.stringify({ marketplaces })}\n`
}

export async function buildIndex(official: PaletteEntry[], token?: string): Promise<string> {
  return indexText(await showcase(official, token))
}
