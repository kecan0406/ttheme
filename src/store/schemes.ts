import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { reach } from './available.ts'
import { cacheRoot } from './paths.ts'

export interface Corpus {
  names: string[]
  fetched: number
  missing: number
  notes: string[]
}

const REPO = 'mbadolato/iTerm2-Color-Schemes'
const LIST_URL = `https://api.github.com/repos/${REPO}/contents/ghostty`
const RAW_URL = `https://raw.githubusercontent.com/${REPO}/master/ghostty/`
const INDEX = '.index'
const INDEX_TTL = 24 * 60 * 60 * 1000
const CONCURRENCY = 16

export function schemesDir(): string {
  return join(cacheRoot(), 'schemes')
}

async function listing(dir: string, notes: string[]): Promise<string[]> {
  const index = join(dir, INDEX)

  const kept = await readFile(index, 'utf8').then(
    (text) => text.split('\n').filter(Boolean),
    () => [],
  )

  const age = await stat(index).then(
    (s) => Date.now() - s.mtimeMs,
    () => Number.POSITIVE_INFINITY,
  )

  if (kept.length > 0 && age < INDEX_TTL) return kept

  try {
    const response = await reach(LIST_URL, undefined, undefined, { accept: 'application/vnd.github+json' })
    const entries = (await response.json()) as { name: string; type: string }[]
    const names = entries.filter((e) => e.type === 'file').map((e) => e.name)

    await writeFile(index, names.join('\n'))

    return names
  } catch (error) {
    notes.push(
      `scheme listing unavailable (${error instanceof Error ? error.message : String(error)}), using what ${dir} holds`,
    )

    return kept
  }
}

async function download(dir: string, names: string[], notes: string[]): Promise<number> {
  const queue = [...names]
  let fetched = 0

  const worker = async () => {
    for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
      try {
        const response = await reach(RAW_URL + encodeURIComponent(name))

        await writeFile(join(dir, name), await response.text())
        fetched++
      } catch (error) {
        notes.push(`skipped ${name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  return fetched
}

export async function syncSchemes(dir = schemesDir()): Promise<Corpus> {
  await mkdir(dir, { recursive: true })

  const notes: string[] = []
  const listed = await listing(dir, notes)
  const present = new Set(await readdir(dir))
  const missing = listed.filter((name) => !present.has(name))
  const fetched = missing.length > 0 ? await download(dir, missing, notes) : 0
  const names = (await readdir(dir)).filter((name) => !name.startsWith('.')).sort()

  return { names, fetched, missing: missing.length, notes }
}

export function readSchemes(dir: string, names: readonly string[]): Promise<[string, string][]> {
  return Promise.all(
    names.map(async (name): Promise<[string, string]> => [name, await readFile(join(dir, name), 'utf8')]),
  )
}
