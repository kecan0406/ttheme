import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { tarballOf } from '../tests/tarball.ts'
import { writeCatalog } from './catalog.ts'
import { type Manifest, type PaletteEntry, SCHEMA } from './manifest.ts'
import { sync, writeInstalled } from './palettes.ts'
import {
  applyRefreshed,
  attempt,
  diffEntries,
  failureLine,
  isDue,
  REFRESH_AFTER,
  RETRY_AFTER,
  refreshLine,
  updateNote,
} from './refresh.ts'
import { cachePath, marketplacesDir } from './sources.ts'

const now = 1_000_000_000_000

test('a marketplace is due once a day, never while auto-update is off, and an hour after a failed try', () => {
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
  const grown = { ...same, count: 3 }
  assert.equal(
    updateNote({ ...grown, change: { added: ['d'], changed: ['b'], gone: [] } }),
    'Updated alice@x — 3 palettes (1 new, 1 changed)',
  )
})

const SOURCE = 'ann/ttheme-pastel'

const MARKETPLACE = { 'ttheme-marketplace.toml': 'name = "pastel"\n\n[owner]\nname = "ann"\n' }

function catalog(schema: number): string {
  return JSON.stringify({ schema, version: '9.0.0', gate: [], palettes: [] })
}

async function withNetwork<T>(respond: () => Promise<Response>, run: (home: string) => Promise<T>): Promise<T> {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-refresh-'))
  mkdirSync(marketplacesDir(home), { recursive: true })
  writeFileSync(cachePath(home, SOURCE), `${JSON.stringify({ files: MARKETPLACE })}\n`)
  writeCatalog(home, JSON.parse(catalog(SCHEMA)))
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

test('an attempt hands back what happened instead of throwing', async () => {
  await withNetwork(
    async () => {
      throw new Error('offline')
    },
    async (home) => {
      const unreachable = await attempt(home, SOURCE)
      assert.ok('failure' in unreachable)
      assert.match(failureLine(SOURCE, unreachable.failure), /^github\.com\/ann\/ttheme-pastel: cannot reach/)
    },
  )
  await withNetwork(
    async () => new Response(tarballOf(MARKETPLACE)),
    async (home) => {
      const fresh = await attempt(home, SOURCE)
      assert.ok('refreshed' in fresh)
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

test('applying a refresh hands back the palettes that left their marketplace instead of printing them', async () => {
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
  const left = applyRefreshed(home, [
    { source: 'official', id: 'official', count: 1, change: { added: [], changed: [], gone: ['gojo'] } },
  ])
  assert.deepEqual(left, ['gojo left its marketplace — ttheme keeps the copy you have'])
  assert.deepEqual(
    applyRefreshed(home, [
      { source: 'official', id: 'official', count: 1, change: { added: ['x'], changed: [], gone: [] } },
    ]),
    [],
  )
})
