import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { writeCatalog } from './catalog.ts'
import { inMarket, runAdd, runDefault } from './installs.ts'
import { type Manifest, type PaletteEntry, SCHEMA } from './manifest.ts'
import { withMarkets } from './markets.ts'
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
  schema: SCHEMA,
  version: '0.1.0',
  gate: [],
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
  assert.match(readFileSync(join(home, 'ghostty', 'config'), 'utf8'), /^theme = ttheme-geto$/m)
})

test('default turns ttheme back on', () => {
  const home = installedHome(['gojo', 'geto'])
  writeInstalled(home, { terminals: ['ghostty'], off: true, palettes: ['gojo', 'geto'] })
  inHome(home, () => runDefault('geto'))
  assert.equal(readInstalled(home).off, undefined)
  assert.match(readFileSync(join(home, 'ghostty', 'config'), 'utf8'), /^theme = ttheme-geto$/m)
})

test('default refuses a palette that is not installed', () => {
  const home = installedHome(['gojo'])
  assert.throws(() => inHome(home, () => runDefault('geto')), /geto is not installed/)
  assert.equal(readInstalled(home).startup, undefined)
})

test('--market names bare palettes after the market it added, and refuses one from another market', () => {
  assert.deepEqual(inMarket(['dusk', 'alice@pastel/dawn', 'tt1:abc'], 'alice@pastel'), [
    'alice@pastel/dusk',
    'alice@pastel/dawn',
    'tt1:abc',
  ])
  assert.deepEqual(inMarket(['kita'], 'official'), ['kita'])
  assert.throws(() => inMarket(['bob@neon/glow'], 'alice@pastel'), /bob@neon\/glow is not in alice@pastel/)
})

test('installed.json keeps an auto-update setting only where it differs from the default', () => {
  const state = { terminals: ['ghostty' as const], palettes: [] }
  const next = withMarkets(state, ['official', 'alice/pastel', 'bob/neon'], {
    official: true,
    'alice/pastel': true,
    'bob/neon': false,
    'carol/gone': true,
  })
  assert.deepEqual(next.markets, ['official', 'alice/pastel', 'bob/neon'])
  assert.deepEqual(next.updates, { 'alice/pastel': true })
  assert.equal(withMarkets(state, ['official'], { official: true }).updates, undefined)
})
