import { spyOn } from 'bun:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { tarballOf } from '../../tests/tarball.ts'
import { paletteToml } from '../core/draft.ts'
import { setText } from '../core/sets.ts'
import { writeBundled } from '../store/available.ts'
import { cachePath, marketplacesDir } from '../store/sources.ts'
import { attempt, failureLine, isDue, REFRESH_AFTER, RETRY_AFTER } from './refresh.ts'

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

const SOURCE = 'ann/ttheme-pastel'

const MARKETPLACE = { 'ttheme-marketplace.toml': 'name = "pastel"\n\n[owner]\nname = "ann"\n' }

const empty = { version: '9.0.0', gate: [], palettes: [] }

async function withNetwork<T>(respond: () => Promise<Response>, run: (home: string) => Promise<T>): Promise<T> {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-refresh-'))
  mkdirSync(marketplacesDir(home), { recursive: true })
  writeFileSync(cachePath(home, SOURCE), `${JSON.stringify({ files: MARKETPLACE })}\n`)
  writeBundled(home, { builtin: empty, commons: { works: [] } })
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
      assert.ok(unreachable)
      assert.match(failureLine(SOURCE, unreachable), /^github\.com\/ann\/ttheme-pastel: cannot reach/)
    },
  )
  await withNetwork(
    async () => new Response(tarballOf(MARKETPLACE)),
    async (home) => {
      assert.equal(await attempt(home, SOURCE), undefined)
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
    'sets/neon.toml': setText([{ slug: 'dusk', text: dusk }]),
    'sets/Lantern Row!/wren.toml': setText([{ slug: 'wren', text: dusk }]),
    'works/neon.toml': 'name = "Neon"\n\n[[character]]\nid = "volt"\n',
    'README.md': '# pastel\n',
  }

  await withNetwork(
    async () => new Response(tarballOf(files)),
    async (home) => {
      assert.equal(await attempt(home, SOURCE), undefined)
      const kept = JSON.parse(readFileSync(cachePath(home, SOURCE), 'utf8')).files
      assert.deepEqual(Object.keys(kept).sort(), ['sets/neon.toml', 'ttheme-marketplace.toml', 'works/neon.toml'])
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
      const failure = await attempt(home, SOURCE)
      assert.ok(failure)
      assert.equal(failureLine(SOURCE, failure), 'github.com/ann/ttheme-pastel: the archive is more than 16 MB')
      assert.ok(sent <= 18 * chunk.length, `${sent / chunk.length} MB read`)
    },
  )
})
