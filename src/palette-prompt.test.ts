import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'

import type { PaletteEntry } from './manifest.ts'
import {
  firstPalette,
  matchesPalette,
  PalettePrompt,
  type PickerScope,
  pickerRows,
  seriesRows,
  stepRow,
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

test('stepRow wraps at either end, stops short of it on a page, and steps over a rule', () => {
  const none = () => false
  assert.equal(stepRow(4, 1, 5, none), 0)
  assert.equal(stepRow(0, -1, 5, none), 4)
  assert.equal(stepRow(2, 10, 5, none), 4)
  assert.equal(stepRow(4, 10, 5, none), 0)
  assert.equal(stepRow(2, -10, 5, none), 0)
  assert.equal(stepRow(4, Number.POSITIVE_INFINITY, 5, none), 4)
  assert.equal(stepRow(0, Number.NEGATIVE_INFINITY, 5, none), 0)
  assert.equal(
    stepRow(1, 1, 5, (i) => i === 2),
    3,
  )
  assert.equal(
    stepRow(3, -1, 5, (i) => i === 2),
    1,
  )
  assert.equal(stepRow(0, 1, 0, none), 0)
})

test('stepRow never leaves the list over a rule at its top or bottom', () => {
  const top = (i: number) => i === 0
  const bottom = (i: number) => i === 2
  assert.equal(stepRow(1, -1, 2, top), 1)
  assert.equal(stepRow(1, -1, 2, top, false), 1)
  assert.equal(stepRow(1, -1, 3, top), 2)
  assert.equal(stepRow(1, Number.NEGATIVE_INFINITY, 2, top), 1)
  assert.equal(stepRow(2, -10, 3, top), 1)
  assert.equal(stepRow(0, Number.POSITIVE_INFINITY, 3, bottom), 1)
  assert.equal(stepRow(0, 10, 3, bottom), 1)
  assert.equal(stepRow(1, 1, 3, bottom), 0)
  assert.equal(stepRow(1, 1, 3, bottom, false), 1)
})

test('matchesPalette filters by name, group and native title', () => {
  const madoka = entries[3]
  assert.ok(madoka)
  assert.ok(matchesPalette(madoka, 'mado'))
  assert.ok(matchesPalette(madoka, 'MAGICA'))
  assert.ok(matchesPalette(madoka, '魔法少女'))
  assert.ok(!matchesPalette(madoka, 'rin'))
})

test('matchesPalette ignores spaces and symbols on both sides, since a typed space never reaches the filter', () => {
  const madoka = entries[3]
  assert.ok(madoka)
  assert.ok(matchesPalette(madoka, 'madokamagica'))
  assert.ok(matchesPalette(madoka, 'Madoka Magica'))
  assert.ok(matchesPalette(madoka, '魔法少女まどかマギカ'))
  assert.ok(matchesPalette(madoka, '☆'))
  assert.ok(!matchesPalette(madoka, 'madokarin'))
})

test('folded rows show group headers only, without the default palette', () => {
  const rows = pickerRows(entries, new Set(), '')
  assert.deepEqual(
    rows.map((r) => (r.kind === 'group' ? `▸${r.name}` : r.kind === 'palette' ? r.entry.name : `${r.kind} ${r.name}`)),
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
    rows.map((r) =>
      r.kind === 'group'
        ? `${r.expanded ? '▾' : '▸'}${r.name}`
        : r.kind === 'palette'
          ? r.entry.name
          : `${r.kind} ${r.name}`,
    ),
    ['▾Vocaloid', 'miku', 'rin', '▸Madoka Magica'],
  )
})

test('a filter overrides folds and hides non-matching groups', () => {
  const rows = pickerRows(entries, new Set(), 'mado')
  assert.deepEqual(
    rows.map((r) => (r.kind === 'group' ? `▾${r.name}` : r.kind === 'palette' ? r.entry.name : `${r.kind} ${r.name}`)),
    ['▾Madoka Magica', 'madoka', 'homura'],
  )
  assert.equal(firstPalette(rows), 1)
})

test('a name filter narrows inside the matching group', () => {
  const rows = pickerRows(entries, new Set(), 'ho')
  assert.deepEqual(
    rows.map((r) =>
      r.kind === 'group' ? `${r.name} (${r.count})` : r.kind === 'palette' ? r.entry.name : `${r.kind} ${r.name}`,
    ),
    ['Madoka Magica (1)', 'homura'],
  )
})

test('the default palette is never offered, even by filter', () => {
  assert.deepEqual(pickerRows(entries, new Set(), 'neu'), [])
})

test('series rows are folded headers matched through any member', () => {
  assert.deepEqual(
    seriesRows(entries, 'ho').map((r) =>
      r.kind === 'group' ? `${r.name} (${r.count})` : r.kind === 'palette' ? r.entry.name : `${r.kind} ${r.name}`,
    ),
    ['Madoka Magica (2)'],
  )
  assert.deepEqual(
    seriesRows(entries, '').map((r) => (r.kind === 'group' ? r.lead?.name : '')),
    ['miku', 'homura'],
  )
})

async function drive(
  keys: string[],
  opts: { color?: boolean; maxItems?: number; installed?: string[]; scope?: PickerScope; required?: boolean } = {},
): Promise<{ result: 'submit' | 'cancel'; frames: string; focused: string[]; picked: string[] }> {
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
  assert.match(frames, /▌ {2}▾ Vocaloid \(0\/2\)/)
  assert.match(frames, /▸ Madoka Magica \(0\/2\)/)
  assert.match(frames, /Catalog \(4\/4 · 0 picked\)/)
  assert.match(frames, /│ {4}Search…/)
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
  assert.match(frames, /│ {4}mado_/)
  assert.match(frames, /Catalog \(2\/4 · 0 picked\)/)
})

