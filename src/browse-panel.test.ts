import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import { isCancel } from '@clack/core'

import { type BrowseIo, BrowsePanel, type Market } from './browse-panel.ts'
import type { PaletteEntry } from './emit/manifest.ts'

function entry(name: string, group: string): PaletteEntry {
  return {
    name,
    group,
    order: 1,
    ansiSource: 'Test',
    background: '#000000',
    foreground: '#eeeeee',
    cursor: '#ffffff',
    selection: '#222222',
    signature: ['#ffffff', '#eeeeee', '#000000'],
    signatureSlots: ['foreground', 'cursor', 'background'],
    ansi: Array.from({ length: 16 }, () => '#808080'),
    gate: [16.1, 3.9, 0, 16.1, 3.9, 16.1, 0, 0, 0],
    backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
  }
}

function market(source: string, id: string, names: string[], auto = false): Market {
  return {
    source,
    id,
    shown: source === 'official' ? 'the ttheme catalog' : `github.com/${source}`,
    entries: names.map((n) => entry(id === 'official' ? n : `${id}/${n}`, id === 'official' ? 'Vocaloid' : id)),
    auto,
    status: 'updated just now',
  }
}

const official = market('official', 'official', ['miku', 'rin'], true)
const pastel = market('alice/ttheme-pastel', 'alice@pastel', ['dusk', 'dawn'])

const ESC = '\x1b'
const STEERING = new RegExp(`${ESC}\\[K|${ESC}\\[\\?(?:2026|25)[hl]|${ESC}\\[H`, 'g')
const ROW = new RegExp(`${ESC}\\[\\d+;1H`, 'g')

function shown(raw: string): string {
  return raw.replace(STEERING, '').replace(ROW, '\n')
}

function io(overrides: Partial<BrowseIo> = {}): BrowseIo {
  return {
    refresh: () => Promise.reject(new Error('offline')),
    fetch: () => Promise.reject(new Error('offline')),
    search: () => Promise.resolve([]),
    ...overrides,
  }
}

async function drive(
  keys: string[],
  opts: {
    columns?: number
    markets?: Market[]
    installed?: string[]
    due?: string[]
    io?: BrowseIo
    hub?: 'browse'
  } = {},
) {
  const input = new PassThrough()
  const output = new PassThrough() as PassThrough & { columns?: number }
  output.columns = opts.columns ?? 100
  let frames = ''
  output.on('data', (chunk: Buffer) => {
    frames += shown(chunk.toString())
  })
  const saved = Object.getOwnPropertyDescriptor(process.stdout, 'columns')
  Object.defineProperty(process.stdout, 'columns', { value: 400, configurable: true, writable: true })
  try {
    const panel = new BrowsePanel({
      markets: opts.markets ?? [official, pastel],
      kept: [],
      installed: opts.installed ?? ['miku', 'alice@pastel/dusk'],
      problems: [],
      due: opts.due ?? [],
      io: opts.io ?? io(),
      color: false,
      ...(opts.hub ? { hub: opts.hub } : {}),
      input,
      output,
    })
    const pending = panel.prompt()
    let previous = ''
    for (const key of keys) {
      await new Promise((resolve) => setTimeout(resolve, previous === '\x1b' ? 80 : 5))
      input.write(key)
      previous = key
    }
    const result = await pending
    const last = frames.slice(frames.lastIndexOf('◆'))
    return { result, frames, last, panel: panel.result(), next: panel.next() }
  } finally {
    if (saved) {
      Object.defineProperty(process.stdout, 'columns', saved)
    } else {
      delete (process.stdout as { columns?: number }).columns
    }
  }
}

const TAB = '\x1b[1;2C'
const BACK_TAB = '\x1b[1;2D'
const PLAIN_TAB = '\t'
const SHIFT_TAB = '\x1b[Z'
const DOWN = '\x1b[B'
const RIGHT = '\x1b[C'
const LEFT = '\x1b[D'

test('shift+right and shift+left move between the four tabs and each keeps its own filter', async () => {
  const { frames } = await drive(['k', 'i', TAB, TAB, BACK_TAB, BACK_TAB, '\r'])
  assert.match(frames, /\[Catalog\] {2}Installed {3}Markets {3}Errors/)
  assert.match(frames, / Catalog {2}\[Installed\] {2}Markets/)
  assert.match(frames, /\[Markets\]/)
  assert.match(frames.slice(frames.lastIndexOf('[Catalog]')), /│ {4}ki_/)
})

test('the right panel sits beside the list from 94 columns, and folds into one line under it', async () => {
  const wide = await drive([RIGHT, DOWN, '\r'])
  assert.match(wide.last, /^◆ .* +│ miku$/m)
  assert.match(wide.last, /│ ▌ {4}● miku +│/)
  assert.match(wide.last, / │ The ttheme catalog$/m)
  assert.match(wide.last, / │ Installed$/m)
  const narrow = await drive([RIGHT, DOWN, '\r'], { columns: 80 })
  assert.doesNotMatch(narrow.last, / │ The ttheme catalog/)
  assert.match(narrow.last, /│ The ttheme catalog · Gate \d+\/\d+.* · Installed\n└/)
})

