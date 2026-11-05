import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import type { Inbound, Mouse } from './keys.ts'
import { IDLE, pointing, Terminal } from './terminal.ts'

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

test('a move goes to the hover and never to the screen, and a key after it puts the hover out', async () => {
  const { input, output, settle } = streams()
  const terminal = new Terminal({ input, output, modes: pointing({}) })
  const hovers: (Mouse | undefined)[] = []
  const taken: Inbound[] = []
  terminal.onHover((event) => hovers.push(event))
  terminal.listen((events) => taken.push(...events))
  input.write('\x1b[<35;5;2M\x1b[<35;6;2M')
  await settle()
  assert.deepEqual(
    hovers.map((event) => [event?.row, event?.col]),
    [[1, 5]],
  )
  assert.deepEqual(taken, [])
  input.write('x')
  await settle()
  assert.equal(hovers.at(-1), undefined)
  assert.equal(taken.length, 1)
  terminal.close()
})

test('leaving, the mouse goes off and what the terminal sent before it read that is dropped, not left for the shell', async () => {
  const { input, output, count, settle } = streams()
  const terminal = new Terminal({ input, output, modes: pointing({}) })
  const taken: Inbound[] = []
  terminal.listen((events) => taken.push(...events))
  let settled = false

  const leaving = terminal.settle().then(() => {
    settled = true
  })

  await settle()
  assert.equal(count('\x1b[?1003l'), 1)
  assert.equal(count('\x1b[5n'), 1)
  input.write('\x1b[<35;5;2M\x1b[<0;5;2M\x1b[<0;5;2mq')
  await settle()
  assert.equal(settled, false)
  input.write('\x1b[0n')
  await leaving
  assert.deepEqual(taken, [])
  terminal.close()
})

test('a terminal that never answers is not waited on for long, and one that never took the mouse is not asked', async () => {
  const silent = streams()
  const terminal = new Terminal({ input: silent.input, output: silent.output, modes: pointing({}) })
  await terminal.settle()
  terminal.close()
  const plain = streams()
  const other = new Terminal({ input: plain.input, output: plain.output, modes: pointing({ TTHEME_MOUSE: 'off' }) })
  await other.settle()
  assert.equal(plain.count('\x1b[5n'), 0)
  other.close()
})

test('over ssh the mouse takes clicks and drags and asks for no moves', () => {
  const [mode] = pointing({ SSH_CONNECTION: '10.0.0.1 22 10.0.0.2 22' })
  assert.ok(mode && !mode.on.includes('1003'))
  assert.ok(mode.off.includes(IDLE), 'a press over ssh still sets the hand, so leaving puts the arrow back')
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
