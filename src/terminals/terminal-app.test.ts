import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { pointDefaults, sync, withBases } from '../cli/sync.ts'
import type { Manifest, PaletteEntry } from '../core/manifest.ts'
import type { Host } from '../store/host.ts'
import type { Installed } from '../store/installed.ts'
import { TERMINAL_JS, terminalScript } from './terminal-app.ts'

function entry(name: string, partial: Partial<PaletteEntry> = {}): PaletteEntry {
  return {
    name,
    ansiSource: 'Horizon',
    background: '#11191c',
    foreground: '#e3e2e7',
    cursor: '#7cc1d6',
    selection: '#383b5b',
    signature: ['#7cc1d6', '#e3e2e7', '#d7bcf3'],
    signatureSlots: ['cursor', 'foreground', 'ansi13'],
    ansi: Array.from({ length: 16 }, (_, i) => `#${(i * 16).toString(16).padStart(2, '0')}8080`),
    gate: [13.8, 6.8, 0.02, 10.4, 4.0],
    backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
    ...partial,
  }
}

const manifest: Manifest = {
  version: '0.1.0',
  gate: [],
  works: [],
  palettes: [entry('neutral', { default: true }), entry('orla', { background: '#101010' }), entry('juno')],
}

interface Terminal {
  host: Host
  scripts: string[][]
  defaults: Map<string, string>
}

function terminal(own: string, running = false, loaded = '1'): Terminal {
  const defaults = new Map([['Default Window Settings', own]])
  const scripts: string[][] = []

  return {
    host: {
      platform: 'darwin',
      env: {},
      run: (command, args) => {
        if (command === 'defaults' && args[0] === 'read') {
          return defaults.get(args[2] ?? '')
        }

        if (command === 'defaults' && args[0] === 'write') {
          defaults.set(args[2] ?? '', args[4] ?? '')

          return ''
        }

        if (command === 'pgrep') {
          return running ? '4242' : undefined
        }

        if (command === 'osascript') {
          scripts.push(args.slice(3))

          return args[3] === 'loaded' ? loaded : 'wrote'
        }

        return undefined
      },
    },
    scripts,
    defaults,
  }
}

test('sync writes a profile per listed palette over the user’s own, and the script that does it', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-terminal-app-'))
  const { host, scripts } = terminal('Clear Dark')
  const state = withBases(configHome, { terminals: ['terminal-app'], palettes: ['orla', 'juno'] }, host)
  assert.equal(state.terminalBase, 'Clear Dark')
  sync(configHome, manifest, state, configHome, host)
  assert.equal(readFileSync(terminalScript(configHome), 'utf8'), TERMINAL_JS)
  const [verb, base, ...rest] = scripts[0] ?? []
  assert.deepEqual([verb, base], ['write', 'Clear Dark'])
  assert.deepEqual(
    rest.filter((arg) => arg.startsWith('ttheme')),
    ['ttheme · orla', 'ttheme · juno'],
  )
  assert.equal(rest.length, 44)
  assert.equal(rest[1], '#101010')
  assert.equal(rest[21], '-')
})

test('Terminal.app opens new windows on the default palette’s profile, gives the user’s own back while off and drops every profile once nothing is installed', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-terminal-app-'))
  const { host, scripts, defaults } = terminal('Clear Dark')
  const state: Installed = withBases(configHome, { terminals: ['terminal-app'], palettes: ['orla'] }, host)
  assert.deepEqual(pointDefaults(configHome, state, true, host).get('terminal-app'), { restart: false })
  assert.equal(defaults.get('Default Window Settings'), 'ttheme · orla')
  assert.equal(defaults.get('Startup Window Settings'), 'ttheme · orla')
  assert.ok(pointDefaults(configHome, { ...state, off: true }, false, host).has('terminal-app'))
  assert.equal(defaults.get('Default Window Settings'), 'Clear Dark')
  assert.ok(!pointDefaults(configHome, { ...state, off: true }, false, host).has('terminal-app'))
  pointDefaults(configHome, { ...state, off: true, palettes: [] }, false, host)
  assert.deepEqual(scripts.at(-1), ['drop'])
})

test('Terminal.app keeps a default the user picked, and asks for a restart only while it runs without the profile loaded', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-terminal-app-'))
  const picked = terminal('Pro')
  assert.equal(
    pointDefaults(
      configHome,
      { terminals: ['terminal-app'], palettes: ['orla'], terminalBase: 'Basic' },
      false,
      picked.host,
    ).size,
    0,
  )
  assert.equal(picked.defaults.get('Default Window Settings'), 'Pro')
  const fresh = terminal('Basic', true, '0')
  assert.deepEqual(
    pointDefaults(configHome, { terminals: ['terminal-app'], palettes: ['orla'] }, true, fresh.host).get(
      'terminal-app',
    ),
    { restart: true },
  )
  const loaded = terminal('Basic', true, '1')
  assert.deepEqual(
    pointDefaults(configHome, { terminals: ['terminal-app'], palettes: ['orla'] }, true, loaded.host).get(
      'terminal-app',
    ),
    { restart: false },
  )
})

test('the Terminal.app script preview keeps open ends when its input does', {
  skip: process.platform !== 'darwin',
}, () => {
  const file = join(mkdtempSync(join(tmpdir(), 'ttheme-terminal-serve-')), 'terminal-app.js')
  writeFileSync(file, TERMINAL_JS)
  const run = spawnSync('osascript', ['-l', 'JavaScript', file, 'serve'], { input: '', timeout: 10000 })
  assert.equal(run.error, undefined)
  assert.equal(run.status, 0)
})
