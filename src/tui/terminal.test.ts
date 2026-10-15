import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import { Terminal } from './terminal.ts'

function streams() {
  const order: string[] = []

  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode: (on: boolean) => {
      order.push(`raw ${on}`)

      return input
    },
  })

  const output = Object.assign(new PassThrough(), { isTTY: true, columns: 80, rows: 24 })
  let written = ''
  output.on('data', (chunk) => {
    written += String(chunk)

    if (String(chunk).includes('\x1b[?u')) {
      order.push('query')
    }
  })
  const count = (text: string) => written.split(text).length - 1
  const settle = () => new Promise((resolve) => setImmediate(resolve))

  return { input, output, count, settle, order }
}

test('the kitty keyboard flags are pushed once, after the terminal answers, and popped when the last screen closes', async () => {
  const { input, output, count, settle, order } = streams()
  const outer = new Terminal({ input, output })
  await settle()
  assert.equal(count('\x1b[?u'), 1)
  assert.ok(order.indexOf('raw true') < order.indexOf('query'), `the terminal is raw before it is asked: ${order}`)
  assert.equal(count('\x1b[>5u'), 0)
  input.write('\x1b[?0u')
  await settle()
  input.write('\x1b[?5u')
  await settle()
  assert.equal(count('\x1b[>5u'), 1)
  const inner = new Terminal({ input, output })
  input.write('\x1b[?5u')
  await settle()
  assert.equal(count('\x1b[>5u'), 1)
  inner.close()
  assert.equal(count('\x1b[<u'), 0)
  outer.reassert()
  assert.equal(count('\x1b[>5u'), 1)
  outer.close()
  assert.equal(count('\x1b[<u'), 1)
})

test('a terminal that never answers the keyboard query is never sent flags to pop', async () => {
  const { input, output, count, settle } = streams()
  const terminal = new Terminal({ input, output })
  input.write('\x1b[A')
  await settle()
  terminal.close()
  assert.equal(count('\x1b[>5u'), 0)
  assert.equal(count('\x1b[<u'), 0)
})