test('editing the filter keeps the focused palette when it still matches', async () => {
  const { picked } = await drive(['\x1b[C', '\x1b[B', '\x1b[B', 'i', ' ', '\r'])
  assert.deepEqual(picked, ['rin'])
})

test('the cursor snaps to the first match when the focused palette is filtered out', async () => {
  const { picked } = await drive(['\x1b[C', '\x1b[B', '\x1b[B', 'k', ' ', '\r'])
  assert.deepEqual(picked, ['miku'])
})

test('color rows carry the swatch squares and drop the ANSI source', async () => {
  const { frames } = await drive(['m', 'i', 'k', '\r'], { color: true })
  assert.ok(frames.includes('\x1b[38;2;238;238;238m■ \x1b[38;2;255;255;255m■ \x1b[38;2;128;128;128m■'))
  assert.doesNotMatch(frames, /ANSI/)
})

test('a small window counts the rows below it', async () => {
  const { frames } = await drive(['a', '\x03'], { maxItems: 2 })
  assert.match(frames, /↓ 4 more/)
})

test('ctrl-c cancels the picker', async () => {
  const { result } = await drive(['\x03'])
  assert.equal(result, 'cancel')
})

test('installed palettes start out picked', async () => {
  const { picked } = await drive(['\r'], { installed: ['rin'] })
  assert.deepEqual(picked, ['rin'])
})

test('space on a folded group picks its palettes without expanding it first', async () => {
  const { picked, frames } = await drive([' ', '\r'])
  assert.deepEqual(picked.sort(), ['miku', 'rin'])
  assert.match(frames, /▌ {2}▸ Vocaloid \(0\/2\)/)
})

test('a folded group still reports how many of its palettes are picked', async () => {
  const { frames } = await drive(['\x1b[B', '\r'], { installed: ['miku'] })
  assert.match(frames, /▸ Vocaloid \(1\/2\)/)
})

test('the filtered count comes from the catalog, not from the drawn rows', async () => {
  const { frames } = await drive(['m', 'i', '\r'])
  assert.match(frames, /Catalog \(1\/4 · 0 picked\)/)
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
  assert.match(frames, /Series \(2\/2 · 0 picked\)/)
  assert.match(frames, /▌ {2}○ Vocaloid +\(2\)/)
  assert.match(frames, /Series \(2\/2 · 1 picked\)/)
  assert.doesNotMatch(frames, /←→ fold/)
  assert.doesNotMatch(frames, /▾/)
})

