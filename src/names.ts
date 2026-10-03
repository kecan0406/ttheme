import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { writeAtomic } from './edits.ts'

const LAYERS = ['core', 'kowiki', 'unlicensed'] as const

const LANGS = ['ko', 'ja', 'en', 'zh'] as const

interface Card {
  tag?: string
  danbooru?: string[]
  names?: Partial<Record<(typeof LANGS)[number], string[]>>
  generated?: string[]
  rank?: number
  weight?: number
}

export interface Known {
  tag: string
  tags: string[]
  names: string[]
  japanese: string[]
  generated: string[]
  rank: number
}

interface Index {
  known: Known[]
  byTag: Map<string, Known>
  keys: string[]
  owners: number[][]
}

export function namesDir(home = homedir()): string {
  return join(process.env.XDG_CACHE_HOME ?? join(home, '.cache'), 'ttheme', 'aninames')
}

const KATAKANA = /[\u30a1-\u30f6]/g

const SPACE = /[\s\p{P}\p{S}]+/gu

export function searchKey(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(KATAKANA, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(SPACE, '')
}

function long(key: string): boolean {
  return key.length >= 2 || /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}]/u.test(key)
}

function files(home: string): string[] {
  const dir = namesDir(home)
  return LAYERS.map((layer) => join(dir, `ttheme-${layer}.json`)).filter((path) => existsSync(path))
}

const FORMAT = 4

function stampOf(paths: string[]): string {
  return [`format ${FORMAT}`, ...paths]
    .map((path, at) => {
      if (at === 0) return path
      const info = statSync(path)
      return `${path}:${info.size}:${info.mtimeMs}`
    })
    .join('|')
}

const loaded = new Map<string, Index>()

interface Stored {
  stamp: string
  known: [string, string[], string[], string[], string[], number][]
  keys: string[]
  owners: number[][]
}

function build(paths: string[]): { known: Known[]; keys: string[]; owners: number[][] } {
  const cards = new Map<
    string,
    {
      tag?: string
      tags: Set<string>
      names: string[]
      japanese: string[]
      generated: string[]
      rank: number
      weight: number
    }
  >()
  for (const path of paths) {
    const layer = JSON.parse(readFileSync(path, 'utf8')) as Record<string, Card>
    for (const [id, card] of Object.entries(layer)) {
      const into = cards.get(id) ?? {
        tags: new Set<string>(),
        names: [],
        japanese: [],
        generated: [],
        rank: 0,
        weight: 0,
      }
      into.generated.push(...(card.generated ?? []))
      into.japanese.push(...(card.names?.ja ?? []))
      into.tag ??= card.tag
      for (const tag of card.danbooru ?? []) into.tags.add(tag)
      for (const lang of LANGS) into.names.push(...(card.names?.[lang] ?? []))
      if (card.rank !== undefined) {
        const weight = card.weight ?? 1
        into.rank = (into.rank * into.weight + card.rank * weight) / (into.weight + weight)
        into.weight += weight
      }
      cards.set(id, into)
    }
  }
  const known: Known[] = []
  const owned = new Map<string, number[]>()
  const own = (key: string, code: number) => {
    const list = owned.get(key)
    if (!list) owned.set(key, [code])
    else if ((list.at(-1) ?? -1) >> 1 !== code >> 1) list.push(code)
    else if (code & 1) list[list.length - 1] = code
  }
  for (const card of cards.values()) {
    if (card.tags.size === 0) continue
    const tags = [...card.tags]
    const tag = card.tag && card.tags.has(card.tag) ? card.tag : (tags[0] as string)
    const at =
      known.push({
        tag,
        tags,
        names: [...new Set(card.names)],
        japanese: [...new Set(card.japanese)],
        generated: [...new Set(card.generated)],
        rank: card.rank,
      }) - 1
    for (const name of [
      ...(known[at]?.names ?? []),
      ...(known[at]?.generated ?? []),
      ...tags.map((each) => each.replaceAll('_', ' ')),
    ]) {
      const whole = searchKey(name)
      if (whole && long(whole)) own(whole, at * 2 + 1)
      const words = name.split(/[\s・·_]+/)
      if (words.length < 2) continue
      for (const word of words) {
        const key = searchKey(word)
        if (key && long(key)) own(key, at * 2)
      }
    }
  }
  const keys = [...owned.keys()].sort()
  return { known, keys, owners: keys.map((key) => owned.get(key) ?? []) }
}

function load(home: string): Index | undefined {
  try {
    return loadIndex(home)
  } catch {
    return undefined
  }
}

