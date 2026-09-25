import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { PaletteEntry } from './emit/manifest.ts'
import { answered, COLOR_QUERY, paletteOsc, parseOscColors, restoreOsc } from './osc.ts'

const miku: PaletteEntry = {
  name: 'miku',
  group: 'Vocaloid',
  ansiSource: 'Test',
  background: '#0e2124',
  foreground: '#e0f4f2',
  cursor: '#39c5bb',
  selection: '#1b3b3e',
  order: 2,
  signature: ['#39c5bb', '#ff91c7', '#aab0ff'],
  signatureSlots: ['cursor', 'ansi1', 'ansi12'],
  ansi: Array.from({ length: 16 }, (_, i) => `#0000${i.toString(16).padStart(2, '0')}`),
  gate: [11.92, 8.03, 0, 11.92, 1.88],
  backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
}

test('paletteOsc emits the same sequences as the zsh osc adapter', () => {
  const osc = paletteOsc(miku)
  assert.ok(osc.startsWith('\x1b]11;#0e2124\x1b\\\x1b]10;#e0f4f2\x1b\\\x1b]12;#39c5bb\x1b\\\x1b]17;#1b3b3e\x1b\\'))
  assert.ok(osc.endsWith(miku.ansi.map((c, i) => `\x1b]4;${i};${c}\x1b\\`).join('')))
})

test('parseOscColors reads terminal replies with ST and BEL terminators', () => {
  const replies =
    '\x1b]11;rgb:1e1e/2222/2828\x1b\\\x1b]4;0;rgb:0000/0000/0000\x07noise\x1b]12;rgba:ffff/0000/0000/aaaa\x1b\\'
  const colors = parseOscColors(replies)
  assert.equal(colors.get('11'), 'rgb:1e1e/2222/2828')
  assert.equal(colors.get('4;0'), 'rgb:0000/0000/0000')
  assert.equal(colors.get('12'), 'rgba:ffff/0000/0000/aaaa')
})

test('restoreOsc replays captured colors as set sequences', () => {
  const saved = new Map([
    ['11', 'rgb:1e1e/2222/2828'],
    ['4;3', 'rgb:aaaa/bbbb/cccc'],
  ])
  assert.equal(restoreOsc(saved), '\x1b]11;rgb:1e1e/2222/2828\x1b\\\x1b]4;3;rgb:aaaa/bbbb/cccc\x1b\\')
})

test('the color query ends at a DSR, so a terminal that leaves OSC 17 unanswered does not hold it to its deadline', () => {
  assert.ok(COLOR_QUERY.endsWith('\x1b[5n'))
  const codes = COLOR_QUERY.split('\x1b').flatMap((part) => part.match(/^\](\d+(?:;\d+)?);\?/)?.[1] ?? [])
  assert.equal(codes.length, 20)
  const ghostty = codes
    .filter((code) => code !== '17')
    .map((code) => `\x1b]${code};rgb:1717/1717/1f1f\x1b\\`)
    .join('')
  assert.equal(answered(ghostty), false)
  assert.equal(answered(`${ghostty}\x1b[0n`), true)
  assert.equal(parseOscColors(`${ghostty}\x1b[0n`).size, 19)
})

test('a restore round-trips through the parser', () => {
  const saved = parseOscColors('\x1b]10;rgb:ffff/ffff/ffff\x1b\\')
  assert.deepEqual(parseOscColors(restoreOsc(saved)), saved)
})
