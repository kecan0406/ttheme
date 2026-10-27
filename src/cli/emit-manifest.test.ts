import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aboutOf, parseCommons } from '../core/commons.ts'
import { parseBuiltin, swatch } from '../core/manifest.ts'
import { BUILTIN_DIR, COMMONS_DIR, loadBuiltin, loadCommons } from './build.ts'
import { bundleJson, bundleOf, commonsJson } from './emit-manifest.ts'

const commons = loadCommons(COMMONS_DIR)
const { themes, fallback } = loadBuiltin(BUILTIN_DIR, commons)
const bundle = bundleOf(themes, fallback)
const { palettes: entries } = bundle

test('the built-in palettes and the commons the build writes are ones every reader accepts', () => {
  assert.equal(parseBuiltin(bundleJson(bundle)).palettes.length, entries.length)
  assert.deepEqual(parseCommons(commonsJson(commons)), commons)
})

test('the built-in palettes mark exactly one fallback palette, and it is of no work', () => {
  assert.deepEqual(
    entries.filter((e) => e.default).map((e) => [e.name, e.subject]),
    [['ttheme/neutral', undefined]],
  )
})

test('every work that holds a built-in palette has its original-language title', () => {
  const held = new Set(entries.flatMap((e) => (e.subject ? [aboutOf(commons.works, e.subject)?.work.id] : [])))

  for (const work of commons.works.filter((w) => held.has(w.id))) {
    assert.ok(work.native, `${work.id}: no native title`)
  }
})

test('the commons carries the danbooru tag find searches, and a palette of a place or a thing, or of no work, has none', () => {
  const byName = new Map(entries.map((e) => [e.name, e]))
  const tag = (name: string) => aboutOf(commons.works, byName.get(name)?.subject)?.character?.danbooru
  assert.equal(tag('ttheme/kagami'), 'hiiragi_kagami')
  assert.equal(tag('ttheme/magi'), undefined)
  assert.equal(tag('ttheme/neutral'), undefined)
})

test('a swatch shows six different colors: the foreground, the signature, then red and green', () => {
  for (const e of entries) {
    const colors = swatch(e)
    assert.equal(new Set(colors).size, 6, `${e.name}: ${colors.join(' ')}`)
    assert.equal(colors[0], e.foreground)
  }

  const ansi = Array.from({ length: 16 }, (_, i) => `#0000${i.toString(16).padStart(2, '0')}`)

  const twin = swatch({
    foreground: '#eeeeee',
    cursor: '#ff00ff',
    selection: '#333333',
    ansi,
    signatureSlots: ['cursor', 'foreground', 'ansi9'],
  })

  assert.deepEqual(twin, ['#eeeeee', '#ff00ff', ansi[9], ansi[2], ansi[4], ansi[3]])
})
