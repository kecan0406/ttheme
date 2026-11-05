import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cells } from '../core/text.ts'
import { clip, fit } from './ansi.ts'
import { Screen } from './screen.ts'
import { LOOKS } from './style.ts'
import { HAND, IDLE } from './terminal.ts'
import { cover, lift, lifted, marking, Pointer, relit, zone, zoneAt } from './zones.ts'

function spans(line: () => string) {
  const { drawn, targets } = marking(line)
  const { text, zones } = lift(drawn, 3, targets)

  return { text, spans: zones.map((z) => `${z.target} ${z.row}:${z.col}+${z.width}`) }
}

test('a zone is plain text outside a frame, so a view drawn elsewhere carries no marks', () => {
  assert.equal(zone('tab', 'Browse'), 'Browse')
})

test('a frame lifts its marks out and keeps the columns they wrapped, past wide text and colors', () => {
  const got = spans(() => ` ${zone('a', '\x1b[1mカタ\x1b[22m')}  ${zone('b', `x ${zone('c', 'y')}`)}`)
  assert.equal(got.text, ' \x1b[1mカタ\x1b[22m  x y')
  assert.deepEqual(got.spans, ['a 3:1+4', 'c 3:9+1', 'b 3:7+3'])
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

function pointed(...rows: (() => string)[]) {
  const { drawn, targets } = marking(() => rows.map((row) => row()))
  const pointer = new Pointer()
  pointer.zones = lifted(drawn, targets).zones

  const shown = (row: number) => lift(relit(drawn[row] as string, pointer.lit(), targets), row, targets).text

  return { pointer, shown }
}

const SHOUT = (inner: string, pressed: boolean) => (pressed ? inner.toLowerCase() : inner.toUpperCase())

test('nothing lights until the terminal has reported a move, and a key puts it out until the next', () => {
  const { pointer, shown } = pointed(() => zone('tab', 'browse', SHOUT))

  pointer.point({ action: 'wheel', button: undefined, row: 0, col: 1 })
  assert.equal(pointer.lit().hot, false)
  assert.equal(pointer.moved({ row: 0, col: 1 }), true)
  assert.equal(shown(0), 'BROWSE')
  assert.equal(pointer.moved({ row: 0, col: 2 }), false)
  assert.equal(pointer.moved(undefined), true)
  assert.equal(shown(0), 'browse')
  assert.equal(pointer.moved(undefined), false)
})

test('a zone without a look stays dark, and zones with equal targets light together', () => {
  const { pointer, shown } = pointed(
    () => zone({ kind: 'row', at: 1 }, 'first', SHOUT),
    () => zone({ kind: 'row', at: 1 }, 'second', SHOUT),
    () => zone({ kind: 'row', at: 2 }, 'third', SHOUT),
    () => zone({ kind: 'help' }, 'inert'),
  )

  pointer.moved({ row: 0, col: 0 })
  assert.deepEqual([0, 1, 2].map(shown), ['FIRST', 'SECOND', 'third'])
  pointer.moved({ row: 3, col: 0 })
  assert.equal(pointer.lit().hot, false)
  assert.deepEqual([0, 1, 2].map(shown), ['first', 'second', 'third'])
})

test('a slider lights the label of its family, and the label stays dark over another family', () => {
  const { pointer, shown } = pointed(
    () => zone({ kind: 'grip', at: 1 }, 'size', SHOUT, 'one'),
    () => zone({ kind: 'bar', at: 1 }, 'bar', (inner) => inner, 'one'),
    () => zone({ kind: 'grip', at: 2 }, 'opacity', SHOUT, 'two'),
  )

  pointer.moved({ row: 1, col: 0 })
  assert.deepEqual([0, 1, 2].map(shown), ['SIZE', 'bar', 'opacity'])
})

test('a press lights only what it pressed, and only while the pointer stays on it', () => {
  const { pointer, shown } = pointed(() => `${zone('a', 'aa', SHOUT)} ${zone('b', 'BB', SHOUT)}`)

  pointer.point({ action: 'press', button: 'left', row: 0, col: 3 })
  assert.equal(pointer.lit().pressed, true)
  assert.equal(shown(0), 'aa bb')
  pointer.point({ action: 'drag', button: 'left', row: 0, col: 0 })
  assert.equal(pointer.lit().hot, false)
  assert.equal(shown(0), 'aa BB')
  pointer.point({ action: 'drag', button: 'left', row: 0, col: 4 })
  assert.equal(shown(0), 'aa bb')
  pointer.point({ action: 'release', button: 'left', row: 0, col: 4 })
  assert.equal(pointer.lit().hot, false)
})

test('an outer zone lights with the one inside it, and each look sees only what its mark wraps', () => {
  const { pointer, shown } = pointed(() =>
    zone('row', `xx ${zone('box', 'y', (inner) => `[${inner}]`)} z`, (inner) => `<${inner}>`),
  )

  pointer.moved({ row: 0, col: 3 })
  assert.equal(shown(0), '<xx [y] z>')
  pointer.moved({ row: 0, col: 0 })
  assert.equal(shown(0), '<xx y z>')
})

test('a row an overlay cut shows one dim cursor, where the row starts', () => {
  const { pointer, shown } = pointed(() => cover(zone('row', '  name       tail', LOOKS.row), 7, 'XX'))

  pointer.moved({ row: 0, col: 1 })
  assert.equal(shown(0).split('▌').length - 1, 1)
})

test('a screen that stops with the hand up puts the arrow back', () => {
  const writes: string[] = []

  const screen = new Screen({
    write: (text) => writes.push(text),
    view: () => ({ lines: [zone('a', 'ab', LOOKS.still)] }),
  })

  const at = {
    kind: 'mouse',
    action: 'move',
    button: undefined,
    wheel: 0,
    sideways: false,
    shift: false,
    alt: false,
    ctrl: false,
    count: 0,
  } as const

  screen.now()
  assert.ok(!writes.join('').includes(HAND))
  screen.hover({ ...at, row: 0, col: 0 })
  screen.now()
  assert.ok(writes.join('').includes(HAND))
  screen.stop()
  assert.equal(writes.at(-1), IDLE)
})

test('every look keeps the width, so a hover never moves a column', () => {
  const texts = [
    '  \x1b[2mnote\x1b[22m plain',
    ' \x1b[1mkey\x1b[22m \x1b[2mlabel\x1b[22m',
    '\x1b[100;1m + Add \x1b[22;49m\x1b[2m  a note\x1b[22m',
    '\x1b[7;1;36m Save \x1b[22;27;39m',
    '▌ \x1b[31mカタ\x1b[39m',
    'plain',
  ]

  for (const [name, look] of Object.entries(LOOKS)) {
    for (const text of texts) {
      for (const pressed of [false, true]) {
        assert.equal(cells(look(text, pressed)), cells(text), `${name} on ${JSON.stringify(text)}`)
      }
    }
  }
})

test('a row under the pointer shows a dim cursor and lifts its dim text, and the cursor row stays as it is', () => {
  assert.equal(LOOKS.row('  name \x1b[2m(1/3)\x1b[22m'), '\x1b[2m▌\x1b[22m name (1/3)\x1b[22m')
  assert.equal(LOOKS.row('▌ name \x1b[2m(1/3)\x1b[22m'), '▌ name \x1b[2m(1/3)\x1b[22m')
})

test('a hint becomes a chip, a chip takes the underline, a pressed one is a pill, and a filled one stays', () => {
  assert.equal(LOOKS.flat('\x1b[1menter\x1b[22m \x1b[2muse\x1b[22m', false), '\x1b[100;1menter use\x1b[22;49m')
  assert.equal(LOOKS.flat('\x1b[1menter\x1b[22m \x1b[2muse\x1b[22m', true), '\x1b[7;1;36menter use\x1b[22;27;39m')
  assert.equal(LOOKS.flat('\x1b[100;1m Add \x1b[22;49m', false), '\x1b[100;1;4m Add \x1b[22;24;49m')
  assert.equal(LOOKS.flat('\x1b[7;1;36m Save \x1b[22;27;39m', false), '\x1b[7;1;36m Save \x1b[22;27;39m')
  assert.equal(LOOKS.danger('\x1b[100;1m × Remove \x1b[22;49m'), '\x1b[7;1;31m × Remove \x1b[22;27;39m')
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
