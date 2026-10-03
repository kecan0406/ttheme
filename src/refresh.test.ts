import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { TooNew } from './catalog.ts'
import { type PaletteEntry, SCHEMA } from './manifest.ts'
import {
  diffEntries,
  isDue,
  isNewer,
  outdatedNote,
  REFRESH_AFTER,
  RETRY_AFTER,
  type Refreshed,
  readTries,
  refreshLine,
  refreshMarket,
  updateNote,
} from './refresh.ts'
import { cachePath, marketsDir } from './sources.ts'

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

test('isNewer compares releases part by part and stays quiet about a version that is not a plain release', () => {
  assert.equal(isNewer('1.0.51', '1.0.50'), true)
  assert.equal(isNewer('1.1.0', '1.0.99'), true)
  assert.equal(isNewer('2.0.0', '1.99.99'), true)
  assert.equal(isNewer('1.0.10', '1.0.9'), true)
  assert.equal(isNewer('1.0.50', '1.0.50'), false)
  assert.equal(isNewer('1.0.49', '1.0.50'), false)
  assert.equal(isNewer('1.0.51-rc.1', '1.0.50'), false)
  assert.equal(isNewer('1.0.51', 'dev'), false)
})

const official: Refreshed = {
  source: 'official',
  id: 'official',
  version: '1.0.51',
  count: 3,
  change: { added: [], changed: [], gone: [] },
}

test('a refreshed official catalog newer than the running ttheme says how to update, and a market never does', () => {
  assert.equal(
    outdatedNote(official, '1.0.50'),
    'ttheme 1.0.51 is out, you have 1.0.50 — `npx @kecan0406/ttheme@latest init` updates it',
  )
  assert.equal(outdatedNote(official, '1.0.51'), undefined)
  assert.equal(outdatedNote(official, '1.0.52'), undefined)
  const { version: _, ...market } = official
  assert.equal(outdatedNote(market, '1.0.50'), undefined)
})

test('a market index newer than ttheme reads leaves the cached copy alone and records why, so browse can show it', async () => {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-refresh-'))
  const source = 'ann/ttheme-pastel'
  const cached = `${JSON.stringify({ schema: SCHEMA, version: '1.0.0', owner: 'ann', name: 'pastel', palettes: [] })}\n`
  mkdirSync(marketsDir(home), { recursive: true })
  writeFileSync(cachePath(home, source), cached)
  const newer = JSON.stringify({ schema: SCHEMA + 1, version: '9.0.0', owner: 'ann', name: 'pastel', palettes: [] })
  const realFetch = globalThis.fetch
  const realState = process.env.XDG_STATE_HOME
  globalThis.fetch = (async () => new Response(newer)) as unknown as typeof fetch
  process.env.XDG_STATE_HOME = join(home, 'state')
  try {
    await assert.rejects(refreshMarket(home, source), TooNew)
    assert.equal(readFileSync(cachePath(home, source), 'utf8'), cached)
    assert.match(readTries()[source]?.error ?? '', /newer than the schema \d+ this ttheme reads.*ttheme@latest init/)
  } finally {
    globalThis.fetch = realFetch
    if (realState === undefined) {
      delete process.env.XDG_STATE_HOME
    } else {
      process.env.XDG_STATE_HOME = realState
    }
  }
})
