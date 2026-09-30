import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MEASURED, REFERENCE, TERMS, type Term } from './terms.ts'

const HERE = import.meta.dirname
export const FACTS = join(HERE, 'facts.tsv')
const GAPS = join(HERE, 'gaps.tsv')
const EXPECT = join(HERE, '..', 'compat', 'expect.tsv')

export type Facts = Record<string, string>

export type Table = Map<string, Map<Term, string>>

export const SAME = '='

export function tableOf(results: ReadonlyMap<Term, Facts>, known: Table = new Map()): Table {
  const ids = new Set<string>()
  for (const facts of results.values()) {
    for (const id of Object.keys(facts)) {
      ids.add(id)
    }
  }
  const table: Table = new Map()
  if (!results.has(REFERENCE)) {
    for (const [id, row] of known) {
      if (
        row.has(REFERENCE) &&
        [...results.values()].some((facts) => Object.keys(facts).some((k) => k.split('.')[0] === id.split('.')[0]))
      ) {
        ids.add(id)
      }
    }
  }
  for (const id of [...ids].sort(byJourney)) {
    const reference = results.get(REFERENCE)?.[id] ?? known.get(id)?.get(REFERENCE) ?? '-'
    const row = new Map<Term, string>()
    for (const term of TERMS) {
      const facts = results.get(term)
      if (!facts) {
        if (term === REFERENCE && known.get(id)?.has(REFERENCE)) {
          row.set(term, reference)
        }
        continue
      }
      const value = facts[id] ?? '-'
      row.set(term, term === REFERENCE || value !== reference ? value : SAME)
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
  const terms = head.split('\t').slice(1) as Term[]
  for (const line of lines) {
    const [id = '', ...cells] = line.split('\t')
    table.set(id, new Map(terms.map((term, i) => [term, cells[i] ?? '-'])))
  }
  return table
}

export function writeTable(table: Table, file = FACTS): void {
  const lines = [['fact', ...TERMS].join('\t')]
  for (const [id, row] of table) {
    lines.push([id, ...TERMS.map((term) => row.get(term) ?? '-')].join('\t'))
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
    const row = new Map<Term, string>()
    for (const term of TERMS) {
      const value = ran && terms.includes(term) ? fresh.get(id)?.get(term) : old.get(id)?.get(term)
      if (value !== undefined) {
        row.set(term, value)
      }
    }
    out.set(id, row)
  }
  return out
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

export function glob(pattern: string, id: string): boolean {
  const re = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^\\t]*')}$`)
  return re.test(id)
}

export function explained(gaps: readonly Gap[], term: Term, id: string): Gap | undefined {
  return gaps.find((gap) => gap.term === term && glob(gap.fact, id))
}

export function owed(term: Term, id: string, value: string, cell: string): boolean {
  return id.endsWith('.issue') ? value !== '-' : term !== REFERENCE && cell !== SAME
}

export function cellValue(table: Table, id: string, term: Term): string {
  const cell = table.get(id)?.get(term) ?? '-'
  return cell === SAME ? (table.get(id)?.get(REFERENCE) ?? '-') : cell
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
