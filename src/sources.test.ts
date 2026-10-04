import assert from 'node:assert/strict'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  archiveUrl,
  autoUpdates,
  cachePath,
  OFFICIAL,
  parseSource,
  refOf,
  repoOf,
  sameMarket,
  shownSource,
} from './sources.ts'

test('a market is added by its repository, a path or official', () => {
  assert.equal(parseSource('Alice/anime'), 'alice/anime')
  assert.equal(parseSource('https://github.com/alice/anime.git'), 'alice/anime')
  assert.equal(parseSource('./mine', '/work'), '/work/mine')
  assert.equal(parseSource('/srv/market'), '/srv/market')
  assert.equal(parseSource('~/market'), join(homedir(), 'market'))
  assert.equal(parseSource('official'), OFFICIAL)
  for (const bad of ['alice', 'a/b/c', '-alice/x', 'al ice/x', 'alice/../x']) {
    assert.throws(() => parseSource(bad), /is not a market/, bad)
  }
})

test('a repository takes a tag, branch or commit after #, which the fetch follows and the cache ignores', () => {
  assert.equal(parseSource('Alice/anime#v1.2'), 'alice/anime#v1.2')
  assert.equal(parseSource('https://github.com/alice/anime.git#release/2'), 'alice/anime#release/2')
  for (const bad of ['alice/anime#', 'alice/anime#a..b', 'alice/anime#-x', 'alice/anime#x/', 'alice/anime#a#b']) {
    assert.throws(() => parseSource(bad), /is not a market/, bad)
  }
  assert.equal(repoOf('alice/anime#v1'), 'alice/anime')
  assert.equal(refOf('alice/anime#v1'), 'v1')
  assert.equal(refOf('alice/anime'), undefined)
  assert.equal(repoOf('/srv/mark#et'), '/srv/mark#et')
  assert.equal(archiveUrl('alice/anime'), 'https://codeload.github.com/alice/anime/tar.gz/HEAD')
  assert.equal(archiveUrl('alice/anime#release/2'), 'https://codeload.github.com/alice/anime/tar.gz/release/2')
  assert.equal(cachePath('/c', 'alice/anime#v1'), cachePath('/c', 'alice/anime'))
  assert.ok(sameMarket('alice/anime#v1', 'alice/anime'))
  assert.ok(!sameMarket('alice/anime', 'alice/other'))
})

test('the official catalog updates on its own unless turned off, a repository only once turned on', () => {
  assert.equal(autoUpdates(OFFICIAL, undefined), true)
  assert.equal(autoUpdates(OFFICIAL, { official: false }), false)
  assert.equal(autoUpdates('alice/anime', undefined), false)
  assert.equal(autoUpdates('alice/anime', { 'alice/anime': true }), true)
  assert.equal(autoUpdates('/srv/market', { '/srv/market': true }), false)
})

test('a market shows as its repository, or its folder under ~ when it sits in the home directory', () => {
  assert.equal(shownSource('alice/anime'), 'github.com/alice/anime')
  assert.equal(shownSource('alice/anime#v1'), 'github.com/alice/anime#v1')
  assert.equal(shownSource(join(homedir(), '.config/ttheme/market')), '~/.config/ttheme/market')
  assert.equal(shownSource('/srv/market'), '/srv/market')
})
