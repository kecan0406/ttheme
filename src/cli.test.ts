import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EMITTED } from './build.ts'
import { Missing } from './catalog.ts'
import { isCrash, parse, UsageError, VERBS } from './cli.ts'
import { WIRED } from './terminals/types.ts'

test('build --only rejects unknown terminals', () => {
  assert.throws(() => parse(['build', '--only', 'vscode']), UsageError)
})

test('build --only offers every terminal', () => {
  assert.deepEqual(EMITTED, [...WIRED])
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
    ['preview', 'use', 'next', 'pin', 'unpin', 'pins', 'config'],
  )
  assert.ok(VERBS.filter((v) => v.shell).every((v) => !v.run))
})

test('only a crash points to ttheme info, never a message written for the user', () => {
  assert.ok(isCrash(new TypeError("Cannot read properties of undefined (reading 'ansi')")))
  assert.ok(isCrash(Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })))
  assert.ok(!isCrash(new Error('not installed: kita')))
  assert.ok(!isCrash(new Missing('nothing at https://example.com')))
  assert.ok(!isCrash('a string'))
})

test('init rejects unknown options', () => {
  assert.throws(() => parse(['init', '--frobnicate']), UsageError)
})
