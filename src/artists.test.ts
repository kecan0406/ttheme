import assert from 'node:assert/strict'
import { test } from 'node:test'
import { creditLine, pageLabel, profilesOf } from './artists.ts'
import { parseArtistUrls } from './booru.ts'

test('an artist keeps one profile per site, follows before support, and none of the duplicates danbooru lists', () => {
  assert.deepEqual(
    profilesOf([
      'https://www.pixiv.net/stacc/yoshio_296',
      'https://x.com/yoshio_296',
      'https://x.com/i/user/968103409411747840',
      'https://twitter.com/home',
      'https://skeb.jp/@yoshio_296',
      'https://lit.link/yoshio38',
      'https://bsky.app/profile/did:plc:szk6onzad27szpysokvlg367',
      'https://bsky.app/profile/yoshio296.bsky.social',
      'https://www.pixiv.net/fanbox/creator/38312600',
      'https://yoshio-296.fanbox.cc',
      'https://www.pixiv.net/member.php?id=38312600',
    ]),
    [
      'https://www.pixiv.net/users/38312600',
      'https://x.com/yoshio_296',
      'https://bsky.app/profile/yoshio296.bsky.social',
      'https://yoshio-296.fanbox.cc',
      'https://skeb.jp/@yoshio_296',
    ],
  )
})

test('danbooru artists that are deleted, and urls it marks inactive, give no profile', () => {
  const found = parseArtistUrls(
    JSON.stringify([
      {
        name: 'potate',
        is_deleted: false,
        urls: [
          { url: 'https://x.com/_potate__fluffy', is_active: false },
          { url: 'https://x.com/potepalette', is_active: true },
        ],
      },
      { name: 'gone', is_deleted: true, urls: [{ url: 'https://x.com/gone', is_active: true }] },
    ]),
  )
  assert.deepEqual([...found], [['potate', ['https://x.com/potepalette']]])
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
      'https://www.pixiv.net/en/artworks/113837973',
      'https://twitter.com/yoshio_296/status/1',
      'https://yoshio-296.fanbox.cc/posts/7',
      'https://www.deviantart.com/someone/art/x-1',
    ].map(pageLabel),
    ['pixiv 113837973', 'x yoshio_296', 'fanbox yoshio-296', 'deviantart.com'],
  )
})
