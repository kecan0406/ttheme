import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TERMINALS } from './build.ts'
import { parse, UsageError, VERBS } from './cli.ts'

test('build --only rejects unknown terminals', () => {
  assert.throws(() => parse(['build', '--only', 'vscode']), UsageError)
})

test('build --only offers every terminal', () => {
  assert.deepEqual(TERMINALS, ['ghostty', 'kitty', 'alacritty', 'wezterm', 'iterm2', 'windows-terminal', 'warp'])
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

test('the catalog verbs are registered alongside build and init', () => {
  assert.deepEqual(VERBS.map((v) => v.name).sort(), [
    'add',
    'browse',
    'build',
    'default',
    'find',
    'image',
    'init',
    'list',
    'remove',
    'update',
  ])
})

test('init rejects unknown options', () => {
  assert.throws(() => parse(['init', '--frobnicate']), UsageError)
})
