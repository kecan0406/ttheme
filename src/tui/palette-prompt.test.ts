import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import { type Work, worldOrder } from '../core/commons.ts'
import type { PaletteEntry } from '../core/manifest.ts'
import {
  firstPalette,
  matchesPalette,
  PaletteList,
  PalettePrompt,
  type PickerScope,
  pickerRows,
  stepRow,
  workRows,
} from './palette-prompt.ts'

function entry(partial: Partial<PaletteEntry> & { name: string }): PaletteEntry {
  return {
    ansiSource: 'Test',
    background: '#000000',
    foreground: '#eeeeee',
    cursor: '#ffffff',
    selection: '#222222',
    signature: ['#ffffff', '#eeeeee', '#000000'],
    signatureSlots: ['foreground', 'cursor', 'background'],
    ansi: Array.from({ length: 16 }, () => '#808080'),
    gate: [16.1, 4.6, 0, 16.1, 3.9],
    backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
    ...partial,
  }
}

const works: Work[] = [
  { id: 'vocaloid', name: 'Vocaloid', characters: [{ id: 'miku' }, { id: 'rin' }] },
  {
    id: 'madoka-magica',
    name: 'Madoka Magica',
    native: '魔法少女まどか☆マギカ',
    lead: 'madoka-magica/homura',
    characters: [
      { id: 'madoka', native: ['鹿目まどか'] },
      { id: 'homura', native: ['暁美ほむら'] },
    ],
  },
  {
    id: 'neon-city',
    name: 'Neon City',
    characters: [{ id: 'arcade' }, { id: 'volt' }],
  },
  { id: 'pastel-days', name: 'Pastel Days', characters: [{ id: 'sakura' }] },
]

const entries: PaletteEntry[] = worldOrder(
  [
    entry({ name: 'ttheme/neutral', default: true }),
    entry({ name: 'ttheme/miku', subject: 'vocaloid/miku' }),
    entry({ name: 'ttheme/rin', subject: 'vocaloid/rin' }),
    entry({ name: 'ttheme/madoka', subject: 'madoka-magica/madoka' }),
    entry({ name: 'ttheme/homura', subject: 'madoka-magica/homura' }),
  ],
  works,
)

const shop: PaletteEntry[] = [
  entry({ name: 'kec@shop/arcade', subject: 'neon-city/arcade' }),
  entry({ name: 'kec@shop/volt', subject: 'neon-city/volt' }),
  entry({ name: 'kec@shop/sakura', subject: 'pastel-days/sakura' }),
  entry({ name: 'kec@shop/dusk' }),
]

const shown = (r: { kind: string; name?: string; title?: string; count?: number; entry?: PaletteEntry }) =>
  r.kind === 'palette' ? r.entry?.name : `${r.kind} ${r.title} (${r.count})`

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

test('matchesPalette filters by name, publisher, work, native title and the character’s names', () => {
  const madoka = entries.find((e) => e.name === 'ttheme/madoka')
  assert.ok(madoka)
  assert.ok(matchesPalette(madoka, works, 'mado'))
  assert.ok(matchesPalette(madoka, works, 'ttheme/madoka'))
  assert.ok(matchesPalette(madoka, works, 'ttheme'))
  assert.ok(matchesPalette(madoka, works, 'MAGICA'))
  assert.ok(matchesPalette(madoka, works, '魔法少女'))
  assert.ok(matchesPalette(madoka, works, '鹿目'))
  assert.ok(!matchesPalette(madoka, works, 'rin'))
  assert.ok(!matchesPalette(madoka, works, 'ほむら'))
  const dusk = shop.at(-1)
  assert.ok(dusk)
  assert.ok(matchesPalette(dusk, works, 'kec@shop'))
  assert.ok(!matchesPalette(dusk, works, 'mado'))
})

test('matchesPalette ignores spaces and symbols on both sides, since a typed space never reaches the filter', () => {
  const madoka = entries.find((e) => e.name === 'ttheme/madoka')
  assert.ok(madoka)
  assert.ok(matchesPalette(madoka, works, 'madokamagica'))
  assert.ok(matchesPalette(madoka, works, 'Madoka Magica'))
  assert.ok(matchesPalette(madoka, works, '魔法少女まどかマギカ'))
  assert.ok(matchesPalette(madoka, works, '☆'))
  assert.ok(!matchesPalette(madoka, works, 'madokarin'))
})

test('folded rows show the works by name only, without the fallback palette', () => {
  const rows = pickerRows(entries, works, new Set(), '')
  assert.deepEqual(rows.map(shown), ['top Madoka Magica (2)', 'top Vocaloid (2)'])
  assert.equal(firstPalette(rows), 0)
})

