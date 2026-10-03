import assert from 'node:assert/strict'
import { test } from 'node:test'

import { advise } from './notice.ts'

function heard(isTTY: boolean | undefined, lines: string[]): string[] {
  const written: string[] = []
  const write = process.stderr.write
  const tty = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY')
  process.stderr.write = ((chunk: string) => {
    written.push(chunk)
    return true
  }) as typeof process.stderr.write
  Object.defineProperty(process.stderr, 'isTTY', { value: isTTY, configurable: true })
  try {
    advise(lines)
  } finally {
    process.stderr.write = write
    if (tty) {
      Object.defineProperty(process.stderr, 'isTTY', tty)
    } else {
      delete (process.stderr as { isTTY?: boolean }).isTTY
    }
  }
  return written
}

test('advice reaches a person on stderr, one line each, and nobody else', () => {
  assert.deepEqual(heard(true, ['one', 'two']), ['one\ntwo\n'])
  assert.deepEqual(heard(false, ['one']), [])
  assert.deepEqual(heard(undefined, ['one']), [])
  assert.deepEqual(heard(true, []), [])
})
