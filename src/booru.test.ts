import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mates, originHost, parseCount, parseGelbooru, parseMoebooru, SITES, safe } from './booru.ts'

const RAW = [
  {
    id: 416805,
    width: 2160,
    height: 2004,
    file_url: 'https://safebooru.org/images/416/6a65.png',
    preview_url: 'https://safebooru.org/thumbnails/416/thumbnail_6a65.jpg',
    owner: 'moeimouto',
    rating: 'safe',
    tags: 'hiiragi_kagami  transparent_background vector_trace',
  },
  {
    id: 2054214,
    width: 4000,
    height: 3768,
    directory: '2054',
    image: 'b1c2.PNG',
    preview_url: '//safebooru.org/thumbnails/2054/thumbnail_b1c2.jpg',
    owner: 'gelbooru',
    rating: 'questionable',
    tags: 'hiiragi_kagami',
  },
  { id: 0, file_url: 'https://safebooru.org/images/1/x.png', preview_url: 'https://x/t.jpg' },
]

test('parseGelbooru keeps every rating so each post counts as checked, and drops posts with no id', () => {
  const posts = parseGelbooru(JSON.stringify(RAW))
  assert.deepEqual(
    posts.map((p) => [p.id, p.rating]),
    [
      [416805, 'safe'],
      [2054214, 'questionable'],
    ],
  )
  assert.deepEqual(posts[0]?.tags, ['hiiragi_kagami', 'transparent_background', 'vector_trace'])
})

test('parseGelbooru rebuilds a missing file url and makes protocol-relative urls absolute', () => {
  const [, post] = parseGelbooru(JSON.stringify(RAW))
  assert.equal(post?.file, 'https://safebooru.org/images/2054/b1c2.PNG')
  assert.equal(post?.ext, 'png')
  assert.equal(post?.preview, 'https://safebooru.org/thumbnails/2054/thumbnail_b1c2.jpg')
})

test('parseGelbooru reads an empty answer as no posts', () => {
  assert.deepEqual(parseGelbooru(''), [])
  assert.deepEqual(parseGelbooru('  \n'), [])
})

test('only safe and general posts pass', () => {
  const [kept, dropped] = parseGelbooru(JSON.stringify(RAW))
  assert.equal(kept && safe(kept), true)
  assert.equal(dropped && safe(dropped), false)
})

test('parseCount reads the count attribute of the post list', () => {
  assert.equal(parseCount('<?xml version="1.0"?><posts count="33" offset="0"></posts>'), 33)
  assert.equal(parseCount('<html>'), 0)
})

test('mates groups palettes by uploader and skips the accounts that mirror other boorus', () => {
  const owners = new Map([
    ['tsukasa', 'moeimouto'],
    ['miyuki', 'moeimouto'],
    ['konata', 'danbooru'],
    ['patchouli', 'gelbooru'],
    ['reimu', ''],
  ])
  assert.deepEqual([...mates(owners)], [['moeimouto', ['miyuki', 'tsukasa']]])
})

test('parseMoebooru takes the extension from file_ext and the uploader from author', () => {
  const [found] = parseMoebooru(
    JSON.stringify([
      {
        id: 214705,
        width: 1197,
        height: 2599,
        file_url: 'https://files.yande.re/image/4dd1/yande.re%20214705%20hiiragi_kagami.png',
        file_ext: 'png',
        preview_url: 'https://assets.yande.re/data/preview/4d/d1/4dd1.jpg',
        author: 'gnarf1975',
        rating: 's',
        tags: 'hiiragi_kagami lucky_star',
      },
    ]),
  )
  assert.deepEqual([found?.id, found?.ext, found?.owner, found && safe(found)], [214705, 'png', 'gnarf1975', true])
})

test('every site other than safebooru asks for safe posts only, whatever the tags', () => {
  for (const site of SITES.filter((s) => s.key !== 'safebooru')) {
    for (const url of [site.postsUrl('hiiragi_kagami user:someone', 0), site.countUrl('hiiragi_kagami')]) {
      assert.match(new URL(url).searchParams.get('tags') ?? '', / rating:s$/, `${site.name}: ${url}`)
    }
  }
})

test('pages are counted from zero everywhere, whichever way each site numbers them', () => {
  const [gel, moe] = [SITES[0], SITES[1]]
  assert.equal(new URL(gel?.postsUrl('x', 0) ?? '').searchParams.get('pid'), '0')
  assert.equal(new URL(moe?.postsUrl('x', 0) ?? '').searchParams.get('page'), '1')
})

test('originHost keeps the site a source url points at and drops free-text sources', () => {
  assert.equal(originHost('http://img01.pixiv.net/img/x/123.jpg'), 'pixiv.net')
  assert.equal(originHost('https://drawingshit.deviantart.com/art/1'), 'deviantart.com')
  assert.equal(originHost('Image board'), '')
  assert.equal(originHost(''), '')
})
