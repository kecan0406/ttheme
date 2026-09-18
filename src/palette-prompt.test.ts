import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import { isCancel } from '@clack/core'

import type { PaletteEntry } from './emit/manifest.ts'
import { firstPalette, matchesPalette, PalettePrompt, pickerRows } from './palette-prompt.ts'

function entry(partial: Partial<PaletteEntry> & { name: string; group: string }): PaletteEntry {
  return {
    ansiSource: 'Test',
    background: '#000000',
    foreground: '#eeeeee',
    cursor: '#ffffff',
    selection: '#222222',
    order: 1,
    signature: ['#ffffff', '#eeeeee', '#000000'],
    signatureSlots: ['foreground', 'cursor', 'background'],
    ansi: Array.from({ length: 16 }, () => '#808080'),
    gate: [16.1, 3.9, 0, 16.1, 3.9],
    ...partial,
  }
}

const entries: PaletteEntry[] = [
  entry({ name: 'neutral', group: '—', default: true }),
  entry({ name: 'miku', group: 'Vocaloid' }),
  entry({ name: 'rin', group: 'Vocaloid' }),
  entry({ name: 'madoka', group: 'Madoka Magica', native: '魔法少女まどか☆マギカ' }),
  entry({ name: 'homura', group: 'Madoka Magica', native: '魔法少女まどか☆マギカ' }),
]

test('matchesPalette filters by name, group and native title', () => {
  const madoka = entries[3]
  assert.ok(madoka)
  assert.ok(matchesPalette(madoka, 'mado'))
  assert.ok(matchesPalette(madoka, 'MAGICA'))
  assert.ok(matchesPalette(madoka, '魔法少女'))
  assert.ok(!matchesPalette(madoka, 'rin'))
})

test('folded rows show group headers only, without the default palette', () => {
  const rows = pickerRows(entries, new Set(), '')
  assert.deepEqual(
    rows.map((r) => (r.kind === 'group' ? `▸${r.name}` : r.entry.name)),
    ['▸Vocaloid', '▸Madoka Magica'],
  )
  assert.deepEqual(
    rows.map((r) => (r.kind === 'group' ? r.count : 0)),
    [2, 2],
  )
  assert.equal(firstPalette(rows), 0)
})

test('expanding a group inserts its palettes under the header', () => {
  const rows = pickerRows(entries, new Set(['Vocaloid']), '')
  assert.deepEqual(
    rows.map((r) => (r.kind === 'group' ? `${r.expanded ? '▾' : '▸'}${r.name}` : r.entry.name)),
    ['▾Vocaloid', 'miku', 'rin', '▸Madoka Magica'],
  )
})

test('a filter overrides folds and hides non-matching groups', () => {
  const rows = pickerRows(entries, new Set(), 'mado')
  assert.deepEqual(
    rows.map((r) => (r.kind === 'group' ? `▾${r.name}` : r.entry.name)),
    ['▾Madoka Magica', 'madoka', 'homura'],
  )
  assert.equal(firstPalette(rows), 1)
})

test('a name filter narrows inside the matching group', () => {
  const rows = pickerRows(entries, new Set(), 'ho')
  assert.deepEqual(
    rows.map((r) => (r.kind === 'group' ? `${r.name} (${r.count})` : r.entry.name)),
    ['Madoka Magica (1)', 'homura'],
  )
})

test('the default palette is never offered, even by filter', () => {
  assert.deepEqual(pickerRows(entries, new Set(), 'neu'), [])
})

async function drive(
  keys: string[],
  opts: { color?: boolean; maxItems?: number; multi?: boolean; installed?: string[]; title?: string } = {},
): Promise<{ result: string | symbol | undefined; frames: string; focused: string[]; picked: string[] }> {
  const input = new PassThrough()
  const output = new PassThrough()
  let frames = ''
  output.on('data', (chunk: Buffer) => {
    frames += chunk.toString()
  })
  const focused: string[] = []
  const prompt = new PalettePrompt({
    entries,
    color: false,
    input,
    output,
    onFocus: (e) => focused.push(e.name),
    ...opts,
  })
  const pending = prompt.prompt()
  for (const key of keys) {
    await new Promise((resolve) => setTimeout(resolve, 5))
    input.write(key)
  }
  const result = await pending
  return { result, frames, focused, picked: [...prompt.picked] }
}