test('expanding a work inserts its palettes under the header, in the order they came', () => {
  const rows = pickerRows(entries, works, new Set(['vocaloid']), '')
  assert.deepEqual(rows.map(shown), ['top Madoka Magica (2)', 'top Vocaloid (2)', 'ttheme/miku', 'ttheme/rin'])
  assert.deepEqual(
    rows.map((r) => (r.kind === 'top' ? r.expanded : undefined)),
    [false, true, undefined, undefined],
  )
})

test('a filter overrides folds and hides the works it does not match', () => {
  const rows = pickerRows(entries, works, new Set(), 'mado')
  assert.deepEqual(rows.map(shown), ['top Madoka Magica (2)', 'ttheme/homura', 'ttheme/madoka'])
  assert.equal(firstPalette(rows), 1)
})

test('a name filter narrows inside the matching work', () => {
  assert.deepEqual(pickerRows(entries, works, new Set(), 'ho').map(shown), ['top Madoka Magica (1)', 'ttheme/homura'])
})

test('the fallback palette is never offered, even by filter', () => {
  assert.deepEqual(pickerRows(entries, works, new Set(), 'neu'), [])
})

test('work rows are folded headers matched through any member, each led by its lead character’s palette', () => {
  assert.deepEqual(workRows(entries, works, 'ho').map(shown), ['top Madoka Magica (2)'])
  assert.deepEqual(
    workRows(entries, works, '').map((r) => (r.kind === 'top' ? r.lead?.name : '')),
    ['ttheme/homura', 'ttheme/miku'],
  )
})

test('originals sit under their publisher after the works, the built-in one first', () => {
  const plain = entry({ name: 'ttheme/plain' })
  const glow = entry({ name: 'bob@neon/glow' })
  const rows = pickerRows([...entries, ...shop, glow, plain], works, new Set(), '')

  assert.deepEqual(rows.map(shown), [
    'top Madoka Magica (2)',
    'top Neon City (2)',
    'top Pastel Days (1)',
    'top Vocaloid (2)',
    'top ttheme (1)',
    'top bob@neon (1)',
    'top kec@shop (1)',
  ])

  assert.deepEqual(
    rows.map((r) => r.kind === 'top' && r.originals === true),
    [false, false, false, false, true, true, true],
  )
})

test('a palette whose character appears in another work sits on that work’s shelf too, and counts once', () => {
  const bemani: Work[] = [
    { id: 'jubeat', name: 'jubeat', characters: [{ id: 'rasis', also: ['pop-n-music'] }] },
    { id: 'pop-n-music', name: "pop'n music", characters: [{ id: 'mimi' }] },
  ]

  const cast = worldOrder(
    [
      entry({ name: 'ttheme/mimi', subject: 'pop-n-music/mimi' }),
      entry({ name: 'ttheme/rasis', subject: 'jubeat/rasis' }),
    ],
    bemani,
  )

  assert.deepEqual(pickerRows(cast, bemani, new Set(['jubeat', 'pop-n-music']), '').map(shown), [
    'top jubeat (1)',
    'ttheme/rasis',
    "top pop'n music (2)",
    'ttheme/rasis',
    'ttheme/mimi',
  ])

  const list = new PaletteList({ entries: cast, works: bemani, picked: new Set(), color: false })
  assert.match(list.window().lines[0] ?? '', /Select all \(2\)/)
  assert.equal(list.total(), 2)
  list.move(1)
  list.move(1)
  list.pick()
  assert.deepEqual([...list.picked].sort(), ['ttheme/mimi', 'ttheme/rasis'])
})

test('under a work a palette names its publisher after its name unless it is built in, and an original names none under its own', () => {
  const evangelion: Work[] = [{ id: 'evangelion', name: 'Evangelion', characters: [{ id: 'rei' }] }]

  const both = worldOrder(
    [
      entry({ name: 'alice@pastel/rei', subject: 'evangelion/rei' }),
      entry({ name: 'ttheme/rei', subject: 'evangelion/rei' }),
      entry({ name: 'alice@pastel/dusk' }),
    ],
    evangelion,
  )

  const list = new PaletteList({ entries: both, works: evangelion, picked: new Set(), color: false })
  list.fold(true)
  list.move(1)
  list.move(1)
  list.move(1)
  list.fold(true)
  const lines = list.window().lines.join('\n')
  assert.match(lines, /^ {5}○ rei$/m)
  assert.match(lines, /^ {5}○ rei {2}alice@pastel$/m)
  assert.match(lines, /── Originals/)
  assert.match(lines, /^ {5}○ dusk$/m)
  assert.ok(lines.indexOf('○ rei\n') < lines.indexOf('○ rei  alice@pastel'))
})

