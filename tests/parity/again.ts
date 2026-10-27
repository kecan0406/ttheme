import { existsSync, readFileSync } from 'node:fs'

const file = process.argv[2] ?? ''
const rows = existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean) : []
const runs = new Map<string, { walks: Set<string>; first: string[] }>()

for (const row of rows) {
  const [walk = '', term = '', journey = '', moved = ''] = row.split('\t')
  const key = `${term} ${journey}`
  const seen = runs.get(key) ?? { walks: new Set<string>(), first: [] }
  seen.walks.add(walk)
  seen.first.push(moved)
  runs.set(key, seen)
}

const total = Number(process.argv[3] ?? new Set(rows.map((row) => row.split('\t')[0])).size)
const twice = [...runs].filter(([, { walks }]) => walks.size >= 2)

for (const [key, { walks, first }] of runs) {
  console.log(`${walks.size >= 2 ? '✗' : '·'} ${key}: walked again in ${walks.size} of the walks`)

  for (const moved of new Set(first)) {
    console.log(`    first walk: ${moved}`)
  }
}

console.log(
  `\n${twice.length === 0 ? '✓' : '✗'} ${runs.size} journeys needed a second walk in ${total} parity walks; ${twice.length} needed one in two walks or more`,
)

if (twice.length > 0) {
  process.exitCode = 1
}
