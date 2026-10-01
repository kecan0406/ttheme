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
  hidden,
  hostMap,
  kindSet,
  lend,
  lentUrl,
  mates,
  narrowOf,
  originHost,
  parseCount,
  parseCounts,
  parseDanbooru,
  parseLent,
  parseMoebooru,
  parseSuggestions,
  parseTagList,
  parseZerochan,
  parseZerochanCount,
  parseZerochanPage,
  postRef,
  rated,
  ratingSet,
  redirected,
  rendition,
  retryAfter,
  SITES,
  type Site,
  siteSet,
  sourcePage,
  sweepCache,
  tagList,
  tagsOf,
} from './booru.ts'

const site = (key: string) => SITES.find((s) => s.key === key) as Site
const [dan, kona, yande, zero] = [site('danbooru'), site('konachan'), site('yande'), site('zerochan')]

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

test('the advanced filters ask each site in its own terms, and danbooru takes them free of its tag budget', () => {
  const all = { score: 10, size: 1080, png: true }
  assert.deepEqual(dan.narrow(all), ['score:>=10', 'width:>=1080', 'height:>=1080', 'filetype:png'])
  assert.deepEqual(yande.narrow(all), ['score:>=10', 'width:>=1080', 'height:>=1080'], 'moebooru tells png by the file')
  assert.deepEqual(zero.narrow(all), ['dimension:large'], 'zerochan keeps no score and names no file type')
  assert.deepEqual(zero.narrow({ score: 0, size: 1800, png: false }), ['dimension:huge'])
  assert.deepEqual(dan.narrow({ score: 0, size: 0, png: false }), [])
  assert.equal(tagsOf(`amane_suzuha transparent_background ${dan.narrow(all).join(' ')} rating:g`), 2)
  assert.equal(tagsOf('amane_suzuha transparent_background order:score'), 3, 'an order still counts')
  const url = new URL(zero.postsUrl('gotou_hitori dimension:huge', 0))
  assert.deepEqual([url.pathname, url.searchParams.get('d')], ['/gotou+hitori', 'huge'])
})

test('typed hide tags read as one lowercase list, commas or spaces, a leading minus dropped', () => {
  assert.deepEqual(tagList('Cosplay, multiple_girls  -ai-generated cosplay'), [
    'cosplay',
    'multiple_girls',
    'ai-generated',
  ])
  assert.deepEqual(tagList(undefined), [])
})

test('a zerochan count means something only for one plain tag, since its filters leave the count as it was', () => {
  assert.equal(zero.counts?.('makise_kurisu'), true)
  assert.equal(zero.counts?.('makise_kurisu dimension:huge'), false)
  assert.equal(zero.counts?.('makise_kurisu transparent_background'), false)
  assert.equal(dan.counts, undefined, 'the boorus count every query they are asked')
})

test('hidden kinds are told by tag, in every site spelling, and none hides nothing', () => {
  const post = { tags: ['makise_kurisu', 'comic', 'line_art', 'solo'] }
  assert.deepEqual(hidden(post, ['comic', 'sketch']), ['comic', 'line_art'])
  assert.deepEqual(hidden(post, ['chibi']), [])
  assert.deepEqual(hidden(post, []), [])
})

