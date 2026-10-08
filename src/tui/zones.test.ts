import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clip, fit } from '../ansi.ts'
import { cover, lift, marking, zone, zoneAt } from './zones.ts'

function spans(line: () => string): { text: string; spans: string[] } {
  const { drawn, targets } = marking(line)
  const { text, zones } = lift(drawn, 3, targets)
  return { text, spans: zones.map((z) => `${z.target} ${z.row}:${z.col}+${z.width}`) }
}

test('a zone is plain text outside a frame, so a view drawn elsewhere carries no marks', () => {
  assert.equal(zone('tab', 'Catalog'), 'Catalog')
})

test('a frame lifts its marks out and keeps the columns they wrapped, past wide text and colors', () => {
  const got = spans(() => ` ${zone('a', '\x1b[1mカタ\x1b[22m')} · ${zone('b', `x ${zone('c', 'y')}`)}`)
  assert.equal(got.text, ' \x1b[1mカタ\x1b[22m · x y')
  assert.deepEqual(got.spans, ['a 3:1+4', 'c 3:10+1', 'b 3:8+3'])
})

test('a column move places the zones after it, and a mark cut off by fit or clip closes where the cut text ends', () => {
  assert.deepEqual(spans(() => `\x1b[12G${zone('id', '1234')}\x1b[3G${zone('ok', 'ok')}`).spans, [
    'id 3:11+4',
    'ok 3:2+2',
  ])
  const cut = spans(() => fit(`ab ${zone('long', 'cdefgh')}`, 6, false))
  assert.equal(cut.text, 'ab cd…')
  assert.deepEqual(cut.spans, ['long 3:3+3'])
  const beside = spans(() => `${fit(zone('row', 'abcdefgh'), 4)} │ ${clip(zone('cell', 'xyz'), 2)} tail`)
  assert.equal(beside.text, 'abc… │ xy tail')
  assert.deepEqual(beside.spans, ['row 3:0+4', 'cell 3:7+2'])
})

test('the smallest zone under the pointer wins, and the later of two the same size', () => {
  const zones = [
    { row: 0, col: 0, width: 10, height: 5, target: 'tile' },
    { row: 2, col: 1, width: 4, height: 1, target: 'link' },
    { row: 2, col: 1, width: 4, height: 1, target: 'later' },
  ]
  assert.equal(zoneAt(zones, 2, 3)?.target, 'later')
  assert.equal(zoneAt(zones, 4, 9)?.target, 'tile')
  assert.equal(zoneAt(zones, 5, 0), undefined)
})

test('cover lays one line over another, keeping the colors and zones on both sides of it', () => {
  const got = spans(() => cover(`\x1b[31m${zone('row', 'abcdefgh')}\x1b[39m`, 2, zone('pop', 'XY')))
  assert.equal(got.text, '\x1b[31mab\x1b[0mXY\x1b[0m\x1b[31mefgh\x1b[39m')
  assert.deepEqual(got.spans, ['row 3:0+2', 'pop 3:2+2', 'row 3:4+4'])
})

test('cover pads a short line and blanks the half of a wide character it cuts', () => {
  assert.equal(cover('ab', 4, 'Z'), 'ab  Z')
  assert.equal(cover('カタカ', 1, 'x'), ' xタカ')
  assert.equal(cover('カタカ', 2, 'x'), 'カx カ')
  assert.equal(cover('abカ', 2, 'x'), 'abx ')
})

test('cover counts an emoji sequence as one character', () => {
  assert.equal(cover('❤️ab', 1, 'x'), ' xab')
  assert.equal(cover('ab👩‍💻cd', 2, 'x'), 'abx cd')
})
