import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { tarballOf } from '../tests/tarball.ts'
import { readKept, writeCatalog } from './catalog.ts'
import { type Manifest, type PaletteEntry, SCHEMA, TooNew } from './manifest.ts'
import { sync, writeInstalled } from './palettes.ts'
import {
  applyRefreshed,
  attempt,
  diffEntries,
  failureLine,
  isDue,
  isNewer,
  outdatedNote,
  REFRESH_AFTER,
  RETRY_AFTER,
  type Refreshed,
  readTries,
  refreshLine,
  refreshMarket,
  refusal,
  updateNote,
} from './refresh.ts'
import { cachePath, MARKET_SCHEMA, marketsDir } from './sources.ts'

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

const SOURCE = 'ann/ttheme-pastel'

function market(schema: number): Record<string, string> {
  return { 'ttheme-market.toml': `schema = ${schema}\nowner = "ann"\nname = "pastel"\n` }
}

const CACHED = `${JSON.stringify({ files: market(MARKET_SCHEMA) })}\n`

function served(schema: number): Response {
  return new Response(tarballOf(market(schema)))
}

async function withNetwork<T>(respond: () => Promise<Response>, run: (home: string) => Promise<T>): Promise<T> {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-refresh-'))
  mkdirSync(marketsDir(home), { recursive: true })
  writeFileSync(cachePath(home, SOURCE), CACHED)
  const realFetch = globalThis.fetch
  const realState = process.env.XDG_STATE_HOME
  globalThis.fetch = (async () => respond()) as unknown as typeof fetch
  process.env.XDG_STATE_HOME = join(home, 'state')
  try {
    return await run(home)
  } finally {
    globalThis.fetch = realFetch
    if (realState === undefined) {
      delete process.env.XDG_STATE_HOME
    } else {
      process.env.XDG_STATE_HOME = realState
    }
  }
}

test('a market newer than ttheme reads leaves the cached copy alone and records why, so browse can show it', async () => {
  await withNetwork(
    async () => served(MARKET_SCHEMA + 1),
    async (home) => {
      await assert.rejects(refreshMarket(home, SOURCE), TooNew)
      assert.equal(readFileSync(cachePath(home, SOURCE), 'utf8'), CACHED)
      assert.match(readTries()[SOURCE]?.error ?? '', /newer than the schema \d+ this ttheme reads.*ttheme@latest init/)
    },
  )
})

test('an attempt hands back what happened instead of throwing, and only a refusal asks the user to act', async () => {
  await withNetwork(
    async () => served(MARKET_SCHEMA + 1),
    async (home) => {
      const refused = await attempt(home, SOURCE)
      assert.ok('failure' in refused)
      assert.equal(refusal(refused), failureLine(SOURCE, refused.failure))
      assert.match(refusal(refused) ?? '', /^github\.com\/ann\/ttheme-pastel: ttheme-market\.toml is schema \d+/)
    },
  )
  await withNetwork(
    async () => {
      throw new Error('offline')
    },
    async (home) => {
      const unreachable = await attempt(home, SOURCE)
      assert.ok('failure' in unreachable)
      assert.equal(refusal(unreachable), undefined)
    },
  )
  await withNetwork(
    async () => served(MARKET_SCHEMA),
    async (home) => {
      const fresh = await attempt(home, SOURCE)
      assert.ok('refreshed' in fresh)
      assert.equal(refusal(fresh), undefined)
      assert.equal(fresh.refreshed.id, 'ann@pastel')
    },
  )
})

function installed(name: string): PaletteEntry {
  return {
    name,
    group: 'Jujutsu Kaisen',
    order: 1,
    ansiSource: 'Horizon + Jujutsu',
    background: '#11191c',
    foreground: '#e3e2e7',
    cursor: '#7cc1d6',
    selection: '#383b5b',
    signature: ['#7cc1d6', '#e3e2e7', '#d7bcf3'],
    signatureSlots: ['cursor', 'foreground', 'ansi13'],
    ansi: Array.from({ length: 16 }, () => '#808080'),
    gate: [13.8, 6.8, 0.02, 10.4, 4.0],
    backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
  }
}

test('applying a refresh hands back the palettes that left their market instead of printing them', async () => {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-apply-'))
  const catalog: Manifest = {
    schema: SCHEMA,
    version: '0.1.0',
    gate: [],
    palettes: [installed('gojo'), installed('geto')],
  }
  const state = { terminals: ['ghostty' as const], palettes: ['gojo', 'geto'] }
  writeCatalog(home, catalog)
  writeInstalled(home, state)
  sync(home, catalog, state)
  const left = await applyRefreshed(home, state, readKept(home), [
    { source: 'official', id: 'official', count: 1, change: { added: [], changed: [], gone: ['gojo'] } },
  ])
  assert.deepEqual(left, ['gojo left its market — ttheme keeps the copy you have'])
  assert.deepEqual(
    await applyRefreshed(home, state, readKept(home), [
      { source: 'official', id: 'official', count: 1, change: { added: ['x'], changed: [], gone: [] } },
    ]),
    [],
  )
})
