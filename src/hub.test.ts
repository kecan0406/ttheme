import assert from 'node:assert/strict'
import { test } from 'node:test'

import { HUB_SWITCH, HUB_TABS, hubGoto, hubTarget } from './hub.ts'

test('a screen asks for the next or previous tab by exit status, wrapping at both ends', () => {
  const last = HUB_TABS[HUB_TABS.length - 1]?.name
  const first = HUB_TABS[0]?.name
  assert.ok(first && last)
  assert.equal(hubTarget(hubGoto(last, 1)), first)
  assert.equal(hubTarget(hubGoto(first, -1)), last)
  assert.equal(hubTarget(hubGoto('preview', 1)), 'browse')
  assert.equal(hubTarget(HUB_SWITCH), undefined)
  assert.equal(hubTarget(HUB_SWITCH + HUB_TABS.length + 1), undefined)
})
