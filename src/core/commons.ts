import { SITES } from './booru.ts'
import { memo } from './memo.ts'
import { escaped, quoted } from './text.ts'
import {
  BUILTIN,
  characterIdOf,
  echo,
  fail,
  oddKeys,
  publisherOf,
  slugOf,
  slugProblem,
  str,
  subjectProblem,
  table,
  text,
  toml,
  WORK_SCHEMA_URL,
  workIdOf,
} from './theme.ts'

export interface Character {
  id: string
  native?: string[]
  danbooru?: string
  also?: string[]
  sites?: Record<string, string[]>
}

export interface Work {
  id: string
  name: string
  native?: string
  lead?: string
  characters: Character[]
}

export type Renames = Record<string, string>

export interface Commons {
  works: Work[]
  renames: Renames
}

export interface About {
  subject: string
  work: Work
  character?: Character
  known: boolean
}

export type Sort = 'abc' | 'cast'

export const WORKS_DIR = 'works'
export const RENAMES_FILE = 'renames.toml'
export const WORK_KEYS = ['$schema', 'name', 'native', 'lead', 'character']
export const CHARACTER_KEYS = ['id', 'native', 'danbooru', 'also', 'sites']

const TAG = /[\s\p{Cc}\p{Bidi_Control}]/u

function tagOf(file: string, field: string, value: unknown): string {
  const tag = str(file, field, value)

  if (TAG.test(tag)) {
    fail(file, `${field} must be a single booru tag, got ${quoted(tag)}`)
  }

  return tag
}

function slug(file: string, field: string, value: unknown): string {
  const id = str(file, field, value)
  const problem = slugProblem(id)

  if (problem) {
    fail(file, `${field} ${quoted(id)} ${problem}`)
  }

  return id
}

export function readSites(
  file: string,
  field: string,
  raw: unknown,
  foreign = false,
): Record<string, string[]> | undefined {
  if (raw === undefined) {
    return undefined
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail(file, `${field} must be a table of site = "tag" or site = ["tag", ...]`)
  }

  const sites: Record<string, string[]> = {}

  for (const [key, value] of Object.entries(raw)) {
    const site = SITES.find((s) => s.key === key)

    if (!site) {
      if (foreign) {
        continue
      }

      fail(file, `${field}.${escaped(key)} is not a find site — use ${SITES.map((s) => s.key).join(', ')}`)
    }

    const names = typeof value === 'string' ? [value] : Array.isArray(value) ? value : undefined

    if (!names || names.some((name) => typeof name !== 'string' || name === '' || TAG.test(name))) {
      fail(file, `${field}.${key} must be one tag or a list of tags, got ${echo(value)}`)
    }

    if (names.length > 1 && !site.ors) {
      fail(file, `${field}.${key} takes one tag — ${site.name} does not OR tags`)
    }

    if (names.length > site.tagBudget) {
      fail(file, `${field}.${key} takes ${site.tagBudget} tags at most — ${site.name} searches that many at a time`)
    }

    sites[key] = names as string[]
  }

  return sites
}

function readNative(file: string, field: string, raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    fail(file, `${field} must be a list of names, like ["後藤ひとり"]`)
  }

  return raw.map((name, i) => {
    const said = text(file, `${field}[${i}]`, name)

    if (said.includes('|')) {
      fail(file, `${field}[${i}] ${quoted(said)} contains |`)
    }

    return said
  })
}

