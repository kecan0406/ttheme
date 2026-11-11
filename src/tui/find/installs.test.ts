import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LOCAL } from './attach.ts'
import { Installs } from './installs.ts'

test('leaving while an install waits behind the render on its way installs it before find closes', async () => {
  const tune = { size: 'fill', at: 3, opacity: 0.18 }

  const view = {
    tiles: [{ key: 7 }],
    focus: 0,
    shown: { id: 7 },
    tune,
    untuned: tune,
    coloring: 'tone',
    installed: [] as number[],
    queue: [] as number[],
    closing: undefined as { code: number } | undefined,
    help: undefined,
    mode: { on: 'try' },
  }

  const trial = {
    presenting: true,
    current: {
      site: LOCAL,
      id: 7,
      key: 7,
      path: '/pictures/7.png',
      ext: 'png',
      size: 0,
      using: 'plain',
      failed: false,
    },
    leave: () => {},
  }

  const session = new AbortController()
  const closed = Promise.withResolvers<number>()

  const installs = new Installs({
    view: view as never,
    grid: () => ({ cols: 80, rows: 24, cell: { w: 8, h: 16 } }),
    home: '',
    entry: { name: 'ann@pastel/tamsin' } as never,
    tone: {} as never,
    blurring: 0,
    sticker: false,
    signal: session.signal,
    renders: { run: async () => undefined } as never,
    kept: { profile: async () => {}, links: () => ({}), owned: () => {} } as never,
    paint: { draw: () => {}, flush: () => {} } as never,
    boards: { posts: new Map() } as never,
    thumbs: { holds: () => {} } as never,
    trial: trial as never,
    notice: () => {},
    tell: () => {},
    finish: (code) => closed.resolve(code),
    aligns: () => false,
    refreshes: () => false,
    refresh: async () => {},
  })

  installs.install()
  assert.deepEqual(view.queue, [])
  installs.leave(2)
  assert.deepEqual(view.closing, { code: 2 }, 'find waits instead of closing')
  trial.presenting = false
  installs.landed()
  assert.deepEqual(view.queue, [7])
  assert.equal(await closed.promise, 2)
  assert.deepEqual(view.installed, [7])
})
