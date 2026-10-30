import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Work } from '../core/commons.ts'
import { worksOf } from './names.ts'

const works: Work[] = [
  { id: 'starfall', name: 'Starfall Academy', characters: [{ id: 'mira', danbooru: 'mira_(starfall)' }] },
]

const found = [
  { kind: 'character', danbooru: ['nobody_(elsewhere)'], works: ['w/1', 'w/2'] },
  { kind: 'character', danbooru: ['mira_(starfall)'], works: ['w/2', 'w/3'] },
  { kind: 'character', danbooru: [], works: ['w/3', 'w/4'] },
  { kind: 'work', danbooru: ['starfall_academy'], works: [] },
]

test('a character known by its tag needs no lookup, nor do the works it already places', () => {
  assert.deepEqual(worksOf(found, works), ['w/1', 'w/4'])
})

test("the first hit's first work is always looked up, for the request that names it", () => {
  assert.deepEqual(worksOf(found.slice(1), works), ['w/2', 'w/4'])
})

test('without known works every character is looked up', () => {
  assert.deepEqual(worksOf(found, undefined), ['w/1', 'w/2', 'w/3', 'w/4'])
})
