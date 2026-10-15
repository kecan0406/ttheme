import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CellProbe, CLICK_GAP, decode, ESC_WAIT, type Inbound, Keys, keysOf } from './keys.ts'

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
  assert.deepEqual(decode('\x1b]11;rgb:1111/1919/1c1c\x07\x1b]4;3;rgb:ffff/0000/8080\x1b\\').events, [
    { kind: 'color', code: '11', value: 'rgb:1111/1919/1c1c' },
    { kind: 'color', code: '4;3', value: 'rgb:ffff/0000/8080' },
  ])
})

test('a DCS, APC, PM or SOS string, or an OSC with no number, is read as nothing, whole or split across reads', () => {
  assert.deepEqual(keysOf('a\x1bP1$r0m\x1b\\b\x1b_Gi=1;OK\x1b\\c\x1b^note\x1b\\\x1bXx\x1b\\\x1b]Lterm\x07d'), [
    'a',
    'b',
    'c',
    'd',
  ])
  const split = decode('\x1bP>|XTerm(')
  assert.deepEqual(split, { events: [], rest: '\x1bP>|XTerm(' })
  assert.deepEqual(keysOf(`${split.rest}390)\x1b\\e`), ['e'])
})

test('a string that no terminator ends is typed keys, not a reply: alt and its first key, then the rest', () => {
  assert.deepEqual(keysOf('\x1bPas\r'), ['alt-shift-p', 'a', 's', 'enter'])
  assert.deepEqual(keysOf('\x1b]Lx\x1b[B'), ['alt-]', 'L', 'x', 'down'])
  assert.deepEqual(
    decode('\x1bXa\x1b[A').events.map((event) => (event.kind === 'key' ? event.key : event.kind)),
    ['alt-shift-x', 'a', 'up'],
  )
})

