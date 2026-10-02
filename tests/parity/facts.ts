import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CAPABILITIES, type Capability, MEASURED, REFERENCE, TERMS, type Term } from './terms.ts'

const HERE = import.meta.dirname
export const FACTS = join(HERE, 'facts.tsv')
const GAPS = join(HERE, 'gaps.tsv')
const EXPECT = join(HERE, '..', 'compat', 'expect.tsv')

export type Facts = Record<string, string>

export const SPEC = 'spec'

export type Column = Term | typeof SPEC

export const COLUMNS: readonly Column[] = [SPEC, ...TERMS]

export type Table = Map<string, Map<Column, string>>

export const SAME = '='

const packed = (value: string, spec: string) => (value === spec ? SAME : value)

export function tableOf(results: ReadonlyMap<Term, Facts>, wanted: Facts, known: Table = new Map()): Table {
  const ids = new Set<string>()
  for (const facts of results.values()) {
    for (const id of Object.keys(facts)) {
      ids.add(id)
    }
  }
  if (TERMS.some((term) => !results.has(term))) {
    const walked = new Set([...ids].map((id) => id.split('.')[0]))
    for (const id of known.keys()) {
      if (walked.has(id.split('.')[0])) {
        ids.add(id)
      }
    }
  }
  const table: Table = new Map()
  for (const id of [...ids].sort(byJourney)) {
    const spec = wanted[id] ?? results.get(REFERENCE)?.[id] ?? known.get(id)?.get(SPEC) ?? '-'
    const row = new Map<Column, string>([[SPEC, spec]])
    for (const term of TERMS) {
      const facts = results.get(term)
      if (facts) {
        row.set(term, packed(facts[id] ?? '-', spec))
      }
    }
    table.set(id, row)
  }
  return table
}

let order: string[] = []

export function journeyOrder(ids: string[]): void {
  order = ids
}

function byJourney(a: string, b: string): number {
  const at = (id: string) => {
    const i = order.indexOf(id.split('.')[0] ?? '')
    return i < 0 ? order.length : i
  }
  return at(a) - at(b) || 0
}

export function readTable(file = FACTS): Table {
  const table: Table = new Map()
  if (!existsSync(file)) {
    return table
  }
  const [head = '', ...lines] = readFileSync(file, 'utf8').trimEnd().split('\n')
  const columns = head.split('\t').slice(1) as Column[]
  for (const line of lines) {
    const [id = '', ...cells] = line.split('\t')
    table.set(id, new Map(columns.map((column, i) => [column, cells[i] ?? '-'])))
  }
  return table
}

export function writeTable(table: Table, file = FACTS): void {
  const lines = [['fact', ...COLUMNS].join('\t')]
  for (const [id, row] of table) {
    lines.push([id, ...COLUMNS.map((column) => row.get(column) ?? '-')].join('\t'))
  }
  writeFileSync(file, `${lines.join('\n')}\n`)
}

export function merged(old: Table, fresh: Table, terms: readonly Term[], journeys: readonly string[]): Table {
  const out: Table = new Map()
  const ids = [...new Set([...old.keys(), ...fresh.keys()])].sort(byJourney)
  for (const id of ids) {
    const ran = journeys.includes(id.split('.')[0] ?? '')
    if (ran && !fresh.has(id)) {
      continue
    }
    const spec = specOf(ran ? fresh : old, id)
    const row = new Map<Column, string>([[SPEC, spec]])
    for (const term of TERMS) {
      const from = ran && terms.includes(term) ? fresh : old
      if (from.get(id)?.has(term)) {
        row.set(term, packed(cellValue(from, id, term), spec))
      }
    }
    out.set(id, row)
  }
  return out
}

export function specOf(table: Table, id: string): string {
  return table.get(id)?.get(SPEC) ?? '-'
}

export function cellValue(table: Table, id: string, term: Term): string {
  const cell = table.get(id)?.get(term) ?? '-'
  return cell === SAME ? specOf(table, id) : cell
}

export function owed(table: Table, id: string, term: Term): boolean {
  return cellValue(table, id, term) !== specOf(table, id)
}

export const KINDS = ['cannot', 'layer', 'deferred'] as const

export type Kind = (typeof KINDS)[number]

export interface Gap {
  term: Term
  fact: string
  kind: Kind
  reason: string
}

export function readGaps(file = GAPS): Gap[] {
  if (!existsSync(file)) {
    return []
  }
  const [, ...lines] = readFileSync(file, 'utf8').trimEnd().split('\n')
  return lines.flatMap((line) => {
    const [term = '', fact = '', kind = '', reason = ''] = line.split('\t')
    return term ? [{ term: term as Term, fact, kind: kind as Kind, reason }] : []
  })
}

export function lacking(gap: Gap): Capability | undefined {
  return gap.fact.startsWith('@') ? (gap.fact.slice(1) as Capability) : undefined
}

export function glob(pattern: string, id: string): boolean {
  const source = pattern
    .replace(/[.+^$()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^\\t]*')
    .replace(/\{([^{}]*)\}/g, (_, alternatives: string) => `(?:${alternatives.split(',').join('|')})`)
  return new RegExp(`^${source}$`).test(id)
}

export function explained(gaps: readonly Gap[], term: Term, id: string, needs: readonly Capability[]): Gap | undefined {
  return (
    gaps.find((gap) => {
      const capability = lacking(gap)
      return (
        gap.term === term && capability !== undefined && needs.includes(capability) && !CAPABILITIES[capability](term)
      )
    }) ?? gaps.find((gap) => gap.term === term && lacking(gap) === undefined && glob(gap.fact, id))
  )
}

export interface Compat {
  cases: readonly string[]
  columns: readonly string[]
  result(term: Term, id: string): string | undefined
}

export function readCompat(file = EXPECT): Compat {
  const [head = [], ...rows] = readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .map((line) => line.split('\t'))
  return {
    cases: rows.map((row) => row[0] ?? ''),
    columns: head.slice(1),
    result: (term, id) => rows.find((row) => row[0] === id)?.[head.indexOf(term)],
  }
}

export const BRIDGES: { id: string; holds: (fact: (id: string) => string | undefined) => boolean }[] = [
  { id: 'follow-default', holds: (fact) => fact('default-here.here.colors') === 'miku' },
  { id: 'follow-belief', holds: (fact) => !(fact('default-here.here.issue') ?? '').includes('wears') },
  { id: 'keep-painted', holds: (fact) => fact('default-keeps.here.colors') === 'rei' },
  { id: 'on-follow', holds: (fact) => fact('on.other.colors') === 'konata' },
  { id: 'on-belief', holds: (fact) => !(fact('on.other.issue') ?? '').includes('wears') },
]

export function unmeasured(compat: Compat, term: Term): string[] | undefined {
  if (!compat.columns.includes(term)) {
    return undefined
  }
  const decided = (id: string) => ['pass', 'fail'].includes(compat.result(term, id) ?? '?')
  const cases: { id: string; holds: unknown }[] = [...MEASURED, ...BRIDGES]
  return cases
    .filter(({ holds }) => !cases.some((other) => other.holds === holds && decided(other.id)))
    .map(({ id }) => id)
}
