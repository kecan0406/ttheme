import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { unsaved, withCatalogs, withDescription, withoutCatalogs } from './publish.ts'
import { readMarketplaceInfo } from './sources.ts'

const toml = `"$schema" = "https://www.schemastore.org/ttheme-marketplace.json"
name = "pastel"

[owner]
name = "alice"

[[catalog]]
name = "K-On!"
native = "けいおん！"

[[catalog]]
name = "Vocaloid"
native = "ボーカロイド"

[metadata]
description = "not the marketplace's"
`

test('a description goes in after the name, is replaced in place, and comes out when cleared', () => {
  const added = withDescription(toml, 'Soft colors')
  assert.match(added, /^name = "pastel"\ndescription = "Soft colors"\n\n\[owner\]/m)
  assert.equal(readMarketplaceInfo(added, 'x').description, 'Soft colors')
  const replaced = withDescription(added, 'Softer "colors"')
  assert.equal(readMarketplaceInfo(replaced, 'x').description, 'Softer "colors"')
  assert.equal(withDescription(replaced, undefined), toml)
  assert.equal(withDescription(toml, undefined), toml)
})

test('a hand-written description over several lines is replaced whole, and a catalog named in single quotes comes out', () => {
  const written = toml
    .replace('name = "pastel"\n', 'name = "pastel"\ndescription = """\nSoft colors"""\n')
    .replace('name = "K-On!"', "name = 'K-On!'")

  assert.equal(readMarketplaceInfo(written, 'x').description, 'Soft colors')
  const replaced = withDescription(written, 'Softer')
  assert.equal(readMarketplaceInfo(replaced, 'x').description, 'Softer')
  assert.equal(withDescription(written, undefined), toml.replace('name = "K-On!"', "name = 'K-On!'"))
  assert.deepEqual(
    readMarketplaceInfo(withoutCatalogs(written, new Set(['K-On!'])), 'x').catalogs.map((c) => c.name),
    ['Vocaloid'],
  )
})

test('catalog tables are added at the end and only the ones named come out', () => {
  const without = withoutCatalogs(toml, new Set(['K-On!']))
  const info = readMarketplaceInfo(without, 'x')
  assert.deepEqual(
    info.catalogs.map((c) => c.name),
    ['Vocaloid'],
  )
  assert.match(without, /name = "alice"\n\n\[\[catalog\]\]\nname = "Vocaloid"/)
  assert.match(without, /\[metadata\]\ndescription = "not the marketplace's"\n$/)
  const back = readMarketplaceInfo(withCatalogs(without, [{ name: 'K-On!', native: 'けいおん！' }]), 'x')
  assert.deepEqual(
    back.catalogs.map((c) => [c.name, c.native]),
    [
      ['Vocaloid', 'ボーカロイド'],
      ['K-On!', 'けいおん！'],
    ],
  )
  assert.equal(withoutCatalogs(toml, new Set()), toml)
})

test('a palette file git never committed, or changed since it was, is one share must warn it deletes, a committed one is not', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-publish-'))

  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {
      cwd: dir,
      stdio: 'ignore',
    })

  try {
    const shared = join(dir, 'palettes', 'kita.toml')
    const tuned = join(dir, 'palettes', 'rei.toml')
    const fresh = join(dir, 'palettes', 'miku.toml')
    mkdirSync(join(dir, 'palettes'))
    writeFileSync(shared, 'a')
    writeFileSync(tuned, 'c')
    assert.deepEqual(await unsaved(dir, [shared]), { fresh: [shared], changed: [] })
    git('init', '-q', '-b', 'main')
    assert.deepEqual(await unsaved(dir, [shared]), { fresh: [shared], changed: [] })
    git('add', '-A')
    git('commit', '-q', '--no-verify', '-m', 'share')
    writeFileSync(tuned, 'tuned since')
    writeFileSync(fresh, 'b')
    assert.deepEqual(await unsaved(dir, [shared, tuned, fresh]), { fresh: [fresh], changed: [tuned] })
    assert.deepEqual(await unsaved(dir, []), { fresh: [], changed: [] })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
