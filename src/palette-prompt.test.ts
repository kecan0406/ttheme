import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import { isCancel } from '@clack/core'

import type { PaletteEntry } from './emit/manifest.ts'
import {
  firstPalette,
  matchesPalette,
  PalettePrompt,
  type PickerScope,
  pickerRows,
  seriesRows,
} from './palette-prompt.ts'

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
    backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
    ...partial,
  }
}

const entries: PaletteEntry[] = [
  entry({ name: 'neutral', group: '—', default: true }),
  entry({ name: 'miku', group: 'Vocaloid' }),
  entry({ name: 'rin', group: 'Vocaloid' }),
  entry({ name: 'madoka', group: 'Madoka Magica', native: '魔法少女まどか☆マギカ' }),
  entry({ name: 'homura', group: 'Madoka Magica', native: '魔法少女まどか☆マギカ', lead: true }),
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

test('series rows are folded headers matched through any member', () => {
  assert.deepEqual(
    seriesRows(entries, 'ho').map((r) => (r.kind === 'group' ? `${r.name} (${r.count})` : r.entry.name)),
    ['Madoka Magica (2)'],
  )
  assert.deepEqual(
    seriesRows(entries, '').map((r) => (r.kind === 'group' ? r.lead.name : '')),
    ['miku', 'homura'],
  )
})

async function drive(
  keys: string[],
  opts: { color?: boolean; maxItems?: number; installed?: string[]; scope?: PickerScope; required?: boolean } = {},
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

test('right unfolds a group and space picks the palette under the cursor', async () => {
  const { picked, frames, focused } = await drive(['\x1b[C', '\x1b[B', ' ', '\r'])
  assert.deepEqual(picked, ['miku'])
  assert.deepEqual(focused, ['miku'])
  assert.match(frames, /▾\[Vocaloid\] \(0\/2\)/)
  assert.match(frames, /▸ Madoka Magica \(0\/2\)/)
  assert.match(frames, /catalog \(4\/4 · 0 picked\)/)
  assert.match(frames, /⌕ search…/)
  assert.match(frames, /space pick · type to filter · enter install/)
})

test('groups fold back and cursor moves across them', async () => {
  const { picked, focused } = await drive(['\x1b[C', '\x1b[B', '\x1b[D', '\x1b[B', '\x1b[C', '\x1b[B', ' ', '\r'])
  assert.deepEqual(picked, ['madoka'])
  assert.deepEqual(focused, ['miku', 'madoka'])
})

test('typing filters and the cursor lands on the first match', async () => {
  const { picked, frames } = await drive(['m', 'a', 'd', 'o', ' ', '\r'])
  assert.deepEqual(picked, ['madoka'])
  assert.match(frames, /⌕ mado_/)
  assert.match(frames, /catalog \(2\/4 · 0 picked\)/)
})

test('editing the filter keeps the focused palette when it still matches', async () => {
  const { picked } = await drive(['\x1b[C', '\x1b[B', '\x1b[B', 'i', ' ', '\r'])
  assert.deepEqual(picked, ['rin'])
})

test('the cursor snaps to the first match when the focused palette is filtered out', async () => {
  const { picked } = await drive(['\x1b[C', '\x1b[B', '\x1b[B', 'k', ' ', '\r'])
  assert.deepEqual(picked, ['miku'])
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

test('installed palettes start out picked', async () => {
  const { picked } = await drive(['\r'], { installed: ['rin'] })
  assert.deepEqual(picked, ['rin'])
})

test('space on a folded group picks its palettes without expanding it first', async () => {
  const { picked, frames } = await drive([' ', '\r'])
  assert.deepEqual(picked.sort(), ['miku', 'rin'])
  assert.match(frames, /▸\[Vocaloid\] \(0\/2\)/)
})

test('a folded group still reports how many of its palettes are picked', async () => {
  const { frames } = await drive(['\x1b[B', '\r'], { installed: ['miku'] })
  assert.match(frames, /▸ Vocaloid \(1\/2\)/)
})

test('the filtered count comes from the catalog, not from the drawn rows', async () => {
  const { frames } = await drive(['m', 'i', '\r'])
  assert.match(frames, /catalog \(1\/4 · 0 picked\)/)
})

test('space on a group row picks every palette under it, and again drops them', async () => {
  const all = await drive(['\x1b[C', ' ', '\r'])
  assert.deepEqual(all.picked.sort(), ['miku', 'rin'])
  const none = await drive(['\x1b[C', ' ', ' ', '\r'])
  assert.deepEqual(none.picked, [])
})

test('series scope lists series only, previews each lead and never unfolds', async () => {
  const { picked, frames, focused } = await drive(['\x1b[C', '\x1b[B', '\x1b[C', ' ', '\r'], { scope: 'series' })
  assert.deepEqual(picked.sort(), ['homura', 'madoka'])
  assert.deepEqual(focused, ['miku', 'homura'])
  assert.match(frames, /series \(2\/2 · 0 picked\)/)
  assert.match(frames, /▶ ○ Vocaloid +\(2\)/)
  assert.match(frames, /series \(2\/2 · 1 picked\)/)
  assert.doesNotMatch(frames, /←→ fold/)
  assert.doesNotMatch(frames, /▾/)
})

test('series scope picks the whole series even when a member name filtered it', async () => {
  const { picked, frames } = await drive(['h', 'o', ' ', '\r'], { scope: 'series' })
  assert.deepEqual(picked.sort(), ['homura', 'madoka'])
  assert.match(frames, /series \(1\/2 · 0 picked\)/)
  assert.match(frames, /▶ ● Madoka Magica \(2\) 魔法少女まどか☆マギカ/)
})

test('space toggles the row and never lands in the filter', async () => {
  const { picked, frames } = await drive(['m', 'i', ' ', 'k', '\r'])
  assert.deepEqual(picked, ['miku'])
  assert.match(frames, /⌕ mik_/)
  assert.doesNotMatch(frames, /⌕ mi k/)
})

test('the select all row picks every shown series, and again drops them', async () => {
  const all = await drive(['\x1b[A', ' ', '\r'], { scope: 'series' })
  assert.deepEqual(all.picked.sort(), ['homura', 'madoka', 'miku', 'rin'])
  const none = await drive(['\x1b[A', ' ', ' ', '\r'], { scope: 'series' })
  assert.deepEqual(none.picked, [])
})

test('a required picker refuses to continue with nothing picked', async () => {
  const { picked, frames } = await drive(['\r', ' ', '\r'], { scope: 'series', required: true })
  assert.match(frames, /pick at least one series/)
  assert.deepEqual(picked.sort(), ['miku', 'rin'])
})
