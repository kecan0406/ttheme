import { spyOn } from 'bun:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { tarballOf } from '../../tests/tarball.ts'
import { paletteToml } from '../core/draft.ts'
import type { Manifest, PaletteEntry } from '../core/manifest.ts'
import { writeBundled } from '../store/available.ts'
import { writeInstalled } from '../store/installed.ts'
import { cachePath, marketplacesDir } from '../store/sources.ts'
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
import { sync } from './sync.ts'

const { preconnect } = fetch

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

const empty = { version: '9.0.0', gate: [], palettes: [] }

async function withNetwork<T>(respond: () => Promise<Response>, run: (home: string) => Promise<T>): Promise<T> {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-refresh-'))
  mkdirSync(marketplacesDir(home), { recursive: true })
  writeFileSync(cachePath(home, SOURCE), `${JSON.stringify({ files: MARKETPLACE })}\n`)
  writeBundled(home, { builtin: empty, commons: { works: [], renames: {} } })
  const realState = process.env.XDG_STATE_HOME
  const fetched = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async () => respond(), { preconnect }))
  process.env.XDG_STATE_HOME = join(home, 'state')

  try {
    return await run(home)
  } finally {
    fetched.mockRestore()

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

test('a fetched archive keeps what a marketplace is read from — its file, its palettes and its proposed works — and nothing else', async () => {
  const dusk = paletteToml({
    name: 'ann@pastel/dusk',
    subject: 'neon/volt',
    signature: ['cursor', 'foreground', 'background'],
    background: '#101010',
    foreground: '#f0f0f0',
    cursor: '#ff8800',
    selection: '#303030',
    ansi: Array.from({ length: 16 }, (_, i) => `#${i.toString(16).repeat(6)}`),
  })

  const files = {
    ...MARKETPLACE,
    'palettes/dusk.toml': dusk,
    'palettes/K-On!/yui.toml': dusk,
    'works/neon.toml': 'name = "Neon"\n\n[[character]]\nid = "volt"\n',
    'README.md': '# pastel\n',
  }

  await withNetwork(
    async () => new Response(tarballOf(files)),
    async (home) => {
      const fresh = await attempt(home, SOURCE)
      assert.ok('refreshed' in fresh)
      assert.equal(fresh.refreshed.count, 1)
      const kept = JSON.parse(readFileSync(cachePath(home, SOURCE), 'utf8')).files
      assert.deepEqual(Object.keys(kept).sort(), ['palettes/dusk.toml', 'ttheme-marketplace.toml', 'works/neon.toml'])
    },
  )
})

test('an archive larger than any marketplace is refused before it is read whole', async () => {
  const chunk = new Uint8Array(1024 * 1024)
  let sent = 0

  await withNetwork(
    async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            sent += chunk.length
            controller.enqueue(chunk)

            if (sent >= 64 * chunk.length) {
              controller.close()
            }
          },
        }),
      ),
    async (home) => {
      const outcome = await attempt(home, SOURCE)
      assert.ok('failure' in outcome)
      assert.equal(failureLine(SOURCE, outcome.failure), 'github.com/ann/ttheme-pastel: the archive is more than 16 MB')
      assert.ok(sent <= 18 * chunk.length, `${sent / chunk.length} MB read`)
    },
  )
})

function installed(name: string): PaletteEntry {
  return {
    name,
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

  const manifest: Manifest = {
    version: '0.1.0',
    gate: [],
    palettes: [installed('ttheme/gojo'), installed('ttheme/geto')],
    works: [],
  }

  const state = { terminals: ['ghostty' as const], palettes: ['ttheme/gojo', 'ttheme/geto'] }
  writeBundled(home, { builtin: manifest, commons: { works: [], renames: {} } })
  writeInstalled(home, state)
  sync(home, manifest, state)

  const left = applyRefreshed(home, [
    { source: 'ttheme', id: 'ttheme', count: 1, change: { added: [], changed: [], gone: ['ttheme/gojo'] } },
  ])

  assert.deepEqual(left, ['ttheme/gojo left its marketplace — ttheme keeps the copy you have'])
  assert.deepEqual(
    applyRefreshed(home, [
      { source: 'ttheme', id: 'ttheme', count: 1, change: { added: ['ttheme/x'], changed: [], gone: [] } },
    ]),
    [],
  )
})
