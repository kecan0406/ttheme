import { expect, test } from 'bun:test'
import { grow, SEEDS } from '../../src/core/seeds.ts'
import { listOf } from '../../src/core/slots.ts'
import { blankEdit, type Edit } from './builder'
import { fileOf, setMembersOf } from './builder-view'

const base = blankEdit(listOf(grow(SEEDS)), 'open', 0)

function edit(id: string, name: string, subject?: string): Edit {
  return { ...base, id, name, meta: subject ? { subject } : {} }
}

test('export takes the open palette with the drafts of its work, the open one winning its name and a broken draft left out', () => {
  const open = edit('open', 'orla', 'starfall/orla')

  const drafts = [
    edit('open', 'orla', 'tidewater/orla'),
    edit('a', 'wren', 'starfall/wren'),
    edit('b', 'orla', 'starfall'),
    edit('c', 'Pip', 'starfall/pip'),
    edit('d', 'juno', 'tidewater/juno'),
    edit('e', 'quill'),
  ]

  const { members, left } = setMembersOf(open, drafts)
  expect(members.map((m) => m.id)).toEqual(['open', 'a'])
  expect(left).toEqual(['Pip'])
  expect(fileOf(open, drafts)).toMatchObject({ file: 'starfall.toml', others: ['wren'], left: ['Pip'] })
  expect(setMembersOf(edit('x', 'tamsin'), drafts).members.map((m) => m.name)).toEqual(['quill', 'tamsin'])
})
