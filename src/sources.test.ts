import assert from 'node:assert/strict'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { OFFICIAL, parseSource, shownSource } from './sources.ts'

test('a market is named by a handle, a repository, a path or official', () => {
  assert.equal(parseSource('Alice'), 'alice/ttheme-palettes')
  assert.equal(parseSource('alice/anime'), 'alice/anime')
  assert.equal(parseSource('https://github.com/alice/anime.git'), 'alice/anime')
  assert.equal(parseSource('./mine', '/work'), '/work/mine')
  assert.equal(parseSource('/srv/market'), '/srv/market')
  assert.equal(parseSource('~/market'), join(homedir(), 'market'))
  assert.equal(parseSource('official'), OFFICIAL)
  for (const bad of ['a/b/c', '-alice', 'al ice', 'alice/../x']) {
    assert.throws(() => parseSource(bad), /is not a market/, bad)
  }
})

test('a market shows as its repository, or its folder under ~ when it sits in the home directory', () => {
  assert.equal(shownSource('alice/anime'), 'github.com/alice/anime')
  assert.equal(shownSource(join(homedir(), '.config/ttheme/market')), '~/.config/ttheme/market')
  assert.equal(shownSource('/srv/market'), '/srv/market')
})
