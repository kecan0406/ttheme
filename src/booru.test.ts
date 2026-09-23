import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

import {
  blockSet,
  cutoutMap,
  exposed,
  fetchPosts,
  hostMap,
  lend,
  lentUrl,
  mates,
  originHost,
  parseCount,
  parseCounts,
  parseDanbooru,
  parseLent,
  parseMoebooru,
  parseSuggestions,
  parseTagList,
  postRef,
  rated,
  ratingSet,
  rendition,
  retryAfter,
  SITES,
  type Site,
  sweepCache,
  tagsOf,
  untunneled,
} from './booru.ts'

const site = (key: string) => SITES.find((s) => s.key === key) as Site
const [dan, kona, yande] = [site('danbooru'), site('konachan'), site('yande')]

test('only the ratings a site calls safe pass, each site read in its own vocabulary', () => {
  assert.equal(rated(dan, { rating: 'g' }), true)
  assert.equal(rated(dan, { rating: 's' }), false, 'danbooru s means sensitive, not safe')
  assert.equal(rated(yande, { rating: 's' }), true, 'moebooru s means safe')
})

test('each ticked rating lets through what that site calls by that name, and only that', () => {
  const moe = yande
  assert.equal(rated(moe, { rating: 'q' }, ['questionable']), true)
  assert.equal(rated(moe, { rating: 's' }, ['questionable']), false, 'questionable alone leaves safe out')
  assert.equal(rated(moe, { rating: 'e' }, ['safe', 'questionable']), false)
  assert.equal(rated(moe, { rating: 'e' }, ['safe', 'explicit']), true)
  assert.equal(rated(dan, { rating: 's' }, ['questionable']), true)
  assert.equal(rated(dan, { rating: 'e' }, ['questionable']), false)
})

test('nudity and underwear are blocked apart, in every site spelling', () => {
  const tags = ['hiiragi_kagami', 'pantsu', 'naked', 'swimsuit']
  assert.deepEqual(exposed({ tags }), ['pantsu', 'naked'])
  assert.deepEqual(exposed({ tags }, ['underwear']), ['pantsu'])
  assert.deepEqual(exposed({ tags }, ['nudity']), ['naked'])
  assert.deepEqual(exposed({ tags }, []), [])
})

test('the rating a site asks for in the query follows the ticked set, where the site takes one', () => {
  const moe = yande
  assert.deepEqual(
    [
      moe.rate(['safe']),
      moe.rate(['questionable']),
      moe.rate(['explicit']),
      moe.rate(['safe', 'questionable']),
      moe.rate(['safe', 'explicit']),
      moe.rate(['questionable', 'explicit']),
      moe.rate(['safe', 'questionable', 'explicit']),
    ],
    ['rating:s', 'rating:q', 'rating:e', '-rating:e', '-rating:q', '-rating:s', ''],
  )
  assert.deepEqual(
    [
      dan.rate(['safe']),
      dan.rate(['questionable']),
      dan.rate(['questionable', 'explicit']),
      dan.rate(['safe', 'questionable', 'explicit']),
    ],
    ['rating:g', 'rating:s,q', 'rating:s,q,e', ''],
  )
})

test('a rating does not count against a tag budget, since danbooru lets it through free', () => {
  assert.equal(tagsOf('amane_suzuha transparent_background rating:s,q,e'), 2)
  assert.equal(tagsOf('amane_suzuha order:score'), 2)
})

test('the settings read back as ticked sets, falling to the safe default when nothing valid is named', () => {
  assert.deepEqual(ratingSet(undefined), ['safe'])
  assert.deepEqual(ratingSet('all'), ['safe'])
  assert.deepEqual(ratingSet('explicit safe'), ['safe', 'explicit'])
  assert.deepEqual(blockSet(''), ['nudity', 'underwear'])
  assert.deepEqual(blockSet('underwear'), ['underwear'])
  assert.deepEqual(blockSet('none'), [])
})

