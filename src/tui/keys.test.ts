import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CellProbe, decode, ESC_WAIT, type Inbound, Keys, keysOf } from './keys.ts'

function cellOf(input: string): { h: number; w: number } | undefined {
  const probe = new CellProbe()
  for (const event of decode(input).events) {
    const cell = probe.see(event)
    if (cell) {
      return cell
    }
  }
  return undefined
}

test('a cell size report reads the xterm cell size in pixels', () => {
  assert.deepEqual(cellOf('x\x1b[6;34;14ty'), { h: 34, w: 14 })
  assert.deepEqual(keysOf('x\x1b[6;34;14ty'), ['x', 'y'])
})

test('a cell size report scales iTerm2 ReportCellSize points to pixels, with either terminator', () => {
  assert.deepEqual(cellOf('\x1b]1337;ReportCellSize=17.0;7.0;2.0\x1b\\q'), { h: 34, w: 14 })
  assert.deepEqual(cellOf('\x1b]1337;ReportCellSize=16.5;7.2;1\x07'), { h: 17, w: 7 })
})

test('a cell size divides the window by the grid where the terminal reports no cell size, as Warp does', () => {
  assert.deepEqual(cellOf('a\x1b[4;1020;1424t\x1b[8;60;178tb'), { h: 17, w: 8 })
  assert.equal(cellOf('\x1b[4;1020;1424t'), undefined)
  assert.deepEqual(cellOf('\x1b[6;34;14t\x1b[4;1020;1424t\x1b[8;30;100t'), { h: 34, w: 14 })
})

test('a report that has not fully arrived is held, not read as keys', () => {
  assert.deepEqual(decode('\x1b]1337;ReportCellSize=17.0;7'), { events: [], rest: '\x1b]1337;ReportCellSize=17.0;7' })
  assert.deepEqual(decode('\x1b[6;34'), { events: [], rest: '\x1b[6;34' })
})

test('keys name the picture paste keys, focus reports and control keys', () => {
  assert.deepEqual(keysOf('\x16\x1bv\x1b[I\x1b[O\x1b'), ['ctrl-v', 'alt-v', 'focus-in', 'focus-out', 'esc'])
  assert.deepEqual(keysOf('\x12\x13\x15\x03\r\t\x7f'), [
    'ctrl-r',
    'ctrl-s',
    'ctrl-u',
    'ctrl-c',
    'enter',
    'tab',
    'backspace',
  ])
})

test('pastes and protocol replies come apart from keys, in order, and unfinished ones wait', () => {
  const split = decode('a\x1b[200~/pics/a')
  assert.deepEqual(split, { events: [{ kind: 'key', key: 'a' }], rest: '\x1b[200~/pics/a' })
  assert.deepEqual(decode(`${split.rest}.png\x1b[201~\x1b[Ab`).events, [
    { kind: 'paste', text: '/pics/a.png' },
    { kind: 'key', key: 'up' },
    { kind: 'key', key: 'b' },
  ])
  assert.deepEqual(decode('\x1b[?5522;2$y\x1b]72;t=q\x1b\\\x1b[?62;22c').events, [
    { kind: 'mode', mode: 5522, value: 2 },
    { kind: 'osc', code: '72', meta: { t: 'q' }, payload: '' },
    { kind: 'attributes' },
  ])
  assert.equal(decode('\x1b]5522;type=read').rest, '\x1b]5522;type=read')
})

test('an escape sequence split across two reads is one key, and a lone esc is read once the wait passes', async () => {
  const got: Inbound[] = []
  const keys = new Keys((events) => got.push(...events))
  keys.feed('\x1b')
  keys.feed('[1;2')
  keys.feed('C')
  assert.deepEqual(got, [{ kind: 'key', key: 'shift-right' }])
  keys.feed('\x1b')
  assert.equal(got.length, 1)
  await new Promise((resolve) => setTimeout(resolve, ESC_WAIT * 3))
  assert.deepEqual(got.at(-1), { kind: 'key', key: 'esc' })
  keys.stop()
})
