import assert from 'node:assert/strict'
import { test } from 'node:test'
import { modeOf } from './mode.ts'
import type { Colors } from './seeds.ts'
import { follow, following, moves } from './upstream.ts'

const dark: Colors = {
  background: '#101010',
  foreground: '#e0e0e0',
  cursor: '#ff8800',
  selection: '#303030',
  ansi: Array.from({ length: 16 }, (_, i) => `#${(0x40 + i * 8).toString(16).repeat(3)}`),
}

const light: Colors = { ...dark, background: '#f8f8f8', foreground: '#202020' }

const withAnsi = (colors: Colors, slot: number, hex: string): Colors => ({
  ...colors,
  ansi: colors.ansi.map((c, i) => (i === slot ? hex : c)),
})

test('each color takes the upstream change you did not make, keeps yours, and a color both changed is a conflict', () => {
  const mine = { ...withAnsi(dark, 1, '#aa0000'), cursor: '#00ff00' }
  const theirs = { ...withAnsi(withAnsi(dark, 2, '#00aa00'), 1, '#aa0000'), cursor: '#0000ff', foreground: '#ffffff' }
  const done = follow(mine, dark, theirs)

  assert.equal(done.colors.foreground, '#ffffff')
  assert.equal(done.colors.ansi[2], '#00aa00')
  assert.equal(done.colors.ansi[1], '#aa0000')
  assert.equal(done.colors.cursor, '#00ff00')
  assert.deepEqual(done.taken, [1, 6])
  assert.deepEqual(done.conflicts, [2])
  assert.equal(done.base.ansi[1], '#aa0000')
  assert.equal(done.base.cursor, dark.cursor)
  assert.equal(done.base.foreground, '#ffffff')
})

test('a palette follows its upstream mode by mode, and moves on only when the upstream moved', () => {
  const mine = { colors: dark, other: withAnsi(light, 4, '#123456') }
  const upstream = { palette: 'ttheme/orla', colors: dark, other: light }
  const still = following(mine, upstream, { colors: dark, other: light })

  assert.ok(still)
  assert.equal(moves(upstream, still), false)

  const done = following(mine, upstream, { colors: dark, other: withAnsi(light, 5, '#654321') })

  assert.ok(done)
  assert.equal(moves(upstream, done), true)
  assert.equal(done.sides.other?.ansi[5], '#654321')
  assert.equal(done.sides.other?.ansi[4], '#123456')
  assert.equal(done.upstream.other?.ansi[5], '#654321')
  assert.deepEqual(done.conflicts, [])
  assert.equal(following(mine, { palette: 'ttheme/orla' }, { colors: dark }), undefined)
})

test('a merge never turns a palette or its base into the other mode: its background and foreground wait as a conflict', () => {
  const mine = { ...dark, foreground: '#606060' }
  const theirs = withAnsi({ ...dark, background: '#909090' }, 3, '#abcdef')
  const done = follow(mine, dark, theirs)

  assert.equal(done.colors.background, dark.background)
  assert.equal(done.colors.foreground, '#606060')
  assert.equal(done.base.background, dark.background)
  assert.deepEqual(done.conflicts, [0, 1])
  assert.deepEqual(done.taken, [7])
  assert.equal(done.colors.ansi[3], '#abcdef')
  assert.deepEqual(follow(done.colors, done.base, theirs).conflicts, [0, 1])

  const movedBase = follow({ ...dark, foreground: '#f8f8f8' }, dark, {
    ...dark,
    background: '#f0f0f0',
    foreground: '#fafafa',
  })

  assert.equal(modeOf(movedBase.base), 'dark')
  assert.equal(movedBase.colors.background, dark.background)
  assert.equal(movedBase.base.background, dark.background)
  assert.deepEqual(movedBase.conflicts, [0, 1])

  const sameBackground = follow({ ...dark, background: '#f0f0f0', foreground: '#fafafa' }, dark, {
    ...dark,
    background: '#f0f0f0',
    foreground: '#fcfcfc',
  })

  assert.equal(modeOf(sameBackground.base), 'dark')
  assert.deepEqual(sameBackground.conflicts, [1])
})

test('following a parent keeps the copy readable when the two changed its background and foreground apart', () => {
  const mine = { colors: { ...dark, foreground: '#606060' }, other: light }
  const upstream = { palette: 'ttheme/orla', colors: dark, other: light }
  const done = following(mine, upstream, { colors: { ...dark, background: '#909090' }, other: light })

  assert.ok(done)
  assert.equal(modeOf(done.sides.colors), 'dark')
  assert.equal(moves(upstream, done), false)
  assert.deepEqual(done.conflicts, [{ mode: 'dark', slots: [0, 1] }])
})
