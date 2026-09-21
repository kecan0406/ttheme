import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import type { Manifest, PaletteEntry } from './emit/manifest.ts'
import { forget, itermProfilesPath, resolve, startupPalette, sync, toTheme } from './palettes.ts'

function entry(name: string, order: number, partial: Partial<PaletteEntry> = {}): PaletteEntry {
  return {
    name,
    group: 'Jujutsu Kaisen',
    order,
    ansiSource: 'Horizon + Jujutsu',
    background: '#11191c',
    foreground: '#e3e2e7',
    cursor: '#7cc1d6',
    selection: '#383b5b',
    signature: ['#7cc1d6', '#e3e2e7', '#d7bcf3'],
    signatureSlots: ['cursor', 'foreground', 'ansi13'],
    ansi: Array.from({ length: 16 }, () => '#808080'),
    gate: [13.8, 6.8, 0.02, 10.4, 4.0],
    ...partial,
  }
}

const catalog: Manifest = {
  version: '0.1.0',
  gate: [],
  font: { family: 'JetBrainsMono Nerd Font', size: 14, codepointMap: [] },
  shader: 'cursor_tail.glsl',
  palettes: [entry('neutral', 1, { default: true }), entry('gojo', 2), entry('geto', 3)],
}

function fixture(): string {
  return mkdtempSync(join(tmpdir(), 'ttheme-palettes-'))
}

test('toTheme derives the ghostty icon colors from the palette', () => {
  const theme = toTheme(entry('gojo', 2), catalog)
  assert.equal(theme.ghostty.iconGhost, '#7cc1d6')
  assert.deepEqual(theme.ghostty.iconScreen, ['#7cc1d6', '#383b5b', '#11191c'])
  assert.equal(theme.ghostty.shader, 'cursor_tail.glsl')
  assert.equal(theme.selectionBackground, '#383b5b')
})

test('toTheme carries the default role through as a role, not a flag', () => {
  assert.equal(toTheme(entry('neutral', 1, { default: true }), catalog).role, 'default')
  assert.equal(toTheme(entry('gojo', 2), catalog).role, undefined)
})

test('resolve rejects a name the catalog does not carry', () => {
  assert.throws(() => resolve(catalog, ['gojo', 'nobody']), /not in the catalog: nobody/)
})

test('resolve rejects a palette that fails the contrast gate', () => {
  const failing: Manifest = { ...catalog, palettes: [entry('dim', 4, { gate: [2, 1, 0.9, 2, 0.5] })] }
  assert.throws(() => resolve(failing, ['dim']), /fail the contrast gate/)
})

test('resolve returns catalog order, not the order asked for', () => {
  assert.deepEqual(
    resolve(catalog, ['geto', 'gojo']).map((p) => p.name),
    ['gojo', 'geto'],
  )
})

test('sync writes a theme file per terminal and the zsh table', () => {
  const home = fixture()
  const written = sync(home, catalog, {
    terminals: ['ghostty', 'kitty'],
    palettes: ['neutral', 'gojo'],
  })
  assert.ok(existsSync(join(home, 'ghostty', 'themes', 'gojo')))
  assert.ok(existsSync(join(home, 'kitty', 'themes', 'gojo.conf')))
  assert.ok(existsSync(join(home, 'ttheme', 'palettes.zsh')))
  assert.ok(written.includes(join(home, 'ghostty', 'config')))
  assert.ok(written.includes(join(home, 'kitty', 'kitty.conf')))

  const table = readFileSync(join(home, 'ttheme', 'palettes.zsh'), 'utf8')
  assert.match(table, /TTHEME_ORDER=\(gojo\)/)
  assert.doesNotMatch(table, /geto/)
})

test('sync writes an empty but valid table when nothing is installed', () => {
  const home = fixture()
  sync(home, catalog, { terminals: ['ghostty'], palettes: [] })
  const table = readFileSync(join(home, 'ttheme', 'palettes.zsh'), 'utf8')
  assert.match(table, /TTHEME_ORDER=\(\)/)
  assert.doesNotMatch(readFileSync(join(home, 'ghostty', 'config'), 'utf8'), /^theme = /m)
})

test('sync points the terminal at the startup palette once one is installed', () => {
  const home = fixture()
  sync(home, catalog, { terminals: ['ghostty'], palettes: ['gojo'] })
  assert.match(readFileSync(join(home, 'ghostty', 'config'), 'utf8'), /^theme = gojo$/m)
})

test('sync leaves the terminal theme alone when the install keeps it', () => {
  const home = fixture()
  sync(home, catalog, { terminals: ['ghostty', 'kitty'], keepTheme: true, palettes: ['gojo'] })
  const config = readFileSync(join(home, 'ghostty', 'config'), 'utf8')
  assert.doesNotMatch(config, /^theme = /m)
  assert.match(config, /^config-file = \?.*\/backgrounds\/shown\.conf$/m)
  assert.doesNotMatch(readFileSync(join(home, 'kitty', 'kitty.conf'), 'utf8'), /^include /m)
  assert.ok(existsSync(join(home, 'ghostty', 'themes', 'gojo')))
})

test('sync writes an iTerm2 profile per listed palette, in P3 with one color set for both modes', () => {
  const configHome = fixture()
  const home = fixture()
  const profiles = itermProfilesPath(home)
  const read = () => JSON.parse(readFileSync(profiles, 'utf8')).Profiles
  sync(configHome, catalog, { terminals: ['iterm2'], palettes: ['neutral', 'gojo', 'geto'] }, home)
  const written = read()
  const gojo = written[0]
  assert.deepEqual(
    written.map((p: { Name: string; Guid: string }) => [p.Name, p.Guid]),
    [
      ['ttheme · gojo', 'ttheme-gojo'],
      ['ttheme · geto', 'ttheme-geto'],
    ],
  )
  assert.equal(gojo['Use Separate Colors for Light and Dark Mode'], false)
  assert.equal(gojo['Harmonize 256 Colors'], true)
  assert.deepEqual(gojo['Background Color'], {
    'Alpha Component': 1,
    'Blue Component': 0x1c / 255,
    'Color Space': 'P3',
    'Green Component': 0x19 / 255,
    'Red Component': 0x11 / 255,
  })
  sync(configHome, catalog, { terminals: ['iterm2'], palettes: ['gojo'] }, home)
  assert.deepEqual(
    read().map((p: { Name: string }) => p.Name),
    ['ttheme · gojo'],
  )
  assert.ok(!existsSync(join(configHome, 'iterm2')))
})

test('startupPalette keeps an explicit choice and falls to the first otherwise', () => {
  assert.equal(startupPalette({ terminals: [], startup: 'geto', palettes: ['gojo', 'geto'] }), 'geto')
  assert.equal(startupPalette({ terminals: [], startup: 'gone', palettes: ['gojo'] }), 'gojo')
  assert.equal(startupPalette({ terminals: [], palettes: [] }), undefined)
})

test('forget removes only the named palettes', () => {
  const home = fixture()
  sync(home, catalog, { terminals: ['ghostty'], palettes: ['neutral', 'gojo', 'geto'] })
  const removed = forget(home, catalog, ['ghostty'], ['geto'])
  assert.deepEqual(removed, [join(home, 'ghostty', 'themes', 'geto')])
  assert.ok(existsSync(join(home, 'ghostty', 'themes', 'gojo')))
  assert.ok(!existsSync(join(home, 'ghostty', 'themes', 'geto')))
})
