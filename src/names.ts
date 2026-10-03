import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { writeAtomic } from './edits.ts'

const LAYERS = ['core', 'kowiki', 'unlicensed'] as const

const LANGS = ['ko', 'ja', 'en', 'zh', 'other'] as const

interface Card {
  tag?: string
  danbooru?: string[]
  names?: Partial<Record<(typeof LANGS)[number], string[]>>
  generated?: string[]
  rank?: number
  weight?: number
  posts?: number
}

export interface Known {
  tag: string
  tags: string[]
  names: string[]
  japanese: string[]
  generated: string[]
  rank: number
}

type Stored = [string, string[], string[], string[], string[]]

interface Index {
  keys: Buffer
  keyAt: Uint32Array
  ownAt: Uint32Array
  owners: Uint32Array
  cards: Buffer
  cardAt: Uint32Array
  ranks: Float32Array
  tags: Buffer
  tagAt: Uint32Array
  tagCard: Uint32Array
}

const SECTIONS = ['keys', 'keyAt', 'ownAt', 'owners', 'cards', 'cardAt', 'ranks', 'tags', 'tagAt', 'tagCard'] as const

const MAGIC = 'TTNI'

export function namesDir(home = homedir()): string {
  return join(process.env.XDG_CACHE_HOME ?? join(home, '.cache'), 'ttheme', 'aninames')
}

const KATAKANA = /[ァ-ヶ]/g

const SPACE = /[\s\p{P}\p{S}]+/gu

export function searchKey(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(KATAKANA, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(SPACE, '')
}

export function containsText(fields: readonly string[], query: string): boolean {
  const key = searchKey(query)
  if (key === '') {
    const raw = query.toLowerCase()
    return fields.some((field) => field.toLowerCase().includes(raw))
  }
  return fields.some((field) => searchKey(field).includes(key))
}

function long(key: string): boolean {
  return key.length >= 2 || /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}]/u.test(key)
}

function files(home: string): string[] {
  const dir = namesDir(home)
  return LAYERS.map((layer) => join(dir, `ttheme-${layer}.json`)).filter((path) => existsSync(path))
}

const FORMAT = 6

function stampOf(paths: string[]): string {
  return [`format ${FORMAT}`, ...paths.map((path) => `${path}:${statSync(path).size}:${statSync(path).mtimeMs}`)].join(
    '|',
  )
}

function readLayer(path: string): Record<string, Card> {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, Card>
  } catch {
    return {}
  }
}

function merged(paths: string[]): Known[] {
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
      posts: number
    }
  >()
  for (const path of paths) {
    for (const [id, card] of Object.entries(readLayer(path))) {
      const into = cards.get(id) ?? {
        tags: new Set<string>(),
        names: [],
        japanese: [],
        generated: [],
        rank: 0,
        weight: 0,
        posts: 0,
      }
      into.posts = Math.max(into.posts, card.posts ?? 0)
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
  const top = Math.log1p([...cards.values()].reduce((most, card) => Math.max(most, card.posts), 1))
  for (const card of cards.values()) {
    if (card.tags.size === 0) continue
    const tags = [...card.tags]
    known.push({
      tag: card.tag && card.tags.has(card.tag) ? card.tag : (tags[0] as string),
      tags,
      names: [...new Set(card.names)],
      japanese: [...new Set(card.japanese)],
      generated: [...new Set(card.generated)],
      rank: card.posts > 0 ? Math.log1p(card.posts) / top : card.rank,
    })
  }
  return known
}

function packed<T extends { set(values: ArrayLike<number>): void }>(
  make: new (length: number) => T,
  values: number[],
): T {
  const out = new make(values.length)
  out.set(values)
  return out
}

function joined(texts: Buffer[]): { bytes: Buffer; at: Uint32Array } {
  const at: number[] = [0]
  for (const text of texts) at.push((at.at(-1) as number) + text.length)
  return { bytes: Buffer.concat(texts), at: packed(Uint32Array, at) }
}

function build(paths: string[], stamp: string): Buffer {
  const known = merged(paths)
  const owned = new Map<string, number[]>()
  const own = (key: string, card: number, flags: number) => {
    const list = owned.get(key)
    const code = card * 4 + flags
    if (!list) owned.set(key, [code])
    else if ((list.at(-1) as number) >>> 2 !== card) list.push(code)
    else if ((list.at(-1) as number) < code) list[list.length - 1] = code
  }
  known.forEach((each, card) => {
    const sourced = [...each.names, ...each.tags.map((tag) => tag.replaceAll('_', ' '))]
    for (const [names, flag] of [
      [sourced, 1],
      [each.generated, 0],
    ] as const) {
      for (const name of names) {
        const whole = searchKey(name)
        if (whole && long(whole)) own(whole, card, 2 | flag)
        const words = name.split(/[\s・·_]+/)
        if (words.length < 2) continue
        for (const word of words) {
          const key = searchKey(word)
          if (key && long(key)) own(key, card, flag)
        }
      }
    }
  })
  const keys = [...owned.keys()].sort()
  const ownAt: number[] = [0]
  const owners: number[] = []
  for (const key of keys) {
    for (const code of owned.get(key) ?? []) owners.push(code)
    ownAt.push(owners.length)
  }
  const tagged = known
    .flatMap((each, card) => each.tags.map((tag) => [tag, card] as const))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const keyText = joined(keys.map((key) => Buffer.from(key)))
  const cardText = joined(
    known.map((each) =>
      Buffer.from(JSON.stringify([each.tag, each.tags, each.names, each.japanese, each.generated] satisfies Stored)),
    ),
  )
  const tagText = joined(tagged.map(([tag]) => Buffer.from(tag)))
  const sections: Record<(typeof SECTIONS)[number], ArrayBufferView> = {
    keys: keyText.bytes,
    keyAt: keyText.at,
    ownAt: packed(Uint32Array, ownAt),
    owners: packed(Uint32Array, owners),
    cards: cardText.bytes,
    cardAt: cardText.at,
    ranks: packed(
      Float32Array,
      known.map((each) => each.rank),
    ),
    tags: tagText.bytes,
    tagAt: tagText.at,
    tagCard: packed(
      Uint32Array,
      tagged.map(([, card]) => card),
    ),
  }
  const bodies = SECTIONS.map((name) => {
    const view = sections[name]
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength)
  })
  let size = 0
  const placed = bodies.map((body) => {
    const at: [number, number] = [size, body.length]
    size += Math.ceil(body.length / 4) * 4
    return at
  })
  const header = Buffer.from(JSON.stringify({ stamp, sections: placed }))
  const start = Math.ceil((8 + header.length) / 4) * 4
  const out = Buffer.alloc(start + size)
  out.write(MAGIC, 0, 'latin1')
  out.writeUInt32LE(header.length, 4)
  header.copy(out, 8)
  for (const [i, body] of bodies.entries()) body.copy(out, start + (placed[i]?.[0] ?? 0))
  return out
}

