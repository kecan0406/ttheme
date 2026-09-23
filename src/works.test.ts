import assert from 'node:assert/strict'
import { test } from 'node:test'

import { type Post, SITES, type Site } from './booru.ts'
import { distance, kinKeys, near, sameKeys, sameSet, shape } from './works.ts'

const site = (key: string) => SITES.find((s) => s.key === key) as Site

function post(fields: Partial<Post>): Post {
  return {
    id: 1,
    width: 1600,
    height: 1000,
    file: '',
    preview: '',
    ext: 'jpg',
    owner: '',
    artist: '',
    score: 0,
    rating: 's',
    md5: '',
    source: '',
    tags: [],
    solo: undefined,
    family: 0,
    smaller: [],
    ...fields,
  }
}

function image(width: number, height: number, paint: (x: number, y: number) => number) {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = paint(x, y)
      data.set([v, v, v, 255], (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

test('the same file is known by its md5 or by the pixiv page it came from, page number included', () => {
  assert.deepEqual(
    sameKeys(post({ md5: 'ab', source: 'https://i.pximg.net/img-original/img/2024/08/10/121347947_p1.jpg' })),
    ['md5:ab', 'pixiv:121347947_p1'],
  )
  assert.deepEqual(sameKeys(post({ source: 'https://www.pixiv.net/artworks/121347947' })), [])
})

test('a post names itself, its file, and every file or post its source points at', () => {
  const md5 = '50676e961c99ebdaadae65592cf455cf'
  assert.deepEqual(
    kinKeys(site('konachan'), post({ id: 155189, md5: 'cd', source: `https://files.yande.re/image/${md5}/x.jpg` })),
    ['post:konachan:155189', 'md5:cd', `md5:${md5}`],
  )
  assert.deepEqual(kinKeys(site('konachan'), post({ id: 9, source: 'https://yande.re/post/show/225908', family: 4 })), [
    'post:konachan:9',
    'post:yande:225908',
    'family:konachan:4',
  ])
})

test('a set is one uploader posting pictures of one size in a row', () => {
  const a = post({ owner: 'gnarf', width: 1500, height: 844 })
  assert.equal(sameSet(a, post({ owner: 'gnarf', width: 1500, height: 844 })), true)
  assert.equal(sameSet(a, post({ owner: 'gnarf', width: 1500, height: 1061 })), false)
  assert.equal(sameSet(a, post({ owner: 'other', width: 1500, height: 844 })), false)
  assert.equal(sameSet(post({}), post({})), false, 'no credit, no set')
})

test('near folds a re-encoded copy of one shape and ratio, not a different picture or a crop', () => {
  const stripes = image(90, 80, (x) => (x % 20 < 10 ? 30 : 220))
  const hash = shape(stripes)
  assert.equal(distance(hash, shape(image(90, 80, (x) => (x % 20 < 10 ? 34 : 216)))), 0)
  const same = { hash, width: 1600, height: 1000 }
  assert.equal(near(same, { hash, width: 800, height: 500 }), true)
  assert.equal(near(same, { hash, width: 1600, height: 900 }), false, 'a crop to another ratio')
  const other = shape(image(90, 80, (_, y) => (y % 20 < 10 ? 30 : 220)))
  assert.equal(near(same, { hash: other, width: 1600, height: 1000 }), false)
})
