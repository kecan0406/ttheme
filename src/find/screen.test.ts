import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { stepped, transmit } from './screen.ts'

test('a step from a typed value goes to the nearest step that way, and steps wrap around', () => {
  const sizes = ['off', '720', '1080', '1440', '1800', '2560']
  assert.equal(stepped(sizes, '1600', 1), '1800')
  assert.equal(stepped(sizes, '1600', -1), '1440')
  assert.equal(stepped(sizes, '3000', 1), 'off')
  assert.equal(stepped(sizes, '2560', 1), 'off')
  assert.equal(stepped(sizes, 'off', -1), '2560')
})

test('transmit sends the picture itself, in chunks, to a terminal that reads no files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-transmit-'))
  const path = join(dir, 'p.png')
  const bytes = Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 256))
  writeFileSync(path, bytes)
  const p = { id: 9, path, row: 0, col: 0, cols: 4, rows: 2, z: -1 }
  assert.equal(transmit(p), `\x1b_Ga=t,t=f,f=100,i=9,q=2;${Buffer.from(path).toString('base64')}\x1b\\`)
  const sent = transmit(p, false) ?? ''
  const chunks = sent.split('\x1b_G').slice(1)
  assert.ok(chunks[0]?.startsWith('a=t,f=100,i=9,m=1,q=2;'))
  assert.ok(chunks.at(-1)?.startsWith('m=0,q=2;'))
  const data = chunks.map((chunk) => chunk.slice(chunk.indexOf(';') + 1, -2)).join('')
  assert.deepEqual(Buffer.from(data, 'base64'), bytes)
  assert.equal(transmit({ ...p, path: join(dir, 'gone.png') }, false), undefined)
})
