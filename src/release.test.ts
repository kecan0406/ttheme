import assert from 'node:assert/strict'
import { test } from 'node:test'
import { autoWanted, isNewer } from './release.ts'

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