test('in a marketplace a list holds its works, then its originals, each palette by its own name', () => {
  const rows = pickerRows(shop, works, new Set(['kec@shop', 'kec@shop/neon-city']), '', 'marketplaces')

  assert.deepEqual(rows.map(shown), [
    'top kec@shop (4)',
    'shelf Neon City (2)',
    'kec@shop/arcade',
    'kec@shop/volt',
    'shelf Pastel Days (1)',
    'kec@shop/dusk',
  ])

  assert.deepEqual(pickerRows(shop, works, new Set(), 'pastel', 'marketplaces').map(shown), [
    'top kec@shop (1)',
    'shelf Pastel Days (1)',
    'kec@shop/sakura',
  ])

  const list = new PaletteList({
    entries: shop,
    works,
    picked: new Set(),
    layout: 'marketplaces',
    mode: 'inside',
    color: false,
  })

  list.fold(true)
  list.move(1)
  assert.match(list.window().lines.join('\n'), /^▌ {4}○ arcade\n {5}○ volt\n {3}▸ Pastel Days \(0\/1\)\n {3}○ dusk$/m)
  assert.equal(list.outer(), false)
  list.fold(false)
  assert.equal(list.focusedRow()?.kind, 'shelf')
  assert.equal(list.outer(), true)
})

test('the marketplaces given come first in their order, empty ones included, and the rest after them', () => {
  const rows = pickerRows([...entries, ...shop], works, new Set(), '', 'marketplaces', ['ttheme', 'bob@neon'], 'cards')
  assert.deepEqual(rows.map(shown), ['top ttheme (4)', 'top bob@neon (0)', 'top kec@shop (4)'])
})

