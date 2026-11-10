import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { Pace } from './pace.ts'

test('a preview that never comes is waited on only while others keep coming', async () => {
  const never = new Promise<void>(() => {})
  const quieted: string[] = []
  const pace = new Pace(200, new AbortController().signal, (from) => quieted.push(from))
  const started = Date.now()
  const waited = pace.wait('files.test', never)
  await sleep(120)
  pace.came('files.test')
  assert.equal(await waited, false)
  assert.ok(Date.now() - started >= 300, 'a preview that came put the wait off')
  assert.equal(pace.still('files.test'), false, 'a site that sent something is not quiet for one late preview')

  assert.equal(await pace.wait('files.test', Promise.resolve()), true)

  const since = Date.now()
  assert.equal(await pace.wait('files.test', never), false)
  assert.ok(Date.now() - since >= 190)
  assert.equal(pace.still('files.test'), true, 'a site that sent nothing all that while is quiet')
  assert.deepEqual(quieted, ['files.test'])

  let back = false

  pace.wait('files.test', never).then(() => {
    back = true
  })

  await new Promise((turn) => setImmediate(turn))
  assert.ok(back, 'a quiet site is not waited on again')

  pace.came('files.test')
  assert.equal(pace.still('files.test'), false, 'until one of its previews comes')
})
