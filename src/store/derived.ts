import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { memoUsed, recallMemo } from '../core/memo.ts'
import { writeAtomic } from './edits.ts'

interface Kept {
  epoch: number
  entries: Record<string, [number, string]>
}

const AGE = 24
const LIMIT = 2000
const BUILDS = 3
const FILE = /^[0-9a-f]{16}\.json$/

let store: string | undefined

function readKept(path: string): Kept | undefined {
  let doc: unknown

  try {
    doc = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }

  if (!doc || typeof doc !== 'object') {
    return undefined
  }

  const epoch = 'epoch' in doc && typeof doc.epoch === 'number' ? doc.epoch : 0
  const raw = 'entries' in doc && doc.entries && typeof doc.entries === 'object' ? doc.entries : {}
  const entries: Kept['entries'] = {}

  for (const [key, pair] of Object.entries(raw)) {
    if (Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'string') {
      entries[key] = [pair[0], pair[1]]
    }
  }

  return { epoch, entries }
}

export function keepDerived(entry: string, cache: string): void {
  if (!entry.startsWith('file:') || !entry.endsWith('.js')) {
    return
  }

  try {
    const build = createHash('sha1')
      .update(readFileSync(fileURLToPath(entry)))
      .digest('hex')
      .slice(0, 16)

    store = join(cache, 'derived', `${build}.json`)
    const kept = readKept(store)

    if (kept) {
      recallMemo(Object.entries(kept.entries).map(([key, [, text]]) => [key, text]))
    }
  } catch {
    store = undefined
  }
}

function prune(dir: string): void {
  const builds = readdirSync(dir)
    .filter((name) => FILE.test(name))
    .flatMap((name) => {
      try {
        return [{ name, at: statSync(join(dir, name)).mtimeMs }]
      } catch {
        return []
      }
    })
    .sort((a, b) => b.at - a.at)

  for (const { name } of builds.slice(BUILDS)) {
    rmSync(join(dir, name), { force: true })
  }
}

export function saveDerived(): void {
  const { fresh, entries } = memoUsed()

  if (!store || !fresh) {
    return
  }

  const disk = readKept(store)
  const epoch = (disk?.epoch ?? 0) + 1
  const all: Kept['entries'] = { ...disk?.entries }

  for (const [key, text] of entries) {
    all[key] = [epoch, text]
  }

  const kept = Object.entries(all)
    .filter(([, [at]]) => at > epoch - AGE)
    .sort((a, b) => b[1][0] - a[1][0])
    .slice(0, Math.max(LIMIT, entries.length))

  try {
    writeAtomic(store, JSON.stringify({ epoch, entries: Object.fromEntries(kept) }))
    prune(dirname(store))
  } catch {}
}