function view<T>(
  make: new (buffer: ArrayBuffer, offset: number, length: number) => T,
  file: Buffer,
  at: number,
  length: number,
): T {
  const from = file.byteOffset + at
  if (from % 4 === 0) return new make(file.buffer as ArrayBuffer, from, length / 4)
  return new make(file.buffer.slice(from, from + length) as ArrayBuffer, 0, length / 4)
}

function opened(file: Buffer, stamp: string): Index | undefined {
  if (file.toString('latin1', 0, 4) !== MAGIC) return undefined
  const size = file.readUInt32LE(4)
  const head = JSON.parse(file.toString('utf8', 8, 8 + size)) as { stamp: string; sections: [number, number][] }
  if (head.stamp !== stamp) return undefined
  const start = Math.ceil((8 + size) / 4) * 4
  const part = (name: (typeof SECTIONS)[number]): [number, number] => {
    const [at, length] = head.sections[SECTIONS.indexOf(name)] as [number, number]
    return [start + at, length]
  }
  const bytes = (name: (typeof SECTIONS)[number]) => {
    const [at, length] = part(name)
    return file.subarray(at, at + length)
  }
  const ints = (name: (typeof SECTIONS)[number]) => view(Uint32Array, file, ...part(name))
  return {
    keys: bytes('keys'),
    keyAt: ints('keyAt'),
    ownAt: ints('ownAt'),
    owners: ints('owners'),
    cards: bytes('cards'),
    cardAt: ints('cardAt'),
    ranks: view(Float32Array, file, ...part('ranks')),
    tags: bytes('tags'),
    tagAt: ints('tagAt'),
    tagCard: ints('tagCard'),
  }
}

let loaded: { stamp: string; index: Index } | undefined

function load(home: string): Index | undefined {
  try {
    const paths = files(home)
    if (paths.length === 0) return undefined
    const stamp = stampOf(paths)
    if (loaded?.stamp === stamp) return loaded.index
    const cache = join(namesDir(home), 'index.bin')
    let index: Index | undefined
    try {
      index = opened(readFileSync(cache), stamp)
    } catch {}
    if (!index) {
      const file = build(paths, stamp)
      try {
        writeAtomic(cache, file)
      } catch {}
      index = opened(file, stamp)
    }
    if (index) loaded = { stamp, index }
    return index
  } catch {
    return undefined
  }
}

function cardOf(index: Index, card: number): Known {
  const [tag, tags, names, japanese, generated] = JSON.parse(
    index.cards.toString('utf8', index.cardAt[card], index.cardAt[card + 1]),
  ) as Stored
  return { tag, tags, names, japanese, generated, rank: index.ranks[card] ?? 0 }
}

