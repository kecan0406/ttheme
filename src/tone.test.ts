import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { available, readKept, untuned } from './catalog.ts'
import { type Manifest, type PaletteEntry, SCHEMA } from './manifest.ts'
import { sync } from './palettes.ts'
import { overrideOf, readTone, slotColors, tonedEntry, tonePath, tuned, withTone, writeTone } from './tone.ts'

function entry(name: string, partial: Partial<PaletteEntry> = {}): PaletteEntry {
  return {
    name,
    group: 'Jujutsu Kaisen',
    order: 1,
    ansiSource: 'Horizon + Jujutsu',
    background: '#11191c',
    foreground: '#e3e2e7',
    cursor: '#7cc1d6',
    selection: '#383b5b',
    signature: ['#7cc1d6', '#e3e2e7', '#d7bcf3'],
    signatureSlots: ['cursor', 'foreground', 'ansi13'],
    ansi: Array.from({ length: 16 }, (_, i) => `#${(0x20 + i * 8).toString(16).padStart(2, '0').repeat(3)}`),
    gate: [13.8, 6.8, 0.02, 10.4, 4.0],
    backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
    ...partial,
  }
}

const catalog: Manifest = {
  schema: SCHEMA,
  version: '0.1.0',
  gate: [],
  palettes: [entry('gojo'), entry('geto')],
}

function home(): string {
  return mkdtempSync(join(tmpdir(), 'ttheme-tone-'))
}

test('a tone overrides only the slots it names, and the signature and the picture tint follow them', () => {
  const gojo = entry('gojo')
  const toned = tonedEntry(gojo, { cursor: '#ff8800', ansi13: '#00ff88' })
  assert.equal(toned.cursor, '#ff8800')
  assert.equal(toned.ansi[13], '#00ff88')
  assert.equal(toned.background, gojo.background)
  assert.equal(toned.ansi[0], gojo.ansi[0])
  assert.deepEqual(toned.signature, ['#ff8800', '#e3e2e7', '#00ff88'])
  assert.equal(toned.backdrop.color, '#ff8800')
  assert.equal(toned.gate.length, 9)
  assert.equal(toned.name, 'gojo')
})

test('a tone that changes nothing hands back the very same entry', () => {
  const gojo = entry('gojo')
  assert.equal(tonedEntry(gojo, undefined), gojo)
  assert.equal(tonedEntry(gojo, { cursor: gojo.cursor }), gojo)
  assert.equal(tuned([gojo], {})[0], gojo)
})

test('overrideOf keeps just what differs from the palette, and a tone read back is the tone written', () => {
  const gojo = entry('gojo')
  const colors = slotColors(gojo)
  colors[2] = '#FF8800'
  colors[10] = '#00FF88'
  const over = overrideOf(gojo, colors)
  assert.deepEqual(over, { cursor: '#ff8800', ansi6: '#00ff88' })
  const dir = home()
  writeTone(dir, withTone({}, 'gojo', over))
  assert.deepEqual(readTone(dir), { gojo: over })
  writeTone(dir, withTone(readTone(dir), 'gojo', {}))
  assert.ok(!existsSync(tonePath(dir)))
  assert.deepEqual(readTone(dir), {})
})

test('a tone file with nonsense in it is read as far as it makes sense', () => {
  const dir = home()
  mkdirSync(join(dir, 'ttheme'), { recursive: true })
  writeFileSync(
    tonePath(dir),
    JSON.stringify({ palettes: { gojo: { cursor: '#FF8800', ansi99: '#ffffff', background: 'red' }, geto: 5 } }),
  )
  assert.deepEqual(readTone(dir), { gojo: { cursor: '#ff8800' } })
  writeFileSync(tonePath(dir), '{ not json')
  assert.deepEqual(readTone(dir), {})
})

test('available lays the tone over the palettes while the untuned view keeps them as the markets give them', () => {
  const dir = home()
  writeTone(dir, { gojo: { cursor: '#ff8800' } })
  assert.equal(available(dir, catalog).palettes.find((p) => p.name === 'gojo')?.cursor, '#ff8800')
  assert.equal(available(dir, catalog).palettes.find((p) => p.name === 'geto')?.cursor, '#7cc1d6')
  assert.equal(untuned(dir, catalog).palettes.find((p) => p.name === 'gojo')?.cursor, '#7cc1d6')
})

test('sync writes the tone into every theme file and the zsh table, and kept.json keeps the palette as it was', () => {
  const dir = home()
  writeTone(dir, { gojo: { cursor: '#ff8800' } })
  sync(dir, catalog, { terminals: ['ghostty'], palettes: ['gojo'] })
  assert.match(readFileSync(join(dir, 'ghostty', 'themes', 'ttheme-gojo'), 'utf8'), /#ff8800/)
  assert.match(readFileSync(join(dir, 'ttheme', 'palettes.zsh'), 'utf8'), /#ff8800/)
  assert.equal(readKept(dir).find((p) => p.name === 'gojo')?.cursor, '#7cc1d6')
  writeTone(dir, {})
  sync(dir, catalog, { terminals: ['ghostty'], palettes: ['gojo'] })
  assert.doesNotMatch(readFileSync(join(dir, 'ghostty', 'themes', 'ttheme-gojo'), 'utf8'), /#ff8800/)
})