function loadIndex(home: string): Index | undefined {
  const paths = files(home)
  if (paths.length === 0) return undefined
  const stamp = stampOf(paths)
  const held = loaded.get(stamp)
  if (held) return held
  const cache = join(namesDir(home), 'index.json')
  let stored: Stored | undefined
  try {
    const read = JSON.parse(readFileSync(cache, 'utf8')) as Stored
    if (read.stamp === stamp) stored = read
  } catch {}
  let index: Index
  if (stored) {
    const known = stored.known.map(([tag, tags, names, japanese, generated, rank]) => ({
      tag,
      tags,
      names,
      japanese,
      generated,
      rank,
    }))
    index = { known, keys: stored.keys, owners: stored.owners, byTag: new Map() }
  } else {
    const built = build(paths)
    index = { ...built, byTag: new Map() }
    const out: Stored = {
      stamp,
      known: built.known.map((each) => [each.tag, each.tags, each.names, each.japanese, each.generated, each.rank]),
      keys: built.keys,
      owners: built.owners,
    }
    try {
      writeAtomic(cache, JSON.stringify(out))
    } catch {}
  }
  for (const known of index.known) for (const tag of known.tags) index.byTag.set(tag, known)
  loaded.clear()
  loaded.set(stamp, index)
  return index
}

const SHARES = { ko: 4, en: 4, ja: 5, zh: 3 }

function aliasesOf(known: Known | undefined): string[] {
  if (!known) return []
  const hangul = /\p{Script=Hangul}/u
  const latin = /^[\p{Script=Latin}\p{N}\s.'’-]+$/u
  const sourced = known.names.filter((name) => hangul.test(name))
  const ko = [...sourced, ...known.generated.slice(0, sourced.length > 0 ? 0 : 2)]
  const en = known.names.filter((name) => latin.test(name))
  const ja = known.japanese
  const zh = known.names.filter((name) => !hangul.test(name) && !latin.test(name) && !ja.includes(name))
  return [
    ...new Set([
      ...ko.slice(0, SHARES.ko),
      ...en.slice(0, SHARES.en),
      ...ja.slice(0, SHARES.ja),
      ...zh.slice(0, SHARES.zh),
    ]),
  ]
}

let remembered: Record<string, string[]> | undefined

export function aliasesFor(tag: string | undefined, home = homedir()): string[] {
  if (!tag) return []
  if (!remembered) {
    try {
      remembered = (
        JSON.parse(readFileSync(join(namesDir(home), 'aliases.json'), 'utf8')) as { tags: Record<string, string[]> }
      ).tags
    } catch {
      remembered = {}
    }
  }
  return remembered[tag] ?? []
}

export function paletteAliases(tags: readonly string[], home = homedir()): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const paths = files(home)
  if (paths.length === 0 || tags.length === 0) return out
  const stamp = stampOf(paths)
  const cache = join(namesDir(home), 'aliases.json')
  let kept: { stamp: string; tags: Record<string, string[]> } | undefined
  try {
    kept = JSON.parse(readFileSync(cache, 'utf8'))
  } catch {}
  if (kept?.stamp === stamp && tags.every((tag) => tag in kept.tags)) {
    remembered = kept.tags
    for (const tag of tags) out.set(tag, kept.tags[tag] ?? [])
    return out
  }
  const index = load(home)
  if (!index) return out
  const all = new Set([...tags, ...(kept?.stamp === stamp ? Object.keys(kept.tags) : [])])
  const fresh: Record<string, string[]> = {}
  for (const tag of all) fresh[tag] = aliasesOf(index.byTag.get(tag))
  try {
    writeAtomic(cache, `${JSON.stringify({ stamp, tags: fresh })}\n`)
  } catch {}
  remembered = fresh
  for (const tag of tags) out.set(tag, fresh[tag] ?? [])
  return out
}

export interface NameHit {
  tag: string
  name: string
}

function lowest(keys: string[], key: string): number {
  let low = 0
  let high = keys.length
  while (low < high) {
    const mid = (low + high) >> 1
    if ((keys[mid] as string) < key) low = mid + 1
    else high = mid
  }
  return low
}

export function nameHits(query: string, limit: number, home = homedir()): NameHit[] {
  const key = searchKey(query)
  if (!key || !long(key)) return []
  const index = load(home)
  if (!index) return []
  const scored = new Map<Known, { level: number; name: string }>()
  for (let at = lowest(index.keys, key); at < index.keys.length && (index.keys[at] as string).startsWith(key); at++) {
    const exact = index.keys[at] === key
    for (const code of index.owners[at] ?? []) {
      const known = index.known[code >> 1]
      if (!known) continue
      const level = exact ? 1 + (code & 1) : 0
      if ((scored.get(known)?.level ?? -1) >= level) continue
      const name =
        [...known.names, ...known.generated].find((each) => searchKey(each).includes(index.keys[at] as string)) ??
        known.tag.replaceAll('_', ' ')
      scored.set(known, { level, name })
    }
    if (scored.size > 400) break
  }
  return [...scored]
    .sort(([a, x], [b, y]) => y.level - x.level || b.rank - a.rank)
    .slice(0, limit)
    .map(([known, { name }]) => ({ tag: known.tag, name }))
}

export function primeNames(): void {
  load(homedir())
}

export function namesOf(tag: string, home = homedir()): Known | undefined {
  return load(home)?.byTag.get(tag)
}
