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
    background: '#000000',
    foreground: '#eeeeee',
    cursor: '#ffffff',
    selection: '#222222',
    ansi: Array.from({ length: 16 }, () => '#808080'),
    gate: [16.1, 4.6, 0, 16.1, 3.9],
    backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
    ...partial,
  }
}

const works: Work[] = [
  { id: 'starfall', name: 'Starfall', characters: [{ id: 'pip' }, { id: 'quill' }] },
  {
    id: 'harbor-lights',
    name: 'Harbor Lights',
    native: '灯台あかり☆ライツ',
    lead: 'harbor-lights/juno',
    characters: [
      { id: 'wren', native: ['レン'], danbooru: 'wren_vale' },
      { id: 'juno', native: ['ジュノ'] },
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
    entry({ name: 'ttheme/pip', subject: 'starfall/pip' }),
    entry({ name: 'ttheme/quill', subject: 'starfall/quill' }),
    entry({ name: 'ttheme/wren', subject: 'harbor-lights/wren' }),
    entry({ name: 'ttheme/juno', subject: 'harbor-lights/juno' }),
  ],
  works,
)

const shop: PaletteEntry[] = [
  entry({ name: 'kai@shop/arcade', subject: 'neon-city/arcade' }),
  entry({ name: 'kai@shop/volt', subject: 'neon-city/volt' }),
  entry({ name: 'kai@shop/sakura', subject: 'pastel-days/sakura' }),
  entry({ name: 'kai@shop/dusk' }),
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
  const wren = entries.find((e) => e.name === 'ttheme/wren')
  assert.ok(wren)
  assert.ok(matchesPalette(wren, works, 'wre'))
  assert.ok(matchesPalette(wren, works, 'ttheme/wren'))
  assert.ok(matchesPalette(wren, works, 'ttheme'))
  assert.ok(matchesPalette(wren, works, 'LIGHTS'))
  assert.ok(matchesPalette(wren, works, '灯台'))
  assert.ok(matchesPalette(wren, works, 'レン'))
  assert.ok(matchesPalette(wren, works, 'vale'))
  assert.ok(!matchesPalette(wren, works, 'quill'))
  assert.ok(!matchesPalette(wren, works, 'ジュノ'))
  const dusk = shop.at(-1)
  assert.ok(dusk)
  assert.ok(matchesPalette(dusk, works, 'kai@shop'))
  assert.ok(!matchesPalette(dusk, works, 'wre'))
})

test('matchesPalette ignores spaces and symbols on both sides, since a typed space never reaches the filter', () => {
  const wren = entries.find((e) => e.name === 'ttheme/wren')
  assert.ok(wren)
  assert.ok(matchesPalette(wren, works, 'harborlights'))
  assert.ok(matchesPalette(wren, works, 'Harbor Lights'))
  assert.ok(matchesPalette(wren, works, '灯台あかりライツ'))
  assert.ok(matchesPalette(wren, works, '☆'))
  assert.ok(!matchesPalette(wren, works, 'wrenquill'))
})

test('folded rows show the works by name only', () => {
  const rows = pickerRows(entries, works, new Set(), '')
  assert.deepEqual(rows.map(shown), ['top Harbor Lights (2)', 'top Starfall (2)'])
  assert.equal(firstPalette(rows), 0)
})

test('expanding a work inserts its palettes under the header, in the order they came', () => {
  const rows = pickerRows(entries, works, new Set(['starfall']), '')
  assert.deepEqual(rows.map(shown), ['top Harbor Lights (2)', 'top Starfall (2)', 'ttheme/pip', 'ttheme/quill'])
  assert.deepEqual(
    rows.map((r) => (r.kind === 'top' ? r.expanded : undefined)),
    [false, true, undefined, undefined],
  )
})

test('a filter overrides folds and hides the works it does not match', () => {
  const rows = pickerRows(entries, works, new Set(), 'harb')
  assert.deepEqual(rows.map(shown), ['top Harbor Lights (2)', 'ttheme/juno', 'ttheme/wren'])
  assert.equal(firstPalette(rows), 1)
})

test('a name filter narrows inside the matching work', () => {
  assert.deepEqual(pickerRows(entries, works, new Set(), 'ju').map(shown), ['top Harbor Lights (1)', 'ttheme/juno'])
})

test('work rows are folded headers matched through any member, each led by its lead character’s palette', () => {
  assert.deepEqual(workRows(entries, works, 'ju').map(shown), ['top Harbor Lights (2)'])
  assert.deepEqual(
    workRows(entries, works, '').map((r) => (r.kind === 'top' ? r.lead?.name : '')),
    ['ttheme/juno', 'ttheme/pip'],
  )
})

test('originals sit under their publisher after the works, the built-in one first', () => {
  const plain = entry({ name: 'ttheme/plain' })
  const glow = entry({ name: 'bob@neon/glow' })
  const rows = pickerRows([...entries, ...shop, glow, plain], works, new Set(), '')

  assert.deepEqual(rows.map(shown), [
    'top Harbor Lights (2)',
    'top Neon City (2)',
    'top Pastel Days (1)',
    'top Starfall (2)',
    'top ttheme (1)',
    'top bob@neon (1)',
    'top kai@shop (1)',
  ])

  assert.deepEqual(
    rows.map((r) => r.kind === 'top' && r.originals === true),
    [false, false, false, false, true, true, true],
  )
})