function lowest(bytes: Buffer, at: Uint32Array, count: number, text: string): number {
  let low = 0
  let high = count
  while (low < high) {
    const mid = (low + high) >> 1
    if (bytes.toString('utf8', at[mid], at[mid + 1]) < text) low = mid + 1
    else high = mid
  }
  return low
}

function cardFor(index: Index, tag: string): number | undefined {
  const key = Buffer.from(tag)
  const count = index.tagCard.length
  const at = lowest(index.tags, index.tagAt, count, tag)
  if (at >= count || index.tags.compare(key, 0, key.length, index.tagAt[at], index.tagAt[at + 1]) !== 0)
    return undefined
  return index.tagCard[at]
}

const QUALIFIED = /\s*[(（][^()（）]*[)）]$/u

const SHARES = { ko: 4, en: 4, ja: 5, zh: 3 }

function aliasesOf(known: Known | undefined): string[] {
  if (!known) return []
  const hangul = /\p{Script=Hangul}/u
  const latin = /^[\p{Script=Latin}\p{N}\s.'’-]+$/u
  const plain = new Set([...known.names, ...known.generated].filter((name) => !QUALIFIED.test(name)))
  const shown = (name: string) => !QUALIFIED.test(name) || !plain.has(name.replace(QUALIFIED, ''))
  const names = known.names.filter(shown)
  const sourced = names.filter((name) => hangul.test(name))
  const ko = [...sourced, ...known.generated.slice(0, sourced.length > 0 ? 0 : 2)]
  const en = names.filter((name) => latin.test(name))
  const ja = known.japanese.filter(shown)
  const zh = names.filter((name) => !hangul.test(name) && !latin.test(name) && !ja.includes(name))
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
  try {
    return aliasMap(tags, home)
  } catch {
    return new Map()
  }
}

function aliasMap(tags: readonly string[], home: string): Map<string, string[]> {
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
  for (const tag of all) {
    const card = cardFor(index, tag)
    fresh[tag] = card === undefined ? [] : aliasesOf(cardOf(index, card))
  }
  try {
    writeAtomic(cache, `${JSON.stringify({ stamp, tags: fresh })}\n`)
  } catch {}
  remembered = fresh
  for (const tag of tags) out.set(tag, fresh[tag] ?? [])
  return out
}

export function knowAliases(entries: readonly { booru?: string }[], home = homedir()): void {
  paletteAliases(
    entries.flatMap((entry) => (entry.booru ? [entry.booru] : [])),
    home,
  )
}

export interface NameHit {
  tag: string
  name: string
}

const LEVEL = 0.25

const PREFERRED = 0.1

export function nameHits(
  query: string,
  limit: number,
  prefer: ReadonlySet<string> = new Set(),
  home = homedir(),
): NameHit[] {
  const text = searchKey(query)
  if (!text || !long(text)) return []
  const index = load(home)
  if (!index) return []
  const key = Buffer.from(text)
  const count = index.ownAt.length - 1
  const preferred = new Set([...prefer].flatMap((tag) => cardFor(index, tag) ?? []))
  const best = new Map<number, { score: number; key: number }>()
  for (let at = lowest(index.keys, index.keyAt, count, text); at < count; at++) {
    const start = index.keyAt[at] as number
    const size = (index.keyAt[at + 1] as number) - start
    if (size < key.length || index.keys.compare(key, 0, key.length, start, start + key.length) !== 0) break
    const exact = size === key.length
    for (let o = index.ownAt[at] as number; o < (index.ownAt[at + 1] as number); o++) {
      const code = index.owners[o] as number
      const card = code >>> 2
      const level = exact ? Math.max(0, (code & 2 ? 2 : 1) - (code & 1 ? 0 : 1)) : 0
      const score = (index.ranks[card] ?? 0) + LEVEL * level + (preferred.has(card) ? PREFERRED : 0)
      if ((best.get(card)?.score ?? -1) < score) best.set(card, { score, key: at })
    }
  }
  return [...best]
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, limit)
    .map(([card, { key: at }]) => {
      const known = cardOf(index, card)
      const matched = index.keys.toString('utf8', index.keyAt[at], index.keyAt[at + 1])
      return {
        tag: known.tags.find((tag) => prefer.has(tag)) ?? known.tag,
        name:
          [...known.names, ...known.generated].find((each) => searchKey(each).includes(matched)) ??
          known.tag.replaceAll('_', ' '),
      }
    })
}

export function primeNames(home = homedir()): void {
  load(home)
}

export function namesOf(tag: string, home = homedir()): Known | undefined {
  const index = load(home)
  if (!index) return undefined
  const card = cardFor(index, tag)
  return card === undefined ? undefined : cardOf(index, card)
}
