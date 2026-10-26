import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  characterIdOf,
  isBuiltin,
  nameProblem,
  publisherOf,
  readTheme,
  slugOf,
  stem,
  subjectProblem,
  textProblem,
  workIdOf,
} from './theme.ts'

const RLO = String.fromCodePoint(0x202e)
const LRI = String.fromCodePoint(0x2066)

test('a palette name is its marketplace and a slug, the built-in marketplace being ttheme', () => {
  assert.equal(nameProblem('ttheme/madoka'), undefined)
  assert.equal(nameProblem('kecan0406@dust/rei-2'), undefined)

  for (const bad of [
    'madoka',
    'Madoka',
    'ttheme/-madoka',
    'ttheme/a--b',
    'a/b',
    'a@b',
    'a@b/c/d',
    '../x',
    'ttheme/a b',
    `${'a'.repeat(40)}@b/c`,
    'ttheme/a"b',
  ]) {
    assert.notEqual(nameProblem(bad), undefined, bad)
  }

  assert.equal(stem('kecan0406@dust/rei'), 'kecan0406--dust--rei')
  assert.equal(stem('ttheme/rei'), 'ttheme--rei')
  assert.equal(publisherOf('kecan0406@dust/rei'), 'kecan0406@dust')
  assert.equal(publisherOf('ttheme/madoka'), 'ttheme')
  assert.equal(isBuiltin('ttheme/madoka'), true)
  assert.equal(isBuiltin('ttheme@dust/madoka'), false)
  assert.equal(slugOf('kecan0406@dust/rei'), 'rei')
})

test('a subject is a work, or a work and one of its characters', () => {
  assert.equal(subjectProblem('evangelion'), undefined)
  assert.equal(subjectProblem('evangelion/rei'), undefined)
  assert.equal(workIdOf('evangelion/rei'), 'evangelion')
  assert.equal(characterIdOf('evangelion/rei'), 'rei')
  assert.equal(characterIdOf('evangelion'), undefined)

  for (const bad of ['', 'Evangelion', 'a/b/c', 'ttheme', 'ttheme/rei', 'eva rei', 'eva/', '/rei']) {
    assert.notEqual(subjectProblem(bad), undefined, bad)
  }
})

test('free text that would break a config line or zsh quoting is refused', () => {
  assert.equal(textProblem('Sword Art Online'), undefined)

  for (const bad of ['a\nb', 'a"b', 'a$b', 'a`b', 'a\\b', 'x'.repeat(81), `ab${RLO}cd`, `ab${LRI}cd`]) {
    assert.notEqual(textProblem(bad), undefined, JSON.stringify(bad))
  }
})

const palette = (head: string) => `${head}
signature = ["cursor", "foreground", "background"]

[colors]
background = "#101010"
foreground = "#f0f0f0"
cursor = "#e0c060"
selection_background = "#303060"
ansi = [${Array.from({ length: 16 }, () => '"#808080"').join(', ')}]
`

const place = { name: 'kec@dust/dusk' }

test('a palette names its subject and where it was copied from at the top, and its slug is its file', () => {
  const theme = readTheme('dusk.toml', palette('subject = "neon/dusk"\nfrom = "ttheme/madoka"'), place)
  assert.equal(theme.name, 'kec@dust/dusk')
  assert.equal(theme.subject, 'neon/dusk')
  assert.equal(theme.from, 'ttheme/madoka')
  assert.equal(theme.ansiSource, 'original')
  assert.equal(readTheme('d.toml', palette(''), place).subject, undefined)
  assert.throws(() => readTheme('d.toml', palette('subject = "Neon"'), place), /names a work/)
  assert.throws(() => readTheme('d.toml', palette('from = "madoka"'), place), /lowercase letters/)
  assert.throws(
    () => readTheme('d.toml', palette('subject = "neon\\u001b]52;c;aGk=\\u0007"'), place),
    (error: Error) => !error.message.includes('\x1b') && !error.message.includes('\x07'),
  )
})

test('[[picture]] takes a known site, a post number and an optional framing', () => {
  const withPicture = (table: string) => `${palette('')}\n[[picture]]\n${table}\n`
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

test('a palette another ttheme wrote drops the picture sites and framings this one does not know instead of refusing the palette', () => {
  const foreign = { ...place, foreign: true as const }

  const pictures = `${palette('')}
[[picture]]
site = "pixiv"
id = 3

[[picture]]
site = "danbooru"
id = 12
position = "left"
`

  assert.deepEqual(readTheme('d.toml', pictures, foreign).pictures, [{ site: 'danbooru', id: 12 }])
  assert.equal(
    readTheme('d.toml', `${palette('')}\n[[picture]]\nsite = "pixiv"\nid = 3\n`, foreign).pictures,
    undefined,
  )
})

test('a palette carries its other mode in [colors.light] or [colors.dark], whichever its [colors] is not', () => {
  const gray = Array.from({ length: 16 }, () => '"#606060"').join(', ')

  const other = (table: string, background: string, foreground: string, cursor = '#a04060') =>
    `${palette('')}\n[${table}]\nbackground = "${background}"\nforeground = "${foreground}"\ncursor = "${cursor}"\nselection_background = "#c0c0e0"\nansi = [${gray}]\n`

  assert.equal(readTheme('d.toml', palette(''), place).other, undefined)
  assert.equal(readTheme('d.toml', other('colors.light', '#fafafa', '#202020'), place).other?.background, '#fafafa')
  assert.throws(() => readTheme('d.toml', other('colors.dark', '#050505', '#f0f0f0'), place), /already dark/)
  assert.throws(() => readTheme('d.toml', other('colors.light', '#202020', '#fafafa'), place), /must be light/)
  assert.throws(
    () => readTheme('d.toml', other('colors.light', '#fafafa', '#202020', '#fafafa'), place),
    /three colors that differ in \[colors\.light\]/,
  )
})

test('a built-in palette carries its other mode and names where its ANSI colors came from', () => {
  const builtin = { name: 'ttheme/dusk', builtin: true as const }
  assert.throws(
    () => readTheme('d.toml', palette('ansi_source = "Neon"'), builtin),
    /built-in palette carries its other mode in \[colors\.light\]/,
  )
  const light = `\n[colors.light]\nbackground = "#fafafa"\nforeground = "#202020"\ncursor = "#a04060"\nselection_background = "#c0c0e0"\nansi = [${Array.from({ length: 16 }, () => '"#606060"').join(', ')}]\n`
  assert.equal(readTheme('d.toml', `${palette('ansi_source = "Neon"')}${light}`, builtin).ansiSource, 'Neon')
  assert.throws(() => readTheme('d.toml', `${palette('')}${light}`, builtin), /ansi_source must be a non-empty string/)
})
