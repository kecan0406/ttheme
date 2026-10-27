import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BUILTIN_DIR, COMMONS_DIR, loadBuiltin, loadCommons } from '../cli/build.ts'
import { contrast, luminance } from './color.ts'
import { check, RULES } from './contrast.ts'
import { inOther } from './theme.ts'

const { themes } = loadBuiltin(BUILTIN_DIR, loadCommons(COMMONS_DIR))

test('color math matches known WCAG values', () => {
  assert.equal(luminance('#000000'), 0)
  assert.equal(luminance('#ffffff'), 1)
  assert.equal(Math.round(contrast('#ffffff', '#000000')), 21)
  assert.equal(contrast('#0e2124', '#39c5bb'), contrast('#39c5bb', '#0e2124'))
})

test('every theme passes the contrast gate in both modes', () => {
  const failures = [...themes, ...themes.flatMap(inOther)].flatMap(check)
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

test('an accent outside its ANSI role fails unless the signature names it', () => {
  const [theme] = themes
  assert.ok(theme)
  const ansi = [...theme.ansi]
  ansi[1] = theme.ansi[2] as string

  const roles = (signatureSlots: string[]) =>
    check({ ...theme, ansi, signatureSlots })
      .filter((v) => v.rule === 'ansi-role')
      .map((v) => v.detail)

  assert.equal(roles(['cursor', 'foreground', 'background']).length, 1)
  assert.deepEqual(roles(['cursor', 'foreground', 'ansi1']), [])
})
