import { SITES } from './booru.ts'
import { unqualified } from './names.ts'
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
  danbooru?: string
  lead?: string
  characters: Character[]
}

export interface Commons {
  works: Work[]
}

export interface About {
  subject: string
  work: Work
  character?: Character
  known: boolean
}

export type Sort = 'abc' | 'cast'

export const WORKS_DIR = 'works'
export const WORK_KEYS = ['$schema', 'name', 'native', 'danbooru', 'lead', 'character']
export const CHARACTER_KEYS = ['id', 'native', 'danbooru', 'also', 'sites']

const TAG = /[\s\p{Cc}\p{Bidi_Control}]/u

const TAG_MOST = 200

export function isTag(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && value.length <= TAG_MOST && !TAG.test(value)
}

function tagOf(file: string, field: string, value: unknown): string {
  const tag = str(file, field, value)

  if (tag.length > TAG_MOST) {
    fail(file, `${field} is longer than a booru tag can be, ${TAG_MOST} characters`)
  }

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

    if (!names?.every(isTag)) {
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
    fail(file, `${at}.also must be a list of work ids`)
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

  const ids = new Set<string>()

  for (const { id: character } of characters) {
    if (ids.has(character)) {
      fail(file, `the character ${quoted(character)} is listed twice`)
    }

    ids.add(character)
  }

  const danbooru = doc.danbooru === undefined ? undefined : tagOf(file, 'danbooru', doc.danbooru)
  const lead = doc.lead === undefined ? undefined : str(file, 'lead', doc.lead)

  if (lead !== undefined) {
    const leadProblem = subjectProblem(lead)

    if (leadProblem) {
      fail(file, `lead ${quoted(lead)} ${leadProblem}`)
    }

    const character = characterIdOf(lead)

    if (workIdOf(lead) !== id || (character !== undefined && !ids.has(character))) {
      fail(file, `lead ${quoted(lead)} names neither ${id} nor one of its characters`)
    }
  }

  return {
    id,
    name: text(file, 'name', doc.name),
    ...(doc.native === undefined ? {} : { native: text(file, 'native', doc.native) }),
    ...(danbooru ? { danbooru } : {}),
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
    ...(work.danbooru ? [`danbooru = ${q(work.danbooru)}`] : []),
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

export function parseCommons(source: string): Commons {
  let doc: { works?: unknown } | null

  try {
    doc = JSON.parse(source)
  } catch {
    throw new Error('the commons is not valid JSON')
  }

  if (!Array.isArray(doc?.works)) {
    throw new Error('the commons has no works')
  }

  const works = doc.works.map((raw) => {
    const work = raw as Work
    const id = typeof work?.id === 'string' ? work.id : ''

    if (!Array.isArray(work?.characters)) {
      throw new Error(`the commons' work ${JSON.stringify(id)} has no characters`)
    }

    let text: string

    try {
      text = workToml(work)
    } catch {
      throw new Error(`the commons' work ${JSON.stringify(id)} does not read`)
    }

    return readWork(`commons/${id}`, text, id, true)
  })

  return { works }
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

export function workOfListed(
  w: Pick<Work, 'id' | 'name' | 'native' | 'danbooru'> & { characters?: Pick<Character, 'id' | 'danbooru'>[] },
): Work {
  return {
    id: w.id,
    name: w.name,
    ...(w.native ? { native: w.native } : {}),
    ...(w.danbooru ? { danbooru: w.danbooru } : {}),
    characters: (w.characters ?? []).map((c) => ({ id: c.id, ...(c.danbooru ? { danbooru: c.danbooru } : {}) })),
  }
}

export interface Shelves {
  works: readonly Work[]
  byId: ReadonlyMap<string, Work>
  castAt: ReadonlyMap<Work, ReadonlyMap<string, number>>
}

export function shelvesOf(works: readonly Work[]): Shelves {
  const byId = new Map<string, Work>()
  const castAt = new Map<Work, Map<string, number>>()

  for (const work of works) {
    byId.set(work.id, work)

    if (castAt.has(work)) {
      continue
    }

    const at = new Map<string, number>()

    for (const [i, { id }] of work.characters.entries()) {
      if (!at.has(id)) {
        at.set(id, i)
      }
    }

    castAt.set(work, at)
  }

  return { works, byId, castAt }
}

export function workOf(works: readonly Work[], id: string): Work | undefined {
  return works.findLast((w) => w.id === id)
}

function aboutFrom(
  subject: string,
  work: Work | undefined,
  characterIn: (work: Work, id: string) => Character | undefined,
): About {
  const id = workIdOf(subject)
  const cid = characterIdOf(subject)

  if (!work) {
    return { subject, work: { id, name: id, characters: [] }, ...(cid ? { character: { id: cid } } : {}), known: false }
  }

  if (cid === undefined) {
    return { subject, work, known: true }
  }

  const character = characterIn(work, cid)

  return character ? { subject, work, character, known: true } : { subject, work, character: { id: cid }, known: false }
}

export function aboutOf(works: readonly Work[], subject: string | undefined): About | undefined {
  return subject === undefined
    ? undefined
    : aboutFrom(subject, workOf(works, workIdOf(subject)), (work, cid) => work.characters.find((c) => c.id === cid))
}

export function aboutIn(shelves: Shelves, subject: string | undefined): About | undefined {
  return subject === undefined
    ? undefined
    : aboutFrom(
        subject,
        shelves.byId.get(workIdOf(subject)),
        (work, cid) => work.characters[shelves.castAt.get(work)?.get(cid) ?? -1],
      )
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
  return unqualified(tag).replaceAll('_', ' ')
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

export function castIn(shelves: Shelves, about: About | undefined): number {
  if (!about) {
    return Number.POSITIVE_INFINITY
  }

  const id = about.character?.id

  return (id === undefined ? undefined : shelves.castAt.get(about.work)?.get(id)) ?? about.work.characters.length
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
  const shelves = shelvesOf(works)

  const keyed = items.map((item) => {
    const about = aboutIn(shelves, item.subject)

    return { item, about, cast: castIn(shelves, about) }
  })

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
          ? a.cast - b.cast
          : cmp(a.about.character?.id ?? `~${slugOf(a.item.name)}`, b.about.character?.id ?? `~${slugOf(b.item.name)}`)

      return (
        cmp(a.about.work.name.toLowerCase(), b.about.work.name.toLowerCase()) ||
        cmp(a.about.work.id, b.about.work.id) ||
        within ||
        a.cast - b.cast ||
        publisherRank(a.item.name) - publisherRank(b.item.name) ||
        cmp(publisherOf(a.item.name), publisherOf(b.item.name)) ||
        cmp(slugOf(a.item.name), slugOf(b.item.name))
      )
    })
    .map(({ item }) => item)
}

function shelfName(item: { name: string }, about: About | undefined): string {
  return about ? `${publisherOf(item.name)} / ${about.work.name}` : publisherOf(item.name)
}

export function shelfOf(item: { name: string; subject?: string }, works: readonly Work[]): string {
  return shelfName(item, aboutOf(works, item.subject))
}

export function shelfIn(item: { name: string; subject?: string }, shelves: Shelves): string {
  return shelfName(item, aboutIn(shelves, item.subject))
}
