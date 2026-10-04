import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCatalog, reach } from './catalog.ts'
import { writeAtomic } from './edits.ts'
import { listed } from './manifest.ts'
import { type Repository, repositorySource } from './markets.ts'
import { fetchArchive, fromArchive } from './refresh.ts'
import { TOPIC } from './sources.ts'
import { slugOf } from './theme.ts'

interface Found extends Repository {
  pushed_at: string
  license: { spdx_id: string } | null
}

const root = join(import.meta.dirname, '..')
const official = parseCatalog(readFileSync(join(root, 'dist', 'manifest.json'), 'utf8')).palettes
const token = process.env.GITHUB_TOKEN

async function found(): Promise<Found[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(`topic:${TOPIC}`)}&sort=stars&per_page=100`
  const response = await reach(url, undefined, undefined, token ? { authorization: `Bearer ${token}` } : {})
  return ((await response.json()) as { items: Found[] }).items
}

async function shown(r: Found) {
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

let markets: Awaited<ReturnType<typeof shown>> = []
try {
  markets = (await Promise.all((await found()).map(shown))).flat()
} catch (error) {
  process.stderr.write(`showcase: no markets — ${(error as Error).message}\n`)
}
writeAtomic(join(root, 'dist', 'markets.json'), `${JSON.stringify({ markets })}\n`)
console.log(`${markets.length} markets → dist/markets.json`)
