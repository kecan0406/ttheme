import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import cells from 'fast-string-width'

import { type BrowseIo, BrowsePanel, type Marketplace } from './browse-panel.ts'
import type { PaletteEntry } from './manifest.ts'
import type { Listed, Listing } from './marketplace-index.ts'

function entry(name: string, catalog?: string): PaletteEntry {
  return {
    name,
    ...(catalog ? { catalog } : {}),
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

function marketplace(source: string, id: string, names: string[], auto = false): Marketplace {
  return {
    source,
    id,
    shown: source === 'official' ? 'the official marketplace' : `github.com/${source}`,
    entries: names.map((n) => entry(id === 'official' ? n : `${id}/${n}`, id === 'official' ? 'Vocaloid' : undefined)),
    auto,
    status: source === 'official' ? 'comes with ttheme' : 'updated just now',
  }
}

function listedOf(source: string, id: string, stars: number, about: string, names: string[]): Listed {
  const palettes = names.map((name) => {
    const { background, foreground, cursor, selection, ansi, signatureSlots } = entry(name)
    return { name, background, foreground, cursor, selection, ansi, signatureSlots }
  })
  return { id, source, about, stars, updated: '2026-10-09', palettes }
}

function listing(...marketplaces: Listed[]): Listing {
  return { marketplaces, at: Date.now() }
}

const official = marketplace('official', 'official', ['miku', 'rin'])
const pastel = marketplace('alice/ttheme-pastel', 'alice@pastel', ['dusk', 'dawn'])

const FRAME = '\u0001'
const CSI = /\[([0-?]*)[ -/]*([@-~])/y

class Glass {
  readonly frames: string[] = []
  private readonly cells: string[][]
  private row = 0
  private col = 0
  private readonly width: number

  constructor(width: number, height: number) {
    this.width = width
    this.cells = Array.from({ length: height }, () => [])
  }

  feed(text: string): void {
    let at = 0
    while (at < text.length) {
      if (text[at] === '\x1b') {
        at = this.sequence(text, at)
        continue
      }
      const ch = String.fromCodePoint(text.codePointAt(at) as number)
      at += ch.length
      if (ch === '\n') {
        this.row += 1
        this.col = 0
      } else if (ch === '\r') {
        this.col = 0
      } else {
        this.put(ch)
      }
    }
  }

  private put(ch: string): void {
    const wide = cells(ch)
    const line = this.cells[this.row]
    if (!line || wide === 0 || this.col + wide > this.width) {
      return
    }
    line[this.col] = ch
    if (wide === 2) {
      line[this.col + 1] = ''
    }
    this.col += wide
  }

  private sequence(text: string, at: number): number {
    const next = text[at + 1]
    if (next === ']' || next === '_') {
      const ends = [text.indexOf('\x07', at), text.indexOf('\x1b\\', at + 2)].filter((end) => end !== -1)
      const end = Math.min(...ends)
      return text[end] === '\x07' ? end + 1 : end + 2
    }
    CSI.lastIndex = at + 1
    const m = CSI.exec(text)
    if (next !== '[' || !m) {
      return at + 2
    }
    const [whole, params = '', final] = m
    const [a = 0, b = 0] = params.split(';').map(Number)
    if (final === 'H') {
      this.row = Math.max(1, a) - 1
      this.col = Math.max(1, b) - 1
    } else if (final === 'G') {
      this.col = Math.max(1, a) - 1
    } else if (final === 'K') {
      const line = this.cells[this.row] ?? []
      line.length = params === '2' ? 0 : Math.min(line.length, this.col)
    } else if (final === 'J') {
      for (let row = this.row + 1; row < this.cells.length; row++) {
        this.cells[row] = []
      }
      const line = this.cells[this.row] ?? []
      line.length = Math.min(line.length, this.col)
    } else if (final === 'l' && params === '?2026') {
      this.frames.push(
        this.cells
          .map((line) =>
            Array.from(line, (c) => c ?? ' ')
              .join('')
              .trimEnd(),
          )
          .join('\n'),
      )
    }
    return at + 1 + whole.length
  }
}

function io(overrides: Partial<BrowseIo> = {}): BrowseIo {
  return {
    refresh: () => Promise.reject(new Error('offline')),
    fetch: () => Promise.reject(new Error('offline')),
    index: () => Promise.resolve(listing()),
    apply: () => Promise.resolve(),
    ...overrides,
  }
}

async function drive(
  keys: (string | number)[],
  opts: {
    columns?: number
    rows?: number
    marketplaces?: Marketplace[]
    installed?: string[]
    updates?: string[]
    due?: string[]
    io?: BrowseIo
    hub?: 'browse'
  } = {},
) {
  const input = new PassThrough()
  const output = new PassThrough() as PassThrough & { columns?: number; rows?: number }
  output.columns = opts.columns ?? 100
  output.rows = opts.rows ?? 24
  const glass = new Glass(output.columns, output.rows)
  output.on('data', (chunk: Buffer) => glass.feed(chunk.toString()))
  const panel = new BrowsePanel({
    marketplaces: opts.marketplaces ?? [official, pastel],
    kept: [],
    installed: opts.installed ?? ['miku', 'alice@pastel/dusk'],
    ...(opts.updates ? { updates: opts.updates } : {}),
    due: opts.due ?? [],
    io: opts.io ?? io(),
    color: false,
    ...(opts.hub ? { hub: opts.hub } : {}),
    input,
    output,
  })
  const pending = panel.run()
  let previous = ''
  for (const key of keys) {
    if (typeof key === 'number') {
      await new Promise((resolve) => setTimeout(resolve, key))
      continue
    }
    await new Promise((resolve) => setTimeout(resolve, previous === '\x1b' ? 80 : 5))
    input.write(key)
    previous = key
  }
  const result = await pending
  return {
    result,
    frames: glass.frames.map((frame) => `\n${FRAME}${frame}`).join(''),
    last: glass.frames.at(-1) ?? '',
    panel: panel.result(),
    next: panel.next(),
    ran: panel.applied(),
    log: panel.lines(),
    failed: panel.failure(),
  }
}

const PLAIN_TAB = '\t'
const SHIFT_TAB = '\x1b[Z'
const UP = '\x1b[A'
const DOWN = '\x1b[B'
const RIGHT = '\x1b[C'
const APPLY = ['\r', '\r', 20, '\r']
const MIKU = [RIGHT, RIGHT, DOWN]
const SEARCH = [UP, '\r']
const ADD = [UP, UP, '\r']
const REMOVE = [DOWN, RIGHT, UP, '\r', 'y']
const AUTO = [DOWN, RIGHT, UP, UP, '\r']

test('a marketplace opens in the panel beside the cards from 94 columns, and over them in a narrower window', async () => {
  const wide = await drive([...MIKU, '\x03'])
  assert.match(wide.last, /╭─ official ─+╮$/m)
  assert.match(wide.last, /^ {4}● official +│/m)
  assert.match(wide.last, /│ ▌ {4}● miku +│$/m)
  assert.match(wide.last, /├─+┤\n.*│ miku {2}Installed +│\n.*│ Gate \d+\/\d+ · passes +│/)
  assert.match(wide.last, /\[BROWSE\] space pick {3}\? keys +esc back$/m)
  const narrow = await drive([...MIKU, '\x03'], { columns: 80 })
  assert.doesNotMatch(narrow.last, /● official/)
  assert.match(narrow.last, /^ ╭─ official ─+╮$/m)
  assert.match(narrow.last, /^ │ ▌ {4}● miku +│$/m)
})

test('a window too short for the search, the marketplace strip and three rows says how tall it needs to be', async () => {
  const { last } = await drive([PLAIN_TAB], { hub: 'browse', columns: 40, rows: 9 })
  assert.match(last, /Needs 40×10 — now 40×9/)
})

test('the Remove marketplace row asks first, and on yes takes the marketplace off the list while its installed palettes stay picked', async () => {
  const { panel, frames } = await drive([...REMOVE, ...'miku', ...APPLY])
  assert.deepEqual(panel.removes, ['alice/ttheme-pastel'])
  assert.ok(panel.picked.has('alice@pastel/dusk'))
  assert.match(frames, /Remove alice@pastel\? Its installed palettes stay installed {3}y remove {3}n keep +esc back/)
  assert.match(frames, /\(\d+\/\d+ · 2 picked · 1 marketplace to remove\)/)
  const gone = await drive([...REMOVE, '\x1b'], { installed: ['miku'] })
  assert.deepEqual(gone.panel.removes, ['alice/ttheme-pastel'])
  assert.doesNotMatch(gone.last, /^ {4}[●○] alice@pastel/m)
  assert.match(gone.last, /^ ▌ {2}● official +│/m)
  const kept = await drive([DOWN, RIGHT, UP, '\r', 'n', '\x1b', '\x1b'])
  assert.deepEqual(kept.panel.removes, [])
  assert.match(kept.last, /^ ▌ {2}● alice@pastel +│/m)
})

test('the Auto-update row turns a marketplace’s auto-update on and off, and only a change is kept', async () => {
  const on = await drive([...AUTO, '\x1b', ...'miku', ...APPLY])
  assert.deepEqual(on.panel.auto, { 'alice/ttheme-pastel': true })
  assert.match(on.frames, /● alice@pastel {2}↻ auto-update/)
  assert.match(on.frames, /Auto-update turns on/)
  assert.match(on.frames, /│ ▌ \[↻ Auto-update {9}\] on +│$/m)
  const back = await drive([...AUTO, '\r', '\x1b', '\x1b'])
  assert.deepEqual(back.panel.auto, {})
})

test('+ Add marketplace takes a source in the panel, fetches it there, and lands in the panel of the marketplace it staged', async () => {
  const neon = marketplace('bob/ttheme-neon', 'bob@neon', ['glow'])
  const fetched: string[] = []
  const { frames, panel, ran } = await drive([...ADD, ...'bob/ttheme-neon', '\r', 20, ...APPLY], {
    io: io({
      fetch: (source) => {
        fetched.push(source)
        return Promise.resolve(neon)
      },
    }),
  })
  assert.deepEqual(fetched, ['bob/ttheme-neon'])
  assert.match(frames, /╭─ Add marketplace ─+╮$/m)
  assert.match(frames, /│ Enter marketplace source: +│$/m)
  assert.match(frames, /│ │ bob\/ttheme-neon_ +│ │$/m)
  assert.match(frames, /\[BROWSE \(ADD\)\] enter add {3}bksp edit {3}\? keys +esc cancel$/m)
  assert.match(frames, /╭─ bob@neon ─+╮$/m)
  assert.match(frames, /│ ▌ {2}○ glow +│$/m)
  assert.match(frames, /\+ bob@neon {2}github\.com\/bob\/ttheme-neon · 1 palette$/m)
  assert.deepEqual(
    panel.adds.map((m) => m.id),
    ['bob@neon'],
  )
  assert.deepEqual(panel.auto, {})
  assert.ok(ran)
})

test('esc in the form goes back to the marketplaces keeping what was typed, and a fetch it leaves stages nothing until enter asks again', async () => {
  const neon = marketplace('bob/ttheme-neon', 'bob@neon', ['glow'])
  let fetches = 0
  const slow = io({
    fetch: () => {
      fetches += 1
      return new Promise((resolve) => setTimeout(() => resolve(neon), 60))
    },
  })
  const left = await drive([...ADD, ...'bob/ttheme-neon', '\r', '\x1b', 120, '\x03'], { io: slow })
  assert.match(left.frames, /│ [⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Fetching bob\/ttheme-neon… +│$/m)
  assert.match(left.last, /│ │ bob\/ttheme-neon +│ │$/m)
  assert.match(left.last, /\[BROWSE\] enter open/)
  assert.deepEqual(left.panel.adds, [])
  const again = await drive([...ADD, ...'bob/ttheme-neon', '\r', '\x1b', 120, '\r', '\r', 20, '\x03'], { io: slow })
  assert.equal(fetches, 2)
  assert.deepEqual(
    again.panel.adds.map((m) => m.id),
    ['bob@neon'],
  )
})

test('a marketplace due at open refreshes in the background and its new palettes appear', async () => {
  const fresh = marketplace('official', 'official', ['miku', 'rin', 'luka'], true)
  const { panel, frames } = await drive([20, '\x1b'], {
    due: ['official'],
    io: io({
      refresh: (source) =>
        Promise.resolve({
          marketplace: fresh,
          refreshed: { source, id: 'official', count: 3, change: { added: ['luka'], changed: [], gone: [] } },
          updates: [],
        }),
    }),
  })
  assert.equal(panel.refreshed.length, 1)
  assert.match(frames, /Updating… · /)
  assert.match(frames, /5\/5 · 2 picked/)
})

test('a failed update says so on its marketplace’s card, and the panel gives the reason', async () => {
  const { frames } = await drive([DOWN, '\x1b'], { due: ['alice/ttheme-pastel'] })
  assert.match(frames, /● alice@pastel {2}Update failed/)
  assert.match(frames, / │ Update failed: offline/)
})

test('inside the tabs, tab asks for the next screen at once, or first asks about what is staged', async () => {
  const clean = await drive([PLAIN_TAB], { hub: 'browse' })
  assert.equal(clean.result, 'cancel')
  assert.equal(clean.next, 21)
  const back = await drive([SHIFT_TAB], { hub: 'browse' })
  assert.equal(back.next, 21)

  const stay = await drive([...MIKU, ' ', PLAIN_TAB, '\x1b', ...APPLY], { hub: 'browse', installed: [] })
  assert.match(stay.frames, /Apply your changes before you leave\?/)
  assert.equal(stay.result, 'submit')
  assert.equal(stay.next, undefined)

  const discard = await drive([...MIKU, ' ', PLAIN_TAB, 'n'], { hub: 'browse', installed: [] })
  assert.equal(discard.result, 'cancel')
  assert.equal(discard.next, 21)

  const apply = await drive([...MIKU, ' ', PLAIN_TAB, 'y', 20, '\r'], { hub: 'browse', installed: [] })
  assert.equal(apply.result, 'submit')
  assert.equal(apply.next, undefined)
  assert.equal(apply.panel.picked.size, 1)
  assert.ok(apply.ran)
})

test('tab does nothing in browse on its own', async () => {
  const plain = await drive([PLAIN_TAB, '\x1b'])
  assert.equal(plain.result, 'cancel')
  assert.match(plain.last, /^ Browse \(4\/4 · 2 picked\)$/m)
})

test('a window short on rows folds the heading and the search box into one line', async () => {
  const { last } = await drive(['\x1b'], { rows: 14 })
  assert.doesNotMatch(last, /^ ╭/m)
  assert.match(last, /⌕ Search….* 4\/4 · 2 picked$/m)
})

test('a long list says how many rows lie above and below the window', async () => {
  const many = marketplace(
    'official',
    'official',
    Array.from({ length: 30 }, (_, i) => `p${String(i).padStart(2, '0')}`),
    true,
  )
  const top = await drive([RIGHT, RIGHT, '\x1b', '\x1b'], { marketplaces: [many], rows: 14, installed: [] })
  assert.doesNotMatch(top.last, /↑ \d+ more/)
  assert.match(top.last, /├─+ ↓ \d+ more ─┤$/m)
  const deep = await drive([RIGHT, RIGHT, ...Array.from({ length: 20 }, () => DOWN), '\x03'], {
    marketplaces: [many],
    rows: 14,
    installed: [],
  })
  assert.match(deep.last, /│ ↑ \d+ more +│$/m)
  assert.match(deep.last, /├─+ ↓ \d+ more ─┤$/m)
})

test('a marketplace’s card says where it comes from, what it holds and when it was updated, and the panel beside it what is in it and what can be done to it', async () => {
  const { last } = await drive([DOWN, '\x1b'], { columns: 120 })
  assert.match(last, /^ {4}\+ Add marketplace {3}owner\/repo or a folder +│/m)
  assert.match(last, /^ {4}● official +│[^\n]*\n {6}Built in +│[^\n]*\n {6}2 available · 1 installed +│/m)
  assert.match(last, /^ ▌ {2}● alice@pastel +│/m)
  assert.match(last, /^ ▌ {4}alice\/ttheme-pastel +│/m)
  assert.match(last, /^ ▌ {4}2 available · 1 installed · Updated just now +│/m)
  assert.match(last, /╭─ alice@pastel ─+╮$/m)
  assert.match(last, /│ {4}⇡ Update now {12}Updated just now +│$/m)
  assert.match(last, /│ {4}↻ Auto-update {11}off +│$/m)
  assert.match(last, /│ {4}× Remove marketplace +│$/m)
  assert.match(last, /│ {4}● dusk +│$/m)
  assert.match(last, /│ {4}○ dawn +│$/m)
})

test('ctrl+r and ctrl+s never end up in the search text', async () => {
  const { frames } = await drive(['k', '\x12', '\x13', 'i', '\x1b', '\x1b'])
  assert.match(frames, /│ ⌕ ki_ +│/)
})

test('Search marketplace opens a screen of its own that loads the marketplace list as it opens, which Browse alone never does', async () => {
  let asked = 0
  const index = () => {
    asked += 1
    return Promise.resolve(listing(listedOf('bob/ttheme-neon', 'bob@neon', 12, 'Neon palettes', ['glow', 'haze'])))
  }
  await drive([20, '\x1b'], { io: io({ index }) })
  assert.equal(asked, 0)
  const { frames } = await drive([UP, 20, '\r', 20, '\x1b', '\x1b'], { io: io({ index }) })
  assert.equal(asked, 1)
  assert.match(
    frames,
    /^ {4}\+ Add marketplace {3}owner\/repo or a folder +│[^\n]*\n ▌ \[⌕ Search marketplace\] {2}find one on GitHub +│/m,
  )
  assert.match(frames, / Search marketplace \(1 found\)$/m)
  assert.match(frames, /^ +← Back +│ bob\/ttheme-neon +│$/m)
  assert.match(frames, /^ ▌ {2}○ bob@neon {2}★12 · 2 palettes +│ ★ 12 · updated 2026-10-09 +│$/m)
  assert.match(frames, /│ Neon palettes +│/)
  assert.match(frames, /│ {3}glow +│\n.*│ {3}haze +│/)
  assert.match(frames, /\[SEARCH\] space add {3}enter add and go back {3}\? keys +esc back$/m)
})

test('typing in the search filters the list at once, palette names included, and what Browse filtered opens it', async () => {
  const index = () =>
    Promise.resolve(
      listing(
        listedOf('bob/ttheme-neon', 'bob@neon', 12, 'Neon palettes', ['glow']),
        listedOf('alice/ttheme-pastel', 'alice@pastel', 3, 'Soft palettes', ['dusk']),
      ),
    )
  const typed = await drive([...SEARCH, 20, ...'glow', '\x1b', '\x1b', '\x1b'], { io: io({ index }) })
  assert.match(typed.frames, / Search marketplace \(2 found\)$/m)
  assert.match(typed.frames, / Search marketplace \(1 found\)\n.*\n │ ⌕ glow_/)
  const seeded = await drive([...'zzz', '\r', 20, '\x1b', '\x1b', '\x1b', '\x1b'], { io: io({ index }) })
  assert.match(seeded.frames, /│ ⌕ zzz_ +│/)
  assert.match(seeded.frames, /⌕ No marketplace matches "zzz"/)
})

test('a list that did not load says so and space loads it again, and a copy from before shows while offline', async () => {
  let calls = 0
  const neon = listing(listedOf('bob/ttheme-neon', 'bob@neon', 12, 'Neon palettes', ['glow']))
  const index = () => {
    calls += 1
    return calls === 1 ? Promise.reject(new Error('cannot reach the list')) : Promise.resolve(neon)
  }
  const { frames } = await drive([...SEARCH, 20, ' ', 20, '\x1b', '\x1b'], { io: io({ index }) })
  assert.equal(calls, 2)
  assert.match(frames, /\[⌕ The marketplace list did not load\] {2}space retries/)
  assert.match(frames, /│ cannot reach the list +│/)
  assert.match(frames, /▌ {2}○ bob@neon/)
  const offline = await drive([...SEARCH, 20, '\x1b', '\x1b'], {
    io: io({ index: () => Promise.resolve({ ...neon, at: Date.now() - 3 * 3_600_000, offline: 'cannot reach' }) }),
  })
  assert.match(offline.frames, / Search marketplace \(1 found · offline, from 3h ago\)$/m)
})

test('enter on a listed marketplace adds it and goes back to its card, and ← Back goes back with nothing added', async () => {
  const neon = marketplace('bob/ttheme-neon', 'bob@neon', ['glow', 'haze'])
  const index = () =>
    Promise.resolve(listing(listedOf('bob/ttheme-neon', 'bob@neon', 12, 'Neon palettes', ['glow', 'haze'])))
  const fetched: string[] = []
  const { frames, panel } = await drive([...SEARCH, 20, '\r', 20, ...'glow', ...APPLY], {
    io: io({
      index,
      fetch: (source) => {
        fetched.push(source)
        return Promise.resolve(neon)
      },
    }),
  })
  assert.deepEqual(fetched, ['bob/ttheme-neon'])
  assert.match(frames, /^ ▌ {2}● bob@neon {2}Will add +│/m)
  assert.deepEqual(
    panel.adds.map((m) => m.id),
    ['bob@neon'],
  )
  const back = await drive([...SEARCH, 20, UP, '\r', 20, '\x1b'], { io: io({ index }) })
  assert.match(back.frames, /^ +\[← Back\] +│ Back to your marketplaces +│$/m)
  assert.match(back.frames, /\[SEARCH\] enter back {3}\? keys +esc back$/m)
  assert.match(back.last, /^ Browse \(4\/4 · 2 picked\)$/m)
  assert.deepEqual(back.panel.adds, [])
})

test('a source the form cannot read or fetch says why under the field, and one already added is gone to instead', async () => {
  const { frames, panel, last } = await drive([
    ...ADD,
    '\r',
    ...'bob',
    '\r',
    '\x15',
    ...'bob/ttheme-neon',
    '\r',
    20,
    '\x15',
    ...'alice/ttheme-pastel',
    '\r',
    '\x03',
  ])
  assert.match(frames, /│ type a repository or a folder +│$/m)
  assert.match(frames, /│ bob is not a marketplace — give a +│$/m)
  assert.match(frames, /│ offline +│$/m)
  assert.deepEqual(panel.adds, [])
  assert.match(last, /╭─ alice@pastel ─+╮$/m)
  assert.match(last, /│ ▌ {2}● dusk +│$/m)
})

test('enter with something staged opens a review of it, and esc goes back to the list', async () => {
  const { frames, ran } = await drive([...MIKU, DOWN, ' ', '\x1b', ...REMOVE, ...'miku', '\r', 20, '\x1b', ...APPLY])
  assert.match(frames, /Review changes/)
  assert.match(frames, /Marketplaces \(1\)/)
  assert.match(frames, /- alice@pastel +github\.com\/alice\/ttheme-pastel · its 1 palette installed keep working/)
  assert.match(frames, /Palettes \(1 to install\)/)
  assert.match(frames, /\+ rin +Vocaloid/)
  assert.match(frames, /\[BROWSE \(APPLY\)\] enter apply +esc back/)
  const first = frames.indexOf('Review changes')
  assert.ok(frames.indexOf('Browse (', first) > 0)
  assert.ok(frames.indexOf('Review changes', frames.indexOf('Browse (', first)) > 0)
  assert.ok(ran)
})

test('enter on a palette with nothing staged does nothing', async () => {
  const { ran, result, frames } = await drive([...MIKU, '\r', '\x1b', '\x1b'])
  assert.ok(!ran)
  assert.equal(result, 'cancel')
  assert.doesNotMatch(frames, /enter close/)
  assert.doesNotMatch(frames, /Review changes/)
})

test('enter takes a marketplace into the panel, typing lands on the first match there, and esc clears the filter, goes back to the cards, then cancels', async () => {
  const opened = await drive(['\r', '\x1b', '\x1b'])
  assert.equal(opened.result, 'cancel')
  assert.match(opened.frames, /│ ▌ {2}▸ Vocaloid \(1\/2\) +│$/m)
  assert.match(opened.last, /^ ▌ {2}● official +│/m)
  const filtered = await drive(['r', 'i', '\x1b', '\x1b', '\x1b'])
  assert.equal(filtered.result, 'cancel')
  assert.match(filtered.frames, /│ ⌕ ri_ +│[\s\S]*│ ▌ {4}○ rin +│$/m)
  assert.match(filtered.frames, /│ ⌕ Search…[^\n]*\n[\s\S]*│ ▌ {4}○ rin +│$/m)
  assert.match(filtered.last, /^ ▌ {2}● official +│/m)
})

test('? shows the keys over the list until ? or esc, and the list takes no key meanwhile', async () => {
  const { last, frames, panel } = await drive(['?', ' ', '?', '\x1b'])
  assert.match(frames, /╭─ Help ─+╮/)
  assert.match(frames, /Marketplace {3}↓ {2}below its palettes, to its own actions/)
  assert.match(frames, /\[HELP\] +\? esc close/)
  assert.doesNotMatch(last, /Help/)
  assert.deepEqual([...panel.picked].sort(), ['alice@pastel/dusk', 'miku'])
})

test('applying shows what the work reports and waits for it, and done stays until enter', async () => {
  let calls = 0
  const { frames, ran, log, failed, panel } = await drive(
    [...REMOVE, ...'miku', '\r', '\r', 30, '\x1b', '\r', 350, '\r'],
    {
      io: io({
        apply: async (_, report) => {
          calls += 1
          report.status('Fetching glow · 1/2')
          report.say('Removed alice@pastel · github.com/alice/ttheme-pastel')
          report.say('\n1 palettes installed — open a new tab')
          await new Promise((resolve) => setTimeout(resolve, 250))
          report.status('')
        },
      }),
    },
  )
  assert.equal(calls, 1)
  assert.ok(ran)
  assert.equal(failed, undefined)
  assert.deepEqual(panel.removes, ['alice/ttheme-pastel'])
  assert.deepEqual(log, [
    'Removed alice@pastel · github.com/alice/ttheme-pastel',
    '',
    '1 palettes installed — open a new tab',
  ])
  assert.match(frames, /Applying changes/)
  assert.match(frames, /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Fetching glow · 1\/2/)
  assert.match(frames, /^ Removed alice@pastel · github\.com\/alice\/ttheme-pastel$/m)
  assert.match(frames, /\[BROWSE \(APPLY\)\] Keys wait until it ends/)
  assert.match(frames, /✓ Applied \(1 removed\)/)
  assert.match(frames, /\[BROWSE \(APPLY\)\] +enter close/)
})

test('a failed apply says so, keeps what it reported, and still closes on enter', async () => {
  const { frames, failed, log } = await drive([...REMOVE, ...'miku', ...APPLY], {
    io: io({
      apply: (_, report) => {
        report.say('Removed alice@pastel')
        return Promise.reject(new Error('cannot write installed.json'))
      },
    }),
  })
  assert.equal(failed?.message, 'cannot write installed.json')
  assert.deepEqual(log, ['Removed alice@pastel'])
  assert.match(frames, /✗ Stopped/)
  assert.match(frames, /✗ cannot write installed\.json/)
})

test('ctrl+r stages the update of an installed palette marked ⇡, and does nothing on one without', async () => {
  const taken = await drive([...'dusk', '\x12', ...APPLY], { updates: ['alice@pastel/dusk'] })
  assert.deepEqual(taken.panel.renew, ['alice@pastel/dusk'])
  assert.match(taken.frames, /dusk +⇡ update/)
  assert.match(taken.frames, /Palettes \(1 to update\)/)
  assert.match(taken.frames, /Applied \(1 updated\)/)
  const none = await drive([...'miku', '\x12', '\x03'], { updates: ['alice@pastel/dusk'] })
  assert.deepEqual(none.panel.renew, [])
})
