import assert from 'node:assert/strict'
import { test } from 'node:test'

import { runnerOf } from './runner.ts'

test('a run under bunx is bunx, and under npm, pnpm or no runner at all npx', () => {
  assert.equal(runnerOf('bun/1.3.0 npm/? node/v24.3.0 linux x64'), 'bunx')
  assert.equal(runnerOf('npm/10.9.0 node/v22.12.0 linux x64 workspaces/false'), 'npx')
  assert.equal(runnerOf('pnpm/10.0.0 npm/? node/v22.12.0 linux x64'), 'npx')
  assert.equal(runnerOf(undefined), 'npx')
})
