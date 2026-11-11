import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { Site } from '../../core/booru.ts'
import { Kept } from './kept.ts'

const SITE = { key: 'files', name: 'files' } as never

function shelf() {
  const session = new AbortController()
  const asked = new Map<string, AbortSignal[]>()
  const send = new Map<string, () => void>()

  const kept = new Kept({
    home: '',
    manifest: { palettes: [], works: [] } as never,
    entry: { name: 'orla' } as never,
    signal: session.signal,
    net: {
      fetchBytes: (_site: Site, url: string, signal: AbortSignal) =>
        new Promise<Uint8Array>((resolve, reject) => {
          asked.set(url, [...(asked.get(url) ?? []), signal])
          send.set(url, () => resolve(new Uint8Array([1, 2, 3])))
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        }),
    } as never,
    credited: () => {},
    quieted: () => {},
    arrived: () => {},
  })

  const dir = mkdtempSync(join(tmpdir(), 'ttheme-kept-'))
  const at = (file: string) => `https://files.test/${file}`
  const fetch = (file: string, post?: number) => kept.cached(SITE, join(dir, file), at(file), undefined, post)
  const stopped = (file: string) => asked.get(at(file))?.map((signal) => signal.aborted)

  return { kept, session, send, at, fetch, stopped }
}

test('an original is let go once no post in sight wants it, and never one that something else waits on', async () => {
  const { kept, send, at, fetch, stopped } = shelf()
  const far = fetch('far.png', 1)
  const near = fetch('near.png', 2)
  const shared = fetch('shared.png', 1)
  const again = fetch('shared.png', 3)
  const preview = fetch('preview.jpg')
  const both = fetch('both.png', 1)
  const held = fetch('both.png')
  kept.letGo(new Set([2, 3]))
  await assert.rejects(far, { name: 'AbortError' })
  assert.deepEqual(stopped('far.png'), [true])
  assert.deepEqual(stopped('near.png'), [false])
  assert.deepEqual(stopped('shared.png'), [false], 'asked once, for two posts')
  assert.deepEqual(stopped('preview.jpg'), [false])
  assert.deepEqual(stopped('both.png'), [false])

  for (const file of ['near.png', 'shared.png', 'preview.jpg', 'both.png']) {
    send.get(at(file))?.()
  }

  assert.deepEqual(await Promise.all([near, shared, again, preview, both, held]), [3, 3, 3, 3, 3, 3])
  const back = fetch('far.png', 1)
  assert.deepEqual(stopped('far.png'), [true, false], 'a post back in sight is asked for again')
  send.get(at('far.png'))?.()
  assert.equal(await back, 3)
  assert.equal(await fetch('far.png', 1), 3, 'and is read from its file after that')
  assert.deepEqual(stopped('far.png'), [true, false])
})

test('the end of the session stops every original on its way', async () => {
  const { session, fetch, stopped } = shelf()
  const one = fetch('one.png', 1)
  const two = fetch('two.jpg')
  session.abort()
  await assert.rejects(one)
  await assert.rejects(two)
  assert.deepEqual(stopped('one.png'), [true])
  assert.deepEqual(stopped('two.jpg'), [true])
})