function readCharacter(file: string, index: number, raw: unknown, foreign: boolean): Character {
  const c = table(raw)
  const at = `character[${index}]`
  const id = slug(file, `${at}.id`, c.id)
  const native = c.native === undefined ? undefined : readNative(file, `${at}.native`, c.native)
  const danbooru = c.danbooru === undefined ? undefined : tagOf(file, `${at}.danbooru`, c.danbooru)

  if (c.also !== undefined && !Array.isArray(c.also)) {
    fail(file, `${at}.also must be a list of works, like ["pop-n-music"]`)
  }

  const also = Array.isArray(c.also) ? c.also.map((work, i) => slug(file, `${at}.also[${i}]`, work)) : undefined

  if (c.sites !== undefined && danbooru === undefined) {
    fail(file, `${at}.sites renames ${at}.danbooru per site, so it needs ${at}.danbooru`)
  }

  const sites = readSites(file, `${at}.sites`, c.sites, foreign)

  return {
    id,
    ...(native ? { native } : {}),
    ...(danbooru ? { danbooru } : {}),
    ...(also && also.length > 0 ? { also } : {}),
    ...(sites ? { sites } : {}),
  }
}

function elsewhere(character: Character, home: string): Character {
  const { also, ...rest } = character
  const others = [...new Set(also)].filter((work) => work !== home)

  return others.length > 0 ? { ...rest, also: others } : rest
}

export function workIdProblem(id: string): string | undefined {
  return slugProblem(id) ?? (id === BUILTIN ? `cannot be ${BUILTIN}, the built-in marketplace's name` : undefined)
}

export function readWork(file: string, source: string, id: string, foreign = false): Work {
  const problem = workIdProblem(id)

  if (problem) {
    fail(file, `the work ${quoted(id)} ${problem}`)
  }

  const doc = toml(file, source)

  if (doc.character !== undefined && !Array.isArray(doc.character)) {
    fail(file, 'character must be [[character]] tables')
  }

  const characters = (Array.isArray(doc.character) ? doc.character : []).map((raw, i) =>
    elsewhere(readCharacter(file, i, raw, foreign), id),
  )

  const twice = characters.find((c, i) => characters.findIndex((d) => d.id === c.id) !== i)

  if (twice) {
    fail(file, `the character ${quoted(twice.id)} is listed twice`)
  }

  const lead = doc.lead === undefined ? undefined : str(file, 'lead', doc.lead)

  if (lead !== undefined) {
    const leadProblem = subjectProblem(lead)

    if (leadProblem) {
      fail(file, `lead ${quoted(lead)} ${leadProblem}`)
    }

    const character = characterIdOf(lead)

    if (workIdOf(lead) !== id || (character !== undefined && !characters.some((c) => c.id === character))) {
      fail(file, `lead ${quoted(lead)} names neither ${id} nor one of its characters`)
    }
  }

  return {
    id,
    name: text(file, 'name', doc.name),
    ...(doc.native === undefined ? {} : { native: text(file, 'native', doc.native) }),
    ...(lead === undefined ? {} : { lead }),
    characters,
  }
}

export function workKeys(file: string, source: string): string[] {
  const doc = toml(file, source)

  return [
    ...oddKeys('', doc, WORK_KEYS),
    ...(Array.isArray(doc.character) ? doc.character : []).flatMap((c, i) =>
      oddKeys(`character[${i}]`, c, CHARACTER_KEYS),
    ),
  ]
}

const q = (value: string) => JSON.stringify(value)

function sitesToml(sites: Record<string, string[]>): string {
  const value = (tags: string[]) => (tags.length === 1 ? q(tags[0] as string) : `[${tags.map(q).join(', ')}]`)

  return `{ ${Object.entries(sites)
    .map(([site, tags]) => `${site} = ${value(tags)}`)
    .join(', ')} }`
}

export function workToml(work: Work): string {
  const lines = [
    `"$schema" = ${q(WORK_SCHEMA_URL)}`,
    `name = ${q(work.name)}`,
    ...(work.native ? [`native = ${q(work.native)}`] : []),
    ...(work.lead ? [`lead = ${q(work.lead)}`] : []),
    ...work.characters.flatMap((c) => [
      '',
      '[[character]]',
      `id = ${q(c.id)}`,
      ...(c.native ? [`native = [${c.native.map(q).join(', ')}]`] : []),
      ...(c.danbooru ? [`danbooru = ${q(c.danbooru)}`] : []),
      ...(c.also ? [`also = [${c.also.map(q).join(', ')}]`] : []),
      ...(c.sites ? [`sites = ${sitesToml(c.sites)}`] : []),
    ]),
  ]

  return `${lines.join('\n')}\n`
}

