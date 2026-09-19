import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  exposed,
  hostMap,
  mates,
  originHost,
  parseCount,
  parseCounts,
  parseDanbooru,
  parseGelbooru,
  parseMoebooru,
  postRef,
  rated,
  ratingLevel,
  rendition,
  retryAfter,
  SITES,
  type Site,
} from './booru.ts'

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

test('only the ratings a site calls safe pass, each site read in its own vocabulary', () => {
  const [gel, moe, , dan] = SITES as [Site, Site, Site, Site]
  const [kept, dropped] = parseGelbooru(JSON.stringify(RAW))
  assert.equal(kept && rated(gel, kept), true)
  assert.equal(dropped && rated(gel, dropped), false)
  assert.equal(rated(dan, { rating: 's' }), false, 'danbooru s means sensitive, not safe')
  assert.equal(rated(moe, { rating: 's' }), true, 'moebooru s means safe')
})

test('each level lets through what that site calls by that name', () => {
  const [gel, moe, , dan] = SITES as [Site, Site, Site, Site]
  assert.equal(rated(moe, { rating: 'q' }, 'questionable'), true)
  assert.equal(rated(moe, { rating: 'e' }, 'questionable'), false)
  assert.equal(rated(moe, { rating: 'e' }, 'all'), true)
  assert.equal(rated(dan, { rating: 's' }, 'questionable'), true)
  assert.equal(rated(gel, { rating: 'questionable' }, 'questionable'), true)
})

test('the nudity and underwear tags are named in every site spelling, apart from the rating', () => {
  assert.deepEqual(exposed({ tags: ['hiiragi_kagami', 'pantsu'] }), ['pantsu'])
  assert.deepEqual(exposed({ tags: ['hiiragi_kagami', 'naked'] }), ['naked'])
  assert.deepEqual(exposed({ tags: ['hiiragi_kagami', 'swimsuit'] }), [])
})

test('the rating a site asks for in the query follows the level, where the site takes one', () => {
  const [gel, moe, , dan] = SITES as [Site, Site, Site, Site]
  assert.deepEqual([moe.rate('safe'), moe.rate('questionable'), moe.rate('all')], ['rating:s', '-rating:e', ''])
  assert.deepEqual([gel.rate('all'), dan.rate('all')], ['', ''])
  assert.equal(ratingLevel(undefined), 'safe')
  assert.equal(ratingLevel('nonsense'), 'safe')
  assert.equal(ratingLevel('all'), 'all')
})

test('a host override moves a site without renaming it, and only over https', () => {
  assert.deepEqual([...hostMap('konachan=https://konachan.com')], [['konachan', 'https://konachan.com']])
  assert.deepEqual([...hostMap('a=https://x.test, b=https://y.test')].length, 2)
  assert.deepEqual([...hostMap('konachan=http://konachan.com')], [])
  assert.deepEqual([...hostMap('nonsense')], [])
  assert.deepEqual([...hostMap(undefined)], [])
})

test('a post over the pixel cap is fetched as the largest smaller copy the site keeps, or not at all', () => {
  const [big, small] = parseMoebooru(
    JSON.stringify([
      {
        id: 1243551,
        width: 9450,
        height: 9450,
        file_url: 'https://files.yande.re/image/a/1243551.png',
        file_ext: 'png',
        jpeg_url: 'https://files.yande.re/jpeg/a/1243551.jpg',
        jpeg_width: 3500,
        jpeg_height: 3500,
        sample_url: 'https://files.yande.re/sample/a/1243551.jpg',
        sample_width: 1200,
        sample_height: 1200,
        preview_url: 'https://assets.yande.re/data/preview/a.jpg',
        rating: 's',
      },
      {
        id: 1268690,
        width: 1527,
        height: 2000,
        file_url: 'https://files.yande.re/image/b/1268690.png',
        file_ext: 'png',
        jpeg_url: 'https://files.yande.re/jpeg/b/1268690.jpg',
        jpeg_width: 1527,
        jpeg_height: 2000,
        preview_url: 'https://assets.yande.re/data/preview/b.jpg',
        rating: 's',
      },
    ]),
  )
  assert.deepEqual(big && rendition(big), {
    file: 'https://files.yande.re/jpeg/a/1243551.jpg',
    width: 3500,
    height: 3500,
    ext: 'jpg',
  })
  assert.equal(small && rendition(small), small)
  const [unsampled] = parseGelbooru(
    JSON.stringify([
      {
        id: 7,
        width: 20000,
        height: 21750,
        file_url: 'https://safebooru.org/images/1/huge.png',
        sample_url: 'https://safebooru.org/images/1/huge.png',
        sample_width: 0,
        sample_height: 0,
        preview_url: 'https://safebooru.org/thumbnails/1/huge.jpg',
      },
    ]),
  )
  assert.equal(unsampled && rendition(unsampled), undefined)
})