test('enter on a folded group expands it, then a member submits', async () => {
  const { result, frames, focused } = await drive(['\r', '\x1b[B', '\r'])
  assert.equal(result, 'miku')
  assert.deepEqual(focused, ['miku'])
  assert.match(frames, /▸\[Vocaloid\] \(2\)/)
  assert.match(frames, /▸ Madoka Magica \(2\)/)
  assert.match(frames, /startup palette \(4\/4\)/)
  assert.match(frames, /⌕ search…/)
})

test('groups fold back and cursor moves across them', async () => {
  const { result, focused } = await drive(['\x1b[B', '\r', '\x1b[B', '\r'])
  assert.equal(result, 'madoka')
  assert.deepEqual(focused, ['madoka'])
})

test('typing filters and enter picks the first match', async () => {
  const { result, frames } = await drive(['m', 'a', 'd', 'o', '\r'])
  assert.equal(result, 'madoka')
  assert.match(frames, /⌕ mado_/)
  assert.match(frames, /startup palette \(2\/4\)/)
})

test('editing the filter keeps the focused palette when it still matches', async () => {
  const { result } = await drive(['\r', '\x1b[B', '\x1b[B', 'i', '\r'])
  assert.equal(result, 'rin')
})

test('the cursor snaps to the first match when the focused palette is filtered out', async () => {
  const { result } = await drive(['\r', '\x1b[B', '\x1b[B', 'k', '\r'])
  assert.equal(result, 'miku')
})

test('color rows carry six swatch cells and drop the ANSI prefix', async () => {
  const { frames } = await drive(['m', 'i', 'k', '\r'], { color: true })
  assert.ok(frames.includes('\x1b[38;2;128;128;128m▄'.repeat(6)))
  assert.doesNotMatch(frames, /ANSI/)
})

test('a small window counts the rows below it', async () => {
  const { frames } = await drive(['a', '\x03'], { maxItems: 2 })
  assert.match(frames, /↓ 4 more/)
})

test('ctrl-c cancels the picker', async () => {
  const { result } = await drive(['\x03'])
  assert.ok(typeof result === 'symbol' && isCancel(result))
})

test('multi mode picks a palette with tab and submits the set with enter', async () => {
  const { picked, frames } = await drive(['\x1b[C', '\x1b[B', '\t', '\r'], { multi: true, title: 'catalog' })
  assert.deepEqual(picked, ['miku'])
  assert.match(frames, /catalog \(4\/4 · 0 picked\)/)
  assert.match(frames, /tab pick · type to filter · enter install/)
})

test('multi mode marks installed palettes as already picked', async () => {
  const { picked } = await drive(['\r'], { multi: true, installed: ['rin'] })
  assert.deepEqual(picked, ['rin'])
})

test('tab on a folded group picks its palettes without expanding it first', async () => {
  const { picked, frames } = await drive(['\t', '\r'], { multi: true, title: 'catalog' })
  assert.deepEqual(picked.sort(), ['miku', 'rin'])
  assert.match(frames, /▸\[Vocaloid\] \(0\/2\)/)
})

test('a folded group still reports how many of its palettes are picked', async () => {
  const { frames } = await drive(['\x1b[B', '\r'], { multi: true, installed: ['miku'] })
  assert.match(frames, /▸ Vocaloid \(1\/2\)/)
})

test('the filtered count comes from the catalog, not from the drawn rows', async () => {
  const { frames } = await drive(['m', 'i', '\r'], { multi: true, title: 'catalog' })
  assert.match(frames, /catalog \(1\/4 · 0 picked\)/)
})

test('tab on a group row picks every palette under it, and again drops them', async () => {
  const all = await drive(['\x1b[C', '\t', '\r'], { multi: true })
  assert.deepEqual(all.picked.sort(), ['miku', 'rin'])
  const none = await drive(['\x1b[C', '\t', '\t', '\r'], { multi: true })
  assert.deepEqual(none.picked, [])
})

test('single mode is unchanged by the multi additions', async () => {
  const { result, frames } = await drive(['\r', '\x1b[B', '\r'])
  assert.equal(result, 'miku')
  assert.doesNotMatch(frames, /picked/)
})
