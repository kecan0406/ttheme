import assert from 'node:assert/strict'
import { test } from 'node:test'

import { type Post, SITES, type Site } from './booru.ts'
import { fitOrder, interleave, type Pick, paletteMatch } from './fit.ts'

const site = (key: string) => SITES.find((s) => s.key === key) as Site
const frame = { w: 1600, h: 1000 }

function pick(key: string, id: number, width: number, height: number, tags: string[], score = 0): Pick {
  const post: Post = {
    solo: key === 'danbooru' ? tags.includes('solo') : undefined,
    family: 0,
    id,
    width,
    height,
    tags,
    score,
    file: '',
    preview: '',
    ext: 'png',
    owner: '',
    artist: '',
    rating: 'g',
    md5: '',
    source: '',
    smaller: [],
  }
  return { site: site(key), post }
}

const ids = (picks: Pick[]) => picks.map((p) => p.post.id)

test('fit puts the character alone above a crowd, and a comic below both', () => {
  const order = fitOrder(
    [
      pick('danbooru', 1, 1600, 1000, ['comic', 'solo']),
      pick('danbooru', 2, 1600, 1000, ['multiple_girls']),
      pick('danbooru', 3, 1600, 1000, ['solo']),
    ],
    frame,
  )
  assert.deepEqual(ids(order), [3, 2, 1])
})

test('fit prefers a picture as tall as the window over a small one', () => {
  assert.deepEqual(ids(fitOrder([pick('yande', 1, 480, 300, []), pick('yande', 2, 1600, 1000, [])], frame)), [2, 1])
})

test('a cutout is not held against its aspect, an opaque picture far from the window is', () => {
  const order = fitOrder(
    [
      pick('yande', 1, 1000, 3000, []),
      pick('yande', 2, 1000, 3000, ['transparent_png']),
      pick('yande', 3, 3000, 1875, []),
    ],
    frame,
  )
  assert.deepEqual(ids(order), [2, 3, 1])
})

test('solo counts only where the post knows its headcount, and ties keep the order they came in', () => {
  const lent = pick('konachan', 3, 1600, 1000, ['solo'])
  lent.post.solo = true
  assert.deepEqual(
    ids(fitOrder([pick('konachan', 1, 1600, 1000, []), pick('konachan', 2, 1600, 1000, ['solo']), lent], frame)),
    [3, 1, 2],
  )
})

test('a landscape the character stands small in falls below a picture of the character', () => {
  assert.deepEqual(
    ids(fitOrder([pick('yande', 1, 1600, 1000, ['landscape'], 300), pick('yande', 2, 1600, 1000, [], 30)], frame)),
    [2, 1],
  )
})

test('scores are weighed within each site, so a site that scores high does not crowd out the rest', () => {
  const order = fitOrder(
    [
      pick('yande', 1, 1600, 1000, [], 400),
      pick('yande', 2, 1600, 1000, [], 40),
      pick('konachan', 3, 1600, 1000, [], 20),
      pick('konachan', 4, 1600, 1000, [], 2),
    ],
    frame,
  )
  assert.deepEqual(ids(order), [1, 3, 2, 4])
})

test('a picture in the palette colors climbs above one that is not', () => {
  const [plain, matching] = [pick('yande', 1, 1600, 1000, []), pick('yande', 2, 1600, 1000, [])]
  assert.deepEqual(ids(fitOrder([plain, matching], frame, new Map([[matching.post, 1]]))), [2, 1])
})

test('interleave takes one from each site in turn and keeps each site in its order', () => {
  const order = interleave([
    pick('danbooru', 1, 1, 1, []),
    pick('danbooru', 2, 1, 1, []),
    pick('danbooru', 3, 1, 1, []),
    pick('yande', 4, 1, 1, []),
  ])
  assert.deepEqual(ids(order), [1, 4, 2, 3])
})

function flat(width: number, height: number, [r, g, b]: number[], alpha = 255) {
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data.set([r as number, g as number, b as number, alpha], i)
  }
  return { width, height, data }
}

test('paletteMatch is full on a picture in a signature color and nothing on grey or on clear pixels', () => {
  const colors = ['#d98e32', '#ffac9e', '#66acaf']
  assert.equal(paletteMatch(flat(40, 40, [0xd9, 0x8e, 0x32]), colors), 1 / 3)
  assert.equal(paletteMatch(flat(40, 40, [128, 128, 128]), colors), 0)
  assert.equal(paletteMatch(flat(40, 40, [0xd9, 0x8e, 0x32], 0), colors), 0)
  assert.equal(paletteMatch(flat(40, 40, [0xd9, 0x8e, 0x32]), ['#202020', '#f0f0f0']), 0, 'no chromatic color to match')
})
