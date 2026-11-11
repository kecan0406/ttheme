import { expect, test } from 'bun:test'
import { grow, SEEDS } from '../../src/core/seeds.ts'
import { listOf } from '../../src/core/slots.ts'
import { blankEdit, type Edit } from './builder'
import { fileOf, linkOf, setMembersOf, shared, sharingOf, statusOf } from './builder-view'

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

test('a draft the browser refused to write is named as not kept, apart from a browser that keeps none', () => {
  const open = edit('open', 'orla')
  const stored = { drafts: [edit('a', 'wren')] }

  expect(statusOf(open, { state: 'refused', stored })).toEqual({
    ok: false,
    text: 'orla was not kept in this browser — export before you leave',
  })
  expect(statusOf(open, { state: 'none' }).text).toBe('this browser keeps no drafts — export before you leave')
  expect(statusOf(open, { state: 'kept', stored }).ok).toBe(true)
})

test('a share link answered for an older palette leaves the newer one alone', () => {
  const asking = sharingOf({ state: 'idle' }, 'newer')

  expect(shared(asking, 'older', { problem: 'offline' })).toBe(asking)
  const made = shared(asking, 'newer', { code: 'tt8:orla' })

  expect(made).toEqual({ state: 'made', key: 'newer', code: 'tt8:orla' })
  expect(shared(made, 'older', { problem: 'offline' })).toBe(made)
  expect(sharingOf(made, 'newer')).toBe(made)
  expect(linkOf(made, 'orla', undefined)).toMatchObject({ code: 'tt8:orla', failed: null })
  expect(linkOf(asking, 'orla', undefined)).toEqual({ name: 'orla', link: null, code: null, failed: null })
})
