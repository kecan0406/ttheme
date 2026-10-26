import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { SITES } from '../core/booru.ts'
import { CHARACTER_KEYS, WORK_KEYS } from '../core/commons.ts'
import { RULES } from '../core/contrast.ts'
import { MODES } from '../core/mode.ts'
import {
  MARKETPLACE_SCHEMA_URL,
  nameProblem,
  PALETTE_KEYS,
  PALETTE_SCHEMA_URL,
  POSITIONS,
  subjectProblem,
  WORK_SCHEMA_URL,
} from '../core/theme.ts'
import { ROOT } from '../root.ts'
import { MARKETPLACE_KEYS, OWNER_KEYS } from './sources.ts'

interface Node {
  $id?: string
  $ref?: string
  type?: string
  pattern?: string
  not?: Node
  properties?: Record<string, Node>
  propertyNames?: Node
  items?: Node
  enum?: unknown[]
  anyOf?: Node[]
  definitions?: Record<string, Node>
}

const read = (name: string): Node => JSON.parse(readFileSync(join(ROOT, 'schemas', name), 'utf8')) as Node

const keys = (node: Node | undefined): string[] => Object.keys(node?.properties ?? {}).sort()

const SITE_KEYS = SITES.map((s) => s.key)

function grows(node: Node | undefined, values: readonly unknown[], what: string): void {
  assert.deepEqual(node?.anyOf?.[0]?.enum, [...values], what)
  assert.equal(
    node?.anyOf?.[1]?.type,
    'string',
    `${what} keeps a string fallback, so an older copy never flags a newer file`,
  )
}

function takes(node: Node | undefined, value: string): boolean {
  const pattern = node?.pattern
  assert.ok(pattern, 'a pattern to test against')

  return new RegExp(pattern).test(value) && !(node?.not?.pattern && new RegExp(node.not.pattern).test(value))
}

const SUBJECTS = ['evangelion', 'evangelion/rei', 'k-on/yui', 'ttheme', 'ttheme/rei', 'Evangelion', 'a--b', 'a/b/c', '']

const NAMES = [
  'ttheme/rei',
  'alice@dust/rei',
  'rei',
  'ttheme@dust/rei',
  'alice/rei',
  'alice@dust/rei/x',
  'Alice@dust/rei',
]

test('the marketplace schema SchemaStore serves describes the keys ttheme reads from ttheme-marketplace.toml', () => {
  const marketplace = read('ttheme-marketplace.json')
  assert.equal(marketplace.$id, MARKETPLACE_SCHEMA_URL)
  assert.deepEqual(keys(marketplace), [...MARKETPLACE_KEYS].sort())
  assert.deepEqual(keys(marketplace.properties?.owner), [...OWNER_KEYS].sort())
})

test('the palette schema describes the keys, sites, positions, slots and gate rules the palette reader knows', () => {
  const palette = read('ttheme-palette.json')
  assert.equal(palette.$id, PALETTE_SCHEMA_URL)
  assert.deepEqual(keys(palette), [...(PALETTE_KEYS.get('') ?? [])].sort())

  for (const table of ['colors', 'contrast', 'ghostty']) {
    assert.deepEqual(keys(palette.properties?.[table]), [...(PALETTE_KEYS.get(table) ?? [])].sort(), table)
  }

  assert.deepEqual(keys(palette.properties?.picture?.items), [...(PALETTE_KEYS.get('picture') ?? [])].sort())
  const defs = palette.definitions ?? {}

  for (const mode of MODES) {
    assert.equal(palette.properties?.colors?.properties?.[mode]?.$ref, '#/definitions/shade', mode)
    assert.deepEqual(keys(defs.shade), [...(PALETTE_KEYS.get(`colors.${mode}`) ?? [])].sort(), mode)
  }

  grows(defs.site, SITE_KEYS, 'the find sites')
  grows(palette.properties?.picture?.items?.properties?.position, POSITIONS, 'the positions')
  grows(palette.properties?.contrast?.properties?.waive?.items, RULES, 'the gate rules')
  assert.deepEqual(defs.slot?.enum, [
    'background',
    'foreground',
    'cursor',
    'selection',
    ...Array.from({ length: 16 }, (_, i) => `ansi${i}`),
  ])
})

test('the palette schema takes the subjects and full names the palette reader takes', () => {
  const props = read('ttheme-palette.json').properties ?? {}

  for (const subject of SUBJECTS) {
    assert.equal(takes(props.subject, subject), subjectProblem(subject) === undefined, `subject ${subject}`)
  }

  for (const name of NAMES) {
    assert.equal(takes(props.from, name), nameProblem(name) === undefined, `from ${name}`)
  }
})

test('the work schema describes the keys the commons reader knows, for the commons and a marketplace proposal alike', () => {
  const work = read('ttheme-work.json')
  assert.equal(work.$id, WORK_SCHEMA_URL)
  assert.deepEqual(keys(work), [...WORK_KEYS].sort())
  const character = work.properties?.character?.items
  assert.deepEqual(keys(character), [...CHARACTER_KEYS].sort())
  assert.equal(character?.properties?.sites?.propertyNames?.$ref, '#/definitions/site')
  grows(work.definitions?.site, SITE_KEYS, 'the find sites')

  for (const subject of SUBJECTS) {
    assert.equal(takes(work.properties?.lead, subject), subjectProblem(subject) === undefined, `lead ${subject}`)
  }
})
