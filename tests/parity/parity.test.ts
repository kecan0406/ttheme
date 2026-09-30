import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { TRAITS } from '../../src/terminal.ts'
import { WIRED } from '../../src/terminals/types.ts'
import { BRIDGES, FACTS, glob, KINDS, readCompat, readGaps, readTable } from './facts.ts'
import { JOURNEYS } from './journeys.ts'
import { BEHAVIOR, MEASURED, REFERENCE, TERMS, WIRING } from './terms.ts'

test('every terminal ttheme knows runs the journeys, the reference first', () => {
  assert.equal(TERMS[0], REFERENCE)
  for (const id of WIRED) {
    assert.ok((TERMS as readonly string[]).includes(id), `${id} is wired but has no parity column`)
  }
  for (const term of TERMS) {
    assert.ok(term in TRAITS, `${term} has no TRAITS row`)
    assert.ok(WIRING[term] === undefined || WIRED.includes(WIRING[term]), term)
  }
})

test("the model's terminals behave the way mise run compat measured them", () => {
  const compat = readCompat()
  for (const term of TERMS) {
    for (const { id, holds } of MEASURED) {
      const result = compat.result(term, id)
      if (result === 'pass' || result === 'fail') {
        assert.equal(holds(BEHAVIOR[term]), result === 'pass', `${term} ${id}: compat measured ${result}`)
      }
    }
  }
})

test('every measured case the model leans on is one mise run compat records', () => {
  const { cases } = readCompat()
  for (const { id } of [...MEASURED, ...BRIDGES]) {
    assert.ok(cases.includes(id), `compat records no ${id}`)
  }
})

test('the journeys compat also walks in a real window end as compat measured them there', () => {
  const compat = readCompat()
  const table = readTable()
  for (const term of TERMS) {
    const fact = (id: string) => {
      const cell = table.get(id)?.get(term)
      return cell === '=' ? table.get(id)?.get(REFERENCE) : cell
    }
    for (const { id, holds } of BRIDGES) {
      const result = compat.result(term, id)
      if (result === 'pass' || result === 'fail') {
        assert.equal(holds(fact), result === 'pass', `${term} ${id}: compat measured ${result}`)
      }
    }
  }
})

test('journeys are named once and say what they cover', () => {
  const ids = JOURNEYS.map((journey) => journey.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const journey of JOURNEYS) {
    assert.match(journey.id, /^[a-z][a-z-]*$/)
    assert.ok(journey.about.length > 10, journey.id)
  }
})

test('facts.tsv holds every journey for every terminal, and nothing else', () => {
  const head = readFileSync(FACTS, 'utf8').split('\n')[0]?.split('\t')
  assert.deepEqual(head, ['fact', ...TERMS])
  const table = readTable()
  const journeys = new Set([...table.keys()].map((id) => id.split('.')[0]))
  assert.deepEqual([...journeys].sort(), JOURNEYS.map((journey) => journey.id).sort())
  for (const [id, row] of table) {
    for (const term of TERMS) {
      assert.ok(row.has(term), `${id} has no ${term} cell`)
    }
    assert.notEqual(row.get(REFERENCE), '=', `${id}: the reference holds values, never =`)
  }
})

test('every gap names a terminal, a kind, a reason and facts that exist', () => {
  const ids = [...readTable().keys()]
  for (const gap of readGaps()) {
    assert.ok((TERMS as readonly string[]).includes(gap.term), `unknown terminal ${gap.term}`)
    assert.ok((KINDS as readonly string[]).includes(gap.kind), `${gap.term} ${gap.fact}: unknown kind ${gap.kind}`)
    assert.ok(gap.reason.length > 20, `${gap.term} ${gap.fact} gives no reason`)
    assert.ok(
      ids.some((id) => glob(gap.fact, id)),
      `${gap.term} ${gap.fact} matches no fact`,
    )
  }
})
