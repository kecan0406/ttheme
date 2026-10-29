import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { sync } from '../cli/sync.ts'
import { GATE_RULES } from '../core/contrast.ts'
import type { Manifest, PaletteEntry } from '../core/manifest.ts'
import { available, readKept, untuned } from './available.ts'
import { overrideOf, readTone, slotColors, tonedEntry, tonePath, tuned, withTone, writeTone } from './tone.ts'

function entry(name: string, partial: Partial<PaletteEntry> = {}): PaletteEntry {
  return {
    name,
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

const manifest: Manifest = {
  version: '0.1.0',
  gate: [],
  works: [],
  palettes: [entry('ttheme/gojo'), entry('ttheme/geto')],
}

function home(): string {
  return mkdtempSync(join(tmpdir(), 'ttheme-tone-'))
}

test('a tone overrides only the slots it names, and the signature and the picture tint follow them', () => {
  const gojo = entry('ttheme/gojo')
  const toned = tonedEntry(gojo, { cursor: '#ff8800', ansi13: '#00ff88' })
  assert.equal(toned.cursor, '#ff8800')
  assert.equal(toned.ansi[13], '#00ff88')
  assert.equal(toned.background, gojo.background)
  assert.equal(toned.ansi[0], gojo.ansi[0])
  assert.deepEqual(toned.signature, ['#ff8800', '#e3e2e7', '#00ff88'])
  assert.equal(toned.backdrop.color, '#ff8800')
  assert.equal(toned.gate.length, GATE_RULES.length)
  assert.equal(toned.name, 'ttheme/gojo')
})

test('a tone that changes nothing hands back the very same entry', () => {
  const gojo = entry('ttheme/gojo')
  assert.equal(tonedEntry(gojo, undefined), gojo)
  assert.equal(tonedEntry(gojo, { cursor: gojo.cursor }), gojo)
  assert.equal(tuned([gojo], {})[0], gojo)
})

test('overrideOf keeps just what differs from the palette, and a tone read back is the tone written', () => {
  const gojo = entry('ttheme/gojo')
  const colors = slotColors(gojo)
  colors[2] = '#FF8800'
  colors[10] = '#00FF88'
  const over = overrideOf(gojo, colors)
  assert.deepEqual(over, { cursor: '#ff8800', ansi6: '#00ff88' })
  const dir = home()
  writeTone(dir, withTone({}, 'ttheme/gojo', 'dark', over))
  assert.deepEqual(readTone(dir), { 'ttheme/gojo': { dark: over } })
  writeTone(dir, withTone(readTone(dir), 'ttheme/gojo', 'light', { cursor: '#884400' }))
  assert.deepEqual(readTone(dir), { 'ttheme/gojo': { dark: over, light: { cursor: '#884400' } } })
  writeTone(dir, withTone(readTone(dir), 'ttheme/gojo', 'light', {}))
  writeTone(dir, withTone(readTone(dir), 'ttheme/gojo', 'dark', {}))
  assert.ok(!existsSync(tonePath(dir)))
  assert.deepEqual(readTone(dir), {})
})

test('a tone file with nonsense in it is read as far as it makes sense', () => {
  const dir = home()
  mkdirSync(join(dir, 'ttheme'), { recursive: true })
  writeFileSync(
    tonePath(dir),
    JSON.stringify({
      version: 2,
      palettes: { gojo: { dark: { cursor: '#FF8800', ansi99: '#ffffff', background: 'red' }, sepia: {} }, geto: 5 },
    }),
  )
  assert.deepEqual(readTone(dir), { gojo: { dark: { cursor: '#ff8800' } } })
  writeFileSync(tonePath(dir), JSON.stringify({ version: 1, palettes: { gojo: { cursor: '#ff8800' } } }))
  assert.deepEqual(readTone(dir), {})
  writeFileSync(tonePath(dir), '{ not json')
  assert.deepEqual(readTone(dir), {})
})

test('available lays the tone over the palettes while the untuned view keeps them as the marketplaces give them', () => {
  const dir = home()
  writeTone(dir, { 'ttheme/gojo': { dark: { cursor: '#ff8800' } } })
  assert.equal(available(dir, manifest).palettes.find((p) => p.name === 'ttheme/gojo')?.cursor, '#ff8800')
  assert.equal(available(dir, manifest).palettes.find((p) => p.name === 'ttheme/geto')?.cursor, '#7cc1d6')
  assert.equal(untuned(dir, manifest).palettes.find((p) => p.name === 'ttheme/gojo')?.cursor, '#7cc1d6')
})

test("a tone tunes a palette in one mode, and the palette worn in the other mode takes that mode's tone", () => {
  const dir = home()
  mkdirSync(join(dir, 'ttheme'), { recursive: true })
  writeFileSync(join(dir, 'ttheme', 'config.zsh'), ': ${TTHEME_MODE:=light}\n')
  writeTone(dir, { 'ttheme/gojo': { dark: { cursor: '#ff8800' } } })
  const light = available(dir, manifest).palettes.find((p) => p.name === 'ttheme/gojo')
  assert.notEqual(light?.cursor, '#ff8800')
  assert.equal(light?.other?.cursor, '#ff8800')
  writeTone(dir, { 'ttheme/gojo': { dark: { cursor: '#ff8800' }, light: { cursor: '#884400' } } })
  assert.equal(available(dir, manifest).palettes.find((p) => p.name === 'ttheme/gojo')?.cursor, '#884400')
})

test('sync writes the tone into every theme file and the zsh table, and kept.json keeps the palette as it was', () => {
  const dir = home()
  writeTone(dir, { 'ttheme/gojo': { dark: { cursor: '#ff8800' } } })
  sync(dir, manifest, { terminals: ['ghostty'], palettes: ['ttheme/gojo'] })
  assert.match(readFileSync(join(dir, 'ghostty', 'themes', 'ttheme-ttheme--gojo.dark'), 'utf8'), /#ff8800/)
  assert.match(readFileSync(join(dir, 'ttheme', 'palettes.zsh'), 'utf8'), /#ff8800/)
  assert.equal(readKept(dir).find((p) => p.name === 'ttheme/gojo')?.cursor, '#7cc1d6')
  writeTone(dir, {})
  sync(dir, manifest, { terminals: ['ghostty'], palettes: ['ttheme/gojo'] })
  assert.doesNotMatch(readFileSync(join(dir, 'ghostty', 'themes', 'ttheme-ttheme--gojo.dark'), 'utf8'), /#ff8800/)
})
