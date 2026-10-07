import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import cells from 'fast-string-width'

import { type BrowseIo, BrowsePanel, type Market } from './browse-panel.ts'
import type { PaletteEntry } from './manifest.ts'
import type { Repository } from './markets.ts'

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
    status: source === 'official' ? 'comes with ttheme' : 'updated just now',
  }
}

function repo(owner: string, name: string, stars: number, description: string | null = null): Repository {
  return { full_name: `${owner}/${name}`, name, description, stargazers_count: stars, owner: { login: owner } }
}

const official = market('official', 'official', ['miku', 'rin'])
const pastel = market('alice/ttheme-pastel', 'alice@pastel', ['dusk', 'dawn'])

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
    search: () => Promise.resolve([]),
    apply: () => Promise.resolve(),
    ...overrides,
  }
}

async function drive(
  keys: (string | number)[],
  opts: {
    columns?: number
    rows?: number
    markets?: Market[]
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
    markets: opts.markets ?? [official, pastel],
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

const AUTO_ON = '\x1b[1;2C'
const AUTO_OFF = '\x1b[1;2D'
const PLAIN_TAB = '\t'
const SHIFT_TAB = '\x1b[Z'
const DOWN = '\x1b[B'
const RIGHT = '\x1b[C'
const END = '\x1b[F'
const DEL = '\x1b[3~'
const CTRL_S = '\x13'
const APPLY = ['\r', '\r', 20, '\r']
const MIKU = [RIGHT, DOWN, RIGHT, DOWN]

test('the right panel sits beside the list from 94 columns, and folds into one line under it', async () => {
  const wide = await drive([...MIKU, '\r'])
  assert.match(wide.last, /^ +│ miku$/m)
  assert.match(wide.last, /^ ▌ {6}● miku +│/m)
  assert.match(wide.last, / │ The ttheme catalog$/m)
  assert.match(wide.last, / │ Installed$/m)
  const narrow = await drive([...MIKU, '\r'], { columns: 80 })
  assert.doesNotMatch(narrow.last, / │ The ttheme catalog/)
  assert.match(
    narrow.last,
    /^ The ttheme catalog · Gate \d+\/\d+.* · Installed\n \[BROWSE\] space pick {3}enter close/m,
  )
})

test('a window too short for the search, the market strip and three rows says how tall it needs to be', async () => {
  const { last } = await drive([PLAIN_TAB], { hub: 'browse', columns: 40, rows: 9 })
  assert.match(last, /Needs 40×10 — now 40×9/)
})

test('delete on a market’s row stages its removal and again takes it back, and its installed palettes stay picked', async () => {
  const { panel, frames } = await drive([DOWN, DEL, END, ...APPLY])
  assert.deepEqual(panel.removes, ['alice/ttheme-pastel'])
  assert.ok(panel.picked.has('alice@pastel/dusk'))
  assert.match(frames, /▸ alice@pastel \(1\/1\) {2}Will remove/)
  assert.match(frames, / │ Will remove — alice@pastel\/dusk\n.* │ stays installed/)
  const undone = await drive([DOWN, DEL, DEL, '\x1b'])
  assert.deepEqual(undone.panel.removes, [])
})

test('shift+right and shift+left turn a market’s auto-update on and off, and only a change is kept', async () => {
  const on = await drive([DOWN, AUTO_ON, END, ...APPLY])
  assert.deepEqual(on.panel.auto, { 'alice/ttheme-pastel': true })
  assert.match(on.frames, /▸ alice@pastel \(1\/2\) {2}↻ auto-update/)
  assert.match(on.frames, /Auto-update turns on/)
  const back = await drive([DOWN, AUTO_ON, AUTO_OFF, '\x1b'])
  assert.deepEqual(back.panel.auto, {})
})

test('a repository typed into the search is fetched, asked about, and staged with its palettes', async () => {
  const neon = market('bob/ttheme-neon', 'bob@neon', ['glow'])
  const fetched: string[] = []
  const answer = (key: string) =>
    drive([...'bob/ttheme-neon', ' ', key, END, ...APPLY], {
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
  assert.match(yes.frames, /Update bob@neon on its own when its author changes it\? {3}y yes {3}n no +esc back/)
  assert.deepEqual(
    yes.panel.adds.map((m) => m.id),
    ['bob@neon'],
  )
  assert.deepEqual(yes.panel.auto, { 'bob/ttheme-neon': true })
  assert.match(yes.frames, /▌ {2}▸ bob@neon \(0\/1\) {2}↻ auto-update {2}Will add/)
  const no = await answer('n')
  assert.deepEqual(
    no.panel.adds.map((m) => m.id),
    ['bob@neon'],
  )
  assert.deepEqual(no.panel.auto, {})
})

test('esc while the question is up drops only the question', async () => {
  const neon = market('bob/ttheme-neon', 'bob@neon', ['glow'])
  const { result, panel } = await drive([...'bob/ttheme-neon', ' ', '\x1b', '\r'], {
    io: io({ fetch: () => Promise.resolve(neon) }),
  })
  assert.equal(result, 'submit')
  assert.deepEqual(panel.adds, [])
})

test('a market due at open refreshes in the background and its new palettes appear', async () => {
  const fresh = market('official', 'official', ['miku', 'rin', 'luka'], true)
  const { panel, frames } = await drive([20, '\x1b'], {
    due: ['official'],
    io: io({
      refresh: (source) =>
        Promise.resolve({
          market: fresh,
          refreshed: { source, id: 'official', count: 3, change: { added: ['luka'], changed: [], gone: [] } },
          updates: [],
        }),
    }),
  })
  assert.equal(panel.refreshed.length, 1)
  assert.match(frames, /Updating… · /)
  assert.match(frames, /5\/5 · 2 picked/)
})

test('a failed update says so on its market’s row, and the detail panel gives the reason', async () => {
  const { frames } = await drive([DOWN, '\x1b'], { due: ['alice/ttheme-pastel'] })
  assert.match(frames, /▸ alice@pastel \(1\/2\) {2}Update failed/)
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

test('the strip counts each market, and ctrl+s walks them, filtering the list and its counts', async () => {
  const all = await drive(['\x1b'])
  assert.match(all.last, /^ \[All 4\] · official 2 · alice@pastel 2 +ctrl\+s market$/m)
  assert.match(all.last, /Browse \(4\/4 · 2 picked\)/)
  const first = await drive([CTRL_S, '\x1b'])
  assert.match(first.last, /^ All 4 · \[official 2\] · alice@pastel 2/m)
  assert.match(first.last, /Browse \(2\/2 · 1 picked\)/)
  assert.match(first.last, /▸ official \(1\/2\)/)
  assert.doesNotMatch(first.last, /▸ alice@pastel \(/)
  const second = await drive([CTRL_S, CTRL_S, '\x1b'])
  assert.match(second.last, /Browse \(2\/2 · 1 picked\)/)
  assert.match(second.last, /▸ alice@pastel \(1\/2\)/)
  assert.doesNotMatch(second.last, /▸ official \(/)
  const around = await drive([CTRL_S, CTRL_S, CTRL_S, '\x1b'])
  assert.match(around.last, /\[All 4\]/)
  assert.deepEqual([...around.panel.picked].sort(), ['alice@pastel/dusk', 'miku'])
})

test('a window short on rows folds the heading and the search box into one line', async () => {
  const { last } = await drive(['\x1b'], { rows: 14 })
  assert.doesNotMatch(last, /╭/)
  assert.match(last, /⌕ Search….* 4\/4 · 2 picked$/m)
})

test('a long list says how many rows lie above and below the window', async () => {
  const many = market(
    'official',
    'official',
    Array.from({ length: 30 }, (_, i) => `p${String(i).padStart(2, '0')}`),
    true,
  )
  const top = await drive([RIGHT, DOWN, RIGHT, '\x1b'], { markets: [many], rows: 14, installed: [] })
  assert.doesNotMatch(top.last, /↑ \d+ more/)
  assert.match(top.last, /^ ↓ \d+ more/m)
  const deep = await drive([RIGHT, DOWN, RIGHT, ...Array.from({ length: 20 }, () => DOWN), '\r'], {
    markets: [many],
    rows: 14,
    installed: [],
  })
  assert.match(deep.last, /^ ↑ \d+ more/m)
  assert.match(deep.last, /^ ↓ \d+ more/m)
})

test('the detail panel of a market’s row says where it comes from, what it holds and when it was updated', async () => {
  const { last } = await drive([DOWN, '\x1b'], { columns: 120 })
  assert.match(last, /^ +│ alice@pastel$/m)
  assert.match(last, /^ ▌ {2}▸ alice@pastel \(1\/2\) +│/m)
  assert.match(last, / │ github\.com\/alice\/ttheme-pastel$/m)
  assert.match(last, / │ 2 palettes · 1 installed$/m)
  assert.match(last, / │ Auto-update off {2}⇧←→$/m)
  assert.match(last, / │ Updated just now$/m)
})

test('ctrl+r and ctrl+s never end up in the search text', async () => {
  const { last } = await drive(['k', '\x12', '\x13', 'i', '\r'])
  assert.match(last, /│ ⌕ ki_ +│/)
})

test('opening browse looks GitHub up on its own and lists what it finds under the palettes', async () => {
  const asked: (string | undefined)[] = []
  const { last } = await drive([20, '\x1b'], {
    io: io({
      search: (query) => {
        asked.push(query)
        return Promise.resolve([repo('bob', 'ttheme-neon', 12, 'Neon palettes')])
      },
    }),
  })
  assert.deepEqual(asked, [undefined])
  assert.match(last, /▸ alice@pastel \(1\/2\) +│[^\n]*\n +── On GitHub ─/)
  assert.match(last, /○ bob\/ttheme-neon {2}★12 {2}Neon palettes/)
})

test('typing searches GitHub for it once typing stops, and not before', async () => {
  const asked: (string | undefined)[] = []
  const search = (query: string | undefined) => {
    asked.push(query)
    return Promise.resolve([])
  }
  await drive([...'neon', '\r'], { io: io({ search }) })
  assert.deepEqual(asked, [undefined])
  asked.length = 0
  await drive([...'neon', 750, '\r'], { io: io({ search }) })
  assert.deepEqual(asked, [undefined, 'neon'])
})

test('a failed GitHub search says so, and space on that row searches again', async () => {
  let calls = 0
  const { frames, last } = await drive([20, END, ' ', 20, '\r'], {
    io: io({
      search: () => {
        calls += 1
        return calls === 1
          ? Promise.reject(new Error('rate limited'))
          : Promise.resolve([repo('bob', 'ttheme-neon', 12)])
      },
    }),
  })
  assert.equal(calls, 2)
  assert.match(frames, /⌕ GitHub search failed {2}rate limited/)
  assert.match(last, /▌ {2}○ bob\/ttheme-neon/)
})

test('moving onto a GitHub repository fetches its palettes for the detail panel, once', async () => {
  const neon = market('bob/ttheme-neon', 'bob@neon', ['glow', 'haze'])
  const fetched: string[] = []
  const { frames, panel } = await drive([20, END, 600, '\r'], {
    io: io({
      search: () => Promise.resolve([repo('bob', 'ttheme-neon', 12, 'Neon palettes')]),
      fetch: (source) => {
        fetched.push(source)
        return Promise.resolve(neon)
      },
    }),
  })
  assert.deepEqual(fetched, ['bob/ttheme-neon'])
  assert.match(frames, / │ glow, haze/)
  assert.match(frames, /★12 {2}2 palettes · Neon palettes/)
  assert.deepEqual(panel.adds, [])
})

test('a repository typed into the search is looked up by itself, and space then asks without fetching again', async () => {
  const neon = market('bob/ttheme-neon', 'bob@neon', ['glow', 'haze'])
  const fetched: string[] = []
  const { frames, panel } = await drive([...'bob/ttheme-neon', 750, ' ', 'y', END, ...APPLY], {
    io: io({
      fetch: (source) => {
        fetched.push(source)
        return Promise.resolve(neon)
      },
    }),
  })
  assert.deepEqual(fetched, ['bob/ttheme-neon'])
  assert.match(frames, /bob@neon · 2 palettes/)
  assert.match(frames, /Update bob@neon on its own when its author changes it\?/)
  assert.deepEqual(
    panel.adds.map((m) => m.id),
    ['bob@neon'],
  )
})

test('enter with something staged opens a review of it, and esc goes back to the list', async () => {
  const { frames, ran } = await drive([...MIKU, DOWN, ' ', DOWN, DEL, END, '\r', 20, '\x1b', ...APPLY])
  assert.match(frames, /Review changes/)
  assert.match(frames, /Markets \(1\)/)
  assert.match(frames, /- alice@pastel +github\.com\/alice\/ttheme-pastel · its 1 palette installed keep working/)
  assert.match(frames, /Palettes \(1 to install\)/)
  assert.match(frames, /\+ rin +Vocaloid/)
  assert.match(frames, /\[BROWSE \(APPLY\)\] enter apply +esc back/)
  const first = frames.indexOf('Review changes')
  assert.ok(frames.indexOf('Browse (', first) > 0)
  assert.ok(frames.indexOf('Review changes', frames.indexOf('Browse (', first)) > 0)
  assert.ok(ran)
})

test('enter with nothing staged leaves at once', async () => {
  const { ran, result } = await drive([...MIKU, '\r'])
  assert.ok(!ran)
  assert.equal(result, 'submit')
})

test('enter opens a market as preview opens a series, and esc clears the filter back to its palette before it cancels', async () => {
  const opened = await drive(['\r', '\x1b'])
  assert.equal(opened.result, 'cancel')
  assert.match(opened.last, /^ ▌ {2}▾ official/m)
  assert.match(opened.last, /^ {6}▸ Vocaloid/m)
  const filtered = await drive(['r', 'i', '\x1b', '\x1b'])
  assert.equal(filtered.result, 'cancel')
  assert.match(filtered.last, /⌕ Search…/)
  assert.match(filtered.last, /^ ▌ {6}○ rin/m)
})

test('? shows the keys over the list until ? or esc, and the list takes no key meanwhile', async () => {
  const { last, frames, panel } = await drive(['?', ' ', '?', '\x1b'])
  assert.match(frames, /╭─ Help ─+╮/)
  assert.match(frames, /Market {4}⇧←→ {2}auto-update/)
  assert.match(frames, /\[HELP\] +\? esc close/)
  assert.doesNotMatch(last, /Help/)
  assert.deepEqual([...panel.picked].sort(), ['alice@pastel/dusk', 'miku'])
})

test('applying shows what the work reports and waits for it, and done stays until enter', async () => {
  let calls = 0
  const { frames, ran, log, failed, panel } = await drive([DOWN, DEL, END, '\r', '\r', 30, '\x1b', '\r', 350, '\r'], {
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
  })
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
  const { frames, failed, log } = await drive([DOWN, DEL, END, ...APPLY], {
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
  const none = await drive([...'miku', '\x12', '\r'], { updates: ['alice@pastel/dusk'] })
  assert.deepEqual(none.panel.renew, [])
})