test('cutout tags are named per site, a site left empty asks for none, and unnamed sites keep their own', () => {
  assert.deepEqual(
    [...cutoutMap('konachan=transparent,vector yande=transparent_png danbooru= bogus')],
    [
      ['konachan', ['transparent', 'vector']],
      ['yande', ['transparent_png']],
      ['danbooru', []],
    ],
  )
  assert.deepEqual(
    SITES.map((site) => site.cutouts),
    ['transparent_background', '~transparent ~vector', 'transparent_png'],
  )
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
  const [unsampled] = parseMoebooru(
    JSON.stringify([
      {
        id: 7,
        width: 20000,
        height: 21750,
        file_url: 'https://files.yande.re/image/c/7.png',
        file_ext: 'png',
        preview_url: 'https://assets.yande.re/data/preview/c.jpg',
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

test('mates groups palettes by uploader and skips posts with none', () => {
  const owners = new Map([
    ['tsukasa', 'moeimouto'],
    ['miyuki', 'moeimouto'],
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
    [found?.id, found?.ext, found?.owner, found && rated(yande, found)],
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

test('danbooru is searched on the main site, which carries every rating, and it counts tags', () => {
  assert.equal(new URL(dan.postsUrl('x', 0)).host, 'danbooru.donmai.us')
  assert.equal(dan.tagBudget, 2)
  assert.equal(SITES.filter((s) => Number.isFinite(s.tagBudget)).length, 1)
})

test('every site names the tag that sorts by score', () => {
  assert.deepEqual(
    SITES.map((s) => s.best),
    ['order:score', 'order:score', 'order:score'],
  )
})

test('pages are counted from zero everywhere, whichever way each site numbers them', () => {
  assert.equal(new URL(dan.postsUrl('x', 0)).searchParams.get('page'), '1')
  assert.equal(new URL(yande.postsUrl('x', 0)).searchParams.get('page'), '1')
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

test('parseDanbooru takes the artist, the score, the 360 px preview and only the variants ttheme can decode', () => {
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
            { type: '360x360', width: 360, height: 360, file_ext: 'jpg', url: 'https://cdn.donmai.us/360x360/e.jpg' },
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
      [360, 'jpg'],
      [180, 'jpg'],
    ],
  )
  assert.equal(found && rendition(found)?.width, 850)
  assert.equal(found?.preview, 'https://cdn.donmai.us/360x360/e.jpg', 'the tile preview is the 360 px one')
})

test('parseCounts reads the number danbooru answers a count query with', () => {
  assert.equal(parseCounts('{"counts":{"posts":1026}}'), 1026)
  assert.equal(parseCounts(''), 0)
})

test('postRef turns a pasted post page, a site:id or a bare number into one post to jump to', () => {
  assert.deepEqual(postRef('https://yande.re/post/show/214705', dan), { site: yande, id: 214705 })
  assert.deepEqual(postRef('https://danbooru.donmai.us/posts/12223134', yande), { site: dan, id: 12223134 })
  assert.deepEqual(postRef('konachan:244200', dan), { site: kona, id: 244200 })
  assert.deepEqual(postRef('7159377', dan), { site: dan, id: 7159377 })
  assert.equal(postRef('hakurei_reimu', dan), undefined)
  assert.equal(postRef('https://safebooru.org/index.php?page=post&s=view&id=7159377', dan), undefined)
})

test('sweepCache drops the oldest cached files until the tree fits its budget', () => {
  const root = mkdtempSync(join(tmpdir(), 'ttheme-sweep-'))
  const made = ['orig/old.png', 'tile/middle.png', 'thumb/new.jpg']
  made.forEach((name, age) => {
    const path = join(root, 'danbooru', name)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, new Uint8Array(100))
    utimesSync(path, 0, age)
  })
  const kept = join(root, 'danbooru', 'probes.json')
  writeFileSync(kept, '{}')

  sweepCache(250, root)
  assert.equal(existsSync(join(root, 'danbooru', 'orig/old.png')), false, 'the oldest goes first')
  assert.equal(existsSync(join(root, 'danbooru', 'tile/middle.png')), true)
  assert.equal(existsSync(join(root, 'danbooru', 'thumb/new.jpg')), true)
  assert.equal(existsSync(kept), true, 'probes and owners are not image cache')

  sweepCache(0, root)
  assert.equal(existsSync(join(root, 'danbooru', 'thumb/new.jpg')), false, 'a zero budget clears the images')
  assert.equal(existsSync(kept), true)
  rmSync(root, { recursive: true, force: true })
})

test('parseSuggestions keeps each completed tag with its post count', () => {
  assert.deepEqual(
    parseSuggestions(
      JSON.stringify([
        { type: 'tag-word', label: 'amane suzuha', value: 'amane_suzuha', category: 4, post_count: 937 },
        { type: 'tag-word', label: 'x', value: '', post_count: 1 },
      ]),
    ),
    [{ value: 'amane_suzuha', count: 937 }],
  )
  assert.deepEqual(parseSuggestions(''), [])
})

const listed = (fields: Record<string, unknown>) => ({
  id: 7,
  width: 1600,
  height: 1000,
  file_url: 'https://x/7.png',
  preview_url: 'https://x/p7.jpg',
  preview_file_url: 'https://x/p7.jpg',
  ...fields,
})

test('danbooru knows whether a picture shows one person, the moebooru sites leave it unknown', () => {
  const [alone] = parseDanbooru(JSON.stringify([listed({ tag_string: 'amane_suzuha solo' })]))
  const [crowd] = parseDanbooru(JSON.stringify([listed({ tag_string: 'amane_suzuha 2girls' })]))
  const [moe] = parseMoebooru(JSON.stringify([listed({ tags: 'amane_suzuha solo' })]))
  assert.deepEqual([alone?.solo, crowd?.solo, moe?.solo], [true, false, undefined])
})

test('a post names its family by the parent it hangs under, or by itself when it has children', () => {
  const [child] = parseMoebooru(JSON.stringify([listed({ parent_id: 3, tags: '' })]))
  const [parent] = parseDanbooru(JSON.stringify([listed({ has_children: true, tag_string: '' })]))
  const [alone] = parseDanbooru(JSON.stringify([listed({ parent_id: null, has_children: false, tag_string: '' })]))
  assert.deepEqual([child?.family, parent?.family, alone?.family], [3, 7, 0])
})

test('a moebooru post borrows the tags danbooru holds for the same file, headcount included', () => {
  const posts = parseMoebooru(
    JSON.stringify([listed({ id: 1, md5: 'aa', tags: 'x' }), listed({ id: 2, md5: 'bb', tags: 'x' })]),
  )
  lend(posts, parseLent(JSON.stringify([{ md5: 'aa', tag_string: 'x solo comic' }])))
  assert.deepEqual(
    posts.map((p) => [p.tags, p.solo]),
    [
      [['x', 'solo', 'comic'], true],
      [['x'], undefined],
    ],
  )
})

test('the files to borrow for go to danbooru as one md5 list', () => {
  const url = new URL(lentUrl(['aa', 'bb']))
  assert.equal(url.host, 'danbooru.donmai.us')
  assert.equal(url.searchParams.get('tags'), 'md5:aa,bb')
})

test('parseTagList reads a moebooru tag search as completions with their post counts', () => {
  assert.deepEqual(
    parseTagList(
      JSON.stringify([{ id: 33398, name: 'amane_suzuha', count: 86, type: 4, ambiguous: false }, { id: 1 }]),
    ),
    [{ value: 'amane_suzuha', count: 86 }],
  )
})

test('only danbooru rides the unblock proxy, the other sites and their file hosts go direct', () => {
  assert.equal(untunneled(), 'konachan.net,.konachan.net,yande.re,.yande.re')
})

test('a request cut off by a connection reset is tried again', async () => {
  const real = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    if (calls === 1) {
      throw new TypeError('fetch failed', { cause: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }) })
    }
    return new Response('[]')
  }) as unknown as typeof fetch
  try {
    assert.deepEqual(await fetchPosts(yande, 'x', 0, new AbortController().signal), [])
    assert.equal(calls, 2)
  } finally {
    globalThis.fetch = real
  }
})
