import assert from 'node:assert/strict'
import { test } from 'node:test'
import { standingLine } from './notice.ts'
import { autoWanted, isNewer, standingOf } from './release.ts'

test('isNewer compares releases part by part and stays quiet about a version that is not a plain release', () => {
  assert.equal(isNewer('1.0.51', '1.0.50'), true)
  assert.equal(isNewer('1.1.0', '1.0.99'), true)
  assert.equal(isNewer('2.0.0', '1.99.99'), true)
  assert.equal(isNewer('1.0.10', '1.0.9'), true)
  assert.equal(isNewer('1.0.50', '1.0.50'), false)
  assert.equal(isNewer('1.0.49', '1.0.50'), false)
  assert.equal(isNewer('1.0.51-rc.1', '1.0.50'), false)
  assert.equal(isNewer('1.0.51', 'dev'), false)
})

test('nothing is checked in the background with TTHEME_AUTO_UPDATE off or on CI', () => {
  assert.equal(autoWanted({}), true)
  assert.equal(autoWanted({ CI: 'false' }), true)
  assert.equal(autoWanted({ TTHEME_AUTO_UPDATE: 'off' }), false)
  assert.equal(autoWanted({ CI: 'true' }), false)
})

test('a release check stands as under way, failed, newer, current or unknown by what its stamp holds', () => {
  const now = 1_000_000
  assert.equal(standingOf({ checked: now, trying: now - 5_000 }, now, '1.2.29'), 'checking')
  assert.equal(standingOf({ checked: now, trying: now - 40_000, latest: '1.2.29' }, now, '1.2.29'), 'current')
  assert.equal(standingOf({ checked: now, trying: now - 5_000, failed: now - 90_000 }, now, '1.2.29'), 'checking')
  assert.equal(standingOf({ checked: now, failed: now, latest: '1.2.30' }, now, '1.2.29'), 'failed')
  assert.equal(standingOf({ checked: now, latest: '1.2.30' }, now, '1.2.29'), 'newer')
  assert.equal(standingOf({ checked: now, latest: '1.2.28' }, now, '1.2.29'), 'current')
  assert.equal(standingOf({ checked: now }, now, '1.2.29'), 'unknown')
})

test('the standing line names the running release and, when there is one, the newer', () => {
  assert.equal(standingLine('unknown', '1.2.29', '1.2.30'), 'ttheme 1.2.29')
  assert.equal(standingLine('checking', '1.2.29'), 'ttheme 1.2.29  checking…')
  assert.equal(standingLine('current', '1.2.29', '1.2.29'), 'ttheme 1.2.29  ✓ up to date')
  assert.equal(standingLine('newer', '1.2.29', '1.2.30'), 'ttheme 1.2.29  ⇡ 1.2.30 available')
  assert.equal(standingLine('failed', '1.2.29'), 'ttheme 1.2.29  ✗ check failed')
})
