import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { PaletteEntry } from './manifest.ts'
import { diffEntries, isDue, REFRESH_AFTER, RETRY_AFTER, refreshLine, updateNote } from './refresh.ts'

const now = 1_000_000_000_000

test('a market is due once a day, never while auto-update is off, and an hour after a failed try', () => {
  assert.equal(isDue(true, undefined, undefined, now), true)
  assert.equal(isDue(true, now - REFRESH_AFTER, undefined, now), true)
  assert.equal(isDue(true, now - REFRESH_AFTER + 1, undefined, now), false)
  assert.equal(isDue(false, undefined, undefined, now), false)
  assert.equal(isDue(true, now - REFRESH_AFTER, now - RETRY_AFTER + 1, now), false)
  assert.equal(isDue(true, now - REFRESH_AFTER, now - RETRY_AFTER, now), true)
})

function entry(name: string, background = '#000000'): PaletteEntry {
  return { name, background } as PaletteEntry
}

test('a refresh tells new, changed and gone palettes apart', () => {
  const change = diffEntries([entry('a'), entry('b'), entry('c')], [entry('a'), entry('b', '#111111'), entry('d')])
  assert.deepEqual(change, { added: ['d'], changed: ['b'], gone: ['c'] })
})

test('an update is noted only when something changed', () => {
  const same = { source: 'alice/x', id: 'alice@x', count: 2, change: { added: [], changed: [], gone: [] } }
  assert.equal(refreshLine(same), 'alice@x — 2 palettes')
  assert.equal(updateNote(same), undefined)
  const grown = { ...same, source: 'official', id: 'official', version: '1.0.50', count: 3 }
  assert.equal(
    updateNote({ ...grown, change: { added: ['d'], changed: ['b'], gone: [] } }),
    'Updated official 1.0.50 — 3 palettes (1 new, 1 changed)',
  )
})
