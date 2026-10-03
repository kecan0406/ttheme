import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import { isCancel } from '@clack/core'

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
    status: 'updated just now',
  }
}

function repo(owner: string, name: string, stars: number, description: string | null = null): Repository {
  return { full_name: `${owner}/${name}`, name, description, stargazers_count: stars, owner: { login: owner } }
}

const official = market('official', 'official', ['miku', 'rin'], true)
const pastel = market('alice/ttheme-pastel', 'alice@pastel', ['dusk', 'dawn'])

const ESC = '\x1b'
const STEERING = new RegExp(`${ESC}\\[K|${ESC}\\[\\?(?:2026|25)[hl]|${ESC}\\[H`, 'g')
const ROW = new RegExp(`${ESC}\\[(\\d+);1H`, 'g')
const FRAME = '\u0001'

function shown(raw: string): string {
  return raw.replace(STEERING, '').replace(ROW, (_, row: string) => (row === '1' ? `\n${FRAME}` : '\n'))
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
    due?: string[]
    io?: BrowseIo
    hub?: 'browse'
  } = {},
) {
  const input = new PassThrough()
  const output = new PassThrough() as PassThrough & { columns?: number; rows?: number }
  output.columns = opts.columns ?? 100
  output.rows = opts.rows ?? 24
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
      if (typeof key === 'number') {
        await new Promise((resolve) => setTimeout(resolve, key))
        continue
      }
      await new Promise((resolve) => setTimeout(resolve, previous === '\x1b' ? 80 : 5))
      input.write(key)
      previous = key
    }
    const result = await pending
    const last = frames.slice(frames.lastIndexOf(FRAME) + 1)
    return {
      result,
      frames,
      last,
      panel: panel.result(),
      next: panel.next(),
      ran: panel.applied(),
      log: panel.lines(),
      failed: panel.failure(),
    }
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
const CTRL_S = '\x13'
const APPLY = ['\r', '\r', 20, '\r']

test('shift+right and shift+left move between the four tabs and each keeps its own filter', async () => {
  const { frames } = await drive(['k', 'i', TAB, TAB, BACK_TAB, BACK_TAB, '\r'])
  assert.match(frames, /\[Catalog\] {2}Installed {3}Markets {3}Errors/)
  assert.match(frames, / Catalog {2}\[Installed\] {2}Markets/)
  assert.match(frames, /\[Markets\]/)
  assert.match(frames.slice(frames.lastIndexOf('[Catalog]')), /│ ⌕ ki_ +│/)
})

test('the right panel sits beside the list from 94 columns, and folds into one line under it', async () => {
  const wide = await drive([RIGHT, DOWN, '\r'])
  assert.match(wide.last, /^ +│ miku$/m)
  assert.match(wide.last, /^ ▌ {4}● miku +│/m)
  assert.match(wide.last, / │ The ttheme catalog$/m)
  assert.match(wide.last, / │ Installed$/m)
  const narrow = await drive([RIGHT, DOWN, '\r'], { columns: 80 })
  assert.doesNotMatch(narrow.last, / │ The ttheme catalog/)
  assert.match(narrow.last, /^ The ttheme catalog · Gate \d+\/\d+.* · Installed\n ⇧←→/m)
})

test('space on a market stages its removal, and its installed palettes stay picked', async () => {
  const { panel, frames } = await drive([TAB, TAB, DOWN, ' ', ...APPLY])
  assert.deepEqual(panel.removes, ['alice/ttheme-pastel'])
  assert.ok(panel.picked.has('alice@pastel/dusk'))
  assert.match(frames, /○ alice@pastel {2}Will remove/)
  assert.match(frames, / │ Will remove — alice@pastel\/dusk\n.* │ stays installed/)
})

test('left and right turn a market’s auto-update off and on, and only a change is kept', async () => {
  const on = await drive([TAB, TAB, DOWN, RIGHT, ...APPLY])
  assert.deepEqual(on.panel.auto, { 'alice/ttheme-pastel': true })
  assert.match(on.frames, /Auto-update turns on/)
  const back = await drive([TAB, TAB, DOWN, RIGHT, LEFT, '\r'])
  assert.deepEqual(back.panel.auto, {})
})

