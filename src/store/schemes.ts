import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { reach } from './available.ts'
import { writeAtomic } from './edits.ts'

export interface Corpus {
  schemes: [string, string][]
  notes: string[]
}

const REPO = 'mbadolato/iTerm2-Color-Schemes'
const LIST_URL = `https://api.github.com/repos/${REPO}/contents/ghostty`
const RAW_URL = `https://raw.githubusercontent.com/${REPO}/master/ghostty/`
const CONCURRENCY = 16
const FILE_NAME = /^[^./\\\p{Cc}\p{Bidi_Control}][^/\\\p{Cc}\p{Bidi_Control}]*$/u

export function schemesPath(configHome: string): string {
  return join(configHome, 'ttheme', 'schemes.json')
}

export function hasCorpus(configHome: string): boolean {
  return existsSync(schemesPath(configHome))
}

export function readCorpus(configHome: string): unknown {
  try {
    return JSON.parse(readFileSync(schemesPath(configHome), 'utf8'))
  } catch {
    return undefined
  }
}

export function corpusOf(doc: unknown): [string, string][] | undefined {
  const held = typeof doc === 'object' && doc !== null ? (doc as Record<string, unknown>).schemes : undefined

  if (typeof held !== 'object' || held === null) {
    return undefined
  }

  return Object.entries(held)
    .flatMap(([name, text]): [string, string][] =>
      FILE_NAME.test(name) && typeof text === 'string' ? [[name, text]] : [],
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
}

async function listed(): Promise<string[]> {
  const response = await reach(LIST_URL, undefined, undefined, { accept: 'application/vnd.github+json' })
  const entries: unknown = await response.json()

  return (Array.isArray(entries) ? entries : [])
    .flatMap((entry: unknown) => {
      const v = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {}

      return v.type === 'file' && typeof v.name === 'string' ? [v.name] : []
    })
    .filter((name) => FILE_NAME.test(name))
}

export async function fetchCorpus(configHome: string): Promise<Corpus> {
  const names = await listed()
  const queue = [...names]
  const texts = new Map<string, string>()
  const notes: string[] = []

  const worker = async () => {
    for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
      try {
        texts.set(name, await (await reach(RAW_URL + encodeURIComponent(name))).text())
      } catch (error) {
        notes.push(`skipped ${name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const schemes = names.toSorted().flatMap((name): [string, string][] => {
    const text = texts.get(name)

    return text === undefined ? [] : [[name, text]]
  })

  if (schemes.length > 0) {
    writeAtomic(schemesPath(configHome), `${JSON.stringify({ schemes: Object.fromEntries(schemes) })}\n`)
  }

  return { schemes, notes }
}
