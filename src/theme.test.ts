import assert from 'node:assert/strict'
import { test } from 'node:test'

import { marketOf, nameProblem, ORIGINAL, readBooruSites, readTheme, slugOf, stem, textProblem } from './theme.ts'

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

test('a palette name is a slug, or a market and a slug', () => {
  assert.equal(nameProblem('madoka'), undefined)
  assert.equal(nameProblem('kecan0406@dust/rei-2'), undefined)
  for (const bad of [
    'Madoka',
    '-madoka',
    'a--b',
    'a/b',
    'a@b',
    'a@b/c/d',
    '../x',
    'a b',
    `${'a'.repeat(40)}@b/c`,
    'a"b',
  ]) {
    assert.notEqual(nameProblem(bad), undefined, bad)
  }
  assert.equal(stem('kecan0406@dust/rei'), 'kecan0406--dust--rei')
  assert.equal(marketOf('kecan0406@dust/rei'), 'kecan0406@dust')
  assert.equal(marketOf('madoka'), undefined)
  assert.equal(slugOf('kecan0406@dust/rei'), 'rei')
  assert.equal(slugOf('madoka'), 'madoka')
})

test('free text that would break a config line or zsh quoting is refused', () => {
  assert.equal(textProblem('Sword Art Online'), undefined)
  for (const bad of ['a\nb', 'a"b', 'a$b', 'a`b', 'a\\b', 'x'.repeat(81)]) {
    assert.notEqual(textProblem(bad), undefined, JSON.stringify(bad))
  }
})

const shared = (meta: string) => `[meta]
${meta}
signature = ["cursor", "foreground", "background"]

[colors]
background = "#101010"
foreground = "#f0f0f0"
cursor = "#e0c060"
selection_background = "#303060"
ansi = [${Array.from({ length: 16 }, () => '"#808080"').join(', ')}]
`

test('a market palette follows its base: group and order come from it, and its own order is refused', () => {
  const groups = new Map([['Madoka Magica', { name: 'Madoka Magica', lead: 'madoka' }]])
  const bases = new Map([['madoka', { group: 'Madoka Magica', order: 15 }]])
  const place = { name: 'dusk', groups, bases, open: true as const }
  const theme = readTheme('dusk.toml', shared('name = "dusk"\nbase = "madoka"'), place)
  assert.equal(theme.group, 'Madoka Magica')
  assert.equal(theme.order, 15)
  assert.equal(theme.ansiSource, 'madoka')
  assert.equal(readTheme('d.toml', shared('name = "dusk"'), place).group, ORIGINAL)
  assert.throws(() => readTheme('d.toml', shared('name = "dusk"\norder = 3'), place), /meta.order is for the official/)
  assert.throws(() => readTheme('d.toml', shared('name = "other"'), place), /does not match its file/)
  assert.equal(readTheme('d.toml', shared('name = "dusk"\nbase = "homura"'), place).base, 'homura')
  assert.throws(
    () => readTheme('d.toml', shared('name = "dusk"\nbase = "madoka"'), { name: 'dusk', groups }),
    /meta.base is for market palettes/,
  )
})

test('[[picture]] takes a known site, a post number and an optional framing', () => {
  const place = { name: 'dusk', groups: new Map(), open: true as const }
  const withPicture = (table: string) => `${shared('name = "dusk"')}\n[[picture]]\n${table}\n`
  assert.deepEqual(readTheme('d.toml', withPicture('site = "danbooru"\nid = 12\nsize = 130'), place).pictures, [
    { site: 'danbooru', id: 12, size: 130 },
  ])
  assert.throws(() => readTheme('d.toml', withPicture('site = "pixiv"\nid = 12'), place), /site must be one of/)
  assert.throws(() => readTheme('d.toml', withPicture('site = "danbooru"\nid = "12"'), place), /post's number/)
  assert.throws(() => readTheme('d.toml', withPicture('site = "danbooru"\nid = 12\nsize = 5'), place), /size/)
  assert.throws(
    () => readTheme('d.toml', withPicture('site = "danbooru"\nid = 12\nposition = "left"'), place),
    /position/,
  )
})
