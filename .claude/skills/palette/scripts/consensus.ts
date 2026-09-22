import { setTimeout as sleep } from 'node:timers/promises'
import pkg from '../../../../package.json' with { type: 'json' }

interface Related {
  post_count: number
  related_tags: { tag: { name: string }; frequency: number }[]
}

interface Tagged {
  name: string
  frequency: number
}

const ORIGIN = 'https://safebooru.donmai.us'
const AGENT = `ttheme-palette-consensus/${pkg.version} (+${pkg.homepage})`
const GAP = 700
const FLOOR = 0.08
const SHOWN = 4
const THIN = 50
const EYES = 0.5
const ACHROMATIC_HAIR = 0.8
const ACHROMATIC_EYES = 0.5
const ITEM = 0.3
const CHROMATIC = ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'orange', 'brown', 'aqua', 'blonde', 'gold']
const NEUTRAL = ['black', 'white', 'grey', 'silver']
const MIXED = ['multicolored', 'gradient']

const hue = (name: string) => name.split('_')[0] as string
const chromatic = (t: Tagged) => CHROMATIC.includes(hue(t.name))
const neutral = (t: Tagged) => NEUTRAL.includes(hue(t.name))
const fmt = (f: number) => f.toFixed(2)
const list = (tags: Tagged[]) =>
  tags
    .slice(0, SHOWN)
    .map((t) => `${t.name} ${fmt(t.frequency)}`)
    .join('  ') || '-'
const freq = (tags: Tagged[], name: string) => tags.find((t) => t.name === name)?.frequency ?? 0

async function related(tag: string): Promise<Related> {
  const query = new URLSearchParams({ query: `${tag} solo`, category: 'general', limit: '150' })
  const response = await fetch(`${ORIGIN}/related_tag.json?${query}`, { headers: { 'User-Agent': AGENT } })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return (await response.json()) as Related
}

function colors(data: Related): Tagged[] {
  return data.related_tags
    .map((r) => ({ name: r.tag.name, frequency: r.frequency }))
    .filter(
      (t) =>
        t.frequency >= FLOOR &&
        [...CHROMATIC, ...NEUTRAL, ...MIXED].includes(hue(t.name)) &&
        !t.name.endsWith('_background'),
    )
    .sort((a, b) => b.frequency - a.frequency)
}

function verdict(n: number, hair: Tagged[], eyes: Tagged[], items: Tagged[]): string {
  if (n < THIN) return `owner — sample too thin (${n})`
  const eye = eyes[0]
  if (eye && chromatic(eye) && eye.frequency >= EYES) return `eyes — ${eye.name} ${fmt(eye.frequency)}`
  const neutralHair = Math.max(...['black_hair', 'white_hair', 'grey_hair'].map((name) => freq(hair, name)))
  const neutralEyes = Math.max(freq(eyes, 'black_eyes'), freq(eyes, 'grey_eyes'))
  if (neutralHair >= ACHROMATIC_HAIR && neutralEyes >= ACHROMATIC_EYES) return 'achromatic identity'
  const item = items.find(chromatic)
  if (item && item.frequency >= ITEM) return `item — ${item.name} ${fmt(item.frequency)}`
  return 'owner — no consensus'
}

function hairNote(hair: Tagged[]): string {
  const top = hair.find((t) => chromatic(t) || neutral(t))
  if (!top) return ''
  return ` · hair is ${chromatic(top) ? 'chromatic' : 'achromatic'}: ${top.name}`
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
  const found = colors(data)
  const hair = found.filter((t) => t.name.endsWith('_hair'))
  const eyes = found.filter((t) => t.name.endsWith('_eyes'))
  const items = found.filter((t) => !hair.includes(t) && !eyes.includes(t))
  console.log(`${tag}  n ${data.post_count}`)
  console.log(`  hair     ${list(hair)}`)
  console.log(`  eyes     ${list(eyes)}`)
  console.log(`  items    ${list(items)}`)
  console.log(`  verdict  ${verdict(data.post_count, hair, eyes, items)}${hairNote(hair)}\n`)
}
process.exit(failed === 0 ? 0 : 1)
