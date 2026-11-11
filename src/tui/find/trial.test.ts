import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { type Post, postKey } from '../../core/booru.ts'
import { TUNE } from '../../core/picture-panel.ts'
import type { Pick } from '../../pictures/fit.ts'
import type { Shown } from '../../pictures/render.ts'
import { LOCAL } from './attach.ts'
import { type FindView, renderFind, type Tile } from './screen.ts'
import { Trial } from './trial.ts'

interface Asked {
  job: { job: string; from?: string; tune?: { opacity?: number } }
  done: (made: Shown | boolean) => void
}

function inbox<T>() {
  const held: T[] = []
  const waiting: ((item: T) => void)[] = []

  return {
    put(item: T): void {
      const next = waiting.shift()

      if (next) {
        next(item)
      } else {
        held.push(item)
      }
    },
    take(): Promise<T> {
      const item = held.shift()

      return item === undefined ? new Promise((resolve) => waiting.push(resolve)) : Promise.resolve(item)
    },
  }
}

function postOf(id: number, ext = 'png'): Post {
  return {
    id,
    file: `file:///pictures/${id}.${ext}`,
    width: 1700,
    height: 1400,
    ext,
    preview: `file:///pictures/${id}.${ext}`,
    owner: '',
    score: 0,
    rating: 's',
    md5: '',
    source: '',
    tags: [],
    named: { artist: [], character: [], copyright: [] },
    solo: undefined,
    family: 0,
    smaller: [],
  }
}

function tileOf(id: number): Tile {
  return {
    id,
    key: postKey(LOCAL, id),
    site: 'local',
    siteAnsi: 7,
    width: 1700,
    height: 1400,
    reduced: false,
    page: '',
    artist: '',
    score: 0,
    variants: 0,
    mates: [],
  }
}

function bench(ids: number[], locate: () => Promise<undefined> = async () => undefined) {
  const tune = { size: 'fill' as const, at: 3, opacity: 0.18 }
  const picks = ids.map((id): Pick => ({ site: LOCAL, post: postOf(id) }))
  const asked = inbox<Asked>()
  const landed = inbox<true>()
  const drawn = inbox<true>()
  const told: string[] = []
  const groups = [{ posts: picks, open: false }]

  const view: FindView = {
    palette: 'ann@pastel/tamsin',
    tag: 'tamsin_(tidewater)',
    site: 'all',
    siteAnsi: 6,
    nextSite: 'local',
    preset: 'cutouts',
    order: 'fit',
    solo: false,
    rating: ['safe'],
    block: [],
    sets: 'fold',
    narrow: { score: 0, size: 0, png: false },
    enabled: [],
    hide: [],
    hideTags: [],
    settings: [],
    colors: { cursor: '#6ad0c8', selection: '#26423f', background: '#101918', foreground: '#d3e6e3', ansi: [] },
    tiles: [tileOf(ids[0] as number)],
    installed: [],
    queue: [],
    held: [],
    checked: 0,
    total: 0,
    sites: [],
    focus: 0,
    top: 0,
    scroll: 0,
    beat: 0,
    mode: { on: 'try' },
    help: undefined,
    scene: 0,
    details: false,
    tune: { ...tune },
    untuned: tune,
    coloring: 'tone',
    chips: [],
  }

  const trial = new Trial({
    view,
    grid: () => ({ cols: 100, rows: 30, cell: { w: 8, h: 16 } }),
    entry: { name: 'ann@pastel/tamsin' } as never,
    tone: {} as never,
    blurring: 0,
    sticker: false,
    scratch: mkdtempSync(join(tmpdir(), 'ttheme-trial-')),
    signal: new AbortController().signal,
    net: { locate } as never,
    renders: {
      run: (job: Asked['job']) => new Promise((done) => asked.put({ job, done })),
    } as never,
    kept: {
      letGo: () => {},
      profile: async () => {},
      cached: async () => 1024,
      transparent: async () => true,
    } as never,
    paint: { draw: () => drawn.put(true), flush: () => {} } as never,
    boards: {
      posts: new Map(picks.map((pick) => [postKey(LOCAL, pick.post.id), pick])),
      board: { groups },
      show: () => {
        view.tiles = groups.map((group) => tileOf((group.posts[0] as Pick).post.id))
      },
    } as never,
    thumbs: { known: () => true, want: () => {} } as never,
    settings: { setting: () => 'off' } as never,
    inform: () => {},
    tell: (notice) => {
      view.notice = notice
    },
    focus: () => {},
    openPage: () => {},
    fromClipboard: async () => {},
    install: () => {},
    landed: () => landed.put(true),
    hint: (text) => told.push(text),
  })

  return { view, trial, asked, landed, drawn, told }
}