export function readRenames(file: string, source: string): Renames {
  return Object.fromEntries(
    Object.entries(toml(file, source)).flatMap(([from, to]): [string, string][] => {
      if (from === '$schema') {
        return []
      }

      if (subjectProblem(from) || typeof to !== 'string' || subjectProblem(to)) {
        fail(file, `${escaped(from)} must map an old work or character to its new one, as "<work>/<character>"`)
      }

      return [[from, to]]
    }),
  )
}

export function parseCommons(source: string): Commons {
  return memo('commons', source, () => readCommonsJson(source))
}

function readCommonsJson(source: string): Commons {
  let doc: { works?: unknown; renames?: unknown } | null

  try {
    doc = JSON.parse(source)
  } catch {
    throw new Error('the commons is not valid JSON')
  }

  if (!Array.isArray(doc?.works) || !doc.renames || typeof doc.renames !== 'object') {
    throw new Error('the commons has no works or renames')
  }

  const works = doc.works.map((raw) => {
    const work = raw as Work
    const id = typeof work?.id === 'string' ? work.id : ''

    if (!Array.isArray(work?.characters)) {
      throw new Error(`the commons' work ${JSON.stringify(id)} has no characters`)
    }

    return readWork(`commons/${id}`, workToml(work), id)
  })

  const renames = Object.fromEntries(
    Object.entries(doc.renames).filter(
      (pair): pair is [string, string] =>
        typeof pair[1] === 'string' && !subjectProblem(pair[0]) && !subjectProblem(pair[1]),
    ),
  )

  return { works, renames }
}

export function commonsProblems(works: readonly Work[]): string[] {
  const ids = new Set(works.map((w) => w.id))
  const tags = new Map<string, string>()
  const problems: string[] = []

  for (const work of works) {
    for (const c of work.characters) {
      const subject = `${work.id}/${c.id}`

      for (const other of c.also ?? []) {
        if (other === work.id || !ids.has(other)) {
          problems.push(`${subject}: also names ${quoted(other)}, which is not another work`)
        }
      }

      const seen = c.danbooru === undefined ? undefined : tags.get(c.danbooru)

      if (c.danbooru !== undefined && seen !== undefined) {
        problems.push(`${subject}: danbooru ${quoted(c.danbooru)} is ${seen} already — one character, one subject`)
      } else if (c.danbooru !== undefined) {
        tags.set(c.danbooru, subject)
      }
    }
  }

  return problems
}

export function mergeWorks(commons: readonly Work[], proposals: readonly Work[]): Work[] {
  const byId = new Map(commons.map((w) => [w.id, w]))

  for (const proposed of proposals) {
    const have = byId.get(proposed.id)

    if (!have) {
      byId.set(proposed.id, proposed)
      continue
    }

    const known = new Set(have.characters.map((c) => c.id))
    const extra = proposed.characters.filter((c) => !known.has(c.id))

    if (extra.length > 0) {
      byId.set(proposed.id, { ...have, characters: [...have.characters, ...extra] })
    }
  }

  return [...byId.values()]
}

export function followSubject(renames: Readonly<Renames>, subject: string): string {
  let at = subject
  const seen = new Set<string>()

  while (!seen.has(at)) {
    seen.add(at)

    if (Object.hasOwn(renames, at)) {
      at = renames[at] as string
      continue
    }

    const work = workIdOf(at)
    const character = characterIdOf(at)

    if (character === undefined || !Object.hasOwn(renames, work)) {
      break
    }

    at = `${renames[work]}/${character}`
  }

  return at
}

const INDEXES = new WeakMap<readonly Work[], Map<string, Work>>()