test('a palette whose character appears in another work sits on that work’s shelf too, and counts once', () => {
  const paired: Work[] = [
    { id: 'glass-arcade', name: 'Glass Arcade', characters: [{ id: 'lumi', also: ['night-parade'] }] },
    { id: 'night-parade', name: "Night Parade's Eve", characters: [{ id: 'bram' }] },
  ]

  const cast = worldOrder(
    [
      entry({ name: 'ttheme/bram', subject: 'night-parade/bram' }),
      entry({ name: 'ttheme/lumi', subject: 'glass-arcade/lumi' }),
    ],
    paired,
  )

  assert.deepEqual(pickerRows(cast, paired, new Set(['glass-arcade', 'night-parade']), '').map(shown), [
    'top Glass Arcade (1)',
    'ttheme/lumi',
    "top Night Parade's Eve (2)",
    'ttheme/lumi',
    'ttheme/bram',
  ])

  const list = new PaletteList({ entries: cast, works: paired, picked: new Set(), color: false })
  assert.match(list.window().lines[0] ?? '', /Select all \(2\)/)
  assert.equal(list.total(), 2)
  list.move(1)
  list.move(1)
  list.pick()
  assert.deepEqual([...list.picked].sort(), ['ttheme/bram', 'ttheme/lumi'])
})

test('under a work a palette names its publisher after its name unless it is built in, and an original names none under its own', () => {
  const tidewater: Work[] = [{ id: 'tidewater', name: 'Tidewater', characters: [{ id: 'tamsin' }] }]

  const both = worldOrder(
    [
      entry({ name: 'alice@pastel/tamsin', subject: 'tidewater/tamsin' }),
      entry({ name: 'ttheme/tamsin', subject: 'tidewater/tamsin' }),
      entry({ name: 'alice@pastel/dusk' }),
    ],
    tidewater,
  )

  const list = new PaletteList({ entries: both, works: tidewater, picked: new Set(), color: false })
  list.fold(true)
  list.move(1)
  list.move(1)
  list.move(1)
  list.fold(true)
  const lines = list.window().lines.join('\n')
  assert.match(lines, /^ {5}○ tamsin$/m)
  assert.match(lines, /^ {5}○ tamsin {2}alice@pastel$/m)
  assert.match(lines, /── Originals/)
  assert.match(lines, /^ {5}○ dusk$/m)
  assert.ok(lines.indexOf('○ tamsin\n') < lines.indexOf('○ tamsin  alice@pastel'))
})

