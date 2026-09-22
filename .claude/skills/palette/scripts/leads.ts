import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { loadCatalog, slotColor, type ThemeDoc } from './audit.ts'
import { deltaE } from './delta.ts'

interface GroupsDoc {
  group: { name: string; lead: string }[]
}

interface Lead {
  name: string
  group: string
  seed: string
}

interface Nearest {
  lead: Lead
  d: number
}

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    themes: { type: 'string', default: 'themes' },
    group: { type: 'string', multiple: true, default: [] },
    top: { type: 'string', default: '10' },
  },
})
const dir = values.themes
const top = Number(values.top)
if (!Number.isInteger(top) || top < 1) {
  console.error('usage: bun leads.ts [--top N] [--group "<name>" ...] [--themes <dir>]')
  process.exit(1)
}

const catalog = await loadCatalog(dir)
const tables = (Bun.TOML.parse(await Bun.file(join(dir, '_groups.toml')).text()) as unknown as GroupsDoc).group
const seeded = (doc: ThemeDoc): Lead => ({
  name: doc.meta.name,
  group: doc.meta.group,
  seed: slotColor(doc, doc.meta.signature[0] as string).toLowerCase(),
})

const present = [...new Set(catalog.map((t) => t.meta.group))]
const forced = values.group
for (const name of forced) {
  if (!present.includes(name)) {
    console.error(`no theme in ${dir} has group "${name}"`)
    process.exit(1)
  }
}
const fresh =
  forced.length > 0 ? [...new Set(forced)] : present.filter((name) => !tables.some((table) => table.name === name))
if (fresh.length === 0) {
  console.log('no new groups')
  process.exit(0)
}

const existing = tables
  .filter((table) => !fresh.includes(table.name))
  .map((table) => {
    const doc = catalog.find((t) => t.meta.name === table.lead)
    if (doc === undefined) throw new Error(`_groups.toml: lead ${table.lead} of ${table.name} has no theme`)
    return seeded(doc)
  })
const current = new Map(tables.map((table) => [table.name, table.lead]))
const candidates = fresh.map((group) => catalog.filter((t) => t.meta.group === group).map(seeded))

const nearestExisting = (lead: Lead): Nearest =>
  existing
    .map((other) => ({ lead: other, d: deltaE(lead.seed, other.seed) }))
    .reduce((best, n) => (n.d < best.d ? n : best), { lead, d: Number.POSITIVE_INFINITY })

const label = (n: Nearest) => (Number.isFinite(n.d) ? `${n.lead.name} (${n.lead.group}) ${n.d.toFixed(1)}` : 'none')
const mark = (lead: Lead) => (current.get(lead.group) === lead.name ? ' *' : '')
const nameWidth = Math.max(...candidates.flat().map((c) => c.name.length + mark(c).length))
const groupWidth = Math.max(...fresh.map((g) => g.length))

console.log(`new groups: ${fresh.join(', ')}  (against ${existing.length} existing leads, ΔE00)`)
fresh.forEach((group, i) => {
  console.log(`\n${group} — candidates by distance to the nearest existing lead`)
  for (const c of (candidates[i] as Lead[])
    .map((lead) => ({ lead, near: nearestExisting(lead) }))
    .sort((a, b) => b.near.d - a.near.d)) {
    console.log(`  ${(c.lead.name + mark(c.lead)).padEnd(nameWidth)}  ${c.lead.seed}  ${label(c.near)}`)
  }
})

const floor = new Map(candidates.flat().map((c) => [c.name, nearestExisting(c)]))
const assignments: { picks: Lead[]; spread: number[]; score: number; bottleneck: string }[] = []
const walk = (depth: number, picks: Lead[]) => {
  if (depth === fresh.length) {
    const spread = picks.map((pick) => {
      const own = floor.get(pick.name) as Nearest
      return picks
        .filter((other) => other !== pick)
        .map((other) => ({ lead: other, d: deltaE(pick.seed, other.seed) }))
        .reduce((best, n) => (n.d < best.d ? n : best), own)
    })
    const worst = spread.reduce((a, b) => (b.d < a.d ? b : a))
    const at = spread.indexOf(worst)
    assignments.push({
      picks: [...picks],
      spread: spread.map((n) => n.d).sort((a, b) => a - b),
      score: worst.d,
      bottleneck: `${(picks[at] as Lead).name}–${worst.lead.name}`,
    })
    return
  }
  for (const c of candidates[depth] as Lead[]) walk(depth + 1, [...picks, c])
}
walk(0, [])

const leximin = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) {
    const d = (b[i] as number) - (a[i] as number)
    if (d !== 0) return d
  }
  return 0
}
assignments.sort((a, b) => leximin(a.spread, b.spread))

console.log(
  `\ntop ${Math.min(top, assignments.length)} of ${assignments.length} assignments — score = minimum ΔE00 to any other lead`,
)
assignments.slice(0, top).forEach((a, rank) => {
  console.log(`\n${String(rank + 1).padStart(3)}  score ${a.score.toFixed(1)}  (${a.bottleneck})`)
  a.picks.forEach((pick) => {
    console.log(
      `     ${pick.group.padEnd(groupWidth)}  ${(pick.name + mark(pick)).padEnd(nameWidth)}  ${pick.seed}  nearest existing: ${label(floor.get(pick.name) as Nearest)}`,
    )
  })
})
if (forced.some((group) => current.has(group))) console.log('\n* the group’s current lead')