function indexOf(works: readonly Work[]): Map<string, Work> {
  let index = INDEXES.get(works)

  if (!index) {
    index = new Map(works.map((w) => [w.id, w]))
    INDEXES.set(works, index)
  }

  return index
}

export function workOf(works: readonly Work[], id: string): Work | undefined {
  return indexOf(works).get(id)
}

export function aboutOf(works: readonly Work[], subject: string | undefined): About | undefined {
  if (subject === undefined) {
    return undefined
  }

  const id = workIdOf(subject)
  const cid = characterIdOf(subject)
  const work = workOf(works, id)

  if (!work) {
    return { subject, work: { id, name: id, characters: [] }, ...(cid ? { character: { id: cid } } : {}), known: false }
  }

  if (cid === undefined) {
    return { subject, work, known: true }
  }

  const character = work.characters.find((c) => c.id === cid)

  return character ? { subject, work, character, known: true } : { subject, work, character: { id: cid }, known: false }
}

export function worksFor(about: About): string[] {
  return [about.work.id, ...(about.character?.also ?? [])]
}

export function leadOf(work: Work): string {
  const first = work.characters[0]

  return work.lead ?? (first ? `${work.id}/${first.id}` : work.id)
}

export function siteTags(about: About | undefined, site: string): string[] {
  const character = about?.character

  if (!character) {
    return []
  }

  return character.sites?.[site] ?? (character.danbooru ? [character.danbooru] : [])
}

export function spoken(tag: string): string {
  return tag.replace(/_\([^)]*\)$/, '').replaceAll('_', ' ')
}

export function wordsOf(about: About | undefined): string[] {
  if (!about) {
    return []
  }

  const tag = about.character?.danbooru

  return [
    about.work.name,
    about.work.native ?? '',
    about.character?.id ?? '',
    ...(about.character?.native ?? []),
    tag ? spoken(tag) : '',
  ]
}

export function castIndex(about: About | undefined): number {
  if (!about) {
    return Number.POSITIVE_INFINITY
  }

  const at = about.character ? about.work.characters.findIndex((c) => c.id === about.character?.id) : -1

  return at < 0 ? about.work.characters.length : at
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function publisherRank(name: string): number {
  return publisherOf(name) === BUILTIN ? 0 : 1
}

export function worldOrder<T extends { name: string; subject?: string }>(
  items: readonly T[],
  works: readonly Work[],
  sort: Sort = 'abc',
): T[] {
  const keyed = items.map((item) => ({ item, about: aboutOf(works, item.subject) }))

  return keyed
    .toSorted((a, b) => {
      if (!a.about || !b.about) {
        return (
          Number(a.about === undefined) - Number(b.about === undefined) ||
          publisherRank(a.item.name) - publisherRank(b.item.name) ||
          cmp(publisherOf(a.item.name), publisherOf(b.item.name)) ||
          cmp(slugOf(a.item.name), slugOf(b.item.name))
        )
      }

      const within =
        sort === 'cast'
          ? castIndex(a.about) - castIndex(b.about)
          : cmp(a.about.character?.id ?? `~${slugOf(a.item.name)}`, b.about.character?.id ?? `~${slugOf(b.item.name)}`)

      return (
        cmp(a.about.work.name.toLowerCase(), b.about.work.name.toLowerCase()) ||
        cmp(a.about.work.id, b.about.work.id) ||
        within ||
        castIndex(a.about) - castIndex(b.about) ||
        publisherRank(a.item.name) - publisherRank(b.item.name) ||
        cmp(publisherOf(a.item.name), publisherOf(b.item.name)) ||
        cmp(slugOf(a.item.name), slugOf(b.item.name))
      )
    })
    .map(({ item }) => item)
}

export function shelfOf(item: { name: string; subject?: string }, works: readonly Work[]): string {
  const about = aboutOf(works, item.subject)

  return about ? `${publisherOf(item.name)} / ${about.work.name}` : publisherOf(item.name)
}