test('the advanced settings read back with their defaults: every site, nothing hidden, no filter', () => {
  assert.deepEqual(siteSet(undefined), ['danbooru', 'konachan', 'yande.re', 'zerochan'])
  assert.deepEqual(siteSet('zerochan bogus'), ['zerochan'])
  assert.deepEqual(kindSet(undefined), [])
  assert.deepEqual(kindSet('none'), [])
  assert.deepEqual(kindSet('chibi comic'), ['comic', 'chibi'])
  assert.deepEqual(narrowOf('off', 'off', 'off'), { score: 0, size: 0, png: false })
  assert.deepEqual(narrowOf('50', '1800', 'on'), { score: 50, size: 1800, png: true })
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
    ['transparent_background', '~transparent ~vector', 'transparent_png', 'transparent_background'],
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

test('danbooru is searched on shima, the name of its own that networks blocking the main one let through', () => {
  assert.equal(new URL(dan.postsUrl('x', 0)).host, 'shima.donmai.us')
  assert.equal(dan.tagBudget, 2)
  assert.deepEqual(
    SITES.filter((s) => Number.isFinite(s.tagBudget)).map((s) => s.key),
    ['danbooru', 'zerochan'],
  )
})

test('danbooru and the moebooru sites OR a list of tags, zerochan does not', () => {
  assert.deepEqual(
    SITES.filter((s) => s.ors).map((s) => s.key),
    ['danbooru', 'konachan', 'yande'],
  )
})

test('every site names the tag that sorts by score', () => {
  assert.deepEqual(
    SITES.map((s) => s.best),
    ['order:score', 'order:score', 'order:score', 'order:fav'],
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
  assert.deepEqual(found?.named.artist, ['kantoku'])
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
  assert.deepEqual(found?.named.artist, ['hinohari'])
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
  assert.ok(Number.isNaN(parseCounts('{"counts":{"posts":null}}')), 'a count danbooru gave up on is unknown, not 0')
})

test('postRef turns a pasted post page, a site:id or a bare number into one post to jump to', () => {
  assert.deepEqual(postRef('https://yande.re/post/show/214705', dan), { site: yande, id: 214705 })
  assert.deepEqual(postRef('https://danbooru.donmai.us/posts/12223134', yande), { site: dan, id: 12223134 })
  assert.deepEqual(postRef('https://zerochan.net/3248583', dan), { site: zero, id: 3248583 })
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

test('a post takes from danbooru only the credits it lacks, one role at a time', () => {
  const posts = parseMoebooru(
    JSON.stringify({
      posts: [listed({ id: 1, md5: 'aa', tags: 'reimu', source: 'https://x.com/a/status/1' })],
      tags: { reimu: 'character' },
    }),
  )
  const [zc] = parseZerochan(JSON.stringify({ items: [{ id: 5, width: 800, height: 1200, md5: 'bb', tags: [] }] }))
  lend(
    [...posts, ...(zc ? [zc] : [])],
    parseLent(
      JSON.stringify([
        {
          md5: 'aa',
          tag_string_artist: 'hrbzz',
          tag_string_character: 'hakurei_reimu',
          source: 'https://pixiv.net/artworks/2',
        },
        { md5: 'bb', tag_string_artist: 'potate', tag_string_copyright: 'vocaloid', source: 'https://pixiv.net/3' },
      ]),
    ),
  )
  assert.deepEqual(
    [posts[0]?.named, posts[0]?.source],
    [{ artist: ['hrbzz'], character: ['reimu'], copyright: [] }, 'https://x.com/a/status/1'],
  )
  assert.deepEqual(
    [zc?.named, zc?.source],
    [{ artist: ['potate'], character: [], copyright: ['vocaloid'] }, 'https://pixiv.net/3'],
  )
})

test('a pixiv file or old illust link is credited as the artwork page it came from', () => {
  for (const file of [
    'https://i.pximg.net/img-original/img/2023/11/30/20/19/54/113837973_p0.jpg',
    'https://i.pximg.net/c/600x1200_90/img-master/img/2023/11/30/20/19/54/113837973_p1_master1200.jpg',
    'https://i3.pixiv.net/img-original/img/2014/01/02/03/04/05/113837973_p0.png',
    'http://i2.pixiv.net/img07/img/swordsouls/113837973.png',
    'https://www.pixiv.net/member_illust.php?mode=medium&illust_id=113837973',
  ]) {
    assert.equal(sourcePage(file), 'https://www.pixiv.net/artworks/113837973', file)
  }
  for (const kept of [
    'https://www.pixiv.net/en/artworks/149948109',
    'https://x.com/oda_koden/status/2103440708585783307',
    'https://booth.pximg.net/fcecdcff-8acd-4cc/i/2310/abc.jpg',
    'pixiv 12345',
    '',
  ]) {
    assert.equal(sourcePage(kept), kept)
  }
})

test('a zerochan post page names its artist, cast and series by tag type, with its uploader and day', () => {
  const page = `
    <script type="application/ld+json">{ "datePublished": "2026-07-29T19:49:12+00:00" }</script>
    <ul id="tags">
      <li class="mangaka" data-tag="Akoiro" title="Added by Roy4127" data-user="Roy4127"><a>Akoiro</a></li>
      <li class="character primary" data-tag="Hakurei Reimu" data-user="Roy4127"><a>Hakurei Reimu</a></li>
      <li class="series fav" data-tag="Steins;Gate" data-user="Roy4127"><a>Steins;Gate</a></li>
      <li class="game" data-tag="Touhou &amp; Friends" data-user="Roy4127"><a>Touhou</a></li>
      <li class="theme" data-tag="Red Skirt" data-user="Roy4127"><a>Red Skirt</a></li>
      <li class="source" data-tag="Fanart" data-user="Roy4127"><a>Fanart</a></li>
    </ul>
    <script>var uploader = {
      name: 'Roy4127',
      status: 2,
    }</script>`
  assert.deepEqual(parseZerochanPage(page), {
    named: { artist: ['akoiro'], character: ['hakurei_reimu'], copyright: ['steins;gate', 'touhou_&_friends'] },
    source: '',
    owner: 'Roy4127',
    posted: '2026-07-29',
  })
  assert.deepEqual(parseZerochanPage(''), {
    named: { artist: [], character: [], copyright: [] },
    source: '',
    owner: '',
  })
})

test('a file danbooru also holds is fetched from its cdn, and a list that named no file takes that one', () => {
  const [moe] = parseMoebooru(JSON.stringify([listed({ id: 1, md5: 'aa', tags: 'x' })]))
  const [zc] = parseZerochan(JSON.stringify({ items: [{ id: 5, width: 800, height: 1200, md5: 'bb', tags: [] }] }))
  const lent = parseLent(
    JSON.stringify([
      { md5: 'aa', tag_string: 'x', file_url: 'https://cdn.donmai.us/original/aa/00/aa.png' },
      { md5: 'bb', tag_string: 'y', file_url: 'https://cdn.donmai.us/original/bb/00/bb.jpg' },
    ]),
  )
  lend(
    [moe, zc].filter((p) => p !== undefined),
    lent,
  )
  assert.deepEqual(moe?.mirror, {
    file: 'https://cdn.donmai.us/original/aa/00/aa.png',
    preview: 'https://cdn.donmai.us/360x360/aa/00/aa.jpg',
  })
  assert.equal(moe?.file, 'https://x/7.png', 'the post keeps its own file')
  assert.deepEqual([zc?.file, zc?.ext], ['https://cdn.donmai.us/original/bb/00/bb.jpg', 'jpg'])
})

test('the files to borrow for go to danbooru as one md5 list', () => {
  const url = new URL(lentUrl(['aa', 'bb']))
  assert.equal(url.host, 'shima.donmai.us')
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

test('zerochan names its tags in words, so they are read as tags, and nudity makes a post questionable', () => {
  const [plain, nude] = parseZerochan(
    JSON.stringify({
      items: [
        {
          id: 3248583,
          width: 2000,
          height: 3805,
          md5: 'cd77',
          tag: 'Hatsune Miku',
          tags: ['Hatsune Miku', 'Solo', 'Transparent Background'],
        },
        { id: 1, width: 900, height: 900, md5: 'ee', tag: 'Hatsune Miku', tags: ['Nude'] },
      ],
    }),
  )
  assert.deepEqual(plain?.tags, ['hatsune_miku', 'solo', 'transparent_background'])
  assert.deepEqual([plain?.solo, plain?.file, plain?.ext], [true, '', ''], 'a list names no file')
  assert.equal(plain?.preview, 'https://s1.zerochan.net/Hatsune.Miku.600.3248583.jpg')
  assert.deepEqual([plain && rated(zero, plain), nude && rated(zero, nude)], [true, false])
  const [detail] = parseZerochan(
    JSON.stringify({
      id: 3248583,
      width: 2000,
      height: 3805,
      hash: 'cd77',
      primary: 'Hatsune Miku',
      full: 'https://static.zerochan.net/Hatsune.Miku.full.3248583.png',
      tags: ['Solo'],
    }),
  )
  assert.deepEqual(
    [detail?.file, detail?.ext, detail?.md5],
    ['https://static.zerochan.net/Hatsune.Miku.full.3248583.png', 'png', 'cd77'],
  )
  assert.deepEqual(parseZerochan('{ }'), [])
})

test('zerochan takes its words joined by plus in the path, extra tags after a comma, and sorts by favourites for score', () => {
  const plain = new URL(zero.postsUrl('gotou_hitori', 0))
  assert.equal(plain.pathname, '/gotou+hitori')
  assert.deepEqual(
    [plain.searchParams.get('p'), plain.searchParams.get('s'), plain.searchParams.get('l')],
    ['1', 'id', '100'],
  )
  const best = new URL(zero.postsUrl('gotou_hitori transparent_background order:fav', 2))
  assert.equal(best.pathname, '/gotou+hitori,transparent+background')
  assert.deepEqual([best.searchParams.get('p'), best.searchParams.get('s')], ['3', 'fav'])
  assert.equal(zero.rate(['safe']), '', 'zerochan has no rating to ask for')
  assert.equal(parseZerochanCount('<description>Zerochan has 84,051 Hatsune Miku anime images'), 84051)
})

test('a zerochan file is looked for as jpg first, or png first when the post is a cutout', () => {
  const [photo, cut] = parseZerochan(
    JSON.stringify({
      items: [
        { id: 7, tag: 'Amane Suzuha', tags: [] },
        { id: 8, tag: 'Amane Suzuha', tags: ['Transparent Background'] },
      ],
    }),
  )
  assert.deepEqual(photo && zero.guesses?.(photo), [
    'https://static.zerochan.net/Amane.Suzuha.full.7.jpg',
    'https://static.zerochan.net/Amane.Suzuha.full.7.png',
  ])
  assert.equal(cut && zero.guesses?.(cut)[0], 'https://static.zerochan.net/Amane.Suzuha.full.8.png')
})

test("a redirect keeps the query the target left off, and keeps the target's own", () => {
  assert.equal(
    redirected('https://www.zerochan.net/lucy?json=&l=100', 'https://www.zerochan.net/Lucyna+Kushinada'),
    'https://www.zerochan.net/Lucyna+Kushinada?json=&l=100',
  )
  assert.equal(redirected('https://a.test/x?q=1', '/y?z=2'), 'https://a.test/y?z=2')
})

test('a tag zerochan does not know lists nothing instead of failing the search', async () => {
  const real = globalThis.fetch
  globalThis.fetch = (async () => new Response('{ }', { status: 404 })) as unknown as typeof fetch
  try {
    assert.deepEqual(await fetchPosts(zero, 'nobody_here', 0, new AbortController().signal), [])
    await assert.rejects(fetchPosts(yande, 'x', 0, new AbortController().signal), /yande\.re answered 404/)
  } finally {
    globalThis.fetch = real
  }
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
