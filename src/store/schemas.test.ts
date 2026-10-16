import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { SITES } from '../core/booru.ts'
import { RULES } from '../core/contrast.ts'
import { MODES } from '../core/mode.ts'
import { MARKETPLACE_SCHEMA_URL, PALETTE_KEYS, PALETTE_SCHEMA_URL, POSITIONS } from '../core/theme.ts'
import { ROOT } from '../root.ts'
import { CATALOG_KEYS, MARKETPLACE_KEYS, OWNER_KEYS } from './sources.ts'

interface Node {
  $id?: string
  $ref?: string
  properties?: Record<string, Node>
  items?: Node
  enum?: unknown[]
  anyOf?: Node[]
  definitions?: Record<string, Node>
}

const read = (name: string): Node => JSON.parse(readFileSync(join(ROOT, 'schemas', name), 'utf8')) as Node

const keys = (node: Node | undefined): string[] => Object.keys(node?.properties ?? {}).sort()

test('the marketplace schema SchemaStore serves describes the keys ttheme reads from ttheme-marketplace.toml', () => {
  const marketplace = read('ttheme-marketplace.json')
  assert.equal(marketplace.$id, MARKETPLACE_SCHEMA_URL)
  assert.deepEqual(keys(marketplace), [...MARKETPLACE_KEYS].sort())
  assert.deepEqual(keys(marketplace.properties?.owner), [...OWNER_KEYS].sort())
  assert.deepEqual(keys(marketplace.properties?.catalog?.items), [...CATALOG_KEYS].sort())
})

test('the palette schema describes the keys, sites, positions, slots and gate rules the palette reader knows', () => {
  const palette = read('ttheme-palette.json')
  assert.equal(palette.$id, PALETTE_SCHEMA_URL)
  assert.deepEqual(keys(palette), [...(PALETTE_KEYS.get('') ?? [])].sort())

  for (const table of ['meta', 'colors', 'contrast', 'ghostty']) {
    assert.deepEqual(keys(palette.properties?.[table]), [...(PALETTE_KEYS.get(table) ?? [])].sort(), table)
  }

  assert.deepEqual(keys(palette.properties?.picture?.items), [...(PALETTE_KEYS.get('picture') ?? [])].sort())
  const defs = palette.definitions ?? {}

  for (const mode of MODES) {
    assert.equal(palette.properties?.colors?.properties?.[mode]?.$ref, '#/definitions/shade', mode)
    assert.deepEqual(keys(defs.shade), [...(PALETTE_KEYS.get(`colors.${mode}`) ?? [])].sort(), mode)
  }

  assert.deepEqual(
    defs.site?.anyOf?.[0]?.enum,
    SITES.map((s) => s.key),
  )
  assert.deepEqual(palette.properties?.picture?.items?.properties?.position?.anyOf?.[0]?.enum, [...POSITIONS])
  assert.deepEqual(palette.properties?.contrast?.properties?.waive?.items?.anyOf?.[0]?.enum, RULES)
  assert.deepEqual(defs.slot?.enum, [
    'background',
    'foreground',
    'cursor',
    'selection',
    ...Array.from({ length: 16 }, (_, i) => `ansi${i}`),
  ])
})
