import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readBooruSites } from './theme.ts'

test('booru_sites renames the tag per site, as one tag or a list, and an empty list skips the site', () => {
  assert.deepEqual(
    readBooruSites(
      'moon.toml',
      { yande: 'tsukino_usagi', konachan: ['tsukino_usagi', 'sailor_moon_(character)'], danbooru: 'sailor_moon' },
      'sailor_moon',
    ),
    { yande: ['tsukino_usagi'], konachan: ['tsukino_usagi', 'sailor_moon_(character)'], danbooru: ['sailor_moon'] },
  )
  assert.deepEqual(readBooruSites('sukuna.toml', { yande: [] }, 'ryoumen_sukuna_(jujutsu_kaisen)'), { yande: [] })
  assert.equal(readBooruSites('x.toml', undefined, 'x'), undefined)
})

test('booru_sites refuses an unknown site, a tag with a space, a list where the site counts tags, and no meta.booru', () => {
  assert.throws(() => readBooruSites('x.toml', { gelbooru: 'x' }, 'x'), /not a find site/)
  assert.throws(() => readBooruSites('x.toml', { yande: 'two words' }, 'x'), /one tag or a list/)
  assert.throws(() => readBooruSites('x.toml', { danbooru: ['a', 'b'] }, 'x'), /takes one tag/)
  assert.throws(() => readBooruSites('x.toml', { yande: 'y' }, undefined), /needs meta.booru/)
})
