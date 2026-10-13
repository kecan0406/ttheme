import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withCatalogs, withDescription, withoutCatalogs } from './publish.ts'
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
