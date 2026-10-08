import { basename, dirname, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { SITES, type Site } from '../../../../src/booru.ts'

const GAP = 350
const ZEROCHAN_GAP = 1100
const TIMEOUT = 30_000
const TRIES = 3
const CHUNK = 100
const PAGES = 2
const ORDERS = ['', 'order:score', 'order:id']
const TOP = 6
const SHARE = 0.3
const OWN = 0.5
const SHARED = 2

const args = Bun.argv.slice(2)
const file = args[0]
const flag = args.indexOf('--site')
const only = flag === -1 ? undefined : args.slice(flag + 1)
if (!file?.endsWith('.toml') || only?.length === 0) {
  console.error('usage: bun names.ts themes/palettes/<catalog>/<name>.toml [--site <key> ...]')
  process.exit(1)
}
const doc = Bun.TOML.parse(await Bun.file(file).text()) as { meta?: { booru?: string } }
const catalog = basename(dirname(resolve(file)))
const booru = doc.meta?.booru
if (!booru) {
  console.error(`${basename(file, '.toml')}: no meta.booru`)
  process.exit(1)
}
const danbooru = SITES.find((site) => site.key === 'danbooru') as Site
const zerochan = SITES.find((site) => site.key === 'zerochan') as Site
const wanted = (site: Site) => !only || only.includes(site.key)
const moebooru = SITES.filter((site) => site !== danbooru && site !== zerochan && wanted(site))

async function json(url: string): Promise<unknown> {
  for (let tries = 1; ; tries++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'ttheme-palette-skill' },
        signal: AbortSignal.timeout(TIMEOUT),
      })
      if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}`)
      return await response.json()
    } catch (error) {
      if (tries === TRIES) throw error
      await sleep(GAP * tries)
    }
  }
}

async function aliases(field: 'antecedent_name' | 'consequent_name', names: string[]) {
  const params = new URLSearchParams({
    [`search[${field}_comma]`]: names.join(','),
    'search[status]': 'active',
    only: 'antecedent_name,consequent_name',
    limit: '100',
  })
  return (await json(`${danbooru.origin}/tag_aliases.json?${params}`)) as {
    antecedent_name: string
    consequent_name: string
  }[]
}

function tokens(name: string): string[] {
  return name
    .replace(/_\(.*\)$/, '')
    .split(/[_-]/)
    .filter((part) => part.length >= 3)
}

const canon = (await aliases('antecedent_name', [booru]))[0]?.consequent_name ?? booru
const self = new Set([booru, canon, ...(await aliases('consequent_name', [canon])).map((a) => a.antecedent_name)])
const own = new Set([...self].flatMap(tokens))
const picked = new Map<string, string | string[]>()

if (moebooru.length > 0) {
  const md5s = new Set<string>()
  for (const order of ORDERS) {
    for (let page = 1; page <= PAGES; page++) {
      const params = new URLSearchParams({
        tags: `${booru} ${order}`.trim(),
        limit: String(CHUNK),
        page: String(page),
        only: 'md5',
      })
      const posts = (await json(`${danbooru.origin}/posts.json?${params}`)) as { md5?: string }[]
      for (const post of posts) if (post.md5) md5s.add(post.md5)
      await sleep(GAP)
    }
  }
  console.log(
    `${basename(file, '.toml')}: ${booru}${canon === booru ? '' : ` (danbooru ${canon})`}, ${md5s.size} files`,
  )

  for (const site of moebooru) {
    const counts = new Map<string, number>()
    const list = [...md5s]
    let matched = 0
    for (let at = 0; at < list.length; at += CHUNK) {
      const url = site.postsUrl(`md5:${list.slice(at, at + CHUNK).join(',')}`, 0)
      const answer = (await json(url)) as { posts: { tags: string }[]; tags: Record<string, string> }
      for (const post of answer.posts) {
        matched++
        for (const tag of post.tags.split(' ')) {
          if (answer.tags[tag] === 'character') counts.set(tag, (counts.get(tag) ?? 0) + 1)
        }
      }
      await sleep(GAP)
    }
    const ranked = [...counts].sort((a, b) => b[1] - a[1]).slice(0, TOP)
    const names = ranked.map(([name]) => name)
    const known =
      names.length === 0
        ? []
        : ((await json(
            `${danbooru.origin}/tags.json?${new URLSearchParams({ 'search[name_comma]': names.join(','), only: 'name,post_count' })}`,
          )) as { name: string; post_count: number }[])
    const moved = new Map(
      (names.length === 0 ? [] : await aliases('antecedent_name', names)).map((a) => [
        a.antecedent_name,
        a.consequent_name,
      ]),
    )
    let pick: string | undefined
    let why = `no pick among ${matched} shared files`
    for (const [name, count] of ranked) {
      const to = moved.get(name)
      if (self.has(name) || (to && self.has(to))) {
        pick = name
        why = `danbooru names it ${to ?? name} (${count}/${matched})`
        break
      }
      if (to || (known.find((tag) => tag.name === name)?.post_count ?? 0) > 0) continue
      if (count / matched >= SHARE && tokens(name).some((part) => own.has(part))) {
        pick = name
        why = `unknown to danbooru, same name, ${count}/${matched}`
        break
      }
    }
    if (pick) picked.set(site.key, pick)
    console.log(`  ${site.name.padEnd(9)} ${pick ?? '-'}  (${why})`)
    console.log(`            ${ranked.map(([name, count]) => `${name} ${count}`).join(', ') || 'no character tags'}`)
  }
} else {
  console.log(`${basename(file, '.toml')}: ${booru}${canon === booru ? '' : ` (danbooru ${canon})`}`)
}

interface Tried {
  name: string
  total: number
  matched: number
  mine: number
}

async function zerochanAt(path: string): Promise<{ status: number; to?: string; text: string }> {
  await sleep(ZEROCHAN_GAP)
  const response = await fetch(`${zerochan.origin}/${path}`, {
    headers: { 'User-Agent': 'ttheme-palette-skill' },
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT),
  })
  return { status: response.status, to: response.headers.get('location') ?? undefined, text: await response.text() }
}

function spelled(name: string): string {
  return name.split('_').map(encodeURIComponent).join('+')
}

function tagOf(to: string): string {
  return decodeURIComponent(new URL(to, zerochan.origin).pathname.slice(1).replace(/\+/g, ' '))
    .toLowerCase()
    .replace(/\s+/g, '_')
}

async function mineOf(md5s: string[]): Promise<{ matched: number; mine: number }> {
  let matched = 0
  let mine = 0
  for (let at = 0; at < md5s.length; at += CHUNK) {
    const params = new URLSearchParams({
      tags: `md5:${md5s.slice(at, at + CHUNK).join(',')}`,
      limit: String(2 * CHUNK),
      only: 'md5,tag_string',
    })
    for (const post of (await json(`${danbooru.origin}/posts.json?${params}`)) as { tag_string: string }[]) {
      matched++
      if (post.tag_string.split(' ').some((tag) => self.has(tag))) mine++
    }
    await sleep(GAP)
  }
  return { matched, mine }
}

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 3),
  )
}

async function ofSeries(name: string): Promise<boolean> {
  const got = await zerochanAt(`${spelled(name)}?xml=&l=1`)
  const series = words(/ is a character from (.+?)\.\s/.exec(got.text)?.[1] ?? '')
  const ours = words(catalog)
  return [...series].some((word) => ours.has(word))
}

if (wanted(zerochan)) {
  const tried = new Map<string, Tried>()
  const renamed = new Map<string, string>()
  const queue = [booru, ...self]
  const prefixes = [...self].flatMap((name) => {
    const [, base = name, qualifier] = /^(.*?)(?:_\(([a-z0-9]+).*\))?$/.exec(name) ?? []
    const spaced = base.replace(/_/g, ' ')
    return [spaced, spaced.split(' ')[0] as string, ...(qualifier ? [`${spaced} (${qualifier}`] : [])]
  })
  for (const prefix of new Set(prefixes)) {
    const found = await zerochanAt(`suggest?${new URLSearchParams({ q: prefix, json: '' })}`)
    const suggestions =
      found.status === 200
        ? (JSON.parse(found.text) as { suggestions?: { value: string; type: string }[] }).suggestions
        : []
    for (const suggestion of (suggestions ?? []).filter((s) => s.type === 'Character').slice(0, TOP)) {
      queue.push(suggestion.value.toLowerCase().replace(/\s+/g, '_'))
    }
  }
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    if (tried.has(next)) continue
    const got = await zerochanAt(`${spelled(next)}?json=&l=${CHUNK}`)
    if (got.to) {
      tried.set(next, { name: next, total: -1, matched: 0, mine: 0 })
      renamed.set(next, tagOf(got.to))
      queue.unshift(tagOf(got.to))
      continue
    }
    const items = got.status === 200 ? ((JSON.parse(got.text) as { items?: { md5: string }[] }).items ?? []) : []
    tried.set(next, { name: next, total: items.length, ...(await mineOf(items.map((item) => item.md5))) })
  }
  const measured = [...tried.values()].filter((t) => t.total > 0)
  const owned = (t: Tried) => t.matched >= SHARED && t.mine / t.matched >= OWN
  const few = (t: Tried) => t.total > 0 && t.matched < SHARED
  const share = (t: Tried) => `${t.mine}/${t.matched} of its files danbooru tags ${booru}`
  let pick: Tried | undefined
  let why = 'nothing on zerochan carries this character — find asks it nothing'
  const best = measured.filter(owned).sort((a, b) => b.mine / b.matched - a.mine / a.matched || b.mine - a.mine)[0]
  for (const first of [tried.get(booru), tried.get(renamed.get(booru) ?? '')]) {
    if (first && (owned(first) || (few(first) && !(best && best.total > first.total)))) {
      pick = first
      why = owned(first)
        ? share(first)
        : (await ofSeries(first.name))
          ? `only ${first.matched} of its ${first.total} files are on danbooru, and zerochan names the same series`
          : `only ${first.matched} of its ${first.total} files are on danbooru — look by hand`
      break
    }
  }
  if (!pick && best) {
    pick = best
    why = share(best)
  }
  for (const candidate of pick ? [] : measured.filter(few)) {
    if (await ofSeries(candidate.name)) {
      pick = candidate
      why = `only ${candidate.matched} of its ${candidate.total} files are on danbooru, and zerochan names the same series`
      break
    }
  }
  picked.set('zerochan', pick ? pick.name : [])
  console.log(`  ${'zerochan'.padEnd(9)} ${pick?.name ?? '[]'}  (${why})`)
  console.log(
    `            ${[...tried.values()].map((t) => (t.total < 0 ? `${t.name} → renamed` : `${t.name} ${t.mine}/${t.matched} of ${t.total}`)).join(', ')}`,
  )
}

const differs = [...picked].filter(([, name]) => name !== booru)
if (differs.length > 0) {
  console.log('\n[meta.booru_sites]')
  for (const [key, name] of differs) console.log(`${key} = ${Array.isArray(name) ? '[]' : `"${name}"`}`)
}
console.log('\ncheck every name with tags.ts before writing it; a site with no pick needs a look by hand')
