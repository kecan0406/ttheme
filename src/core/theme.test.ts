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
  assert.equal(nameProblem('ttheme/orla'), undefined)
  assert.equal(nameProblem('kumquat09@dust/wren-2'), undefined)

  for (const bad of [
    'orla',
    'Orla',
    'ttheme/-orla',
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

  assert.equal(stem('kumquat09@dust/wren'), 'kumquat09--dust--wren')
  assert.equal(stem('ttheme/wren'), 'ttheme--wren')
  assert.equal(publisherOf('kumquat09@dust/wren'), 'kumquat09@dust')
  assert.equal(publisherOf('ttheme/orla'), 'ttheme')
  assert.equal(isBuiltin('ttheme/orla'), true)
  assert.equal(isBuiltin('ttheme@dust/orla'), false)
  assert.equal(slugOf('kumquat09@dust/wren'), 'wren')
})

test('a subject is a work, or a work and one of its characters', () => {
  assert.equal(subjectProblem('starfall'), undefined)
  assert.equal(subjectProblem('starfall/wren'), undefined)
  assert.equal(workIdOf('starfall/wren'), 'starfall')
  assert.equal(characterIdOf('starfall/wren'), 'wren')
  assert.equal(characterIdOf('starfall'), undefined)

  for (const bad of ['', 'Starfall', 'a/b/c', 'ttheme', 'ttheme/wren', 'star wren', 'star/', '/wren']) {
    assert.notEqual(subjectProblem(bad), undefined, bad)
  }
})

test('free text that would break a config line or zsh quoting is refused', () => {
  assert.equal(textProblem('Glass Arcade'), undefined)

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

const place = { name: 'kai@dust/dusk' }

test('a palette names its subject and the palette it was copied from at the top', () => {
  const theme = readTheme('dusk', palette('subject = "neon/dusk"\nupstream.palette = "ttheme/orla"'), place)
  assert.equal(theme.name, 'kai@dust/dusk')
  assert.equal(theme.subject, 'neon/dusk')
  assert.deepEqual(theme.upstream, { palette: 'ttheme/orla' })
  assert.equal(readTheme('d', palette(''), place).subject, undefined)
  assert.throws(() => readTheme('d', palette('subject = "Neon"'), place), /names a work/)
  assert.throws(() => readTheme('d', palette('upstream.palette = "orla"'), place), /lowercase letters/)
  assert.throws(
    () => readTheme('d', palette('subject = "neon\\u001b]52;c;aGk=\\u0007"'), place),
    (error: Error) => !error.message.includes('\x1b') && !error.message.includes('\x07'),
  )
})

test('[[picture]] takes a known site, a post number and an optional framing', () => {
  const withPicture = (table: string) => `${palette('')}\n[[picture]]\n${table}\n`
  assert.deepEqual(readTheme('d', withPicture('site = "danbooru"\nid = 12\nsize = 130'), place).pictures, [
    { site: 'danbooru', id: 12, size: 130 },
  ])
  assert.throws(() => readTheme('d', withPicture('site = "pixiv"\nid = 12'), place), /site must be one of/)
  assert.throws(() => readTheme('d', withPicture('site = "danbooru"\nid = "12"'), place), /post's number/)
  assert.throws(() => readTheme('d', withPicture('site = "danbooru"\nid = 12\nsize = 5'), place), /size/)
  assert.throws(() => readTheme('d', withPicture('site = "danbooru"\nid = 12\nposition = "left"'), place), /position/)
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

  assert.deepEqual(readTheme('d', pictures, foreign).pictures, [{ site: 'danbooru', id: 12 }])
  assert.equal(readTheme('d', `${palette('')}\n[[picture]]\nsite = "pixiv"\nid = 3\n`, foreign).pictures, undefined)
})

test('a palette carries its other mode in [palette.colors.light] or [palette.colors.dark], whichever its [palette.colors] is not', () => {
  const gray = Array.from({ length: 16 }, () => '"#606060"').join(', ')

  const other = (table: string, background: string, foreground: string, cursor = '#a04060') =>
    `${palette('')}\n[${table}]\nbackground = "${background}"\nforeground = "${foreground}"\ncursor = "${cursor}"\nselection_background = "#c0c0e0"\nansi = [${gray}]\n`

  assert.equal(readTheme('d', palette(''), place).other, undefined)
  assert.equal(readTheme('d', other('colors.light', '#fafafa', '#202020'), place).other?.background, '#fafafa')
  assert.throws(() => readTheme('d', other('colors.dark', '#050505', '#f0f0f0'), place), /already dark/)
  assert.throws(() => readTheme('d', other('colors.light', '#202020', '#fafafa'), place), /must be light/)
  assert.throws(
    () => readTheme('d', other('colors.light', '#fafafa', '#202020', '#fafafa'), place),
    /three colors that differ in \[palette\.colors\.light\]/,
  )
})

test('a built-in palette carries its other mode', () => {
  const builtin = { name: 'ttheme/dusk', builtin: true as const }
  assert.throws(
    () => readTheme('d', palette(''), builtin),
    /built-in palette carries its other mode in \[palette\.colors\.light\]/,
  )
  const light = `\n[colors.light]\nbackground = "#fafafa"\nforeground = "#202020"\ncursor = "#a04060"\nselection_background = "#c0c0e0"\nansi = [${Array.from({ length: 16 }, () => '"#606060"').join(', ')}]\n`
  assert.equal(readTheme('d', `${palette('')}${light}`, builtin).other?.background, '#fafafa')
})