async function drive(
  keys: string[],
  opts: {
    color?: boolean
    maxItems?: number
    installed?: string[]
    scope?: PickerScope
    required?: boolean
    entries?: PaletteEntry[]
  } = {},
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
    works,
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

const UP = '\x1b[A'
const DOWN = '\x1b[B'
const RIGHT = '\x1b[C'
const LEFT = '\x1b[D'

test('right unfolds a work and space picks the palette under the cursor', async () => {
  const { picked, frames, focused } = await drive([RIGHT, DOWN, ' ', '\r'])
  assert.deepEqual(picked, ['ttheme/homura'])
  assert.deepEqual(focused, ['ttheme/homura'])
  assert.match(frames, /▌ {2}▾ Madoka Magica \(0\/2\) 魔法少女まどか☆マギカ/)
  assert.match(frames, /▸ Vocaloid \(0\/2\)/)
  assert.match(frames, /Palettes \(4\/4 · 0 picked\)/)
  assert.match(frames, /│ {4}Search…/)
  assert.match(frames, /space pick {3}type to filter {3}enter install/)
})

test('works fold back and the cursor moves across them', async () => {
  const { picked, focused } = await drive([RIGHT, DOWN, LEFT, DOWN, RIGHT, DOWN, ' ', '\r'])
  assert.deepEqual(picked, ['ttheme/miku'])
  assert.deepEqual(focused, ['ttheme/homura', 'ttheme/miku'])
})

test('typing filters and the cursor lands on the first match', async () => {
  const { picked, frames } = await drive(['m', 'a', 'd', 'o', ' ', '\r'])
  assert.deepEqual(picked, ['ttheme/homura'])
  assert.match(frames, /│ {4}mado_/)
  assert.match(frames, /Palettes \(2\/4 · 0 picked\)/)
})

test('editing the filter keeps the focused palette when it still matches', async () => {
  const { picked } = await drive([RIGHT, DOWN, DOWN, 'a', ' ', '\r'])
  assert.deepEqual(picked, ['ttheme/madoka'])
})

test('the cursor snaps to the first match when the focused palette is filtered out', async () => {
  const { picked } = await drive([RIGHT, DOWN, DOWN, 'u', ' ', '\r'])
  assert.deepEqual(picked, ['ttheme/homura'])
})

test('color rows carry the swatch squares and drop the ANSI source', async () => {
  const { frames } = await drive(['m', 'i', 'k', '\r'], { color: true })
  assert.ok(frames.includes('\x1b[38;2;238;238;238m■ \x1b[38;2;255;255;255m■ \x1b[38;2;128;128;128m■'))
  assert.doesNotMatch(frames, /Test/)
})

test('a small window counts the rows below it, and the rows above it once scrolled', async () => {
  const { frames } = await drive(['a', '\x03'], { maxItems: 2 })
  assert.match(frames, /↓ 4 more/)
  const scrolled = await drive(['a', DOWN, DOWN, DOWN, '\x03'], { maxItems: 2 })
  assert.match(scrolled.frames, /↑ \d+ more {2}↓ \d+ more/)
})

test('ctrl-c cancels the picker', async () => {
  const { result } = await drive(['\x03'])
  assert.equal(result, 'cancel')
})

test('installed palettes start out picked', async () => {
  const { picked } = await drive(['\r'], { installed: ['ttheme/rin'] })
  assert.deepEqual(picked, ['ttheme/rin'])
})

test('space on a folded work picks its palettes without expanding it first', async () => {
  const { picked, frames } = await drive([' ', '\r'])
  assert.deepEqual(picked.sort(), ['ttheme/homura', 'ttheme/madoka'])
  assert.match(frames, /▌ {2}▸ Madoka Magica \(0\/2\)/)
})

test('a folded work still reports how many of its palettes are picked', async () => {
  const { frames } = await drive([DOWN, '\r'], { installed: ['ttheme/miku'] })
  assert.match(frames, /▸ Vocaloid \(1\/2\)/)
})

test('the filtered count comes from the palettes, not from the drawn rows', async () => {
  const { frames } = await drive(['m', 'i', '\r'])
  assert.match(frames, /Palettes \(1\/4 · 0 picked\)/)
})

test('space on a work row picks every palette under it, and again drops them', async () => {
  const all = await drive([RIGHT, ' ', '\r'])
  assert.deepEqual(all.picked.sort(), ['ttheme/homura', 'ttheme/madoka'])
  const none = await drive([RIGHT, ' ', ' ', '\r'])
  assert.deepEqual(none.picked, [])
})

test('work scope lists works only, previews each lead and never unfolds', async () => {
  const { picked, frames, focused } = await drive([RIGHT, DOWN, RIGHT, ' ', '\r'], { scope: 'work' })
  assert.deepEqual(picked.sort(), ['ttheme/miku', 'ttheme/rin'])
  assert.deepEqual(focused, ['ttheme/homura', 'ttheme/miku'])
  assert.match(frames, /Works \(2\/2 · 0 picked\)/)
  assert.match(frames, /▌ {2}○ Madoka Magica \(2\) 魔法少女まどか☆マギカ/)
  assert.match(frames, /▌ {2}○ Vocaloid +\(2\)/)
  assert.match(frames, /Works \(2\/2 · 1 picked\)/)
  assert.doesNotMatch(frames, /←→ fold/)
  assert.doesNotMatch(frames, /▾/)
})

test('work scope picks the whole work even when a member name filtered it', async () => {
  const { picked, frames } = await drive(['h', 'o', ' ', '\r'], { scope: 'work' })
  assert.deepEqual(picked.sort(), ['ttheme/homura', 'ttheme/madoka'])
  assert.match(frames, /Works \(1\/2 · 0 picked\)/)
  assert.match(frames, /▌ {2}● Madoka Magica \(2\) 魔法少女まどか☆マギカ/)
})

test('space toggles the row and never lands in the filter', async () => {
  const { picked, frames } = await drive(['m', 'i', ' ', 'k', '\r'])
  assert.deepEqual(picked, ['ttheme/miku'])
  assert.match(frames, /│ {4}mik_/)
  assert.doesNotMatch(frames, /│ {4}mi k/)
})

test('the select all row picks every shown work, and again drops them', async () => {
  const all = await drive([UP, ' ', '\r'], { scope: 'work' })
  assert.deepEqual(all.picked.sort(), ['ttheme/homura', 'ttheme/madoka', 'ttheme/miku', 'ttheme/rin'])
  const none = await drive([UP, ' ', ' ', '\r'], { scope: 'work' })
  assert.deepEqual(none.picked, [])
})

test('a required picker refuses to continue with nothing picked', async () => {
  const { picked, frames } = await drive(['\r', ' ', '\r'], { scope: 'work', required: true })
  assert.match(frames, /Pick at least one work/)
  assert.deepEqual(picked.sort(), ['ttheme/homura', 'ttheme/madoka'])
})

test('space on a palette of another publisher picks it under its work, left folds it back, and the originals follow the rule', async () => {
  const { picked, frames } = await drive([DOWN, RIGHT, DOWN, ' ', LEFT, '\r'], { entries: [...entries, ...shop] })
  assert.deepEqual(picked, ['kec@shop/arcade'])
  assert.match(frames, /▾ Neon City \(0\/2\)/)
  assert.match(frames, / {4}● arcade {2}kec@shop/)
  assert.doesNotMatch(frames, /kec@shop\/arcade/)
  assert.match(frames, /── Originals ─+\n.*▸ kec@shop \(0\/1\)/)
  assert.ok(frames.lastIndexOf('▌  ▸ Neon City (1/2)') > frames.lastIndexOf('● arcade'))
})