test('a picture forgotten while it is being prepared takes its Preparing line with it', async () => {
  const { view, trial, asked, landed } = bench([7])
  const key = postKey(LOCAL, 7)
  trial.current = {
    site: LOCAL,
    id: 7,
    key,
    path: '/pictures/7.png',
    ext: 'png',
    size: 1024,
    using: 'plain',
    failed: false,
  }
  trial.reveal()
  assert.deepEqual(view.work, { step: 'prepare', key })
  const show = await asked.take()
  trial.forget()
  show.done({ clear: 40, fill: 120, opacity: 0.18 })
  await landed.take()
  assert.equal(view.work, undefined)
  assert.equal(view.shown, undefined)
})

test('a picture that failed to arrive keeps its reason on the foot after another notice came and went', async () => {
  const { view, trial, drawn } = bench([7], () => Promise.reject(new Error('connection reset')))
  trial.select()

  while (view.work?.step !== 'failed') {
    await drawn.take()
  }

  assert.deepEqual(view.work, { step: 'failed', key: postKey(LOCAL, 7), reason: 'local: connection reset' })
  view.notice = { text: 'Already in the queue', tone: 'info' }
  view.notice = undefined
  const foot = renderFind(view, 100, 30).lines.at(-1) ?? ''
  assert.match(foot, /local: connection reset — enter tries again/)
})

test('a tuning changed while a picture is drawn for the first time is drawn again', async () => {
  const { view, trial, asked, landed } = bench([7])
  trial.select()
  const plain = await asked.take()
  plain.done({ clear: 40, fill: 120, opacity: 0.18 })
  const first = await asked.take()
  trial.tuneOn(TUNE.opacity)
  trial.tuneKey('right')
  first.done({ clear: 40, fill: 120, opacity: 0.18 })
  const again = await asked.take()
  assert.equal(again.job.tune?.opacity, 0.19)
  again.done({ clear: 40, fill: 120, opacity: 0.18 })
  await landed.take()
  assert.equal(view.shown?.id, postKey(LOCAL, 7))
  assert.match(view.shown?.path ?? '', /-19\.png$/)
})

test('an opaque picture with a transparent copy in its set is swapped for the copy', async () => {
  const { view, trial, asked, landed, told } = bench([7, 8])
  trial.select()
  const opaque = await asked.take()
  opaque.done({ clear: 0, fill: 120, opacity: 0.18 })
  const twin = await asked.take()
  assert.equal(twin.job.job, 'twin')
  twin.done(true)
  const plain = await asked.take()
  assert.match(plain.job.from ?? '', /8\.png$/)
  plain.done({ clear: 40, fill: 120, opacity: 0.18 })
  ;(await asked.take()).done({ clear: 40, fill: 120, opacity: 0.18 })
  await landed.take()
  assert.equal(view.tiles[0]?.id, 8)
  assert.equal(view.shown?.id, postKey(LOCAL, 8))
  assert.deepEqual(told, ['Trying local 8, the same picture with a transparent background'])
})

test('a track still held after the try view closed moves nothing', () => {
  const { view, trial } = bench([7])
  trial.leave()
  trial.slide(TUNE.opacity, {
    target: undefined,
    x: 5,
    y: 0,
    exact: { x: 5.5, y: 0.5 },
    width: 11,
    height: 1,
    inside: true,
  })
  assert.deepEqual(view.mode, { on: 'grid' })
  assert.equal(view.tune.opacity, 0.18)
})