test('series scope picks the whole series even when a member name filtered it', async () => {
  const { picked, frames } = await drive(['h', 'o', ' ', '\r'], { scope: 'series' })
  assert.deepEqual(picked.sort(), ['homura', 'madoka'])
  assert.match(frames, /Series \(1\/2 · 0 picked\)/)
  assert.match(frames, /▌ {2}● Madoka Magica \(2\) 魔法少女まどか☆マギカ/)
})

test('space toggles the row and never lands in the filter', async () => {
  const { picked, frames } = await drive(['m', 'i', ' ', 'k', '\r'])
  assert.deepEqual(picked, ['miku'])
  assert.match(frames, /│ {4}mik_/)
  assert.doesNotMatch(frames, /│ {4}mi k/)
})

test('the select all row picks every shown series, and again drops them', async () => {
  const all = await drive(['\x1b[A', ' ', '\r'], { scope: 'series' })
  assert.deepEqual(all.picked.sort(), ['homura', 'madoka', 'miku', 'rin'])
  const none = await drive(['\x1b[A', ' ', ' ', '\r'], { scope: 'series' })
  assert.deepEqual(none.picked, [])
})

test('a required picker refuses to continue with nothing picked', async () => {
  const { picked, frames } = await drive(['\r', ' ', '\r'], { scope: 'series', required: true })
  assert.match(frames, /Pick at least one series/)
  assert.deepEqual(picked.sort(), ['miku', 'rin'])
})

const shop: PaletteEntry[] = [
  entry({ name: 'kec@shop/arcade', group: 'kec@shop', catalog: 'neon' }),
  entry({ name: 'kec@shop/volt', group: 'kec@shop', catalog: 'neon' }),
  entry({ name: 'kec@shop/sakura', group: 'kec@shop', catalog: 'pastel' }),
  entry({ name: 'kec@shop/dusk', group: 'kec@shop' }),
]

test('a market lists its catalogs, then the palettes outside every catalog', () => {
  const rows = pickerRows(shop, new Set(['kec@shop', 'kec@shop/neon']), '')
  assert.deepEqual(
    rows.map((r) => (r.kind === 'palette' ? r.entry.name : `${r.kind} ${r.name} (${r.count})`)),
    [
      'group kec@shop (4)',
      'catalog neon (2)',
      'kec@shop/arcade',
      'kec@shop/volt',
      'catalog pastel (1)',
      'kec@shop/dusk',
    ],
  )
  assert.deepEqual(
    pickerRows(shop, new Set(), 'pastel').map((r) => (r.kind === 'palette' ? r.entry.name : `${r.kind} ${r.name}`)),
    ['group kec@shop', 'catalog pastel', 'kec@shop/sakura'],
  )
})

test('space on a catalog picks its palettes, left folds a palette back into its catalog, and rows show the bare name', async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  let frames = ''
  output.on('data', (chunk: Buffer) => {
    frames += chunk.toString()
  })
  const prompt = new PalettePrompt({ entries: [...entries, ...shop], color: false, input, output })
  const pending = prompt.prompt()
  for (const key of ['\x1b[B', '\x1b[B', '\x1b[C', '\x1b[B', ' ', '\x1b[C', '\x1b[B', '\x1b[D', '\r']) {
    await new Promise((resolve) => setTimeout(resolve, 5))
    input.write(key)
  }
  await pending
  assert.deepEqual([...prompt.picked].sort(), ['kec@shop/arcade', 'kec@shop/volt'])
  assert.match(frames, /▾ kec@shop \(2\/4\)/)
  assert.match(frames, / {4}● arcade/)
  assert.doesNotMatch(frames, /● kec@shop\/arcade/)
  assert.ok(frames.lastIndexOf('▌    ▸ neon (2/2)') > frames.lastIndexOf('● volt'))
})
