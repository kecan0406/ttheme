import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { contrast, luminance } from './color.ts'
import { check, RULES } from './contrast.ts'
import { loadThemes, RESERVED_NAMES, rotation } from './theme.ts'

const themes = loadThemes(join(import.meta.dirname, '..', 'themes'))

test('color math matches known WCAG values', () => {
  assert.equal(luminance('#000000'), 0)
  assert.equal(luminance('#ffffff'), 1)
  assert.equal(Math.round(contrast('#ffffff', '#000000')), 21)
  assert.equal(contrast('#0e2124', '#39c5bb'), contrast('#39c5bb', '#0e2124'))
})

test('every theme passes the contrast gate', () => {
  const failures = themes.flatMap(check)
  assert.deepEqual(
    failures.map((v) => `${v.theme} [${v.rule}] ${v.detail}`),
    [],
  )
})

test('waivers name a real rule and carry a reason', () => {
  for (const theme of themes) {
    for (const rule of theme.waive) {
      assert.ok(RULES.includes(rule), `${theme.name} waives unknown rule "${rule}" — valid: ${RULES.join(', ')}`)
    }
    if (theme.waive.length > 0) {
      assert.ok(theme.waiveReason, `${theme.name} waives rules without a reason`)
    }
  }
})

test('palette data is structurally sound', () => {
  assert.ok(themes.length > 0, 'no themes loaded')
  for (const theme of themes) {
    assert.equal(theme.ansi.length, 16, `${theme.name} needs 16 ANSI colors`)
    assert.ok(theme.font.family.length > 0, `${theme.name} has no font family`)
    assert.ok(Number.isFinite(theme.font.size), `${theme.name} has no font size`)
  }
})

test('no palette name collides with a ttheme subcommand', () => {
  for (const theme of themes) {
    assert.ok(!RESERVED_NAMES.has(theme.name), `${theme.name} shadows the ttheme subcommand of the same name`)
  }
})

test('the rotation excludes the default role', () => {
  const names = rotation(themes).map((t) => t.name)
  assert.ok(!names.includes('neutral'), 'neutral must sit out of the rotation')
  assert.ok(names.length >= 1)
})
