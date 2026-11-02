import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Missing } from '../store/available.ts'
import { failureOf, InputError } from './answer.ts'
import { isCrash, parse, UsageError, VERBS } from './cli.ts'
import { runMarketplace } from './marketplaces.ts'
import { runWire } from './wire.ts'

test('build --only rejects unknown terminals', () => {
  assert.throws(() => parse(['build', '--only', 'vscode']), UsageError)
})

test('build --only takes terminals one by one', () => {
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
  assert.deepEqual(parse(['-v']), { kind: 'version' })
})

test('every verb either runs here or belongs to the shell layer', () => {
  assert.deepEqual(
    VERBS.filter((v) => !v.run).map((v) => v.name),
    ['use', 'pin', 'unpin', 'pins', 'config', 'auto', 'light', 'dark'],
  )
  assert.ok(VERBS.filter((v) => v.shell).every((v) => !v.run))
})

test('only a crash points to ttheme info, never a message written for the user', () => {
  assert.ok(isCrash(new TypeError("Cannot read properties of undefined (reading 'ansi')")))
  assert.ok(isCrash(Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })))
  assert.ok(!isCrash(new Error('not installed: orla')))
  assert.ok(!isCrash(new Missing('nothing at https://example.com')))
})

test('a full or read-only disk is the machine, never a bug to report', () => {
  for (const code of ['EACCES', 'EPERM', 'EROFS', 'ENOSPC']) {
    assert.ok(!isCrash(Object.assign(new Error(`${code}: cannot write`), { code })))
  }
})

test('--help wins over any other argument, up to a --', () => {
  const add = VERBS.find((v) => v.name === 'add')
  assert.deepEqual(parse(['add', '--frobnicate', '--help']), { kind: 'help', verb: add })
  assert.deepEqual(parse(['add', '--in', '-h']), { kind: 'help', verb: add })
  assert.deepEqual(parse(['add', '--', '--help']), { kind: 'run', verb: add, args: ['--help'], flags: {} })
})

test('init rejects unknown options', () => {
  assert.throws(() => parse(['init', '--frobnicate']), UsageError)
})

test('an action or a terminal a verb does not know is invalid input, not a failure', async () => {
  for (const asked of [
    runMarketplace('frobnicate', undefined),
    runMarketplace('add', undefined),
    runWire('frobnicate'),
  ]) {
    const error = await asked.then(
      () => assert.fail('it ran'),
      (thrown: Error) => thrown,
    )

    assert.ok(error instanceof InputError)
    assert.equal(failureOf(error, false).code, 3)
  }
})