test('retryAfter reads delay seconds or an http date, and waits a minute when the site names neither', () => {
  const now = Date.parse('2026-09-20T12:00:00Z')
  assert.equal(retryAfter('30', now), 30_000)
  assert.equal(retryAfter('Sun, 20 Sep 2026 12:00:12 GMT', now), 12_000)
  assert.equal(retryAfter('Sun, 20 Sep 2026 11:59:00 GMT', now), 0)
  assert.equal(retryAfter(null, now), 60_000)
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
  assert.deepEqual(
    [found?.id, found?.ext, found?.owner, found && rated(SITES[1] as Site, found)],
    [214705, 'png', 'gnarf1975', true],
  )
})

test('the url builders pass the tags through as given, rating included', () => {
  for (const site of SITES.filter((s) => s.key === 'yande' || s.key === 'konachan')) {
    for (const url of [site.postsUrl('hiiragi_kagami rating:s', 0), site.countUrl('hiiragi_kagami rating:s')]) {
      assert.match(new URL(url).searchParams.get('tags') ?? '', / rating:s$/, `${site.name}: ${url}`)
    }
  }
})

test('the danbooru site is the mirror that carries general-rated posts only, and it counts tags', () => {
  const site = SITES.find((s) => s.key === 'danbooru')
  assert.equal(new URL(site?.postsUrl('x', 0) ?? '').host, 'safebooru.donmai.us')
  assert.equal(site?.tagBudget, 2)
  assert.equal(SITES.filter((s) => Number.isFinite(s.tagBudget)).length, 1)
})

test('every site names the tag that sorts by score', () => {
  assert.deepEqual(
    SITES.map((s) => s.best),
    ['sort:score:desc', 'order:score', 'order:score', 'order:score'],
  )
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

test('parseMoebooru reads the artist out of the tag types the same answer carries', () => {
  const [found] = parseMoebooru(
    JSON.stringify({
      posts: [
        {
          id: 214705,
          width: 1197,
          height: 2599,
          file_url: 'https://files.yande.re/image/4dd1/x.png',
          file_ext: 'png',
          preview_url: 'https://assets.yande.re/data/preview/4d.jpg',
          author: 'gnarf1975',
          score: 42,
          rating: 's',
          tags: 'hiiragi_kagami lucky_star kantoku',
        },
      ],
      tags: { hiiragi_kagami: 'character', lucky_star: 'copyright', kantoku: 'artist' },
    }),
  )
  assert.equal(found?.artist, 'kantoku')
  assert.equal(found?.score, 42)
})

test('parseDanbooru takes the artist, the score and only the variants ttheme can decode', () => {
  const [found] = parseDanbooru(
    JSON.stringify([
      {
        id: 12223134,
        image_width: 9000,
        image_height: 9000,
        file_url: 'https://cdn.donmai.us/original/e1/cb/e1cb.png',
        file_ext: 'png',
        preview_file_url: 'https://cdn.donmai.us/180x180/e1/cb/e1cb.jpg',
        score: 7,
        tag_string: 'kirisame_marisa touhou hinohari',
        tag_string_artist: 'hinohari',
        media_asset: {
          variants: [
            { type: '180x180', width: 180, height: 180, file_ext: 'jpg', url: 'https://cdn.donmai.us/180x180/e.jpg' },
            { type: '720x720', width: 720, height: 720, file_ext: 'webp', url: 'https://cdn.donmai.us/720x720/e.webp' },
            { type: 'sample', width: 850, height: 850, file_ext: 'jpg', url: 'https://cdn.donmai.us/sample/e.jpg' },
          ],
        },
      },
    ]),
  )
  assert.equal(found?.artist, 'hinohari')
  assert.equal(found?.score, 7)
  assert.deepEqual(
    found?.smaller.map((v) => [v.width, v.ext]),
    [
      [850, 'jpg'],
      [180, 'jpg'],
    ],
  )
  assert.equal(found && rendition(found)?.width, 850)
})

test('parseCounts reads the number danbooru answers a count query with', () => {
  assert.equal(parseCounts('{"counts":{"posts":1026}}'), 1026)
  assert.equal(parseCounts(''), 0)
})

test('postRef turns a pasted post page, a site:id or a bare number into one post to jump to', () => {
  const [safebooru, yande] = [SITES[0], SITES[1]]
  assert.deepEqual(postRef('https://yande.re/post/show/214705', safebooru as never), { site: yande, id: 214705 })
  assert.deepEqual(postRef('https://safebooru.donmai.us/posts/12223134', safebooru as never), {
    site: SITES[3],
    id: 12223134,
  })
  assert.deepEqual(postRef('https://safebooru.org/index.php?page=post&s=view&id=7159377', safebooru as never), {
    site: safebooru,
    id: 7159377,
  })
  assert.deepEqual(postRef('konachan:244200', safebooru as never), { site: SITES[2], id: 244200 })
  assert.deepEqual(postRef('7159377', safebooru as never), { site: safebooru, id: 7159377 })
  assert.equal(postRef('hakurei_reimu', safebooru as never), undefined)
  assert.equal(postRef('https://danbooru.donmai.us/posts/1', safebooru as never), undefined)
})
