import assert from 'node:assert/strict'
import { test } from 'node:test'
import { type Post, SITES, type Site } from '../../core/booru.ts'
import { Boards } from './boards.ts'
import type { Stage, Tile } from './screen.ts'

const [ONE, TWO] = SITES as [Site, Site]

function postOf(site: Site, id: number): Post {
  return {
    id,
    file: `file:///pictures/${id}.png`,
    width: 1700,
    height: 1400,
    ext: 'png',
    preview: `file:///previews/${id}.jpg`,
    owner: '',
    score: 0,
    rating: [...site.ratings.safe][0] ?? '',
    md5: '',
    source: '',
    tags: [],
    named: { artist: [], character: [], copyright: [] },
    solo: undefined,
    family: 0,
    smaller: [],
  }
}

function until(met: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const look = () => (met() ? resolve() : setImmediate(look))
    look()
  })
}

function shelf() {
  const at = { tab: ONE, held: false }
  const planned = new Map<Site, () => void>()
  const checks: (() => void)[] = []

  const view = {
    tag: 'tamsin_(tidewater)',
    preset: 'all',
    order: 'newest',
    sets: 'show',
    mode: { on: 'grid' },
    rating: ['safe'],
    block: [],
    solo: false,
    narrow: { score: 0, size: 0, png: false },
    hide: [],
    hideTags: [],
    tiles: [] as Tile[],
    checked: 0,
    total: 0,
    hunt: undefined as Stage | undefined,
    sites: [],
    focus: 0,
    top: 0,
  }

  const boards = new Boards({
    view: view as never,
    grid: () => ({ cols: 100, rows: 30, cell: { w: 8, h: 16 } }),
    entry: { name: 'ann@pastel/tamsin' } as never,
    scratch: '',
    signal: new AbortController().signal,
    net: {
      fetchCount: async () => 2,
      fetchPosts: async (site: Site, _tags: string, page: number) =>
        page === 0 ? [postOf(site, 1), postOf(site, 2)] : [],
    } as never,
    renders: { run: async () => ({ match: 1, hash: '0' }) } as never,
    kept: {
      mateOwners: (site: Site) =>
        new Promise((resolve) => {
          planned.set(site, () => resolve(new Map()))
        }),
      matesOf: () => [],
      cached: async () => 0,
      pace: {
        still: () => false,
        wait: () => (at.held ? new Promise((resolve) => checks.push(() => resolve(true))) : Promise.resolve(true)),
      },
    } as never,
    paint: { draw: () => {}, snap: () => {}, glide: () => {} } as never,
    thumbs: { pathOf: () => undefined, missing: () => false, want: () => {}, known: () => true } as never,
    tags: { query: () => ({ tags: 'tamsin_(tidewater)', notes: [] }) } as never,
    site: () => at.tab,
    sites: () => [at.tab],
    tabName: () => at.tab.name,
    tabTo: (site) => {
      at.tab = site
    },
    forget: () => {},
    select: () => {},
    enter: () => {},
    tell: () => {},
  })

  return { at, view, boards, planned, checks }
}

test('a search left for another site before it knew where to look still loads when its tab comes back', async () => {
  const { at, view, boards, planned } = shelf()
  const first = boards.search()
  await until(() => planned.has(ONE))
  at.tab = TWO
  const second = boards.turn()
  await until(() => planned.has(TWO))
  planned.get(ONE)?.()
  await first
  at.tab = ONE
  await boards.turn()
  assert.deepEqual(
    view.tiles.map((tile) => tile.id),
    [1, 2],
  )
  assert.equal(view.hunt, undefined)
  planned.get(TWO)?.()
  await second
})

test('posts being checked when the site tab turns away are on the board when it comes back', async () => {
  const { at, view, boards, planned, checks } = shelf()
  at.held = true
  const first = boards.search()
  await until(() => planned.has(ONE))
  planned.get(ONE)?.()
  await until(() => checks.length === 2)
  at.tab = TWO
  const second = boards.turn()

  for (const done of checks.splice(0)) {
    done()
  }

  await first
  at.held = false
  at.tab = ONE
  await boards.turn()
  assert.deepEqual(
    view.tiles.map((tile) => tile.id),
    [1, 2],
  )
  assert.equal(view.checked, 2)
  planned.get(TWO)?.()
  await second
})
