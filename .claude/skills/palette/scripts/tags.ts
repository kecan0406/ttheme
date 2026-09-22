import { basename } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fetchCount, SITES, type Site } from '../../../../src/booru.ts'

interface Row {
  tag: string
  source: string
}

const GAP = 350
const TIMEOUT = 30_000
const ZEROS = 2
const TRIES = 3

const args = Bun.argv.slice(2)
const split = args.indexOf('--try')
const files = split === -1 ? args : args.slice(0, split)
const tried = split === -1 ? [] : args.slice(split + 1)
if (files.length + tried.length === 0 || files.some((f) => !f.endsWith('.toml'))) {
  console.error('usage: bun tags.ts themes/<name>.toml [...] [--try <tag> ...]')
  process.exit(1)
}

const rows: Row[] = []
const add = (tag: string, source: string) => {
  const known = rows.find((r) => r.tag === tag)
  if (known) known.source = `${known.source},${source}`
  else rows.push({ tag, source })
}
for (const file of files) {
  const doc = Bun.TOML.parse(await Bun.file(file).text()) as { meta?: { booru?: string } }
  const name = basename(file, '.toml')
  if (doc.meta?.booru) add(doc.meta.booru, name)
  else console.log(`${name}: no meta.booru, skipped`)
}
for (const tag of tried) add(tag, '--try')
if (rows.length === 0) process.exit(0)

const count = async (site: Site, tag: string): Promise<number> => {
  for (let tries = 1; ; tries++) {
    try {
      return await fetchCount(site, tag, AbortSignal.timeout(TIMEOUT))
    } catch (error) {
      if (tries === TRIES) throw error
      await sleep(GAP * tries)
    }
  }
}

const errors: string[] = []
const counts = await Promise.all(
  SITES.map(async (site) => {
    const found: (number | undefined)[] = []
    for (const [i, row] of rows.entries()) {
      if (i > 0) await sleep(GAP)
      try {
        found.push(await count(site, row.tag))
      } catch (error) {
        found.push(undefined)
        errors.push(`${site.name} ${row.tag}: ${(error as Error).message}`)
      }
    }
    return found
  }),
)

const header = ['tag', 'from', ...SITES.map((s) => s.name)]
const table = rows.map((row, i) => [row.tag, row.source, ...counts.map((c) => String(c[i] ?? 'err'))])
const widths = header.map((h, col) => Math.max(h.length, ...table.map((cells) => (cells[col] as string).length)))
const line = (cells: string[]) =>
  cells.map((cell, col) => (col < 2 ? cell.padEnd(widths[col] as number) : cell.padStart(widths[col] as number)))

let flagged = 0
console.log(line(header).join('  '))
for (const [i, cells] of table.entries()) {
  const zeros = counts.filter((c) => c[i] === 0).length
  const flag = zeros >= ZEROS ? `  <- 0 on ${zeros} sites` : ''
  if (flag && (rows[i] as Row).source !== '--try') flagged++
  console.log(`${line(cells).join('  ')}${flag}`)
}
for (const e of errors) console.log(`error  ${e}`)
process.exit(flagged === 0 ? 0 : 1)
