import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { cacheRoot } from '../store/paths.ts'
import { keyOf, prune, remember } from './drawn.ts'

test('the drawing cache keeps what was used last within its size, and leaves an unfinished write only until it is stale', () => {
  process.env.XDG_CACHE_HOME = mkdtempSync(join(tmpdir(), 'ttheme-drawn-prune-'))
  const dir = join(cacheRoot(), 'drawn')
  const keys = [1, 2, 3, 4].map((n) => keyOf([n]))
  const minutes = (ago: number) => new Date(Date.now() - ago * 60_000)

  keys.forEach((key, at) => {
    remember(key, {
      stem: 'kagami.0',
      fill: 'kagami.0@fill-50.png',
      figure: Buffer.alloc(1000),
      picture: Buffer.alloc(1000),
    })
    utimesSync(join(dir, key), minutes(10 - at), minutes(10 - at))
  })

  const size = statSync(join(dir, keys[0] as string)).size
  const young = join(dir, `${keys[0]}.ttheme-1`)
  const stale = join(dir, `${keys[1]}.ttheme-2`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(young, '')
  writeFileSync(stale, '')
  utimesSync(stale, minutes(120), minutes(120))

  prune(size * 2 + 10)
  assert.deepEqual(
    keys.map((key) => existsSync(join(dir, key))),
    [false, false, true, true],
  )
  assert.deepEqual([existsSync(young), existsSync(stale)], [true, false])
})
