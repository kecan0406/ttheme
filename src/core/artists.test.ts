import assert from 'node:assert/strict'
import { test } from 'node:test'
import { artworkOf, creditLine, pageLabel, profilesOf, safeUrl } from './artists.ts'
import { parseArtistUrls } from './booru.ts'

test('an artist keeps one profile per site, follows before support, and none of the duplicates danbooru lists', () => {
  assert.deepEqual(
    profilesOf([
      'https://www.pixiv.net/stacc/marlo_731',
      'https://x.com/marlo_731',
      'https://x.com/i/user/900000000000000123',
      'https://twitter.com/home',
      'https://skeb.jp/@marlo_731',
      'https://lit.link/marlo38',
      'https://bsky.app/profile/did:plc:szk6onzad27szpysokvlg367',
      'https://bsky.app/profile/marlo731.bsky.social',
      'https://www.pixiv.net/fanbox/creator/40000123',
      'https://marlo-731.fanbox.cc',
      'https://www.pixiv.net/member.php?id=40000123',
    ]),
    [
      'https://www.pixiv.net/users/40000123',
      'https://x.com/marlo_731',
      'https://bsky.app/profile/marlo731.bsky.social',
      'https://marlo-731.fanbox.cc',
      'https://skeb.jp/@marlo_731',
    ],
  )
})

test('danbooru artists that are deleted, and urls it marks inactive, give no profile', () => {
  const found = parseArtistUrls(
    JSON.stringify([
      {
        name: 'paperboat',
        is_deleted: false,
        urls: [
          { url: 'https://x.com/_paper__boat', is_active: false },
          { url: 'https://x.com/paperboatart', is_active: true },
        ],
      },
      { name: 'gone', is_deleted: true, urls: [{ url: 'https://x.com/gone', is_active: true }] },
    ]),
  )

  assert.deepEqual([...found], [['paperboat', ['https://x.com/paperboatart']]])
})

test('the credit to copy follows each artist on a site the artwork page is not on', () => {
  const profiles = { a: ['https://www.pixiv.net/users/1', 'https://x.com/a'] }
  assert.equal(
    creditLine({ artist: ['a'], profiles, source: 'https://www.pixiv.net/artworks/5' }),
    'Background art by a (x.com/a) · https://www.pixiv.net/artworks/5',
  )
  assert.equal(
    creditLine({ artist: ['a'], profiles, source: 'https://x.com/a/status/5' }),
    'Background art by a (pixiv.net/users/1) · https://x.com/a/status/5',
  )
})

test('an artist named like a property every object has is credited as any other is', () => {
  const profiles = JSON.parse('{"tove": ["https://x.com/tove"]}')

  for (const name of ['constructor', '__proto__']) {
    assert.equal(
      creditLine({ artist: [name, 'tove'], profiles, source: 'https://www.pixiv.net/artworks/1' }),
      `Background art by ${name}, tove (x.com/tove) · https://www.pixiv.net/artworks/1`,
    )
  }
})

test('the credit to copy names the post where the picture names no artwork page, and nothing when it names neither', () => {
  assert.equal(
    creditLine({ artist: ['a', 'b'], source: 'Original', from: 'danbooru 9 https://shima.donmai.us/posts/9' }),
    'Background art by a, b · https://danbooru.donmai.us/posts/9',
  )
  assert.equal(
    creditLine({ from: 'konachan 3 https://konachan.net/post/show/3' }),
    'Background art (artist unknown) · https://konachan.net/post/show/3',
  )
  assert.equal(creditLine({ source: '/Users/me/picture.png' }), undefined)
})

test('an artwork page is labeled by its site and work, any other page by its host', () => {
  assert.deepEqual(
    [
      'https://www.pixiv.net/en/artworks/100000123',
      'https://twitter.com/marlo_731/status/1',
      'https://marlo-731.fanbox.cc/posts/7',
      'https://www.deviantart.com/someone/art/x-1',
    ].map(pageLabel),
    ['pixiv 100000123', 'x marlo_731', 'fanbox marlo-731', 'deviantart.com'],
  )
})

test('an address that holds a direction mark is no page, so it is neither credited nor labeled with itself', () => {
  const [rlo, lri] = [0x202e, 0x2066].map((code) => String.fromCodePoint(code))
  assert.equal(safeUrl(`https://example.test/${rlo}gnp.exe`), false)
  assert.equal(artworkOf({ source: `https://exa${rlo}mple.test/a` }), undefined)
  assert.equal(creditLine({ source: `https://example.test/${rlo}gnp.exe` }), undefined)
  assert.equal(creditLine({ from: `danbooru 9 https://shima.donmai.us/posts/9${lri}` }), undefined)
})
