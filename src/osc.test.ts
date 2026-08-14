import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { PaletteEntry } from './emit/manifest.ts'
import { paletteOsc, parseOscColors, restoreOsc } from './osc.ts'

const miku: PaletteEntry = {
  name: 'miku',
  group: 'Vocaloid',
  ansiSource: 'Test',
  background: '#0e2124',
  foreground: '#e0f4f2',
  cursor: '#39c5bb',
  selection: '#1b3b3e',
  ansi: Array.from({ length: 16 }, (_, i) => `#0000${i.toString(16).padStart(2, '0')}`),
}

test('paletteOsc emits the same sequences as the zsh osc adapter', () => {
  const osc = paletteOsc(miku)
  assert.ok(osc.startsWith('\x1b]11;#0e2124\x1b\\\x1b]10;#e0f4f2\x1b\\\x1b]12;#39c5bb\x1b\\\x1b]17;#1b3b3e\x1b\\'))
  assert.ok(
    osc.endsWith(
      `\x1b]4;0;#000000${miku.ansi
        .slice(1)
        .map((c, i) => `;${i + 1};${c}`)
        .join('')}\x1b\\`,
    ),
  )
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

test('a restore round-trips through the parser', () => {
  const saved = parseOscColors('\x1b]10;rgb:ffff/ffff/ffff\x1b\\')
  assert.deepEqual(parseOscColors(restoreOsc(saved)), saved)
})