test('a repository typed into Markets is fetched, asked about, and staged with its palettes', async () => {
  const neon = market('bob/ttheme-neon', 'bob@neon', ['glow'])
  const fetched: string[] = []
  const answer = (key: string) =>
    drive([TAB, TAB, ...'bob/ttheme-neon', ' ', key, '\x7f'.repeat(15), TAB, TAB, ...APPLY], {
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
  assert.match(frames, /✗ alice@pastel +│.*\n +Update failed: offline/)
})

test('inside the tabs, tab asks for the next screen at once, or first asks about what is staged', async () => {
  const clean = await drive([PLAIN_TAB], { hub: 'browse' })
  assert.ok(isCancel(clean.result))
  assert.equal(clean.next, 21)
  const back = await drive([SHIFT_TAB], { hub: 'browse' })
  assert.equal(back.next, 21)

  const stay = await drive([RIGHT, DOWN, ' ', PLAIN_TAB, '\x1b', ...APPLY], { hub: 'browse', installed: [] })
  assert.match(stay.frames, /Apply your changes before you leave\?/)
  assert.ok(!isCancel(stay.result))
  assert.equal(stay.next, undefined)

  const discard = await drive([RIGHT, DOWN, ' ', PLAIN_TAB, 'n'], { hub: 'browse', installed: [] })
  assert.ok(isCancel(discard.result))
  assert.equal(discard.next, 21)

  const apply = await drive([RIGHT, DOWN, ' ', PLAIN_TAB, 'y', 20, '\r'], { hub: 'browse', installed: [] })
  assert.ok(!isCancel(apply.result))
  assert.equal(apply.next, undefined)
  assert.equal(apply.panel.picked.size, 1)
  assert.ok(apply.ran)
})

test('tab does nothing in browse on its own, and shift+arrows switch tabs without acting on the row', async () => {
  const plain = await drive([PLAIN_TAB, '\r'])
  assert.match(plain.last, /\[Catalog\]/)
  const moved = await drive([TAB, TAB, BACK_TAB, '\r'])
  assert.match(moved.last, /\[Installed\]/)
  assert.deepEqual(moved.panel.auto, {})
})

test('the strip counts each market, and ctrl+s walks them, filtering the list and its counts', async () => {
  const all = await drive(['\r'])
  assert.match(all.last, /^ \[All 4\] · official 2 · alice@pastel 2 +ctrl\+s market$/m)
  assert.match(all.last, /Discover palettes \(4\/4 · 2 picked\)/)
  const first = await drive([CTRL_S, '\r'])
  assert.match(first.last, /^ All 4 · \[official 2\] · alice@pastel 2/m)
  assert.match(first.last, /Discover palettes \(2\/2 · 1 picked\)/)
  assert.match(first.last, /[▸▾] Vocaloid \(/)
  assert.doesNotMatch(first.last, /▸ alice@pastel \(/)
  const second = await drive([CTRL_S, CTRL_S, '\r'])
  assert.match(second.last, /Discover palettes \(2\/2 · 1 picked\)/)
  assert.match(second.last, /▸ alice@pastel \(1\/2\)/)
  assert.doesNotMatch(second.last, /[▸▾] Vocaloid \(/)
  const around = await drive([CTRL_S, CTRL_S, CTRL_S, '\r'])
  assert.match(around.last, /\[All 4\]/)
  assert.deepEqual([...around.panel.picked].sort(), ['alice@pastel/dusk', 'miku'])
})

test('a market filter on Installed lists only the markets that hold an installed palette', async () => {
  const { last } = await drive([TAB, '\r'], { installed: ['miku'] })
  assert.match(last, /^ \[All 1\] · official 1 +ctrl\+s market$/m)
})

test('a window short on rows folds the heading and the search box into one line', async () => {
  const { last } = await drive(['\r'], { rows: 14 })
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
  const top = await drive([RIGHT, '\r'], { markets: [many], rows: 14, installed: [] })
  assert.doesNotMatch(top.last, /↑ \d+ more/)
  assert.match(top.last, /^ ↓ \d+ more/m)
  const deep = await drive([RIGHT, ...Array.from({ length: 20 }, () => DOWN), '\r'], {
    markets: [many],
    rows: 14,
    installed: [],
  })
  assert.match(deep.last, /^ ↑ \d+ more/m)
  assert.match(deep.last, /^ ↓ \d+ more/m)
})

test('Markets lists each market over two lines: where it comes from, what it holds and when it was updated', async () => {
  const { last } = await drive([TAB, TAB, '\r'], { columns: 120 })
  assert.match(last, /● official +↻ auto-update/)
  assert.match(last, /^ +The ttheme catalog · 2 palettes · 1 installed · updated just now/m)
  assert.match(last, /● alice@pastel +│/)
  assert.doesNotMatch(last, /● alice@pastel +↻/)
  assert.match(last, /^ +alice\/ttheme-pastel · 2 palettes · 1 installed · updated just now/m)
})

test('ctrl+r and ctrl+s never end up in the search text', async () => {
  const { last } = await drive([TAB, TAB, 'k', '\x12', '\x13', 'i', '\r'])
  assert.match(last, /│ ⌕ ki_ +│/)
  const catalog = await drive(['k', '\x13', 'i', '\r'])
  assert.match(catalog.last, /│ ⌕ ki_ +│/)
})

test('opening Markets looks GitHub up on its own and lists what it finds with a line about each', async () => {
  const asked: (string | undefined)[] = []
  const { last } = await drive([TAB, TAB, 20, '\r'], {
    io: io({
      search: (query) => {
        asked.push(query)
        return Promise.resolve([repo('bob', 'ttheme-neon', 12, 'Neon palettes')])
      },
    }),
  })
  assert.deepEqual(asked, [undefined])
  assert.match(last, /── On GitHub ─/)
  assert.match(last, /○ bob\/ttheme-neon +★12/)
  assert.match(last, /^ +Neon palettes/m)
})

test('typing into Markets searches GitHub for it once typing stops, and not before', async () => {
  const asked: (string | undefined)[] = []
  const search = (query: string | undefined) => {
    asked.push(query)
    return Promise.resolve([])
  }
  await drive([TAB, TAB, ...'neon', '\r'], { io: io({ search }) })
  assert.deepEqual(asked, [undefined])
  asked.length = 0
  await drive([TAB, TAB, ...'neon', 750, '\r'], { io: io({ search }) })
  assert.deepEqual(asked, [undefined, 'neon'])
})

test('a failed GitHub search says so, and space on that row searches again', async () => {
  let calls = 0
  const { frames, last } = await drive([TAB, TAB, 20, DOWN, DOWN, ' ', 20, '\r'], {
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
  assert.match(frames, /⌕ GitHub search failed/)
  assert.match(frames, /rate limited/)
  assert.match(last, /○ bob\/ttheme-neon/)
})

test('moving onto a GitHub repository fetches its index for the detail panel, once', async () => {
  const neon = market('bob/ttheme-neon', 'bob@neon', ['glow', 'haze'])
  const fetched: string[] = []
  const { frames, panel } = await drive([TAB, TAB, 20, DOWN, DOWN, 600, '\r'], {
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
  assert.match(frames, /^ +2 palettes · Neon palettes/m)
  assert.deepEqual(panel.adds, [])
})

test('a repository typed into Markets is looked up by itself, and space then asks without fetching again', async () => {
  const neon = market('bob/ttheme-neon', 'bob@neon', ['glow', 'haze'])
  const fetched: string[] = []
  const { frames, panel } = await drive(
    [TAB, TAB, ...'bob/ttheme-neon', 750, ' ', 'y', '\x7f'.repeat(15), TAB, TAB, ...APPLY],
    {
      io: io({
        fetch: (source) => {
          fetched.push(source)
          return Promise.resolve(neon)
        },
      }),
    },
  )
  assert.deepEqual(fetched, ['bob/ttheme-neon'])
  assert.match(frames, /bob@neon · 2 palettes/)
  assert.match(frames, /Update bob@neon on its own when its author changes it\?/)
  assert.deepEqual(
    panel.adds.map((m) => m.id),
    ['bob@neon'],
  )
})

test('enter with something staged opens a review of it, and esc goes back to the tabs', async () => {
  const { frames, ran } = await drive([RIGHT, DOWN, DOWN, ' ', TAB, TAB, DOWN, ' ', '\r', 20, '\x1b', ...APPLY])
  assert.match(frames, /Review changes/)
  assert.match(frames, /Markets \(1\)/)
  assert.match(frames, /- alice@pastel +github\.com\/alice\/ttheme-pastel · its 1 palette installed keep working/)
  assert.match(frames, /Palettes \(1 to install\)/)
  assert.match(frames, /\+ rin +Vocaloid/)
  assert.match(frames, /enter apply · esc back/)
  const first = frames.indexOf('Review changes')
  assert.ok(frames.indexOf('Manage markets', first) > 0)
  assert.ok(frames.indexOf('Review changes', frames.indexOf('Manage markets', first)) > 0)
  assert.ok(ran)
})

test('enter with nothing staged leaves at once', async () => {
  const { ran, result } = await drive(['\r'])
  assert.ok(!ran)
  assert.ok(!isCancel(result))
})

test('applying shows what the work reports and waits for it, and done stays until enter', async () => {
  let calls = 0
  const { frames, ran, log, failed, panel } = await drive(
    [TAB, TAB, DOWN, ' ', '\r', '\r', 30, '\x1b', '\r', 200, '\r'],
    {
      io: io({
        apply: async (_, report) => {
          calls += 1
          report.status('Fetching glow · 1/2')
          report.say('Removed alice@pastel · github.com/alice/ttheme-pastel')
          report.say('\n1 palettes installed — open a new tab')
          await new Promise((resolve) => setTimeout(resolve, 120))
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
  assert.match(frames, /keys wait until it ends/)
  assert.match(frames, /✓ Applied \(1 removed\)/)
  assert.match(frames, /enter close/)
})

test('a failed apply says so, keeps what it reported, and still closes on enter', async () => {
  const { frames, failed, log } = await drive([TAB, TAB, DOWN, ' ', ...APPLY], {
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
