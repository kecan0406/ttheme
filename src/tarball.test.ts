import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gzipSync } from 'node:zlib'
import { tarballOf } from '../tests/tarball.ts'
import { untar } from './tarball.ts'

test("a repository's archive reads as its files under paths without the top folder, however long or far from ASCII", () => {
  const long = `palettes/팝픈 뮤직/${'a'.repeat(120)}.toml`
  const files = untar(tarballOf({ 'ttheme-market.toml': 'name = "pastel"\n', [long]: 'x', 'palettes/dusk.toml': '' }))
  assert.deepEqual([...files.keys()].sort(), ['palettes/dusk.toml', long, 'ttheme-market.toml'].sort())
  assert.equal(new TextDecoder().decode(files.get('ttheme-market.toml')), 'name = "pastel"\n')
  assert.equal(files.get('palettes/dusk.toml')?.length, 0)
})

test('an archive that unpacks past the limit or is not gzip refuses to read instead of filling memory', () => {
  assert.throws(() => untar(gzipSync(new Uint8Array(65 * 1024 * 1024))), /unpacks to more than 64 MB/)
  assert.throws(() => untar(new Uint8Array([0x1f, 0x8b, 1, 2, 3])), /not a gzip file/)
})
