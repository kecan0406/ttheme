import { expect, test } from 'bun:test'
import { grow, SEEDS } from '../../src/core/seeds.ts'
import { listOf } from '../../src/core/slots.ts'
import { blankEdit, draftsOn, type Edit, reread, restored, type Shelf, startBlank } from './builder'

const had = blankEdit(listOf(grow(SEEDS)), 'had', 0, 'orla')

function aged(id: string, at: number): Edit {
  return { ...had, id, at }
}

test('a blank started over another blank still cancels back to the palette open before both', () => {
  const first = startBlank(had, null, 'first', 1)
  const second = startBlank(first.edit, first.seeding, 'second', 2)

  expect(first.seeding.before.id).toBe('had')
  expect(second.edit.id).toBe('second')
  expect(second.seeding.before.id).toBe('had')
})

test('a deleted draft comes back by its age, wherever the list moved under it', () => {
  const gone = aged('gone', 20)
  const stored = { drafts: [aged('newest', 40), aged('newer', 30), aged('older', 10)] }

  expect(restored(stored, gone).drafts.map((draft) => draft.id)).toEqual(['newest', 'newer', 'gone', 'older'])
  expect(restored({ drafts: [gone] }, gone).drafts.map((draft) => draft.id)).toEqual(['gone'])
})

test('a write the browser refused keeps the drafts it still holds', () => {
  const stored = { drafts: [aged('wren', 5)] }
  const refused: Shelf = { state: 'refused', stored }

  expect(draftsOn(refused)).toEqual(stored.drafts)
  expect(reread(refused, stored)).toEqual(refused)
  expect(reread(refused, null)).toEqual({ state: 'none' })
  expect(draftsOn({ state: 'none' })).toEqual([])
})
