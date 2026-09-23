import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { writeCatalog } from './catalog.ts'
import type { Manifest, PaletteEntry } from './emit/manifest.ts'
import { runAdd, runDefault } from './market.ts'
import { readInstalled, sync, writeInstalled } from './palettes.ts'

function entry(name: string, order: number): PaletteEntry {
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
    backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
  }
}

const catalog: Manifest = {
  version: '0.1.0',
  gate: [],
  placement: { tall: 1.15, reach: 0.4, widest: 0.95, headroom: 0.04, margin: 0.03, stands: 12 },
  font: { family: 'JetBrainsMono Nerd Font', size: 14, codepointMap: [] },
  shader: 'cursor_tail.glsl',
  palettes: [entry('gojo', 1), entry('geto', 2), entry('sukuna', 3)],
}

function installedHome(palettes: string[]): string {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-market-'))
  const state = { terminals: ['ghostty' as const], palettes }
  writeCatalog(home, catalog)
  writeInstalled(home, state)
  sync(home, catalog, state)
  return home
}

function inHome<T>(home: string, run: () => T): T {
  const saved = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = home
  const log = console.log
  console.log = () => {}
  try {
    return run()
  } finally {
    console.log = log
    if (saved === undefined) {
      delete process.env.XDG_CONFIG_HOME
    } else {
      process.env.XDG_CONFIG_HOME = saved
    }
  }
}

test('a kept default survives a later add', () => {
  const home = installedHome(['gojo', 'geto'])
  inHome(home, () => {
    runDefault('geto')
    runAdd(['sukuna'])
  })
  assert.equal(readInstalled(home).startup, 'geto')
  assert.match(readFileSync(join(home, 'ghostty', 'config'), 'utf8'), /^theme = geto$/m)
})

test('default takes the terminal out of keep', () => {
  const home = installedHome(['gojo', 'geto'])
  writeInstalled(home, { terminals: ['ghostty'], keepTheme: true, palettes: ['gojo', 'geto'] })
  inHome(home, () => runDefault('geto'))
  assert.equal(readInstalled(home).keepTheme, undefined)
  assert.match(readFileSync(join(home, 'ghostty', 'config'), 'utf8'), /^theme = geto$/m)
})

test('default refuses a palette that is not installed', () => {
  const home = installedHome(['gojo'])
  assert.throws(() => inHome(home, () => runDefault('geto')), /geto is not installed/)
  assert.equal(readInstalled(home).startup, undefined)
})
