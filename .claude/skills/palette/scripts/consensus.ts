import { setTimeout as sleep } from 'node:timers/promises'
import pkg from '../../../../package.json' with { type: 'json' }
import { hairOf, type Tagged, type Verdict, verdictOf, worn } from '../../../../src/core/consensus.ts'

interface Related {
  post_count: number
  related_tags: { tag: { name: string }; frequency: number }[]
}

const ORIGIN = 'https://safebooru.donmai.us'
const AGENT = `ttheme-palette-consensus/${pkg.version} (+${pkg.homepage})`
const GAP = 700
const SHOWN = 4

const fmt = (f: number) => f.toFixed(2)
const list = (tags: Tagged[]) =>
  tags
    .slice(0, SHOWN)
    .map((t) => `${t.name} ${fmt(t.frequency)}`)
    .join('  ') || '-'

function said(verdict: Verdict): string {
  if (verdict.kind === 'thin') return `owner — sample too thin (${verdict.posts})`
  if (verdict.kind === 'eyes') return `eyes — ${verdict.tag.name} ${fmt(verdict.tag.frequency)}`
  if (verdict.kind === 'achromatic') return 'achromatic identity'
  if (verdict.kind === 'item') return `item — ${verdict.tag.name} ${fmt(verdict.tag.frequency)}`
  return 'owner — no consensus'
}

async function related(tag: string): Promise<Related> {
  const query = new URLSearchParams({ query: `${tag} solo`, category: 'general', limit: '150' })
  const response = await fetch(`${ORIGIN}/related_tag.json?${query}`, { headers: { 'User-Agent': AGENT } })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return (await response.json()) as Related
}

const tags = Bun.argv.slice(2)
if (tags.length === 0) {
  console.error('usage: bun consensus.ts <danbooru_tag> [...]')
  process.exit(1)
}

let failed = 0
for (const [i, tag] of tags.entries()) {
  if (i > 0) await sleep(GAP)
  let data: Related
  try {
    data = await related(tag)
  } catch (error) {
    failed++
    console.log(`${tag}  error ${(error as Error).message}\n`)
    continue
  }
  const found = worn(data.related_tags.map((r) => ({ name: r.tag.name, frequency: r.frequency })))
  const hair = hairOf(found.hair)
  console.log(`${tag}  n ${data.post_count}`)
  console.log(`  hair     ${list(found.hair)}`)
  console.log(`  eyes     ${list(found.eyes)}`)
  console.log(`  items    ${list(found.items)}`)
  console.log(
    `  verdict  ${said(verdictOf(data.post_count, found))}${hair ? ` · hair is ${hair.chromatic ? 'chromatic' : 'achromatic'}: ${hair.name}` : ''}\n`,
  )
}
process.exit(failed === 0 ? 0 : 1)