test('with no keyboard protocol, esc and a key other than a lowercase letter read as that key with alt', () => {
  assert.deepEqual(keysOf('\x1b1\x1bA\x1b/\x1b \x1b\x1b'), ['alt-1', 'alt-shift-a', 'alt-/', 'alt-space', 'esc', 'esc'])
  assert.deepEqual(keysOf('\x1b['), ['alt-['])
  assert.deepEqual(keysOf('\x1bO'), ['alt-shift-o'])
  assert.deepEqual(keysOf('\x1bP'), ['alt-shift-p'])
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

function mice(input: string): string[] {
  return decode(input, true).events.flatMap((event) =>
    event.kind === 'mouse'
      ? [
          `${event.action} ${event.button ?? (event.wheel ? `${event.sideways ? 'x' : 'y'}${event.wheel}` : '-')} ${event.row},${event.col}${event.shift ? ' shift' : ''}${event.alt ? ' alt' : ''}${event.ctrl ? ' ctrl' : ''}`,
        ]
      : event.kind === 'key'
        ? [event.key]
        : [],
  )
}

test('an SGR mouse report reads its button, action, cell and modifiers, zero-based', () => {
  assert.deepEqual(mice('\x1b[<0;12;5M\x1b[<32;14;5M\x1b[<0;14;6m'), [
    'press left 4,11',
    'drag left 4,13',
    'release left 5,13',
  ])
  assert.deepEqual(mice('\x1b[<2;1;1M\x1b[<1;300;90M\x1b[<35;3;3M'), [
    'press right 0,0',
    'press middle 89,299',
    'move - 2,2',
  ])
  assert.deepEqual(mice('\x1b[<64;10;3M\x1b[<65;10;3M\x1b[<66;10;3M\x1b[<67;10;3M'), [
    'wheel y-1 2,9',
    'wheel y1 2,9',
    'wheel x-1 2,9',
    'wheel x1 2,9',
  ])
  assert.deepEqual(mice('\x1b[<20;2;2M\x1b[<8;2;2M'), ['press left 1,1 shift ctrl', 'press left 1,1 alt'])
})

test('an SGR-Pixels report reads as the cell under it and where in that cell it fell', () => {
  const [press, drag] = decode('\x1b[<0;189;95M\x1b[<32;-3;19M', true, { w: 18, h: 38 }).events
  assert.deepEqual(
    press?.kind === 'mouse' && [press.action, press.row, press.col, press.fx?.toFixed(2), press.fy?.toFixed(2)],
    ['press', 2, 10, '0.50', '0.50'],
  )
  assert.deepEqual(drag?.kind === 'mouse' && [drag.action, drag.row, drag.col, drag.fx, drag.fy?.toFixed(2)], [
    'drag',
    0,
    0,
    0,
    '0.50',
  ])
})

test('a legacy X10 mouse report is read whole, so its bytes never land as keys', () => {
  assert.deepEqual(mice('\x1b[M !!a'), ['press left 0,0', 'a'])
  assert.deepEqual(mice('\x1b[M#*%'), ['release - 4,9'])
  assert.deepEqual(mice('\x1b[M`55\x1b[Ma55'), ['wheel y-1 20,20', 'wheel y1 20,20'])
  assert.deepEqual(mice('\x1b[M �!x'), ['x'])
  assert.deepEqual(decode('\x1b[M !'), { events: [], rest: '\x1b[M !' })
})

test('a mouse report split across reads is held, and a quick second press on the same cell counts two', async () => {
  const got: Inbound[] = []
  const keys = new Keys((events) => got.push(...events))
  keys.feed('\x1b[<0;')
  keys.feed('7;3')
  assert.equal(got.length, 0)
  keys.feed('M\x1b[<0;7;3m')
  keys.feed('\x1b[<0;8;3M\x1b[<0;8;3m')
  keys.feed('\x1b[<0;20;3M')
  await new Promise((resolve) => setTimeout(resolve, CLICK_GAP + 50))
  keys.feed('\x1b[<0;20;3M')
  const counts = got.flatMap((event) => (event.kind === 'mouse' ? [`${event.action} ${event.count}`] : []))
  assert.deepEqual(counts, ['press 1', 'release 1', 'press 2', 'release 2', 'press 1', 'press 1'])
  keys.stop()
})

test('a legacy report split inside its opening bytes still reads, and the key after it stays a key', () => {
  const got: Inbound[] = []
  const keys = new Keys((events) => got.push(...events))
  keys.feed(Buffer.from([0x1b]))
  keys.feed(Buffer.from([0x5b, 0x4d, 0x20, 0xa0, 0x21, 0x61]))
  keys.feed(Buffer.from([0x1b, 0x5b]))
  keys.feed(Buffer.from([0x4d, 0x23, 0xc3, 0x22, 0x62]))
  assert.deepEqual(
    got.map((event) => (event.kind === 'mouse' ? `${event.action} ${event.row},${event.col}` : `${event.kind}`)),
    ['press 0,127', 'key', 'release 1,162', 'key'],
  )
  keys.stop()
})

test('a burst of wheel events one notch sends is one step, and legacy bytes past column 95 read, split or not', () => {
  const got: Inbound[] = []
  const keys = new Keys((events) => got.push(...events))
  keys.feed('\x1b[<65;5;5M\x1b[<65;5;5M\x1b[<65;5;5M\x1b[<64;5;5M')
  keys.feed(Buffer.from([0x1b, 0x5b, 0x4d, 0x20, 0xa0, 0x21, 0x78]))
  keys.feed(Buffer.from([0x1b, 0x5b, 0x4d, 0x23]))
  keys.feed(Buffer.from([0xc3, 0x22, 0x79]))
  assert.deepEqual(
    got.map((event) =>
      event.kind === 'mouse' ? `${event.action} ${event.wheel} ${event.row},${event.col}` : `${event.kind}`,
    ),
    ['wheel 1 4,4', 'wheel -1 4,4', 'press 0 0,127', 'key', 'release 0 1,162', 'key'],
  )
  keys.stop()
})

test('a kitty keyboard reply and its CSI u keys read as the names the legacy bytes gave, and the rest is left out', () => {
  assert.deepEqual(decode('\x1b[?0u\x1b[?5u').events, [
    { kind: 'keyboard', flags: 0 },
    { kind: 'keyboard', flags: 5 },
  ])
  assert.deepEqual(keysOf('\x1b[27u\x1b[99;5u\x1b[118;3u\x1b[127;3u\x1b[9;2u\x1b[32;5u\x1b[13;2u\x1b[97;2u'), [
    'esc',
    'ctrl-c',
    'alt-v',
    'alt-backspace',
    'shift-tab',
    'ctrl-space',
    'shift-enter',
    'A',
  ])
  assert.deepEqual(keysOf('\x1b[12593::114;5u\x1b[114;69u\x1b[97;6u\x1b[92;5u'), [
    'ctrl-r',
    'ctrl-r',
    'ctrl-shift-a',
    'ctrl-\\',
  ])
  assert.deepEqual(keysOf('\x1b[114;9u\x1b[57399u\x1b[>5u'), [])
  assert.deepEqual(decode('\x1b[27'), { events: [], rest: '\x1b[27' })
})

test('every key a CSI u report names reads as the legacy bytes of the same key did', () => {
  for (let code = 1; code < 27; code++) {
    const letter = code + 96
    assert.deepEqual(
      keysOf(`\x1b[${letter};5u`),
      keysOf(String.fromCharCode(code)),
      `ctrl+${String.fromCharCode(letter)}`,
    )
  }

  assert.deepEqual(keysOf('\x1b[91;5u'), keysOf('\x1b'))
  assert.deepEqual(keysOf('\x1b[32;5u'), keysOf('\x00'))

  for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
    assert.deepEqual(keysOf(`\x1b[${letter.charCodeAt(0)};3u`), keysOf(`\x1b${letter}`), `alt+${letter}`)
  }

  assert.deepEqual(keysOf('\x1b[127;3u'), keysOf('\x1b\x7f'))
  assert.deepEqual(keysOf('\x1b[9;2u'), keysOf('\x1b[Z'))
})

test('a key the keyboard protocol reports with caps lock or num lock on reads as the same key with them off', () => {
  for (const [locked, plain] of [
    ['\x1b[1;65A', '\x1b[A'],
    ['\x1b[1;129B', '\x1b[B'],
    ['\x1b[1;193H', '\x1b[H'],
    ['\x1b[1;65F', '\x1b[F'],
    ['\x1b[5;65~', '\x1b[5~'],
    ['\x1b[3;129~', '\x1b[3~'],
    ['\x1b[1;66C', '\x1b[1;2C'],
    ['\x1b[1;130D', '\x1b[1;2D'],
  ] as const) {
    assert.deepEqual(keysOf(locked), keysOf(plain), JSON.stringify(locked))
  }

  assert.deepEqual(keysOf('\x1b[1;65A\x1b[1;69A\x1b[1;73A'), ['up'])
})

test('a keypad key the keyboard protocol reports by its own number reads as the key it stands for', () => {
  for (const [keypad, plain] of [
    ['\x1b[57414u', '\r'],
    ['\x1b[57414;2u', '\x1b[13;2u'],
    ['\x1b[57419u', '\x1b[A'],
    ['\x1b[57420;129u', '\x1b[B'],
    ['\x1b[57417u', '\x1b[D'],
    ['\x1b[57418;2u', '\x1b[1;2C'],
    ['\x1b[57421u', '\x1b[5~'],
    ['\x1b[57422;65u', '\x1b[6~'],
    ['\x1b[57423u', '\x1b[H'],
    ['\x1b[57424u', '\x1b[F'],
    ['\x1b[57426u', '\x1b[3~'],
  ] as const) {
    assert.deepEqual(keysOf(keypad), keysOf(plain), JSON.stringify(keypad))
  }
})

test('a CSI u report whose shifted key lies past the last code point reads as the key shifted', () => {
  assert.deepEqual(keysOf('\x1b[97:1114112;2u\x1b[97:65;2u'), ['A', 'A'])
})

test('a CSI u report naming a surrogate as its key or its shifted key never reads as half a character', () => {
  assert.deepEqual(keysOf('\x1b[55296u\x1b[57343;2u\x1b[97:55296;2u'), ['A'])
})
