import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cellReport } from './find-screen.ts'

test('cellReport reads the xterm cell size in pixels', () => {
  assert.deepEqual(cellReport('x\x1b[6;34;14ty'), { cell: { h: 34, w: 14 }, rest: 'xy' })
})

test('cellReport scales iTerm2 ReportCellSize points to pixels, with either terminator', () => {
  assert.deepEqual(cellReport('\x1b]1337;ReportCellSize=17.0;7.0;2.0\x1b\\q'), { cell: { h: 34, w: 14 }, rest: 'q' })
  assert.deepEqual(cellReport('\x1b]1337;ReportCellSize=16.5;7.2;1\x07'), { cell: { h: 17, w: 7 }, rest: '' })
})

test('cellReport waits for a report that has not fully arrived', () => {
  assert.equal(cellReport('\x1b]1337;ReportCellSize=17.0;7'), null)
  assert.equal(cellReport('\x1b[6;34'), null)
})