test('in a marketplace a list holds its works, then its originals, each palette by its own name', () => {
  const rows = pickerRows(shop, works, new Set(['kai@shop', 'kai@shop/neon-city']), '', 'marketplaces')

  assert.deepEqual(rows.map(shown), [
    'top kai@shop (4)',
    'shelf Neon City (2)',
    'kai@shop/arcade',
    'kai@shop/volt',
    'shelf Pastel Days (1)',
    'kai@shop/dusk',
  ])

  assert.deepEqual(pickerRows(shop, works, new Set(), 'pastel', 'marketplaces').map(shown), [
    'top kai@shop (1)',
    'shelf Pastel Days (1)',
    'kai@shop/sakura',
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
  assert.deepEqual(rows.map(shown), ['top ttheme (4)', 'top bob@neon (0)', 'top kai@shop (4)'])
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
  assert.deepEqual(picked, ['ttheme/juno'])
  assert.deepEqual(focused, ['ttheme/juno'])
  assert.match(frames, /▌ {2}▾ Harbor Lights \(0\/2\) 灯台あかり☆ライツ/)
  assert.match(frames, /▸ Starfall \(0\/2\)/)
  assert.match(frames, /Palettes \(4\/4 · 0 picked\)/)
})

test('works fold back and the cursor moves across them', async () => {
  const { picked, focused } = await drive([RIGHT, DOWN, LEFT, DOWN, RIGHT, DOWN, ' ', '\r'])
  assert.deepEqual(picked, ['ttheme/pip'])
  assert.deepEqual(focused, ['ttheme/juno', 'ttheme/pip'])
})

test('typing filters and the cursor lands on the first match', async () => {
  const { picked, frames } = await drive(['h', 'a', 'r', 'b', ' ', '\r'])
  assert.deepEqual(picked, ['ttheme/juno'])
  assert.match(frames, /│ {4}harb_/)
  assert.match(frames, /Palettes \(2\/4 · 0 picked\)/)
})

test('editing the filter keeps the focused palette when it still matches', async () => {
  const { picked } = await drive([RIGHT, DOWN, DOWN, 'a', ' ', '\r'])
  assert.deepEqual(picked, ['ttheme/wren'])
})

test('the cursor snaps to the first match when the focused palette is filtered out', async () => {
  const { picked } = await drive([RIGHT, DOWN, DOWN, 'u', ' ', '\r'])
  assert.deepEqual(picked, ['ttheme/juno'])
})

test('color rows carry the swatch squares: foreground, cursor and selection, then the accents', async () => {
  const { frames } = await drive(['p', 'i', 'p', '\r'], { color: true })
  assert.ok(
    frames.includes('\x1b[38;2;238;238;238m■ \x1b[38;2;255;255;255m■ \x1b[38;2;34;34;34m■ \x1b[38;2;128;128;128m■'),
  )
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
  const { picked } = await drive(['\r'], { installed: ['ttheme/quill'] })
  assert.deepEqual(picked, ['ttheme/quill'])
})

test('space on a folded work picks its palettes without expanding it first', async () => {
  const { picked, frames } = await drive([' ', '\r'])
  assert.deepEqual(picked.sort(), ['ttheme/juno', 'ttheme/wren'])
  assert.match(frames, /▌ {2}▸ Harbor Lights \(0\/2\)/)
})

test('a folded work still reports how many of its palettes are picked', async () => {
  const { frames } = await drive([DOWN, '\r'], { installed: ['ttheme/pip'] })
  assert.match(frames, /▸ Starfall \(1\/2\)/)
})

test('the filtered count comes from the palettes, not from the drawn rows', async () => {
  const { frames } = await drive(['p', 'i', '\r'])
  assert.match(frames, /Palettes \(1\/4 · 0 picked\)/)
})

test('space on a work row picks every palette under it, and again drops them', async () => {
  const all = await drive([RIGHT, ' ', '\r'])
  assert.deepEqual(all.picked.sort(), ['ttheme/juno', 'ttheme/wren'])
  const none = await drive([RIGHT, ' ', ' ', '\r'])
  assert.deepEqual(none.picked, [])
})

test('work scope lists works only, previews each lead and never unfolds', async () => {
  const { picked, frames, focused } = await drive([RIGHT, DOWN, RIGHT, ' ', '\r'], { scope: 'work' })
  assert.deepEqual(picked.sort(), ['ttheme/pip', 'ttheme/quill'])
  assert.deepEqual(focused, ['ttheme/juno', 'ttheme/pip'])
  assert.match(frames, /Works \(2\/2 · 0 picked\)/)
  assert.match(frames, /▌ {2}○ Harbor Lights \(2\) 灯台あかり☆ライツ/)
  assert.match(frames, /▌ {2}○ Starfall +\(2\)/)
  assert.match(frames, /Works \(2\/2 · 1 picked\)/)
  assert.doesNotMatch(frames, /←→ fold/)
  assert.doesNotMatch(frames, /▾/)
})

test('work scope picks the whole work even when a member name filtered it', async () => {
  const { picked, frames } = await drive(['j', 'u', ' ', '\r'], { scope: 'work' })
  assert.deepEqual(picked.sort(), ['ttheme/juno', 'ttheme/wren'])
  assert.match(frames, /Works \(1\/2 · 0 picked\)/)
  assert.match(frames, /▌ {2}● Harbor Lights \(2\) 灯台あかり☆ライツ/)
})

test('space toggles the row and never lands in the filter', async () => {
  const { picked, frames } = await drive(['p', 'i', ' ', 'p', '\r'])
  assert.deepEqual(picked, ['ttheme/pip'])
  assert.match(frames, /│ {4}pip_/)
  assert.doesNotMatch(frames, /│ {4}pi p/)
})

test('the select all row picks every shown work, and again drops them', async () => {
  const all = await drive([UP, ' ', '\r'], { scope: 'work' })
  assert.deepEqual(all.picked.sort(), ['ttheme/juno', 'ttheme/pip', 'ttheme/quill', 'ttheme/wren'])
  const none = await drive([UP, ' ', ' ', '\r'], { scope: 'work' })
  assert.deepEqual(none.picked, [])
})

test('a required picker refuses to continue with nothing picked', async () => {
  const { picked, frames } = await drive(['\r', ' ', '\r'], { scope: 'work', required: true })
  assert.match(frames, /Pick at least one work/)
  assert.deepEqual(picked.sort(), ['ttheme/juno', 'ttheme/wren'])
})

test('space on a palette of another publisher picks it under its work, left folds it back, and the originals follow the rule', async () => {
  const { picked, frames } = await drive([DOWN, RIGHT, DOWN, ' ', LEFT, '\r'], { entries: [...entries, ...shop] })
  assert.deepEqual(picked, ['kai@shop/arcade'])
  assert.match(frames, /▾ Neon City \(0\/2\)/)
  assert.match(frames, / {4}● arcade {2}kai@shop/)
  assert.doesNotMatch(frames, /kai@shop\/arcade/)
  assert.match(frames, /── Originals ─+\n.*▸ kai@shop \(0\/1\)/)
  assert.ok(frames.lastIndexOf('▌  ▸ Neon City (1/2)') > frames.lastIndexOf('● arcade'))
})