test('space on a market stages its removal, and its installed palettes stay picked', async () => {
  const { panel, frames } = await drive([TAB, TAB, DOWN, ' ', '\r'])
  assert.deepEqual(panel.removes, ['alice/ttheme-pastel'])
  assert.ok(panel.picked.has('alice@pastel/dusk'))
  assert.match(frames, /○ alice@pastel {2}Will remove/)
  assert.match(frames, / │ Will remove — alice@pastel\/dusk\n.* │ stays installed/)
})

test('left and right turn a market’s auto-update off and on, and only a change is kept', async () => {
  const on = await drive([TAB, TAB, DOWN, RIGHT, '\r'])
  assert.deepEqual(on.panel.auto, { 'alice/ttheme-pastel': true })
  assert.match(on.frames, /Auto-update turns on/)
  const back = await drive([TAB, TAB, DOWN, RIGHT, LEFT, '\r'])
  assert.deepEqual(back.panel.auto, {})
})

test('a repository typed into Markets is fetched, asked about, and staged with its palettes', async () => {
  const neon = market('bob/ttheme-neon', 'bob@neon', ['glow'])
  const fetched: string[] = []
  const answer = (key: string) =>
    drive([TAB, TAB, ...'bob/ttheme-neon', ' ', key, '\x7f'.repeat(15), TAB, TAB, '\r'], {
      io: io({
        fetch: (source) => {
          fetched.push(source)
          return Promise.resolve(neon)
        },
      }),
    })
  const yes = await answer('y')
  assert.deepEqual(fetched, ['bob/ttheme-neon'])
  assert.match(yes.frames, /\+ Add github\.com\/bob\/ttheme-neon/)
  assert.match(yes.frames, /Update bob@neon on its own when its author changes it\? y yes · n no · esc back/)
  assert.deepEqual(
    yes.panel.adds.map((m) => m.id),
    ['bob@neon'],
  )
  assert.deepEqual(yes.panel.auto, { 'bob/ttheme-neon': true })
  assert.match(yes.frames, /▸ bob@neon \(0\/1\)/)
  const no = await answer('n')
  assert.deepEqual(
    no.panel.adds.map((m) => m.id),
    ['bob@neon'],
  )
  assert.deepEqual(no.panel.auto, {})
})

test('esc while the question is up drops only the question', async () => {
  const neon = market('bob/ttheme-neon', 'bob@neon', ['glow'])
  const { result, panel } = await drive([TAB, TAB, ...'bob/ttheme-neon', ' ', '\x1b', '\r'], {
    io: io({ fetch: () => Promise.resolve(neon) }),
  })
  assert.ok(!isCancel(result))
  assert.deepEqual(panel.adds, [])
})

test('a market due at open refreshes in the background and its new palettes appear', async () => {
  const fresh = market('official', 'official', ['miku', 'rin', 'luka'], true)
  const { panel, frames } = await drive(['\r'], {
    due: ['official'],
    io: io({
      refresh: (source) =>
        Promise.resolve({
          market: fresh,
          refreshed: { source, id: 'official', count: 3, change: { added: ['luka'], changed: [], gone: [] } },
        }),
    }),
  })
  assert.equal(panel.refreshed.length, 1)
  assert.match(frames, /Updating… · /)
  assert.match(frames, /5\/5 · 2 picked/)
})

test('a failed update shows up under Errors with its reason', async () => {
  const { frames } = await drive([TAB, TAB, TAB, '\r'], { due: ['alice/ttheme-pastel'] })
  assert.match(frames, /\[Errors 1\]/)
  assert.match(frames, /✗ alice@pastel {2}Update failed: offline/)
})

test('inside the tabs, tab asks for the next screen at once, or first asks about what is staged', async () => {
  const clean = await drive([PLAIN_TAB], { hub: 'browse' })
  assert.ok(isCancel(clean.result))
  assert.equal(clean.next, 21)
  const back = await drive([SHIFT_TAB], { hub: 'browse' })
  assert.equal(back.next, 21)

  const stay = await drive([RIGHT, DOWN, ' ', PLAIN_TAB, '\x1b', '\r'], { hub: 'browse', installed: [] })
  assert.match(stay.frames, /Apply your changes before you leave\?/)
  assert.ok(!isCancel(stay.result))
  assert.equal(stay.next, undefined)

  const discard = await drive([RIGHT, DOWN, ' ', PLAIN_TAB, 'n'], { hub: 'browse', installed: [] })
  assert.ok(isCancel(discard.result))
  assert.equal(discard.next, 21)

  const apply = await drive([RIGHT, DOWN, ' ', PLAIN_TAB, 'y'], { hub: 'browse', installed: [] })
  assert.ok(!isCancel(apply.result))
  assert.equal(apply.next, undefined)
  assert.equal(apply.panel.picked.size, 1)
})

test('tab does nothing in browse on its own, and shift+arrows switch tabs without acting on the row', async () => {
  const plain = await drive([PLAIN_TAB, '\r'])
  assert.match(plain.last, /\[Catalog\]/)
  const moved = await drive([TAB, TAB, BACK_TAB, '\r'])
  assert.match(moved.last, /\[Installed\]/)
  assert.deepEqual(moved.panel.auto, {})
})
