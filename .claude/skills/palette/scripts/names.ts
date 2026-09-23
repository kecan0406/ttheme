import { basename } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { SITES, type Site } from '../../../../src/booru.ts'

const GAP = 350
const TIMEOUT = 30_000
const TRIES = 3
const CHUNK = 100
const PAGES = 2
const ORDERS = ['', 'order:score', 'order:id']
const TOP = 6
const SHARE = 0.3

const file = Bun.argv[2]
if (!file?.endsWith('.toml')) {
  console.error('usage: bun names.ts themes/<name>.toml')
  process.exit(1)
}
const doc = Bun.TOML.parse(await Bun.file(file).text()) as { meta?: { booru?: string } }
const booru = doc.meta?.booru
if (!booru) {
  console.error(`${basename(file, '.toml')}: no meta.booru`)
  process.exit(1)
}
const danbooru = SITES.find((site) => site.key === 'danbooru') as Site
const moebooru = SITES.filter((site) => site !== danbooru)

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
console.log(`${basename(file, '.toml')}: ${booru}${canon === booru ? '' : ` (danbooru ${canon})`}, ${md5s.size} files`)

const picked = new Map<string, string>()
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

const differs = [...picked].filter(([, name]) => name !== booru)
if (differs.length > 0) {
  console.log('\n[meta.booru_sites]')
  for (const [key, name] of differs) console.log(`${key} = "${name}"`)
}
console.log('\ncheck every name with tags.ts before writing it; a site with no pick needs a look by hand')
