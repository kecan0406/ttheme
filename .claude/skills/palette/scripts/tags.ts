import { basename } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fetchCount, SITES, type Site } from '../../../../src/booru.ts'

interface Row {
  from: string
  names: Map<string, string[]>
}

interface Kind {
  character: boolean
  deprecated: boolean
}

const GAP = 350
const TIMEOUT = 30_000
const TRIES = 3
const CHARACTER = 4

const args = Bun.argv.slice(2)
const split = args.indexOf('--try')
const files = split === -1 ? args : args.slice(0, split)
const tried = split === -1 ? [] : args.slice(split + 1)
if (files.length + tried.length === 0 || files.some((f) => !f.endsWith('.toml'))) {
  console.error('usage: bun tags.ts themes/<name>.toml [...] [--try <tag> ...]')
  process.exit(1)
}

const rows: Row[] = []
for (const file of files) {
  const doc = Bun.TOML.parse(await Bun.file(file).text()) as {
    meta?: { booru?: string; booru_sites?: Record<string, string | string[]> }
  }
  const name = basename(file, '.toml')
  const booru = doc.meta?.booru
  if (!booru) {
    console.log(`${name}: no meta.booru, skipped`)
    continue
  }
  const sites = doc.meta?.booru_sites ?? {}
  rows.push({
    from: name,
    names: new Map(
      SITES.map((site) => {
        const own = sites[site.key]
        return [site.key, own === undefined ? [booru] : typeof own === 'string' ? [own] : own]
      }),
    ),
  })
}
for (const tag of tried) rows.push({ from: `--try ${tag}`, names: new Map(SITES.map((site) => [site.key, [tag]])) })
if (rows.length === 0) process.exit(0)

async function patient<T>(ask: () => Promise<T>): Promise<T> {
  for (let tries = 1; ; tries++) {
    try {
      return await ask()
    } catch (error) {
      if (tries === TRIES) throw error
      await sleep(GAP * tries)
    }
  }
}

async function json(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ttheme-palette-skill' },
    signal: AbortSignal.timeout(TIMEOUT),
  })
  if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}`)
  return response.json()
}

async function kinds(site: Site, names: string[]): Promise<Map<string, Kind>> {
  const found = new Map<string, Kind>()
  if (site.key === 'danbooru') {
    const params = new URLSearchParams({
      'search[name_comma]': names.join(','),
      only: 'name,category,is_deprecated',
    })
    const tags = (await json(`${site.origin}/tags.json?${params}`)) as {
      name: string
      category: number
      is_deprecated: boolean
    }[]
    for (const tag of tags) {
      found.set(tag.name, { character: tag.category === CHARACTER, deprecated: tag.is_deprecated })
    }
    return found
  }
  for (const name of names) {
    const tags = (await json(`${site.origin}/tag.json?${new URLSearchParams({ name, limit: '0' })}`)) as {
      name: string
      type: number
    }[]
    const tag = tags.find((t) => t.name === name)
    if (tag) found.set(name, { character: tag.type === CHARACTER, deprecated: false })
  }
  return found
}

function query(names: string[]): string {
  return names.length > 1 ? names.map((name) => `~${name}`).join(' ') : (names[0] as string)
}

const errors: string[] = []
const cells = await Promise.all(
  SITES.map(async (site) => {
    const out: { text: string; flag: string }[] = []
    for (const [i, row] of rows.entries()) {
      if (i > 0) await sleep(GAP)
      const names = row.names.get(site.key) ?? []
      if (names.length === 0) {
        out.push({ text: 'none', flag: '' })
        continue
      }
      try {
        const count = await patient(() => fetchCount(site, query(names), AbortSignal.timeout(TIMEOUT)))
        const known = await patient(() => kinds(site, names))
        const off = names.flatMap((name) => {
          const kind = known.get(name)
          if (!kind) return count > 0 && site.key !== 'danbooru' ? [] : [`${name} is not a tag`]
          return kind.deprecated ? [`${name} is deprecated`] : kind.character ? [] : [`${name} is not a character`]
        })
        out.push({
          text: `${count}${names.length > 1 || names[0] !== rows[i]?.names.get('danbooru')?.[0] ? ` ${names.join('|')}` : ''}`,
          flag: [...(count === 0 ? ['0 posts'] : []), ...off].join(', '),
        })
      } catch (error) {
        out.push({ text: 'err', flag: '' })
        errors.push(`${site.name} ${names.join('|')}: ${(error as Error).message}`)
      }
    }
    return out
  }),
)

const header = ['from', ...SITES.map((s) => s.name)]
const table = rows.map((row, i) => [row.from, ...cells.map((c) => (c[i] as { text: string }).text)])
const widths = header.map((h, col) => Math.max(h.length, ...table.map((line) => (line[col] as string).length)))
const line = (parts: string[]) => parts.map((part, col) => part.padEnd(widths[col] as number)).join('  ')

let flagged = 0
console.log(line(header))
for (const [i, parts] of table.entries()) {
  const flags = SITES.flatMap((site, s) => {
    const flag = cells[s]?.[i]?.flag
    return flag ? [`${site.name}: ${flag}`] : []
  })
  if (flags.length > 0 && !(rows[i] as Row).from.startsWith('--try')) flagged++
  console.log(`${line(parts)}${flags.length > 0 ? `  <- ${flags.join('; ')}` : ''}`)
}
for (const e of errors) console.log(`error  ${e}`)
process.exit(flagged === 0 && errors.length === 0 ? 0 : 1)
