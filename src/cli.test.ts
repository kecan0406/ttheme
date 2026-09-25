import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EMITTED } from './build.ts'
import { parse, UsageError, VERBS } from './cli.ts'
import { TERMINALS } from './verbs.ts'

test('build --only rejects unknown terminals', () => {
  assert.throws(() => parse(['build', '--only', 'vscode']), UsageError)
})

test('build --only offers every terminal', () => {
  assert.deepEqual(EMITTED, [...TERMINALS])
  assert.deepEqual(parse(['build', '--only', 'kitty', '--only', 'iterm2']), {
    kind: 'run',
    verb: VERBS.find((v) => v.name === 'build'),
    args: [],
    flags: { only: ['kitty', 'iterm2'] },
  })
})

test('unknown commands fail with a usage error', () => {
  assert.throws(() => parse(['paint']), UsageError)
})

test('--version is its own invocation', () => {
  assert.deepEqual(parse(['--version']), { kind: 'version' })
})

test('every verb either runs here or belongs to the shell layer', () => {
  assert.deepEqual(
    VERBS.filter((v) => !v.run).map((v) => v.name),
    ['preview', 'use', 'next', 'pin', 'unpin', 'config'],
  )
  assert.ok(VERBS.filter((v) => v.shell).every((v) => !v.run))
})

test('init rejects unknown options', () => {
  assert.throws(() => parse(['init', '--frobnicate']), UsageError)
})
