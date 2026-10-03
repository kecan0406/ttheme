import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { test } from 'node:test'
import {
  againCatalog,
  applyInit,
  type InitOptions,
  type InitPaths,
  installedState,
  planAgain,
  planInit,
  planUpgrade,
} from './init.ts'
import { SCHEMA } from './manifest.ts'
import type { Installed } from './palettes.ts'

function manifestFixture() {
  const palette = (name: string, order: number, role?: 'default') => ({
    name,
    group: 'Fixture',
    order,
    ansiSource: 'Fixture',
    ...(role ? { default: true } : {}),
    background: '#101010',
    foreground: '#f0f0f0',
    cursor: '#ff8800',
    selection: '#303030',
    signature: ['#ff8800', '#f0f0f0', '#101010'],
    signatureSlots: ['cursor', 'foreground', 'background'],
    backdrop: { slot: 'cursor', color: '#ff8800', opacity: 0.2 },
    ansi: Array.from({ length: 16 }, (_, i) => `#${i.toString(16).repeat(6)}`),
    gate: [21, 21, 0, 21, 21],
  })
  return {
    schema: SCHEMA,
    version: '0.0.0',
    gate: [],
    palettes: [palette('neutral', 1, 'default'), palette('miku', 2)],
  }
}

function withMarkets(paths: InitPaths): string {
  const dust = join(paths.home, 'dust')
  mkdirSync(join(dust, 'palettes'), { recursive: true })
  writeFileSync(
    join(dust, 'ttheme-market.json'),
    JSON.stringify({ schema: SCHEMA, version: '0.0.0', owner: 'kec', name: 'moss', palettes: [] }),
  )
  writeFileSync(
    join(dust, 'palettes', 'fern.toml'),
    [
      '[meta]',
      'name = "fern"',
      'signature = ["cursor", "foreground", "background"]',
      '',
      '[colors]',
      'background = "#101010"',
      'foreground = "#f0f0f0"',
      'cursor = "#ff8800"',
      'selection_background = "#303030"',
      `ansi = [${Array.from({ length: 16 }, (_, i) => `"#${i.toString(16).repeat(6)}"`).join(', ')}]`,
      '',
    ].join('\n'),
  )
  const cache = join(paths.configHome, 'ttheme', 'markets')
  mkdirSync(cache, { recursive: true })
  const [, miku] = manifestFixture().palettes
  writeFileSync(
    join(cache, 'alice--pastel.json'),
    JSON.stringify({ ...manifestFixture(), owner: 'alice', name: 'pastel', palettes: [{ ...miku, name: 'dusk' }] }),
  )
  return dust
}

function makeFixture(): InitPaths {
  const base = mkdtempSync(join(tmpdir(), 'ttheme-init-'))
  const root = join(base, 'repo')
  const files: Record<string, string> = {
    'bin/ttheme.js': 'cli',
    'bin/ttheme.js.map': 'map',
    'shell/ttheme.zsh': 'ttheme layer',
    'shell/preview.zsh': 'preview',
    'shell/launch-tab.zsh': '#!/bin/zsh -f',
    'shell/adapters/_osc.zsh': 'osc',
    'shell/adapters/kitty.zsh': 'kitty adapter',
    'dist/ghostty/themes/neutral': 'neutral theme',
    'dist/ghostty/themes/miku': 'miku theme',
    'dist/kitty/themes/neutral.conf': 'neutral kitty',
    'dist/kitty/themes/miku.conf': 'miku kitty',
    'dist/alacritty/themes/neutral.toml': 'neutral alacritty',
    'dist/alacritty/themes/miku.toml': 'miku alacritty',
    'dist/manifest.json': JSON.stringify(manifestFixture()),
  }
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  const home = join(base, 'home')
  mkdirSync(home, { recursive: true })
  return { root, home, configHome: join(home, '.config'), zdotdir: home }
}

function options(partial: Partial<InitOptions> = {}): InitOptions {
  return { terminals: ['ghostty'], palettes: [], ...partial }
}

test('planInit places the runtime layer and touches only .zshrc', () => {
  const paths = makeFixture()
  const plan = planInit(options({ terminals: ['ghostty', 'kitty'] }), paths)
  const tthemeDir = join(paths.configHome, 'ttheme')
  const targets = plan.copies.map((c) => c.to)
  for (const expected of [
    join(tthemeDir, 'ttheme.js'),
    join(tthemeDir, 'ttheme.zsh'),
    join(tthemeDir, 'preview.zsh'),
    join(tthemeDir, 'launch-tab.zsh'),
    join(tthemeDir, 'adapters', '_osc.zsh'),
  ]) {
    assert.ok(targets.includes(expected), `missing copy target ${expected}`)
  }
  assert.deepEqual(
    plan.edits.map((e) => e.file),
    [join(paths.home, '.zshrc')],
  )
})

test('planInit installs no palettes and copies no theme files', () => {
  const paths = makeFixture()
  const plan = planInit(options({ terminals: ['ghostty', 'kitty'] }), paths)
  assert.deepEqual(plan.installed.palettes, [])
  assert.ok(!plan.copies.some((c) => c.to.includes(`${sep}themes${sep}`)))
})

test('applyInit leaves a fresh install with an empty table and no terminal theme', () => {
  const paths = makeFixture()
  applyInit(planInit(options({ terminals: ['ghostty'] }), paths))
  const table = readFileSync(join(paths.configHome, 'ttheme', 'palettes.zsh'), 'utf8')
  assert.match(table, /TTHEME_ORDER=\(\)/)
  const ghostty = readFileSync(join(paths.configHome, 'ghostty', 'config'), 'utf8')
  assert.match(ghostty, /# ttheme begin/)
  assert.doesNotMatch(ghostty, /^theme = /m)
  assert.deepEqual(JSON.parse(readFileSync(join(paths.configHome, 'ttheme', 'installed.json'), 'utf8')).palettes, [])
})

test('applyInit creates the layout, marks the launcher executable and wires configs', () => {
  const paths = makeFixture()
  const plan = planInit(options(), paths)
  applyInit(plan)
  const launcher = join(paths.configHome, 'ttheme', 'launch-tab.zsh')
  assert.ok(statSync(launcher).mode & 0o100, 'launcher is not executable')
  const ghostty = readFileSync(join(paths.configHome, 'ghostty', 'config'), 'utf8')
  assert.match(ghostty, /# ttheme begin/)
  assert.match(ghostty, /command = .*launch-tab\.zsh/)
  const zshrc = readFileSync(join(paths.home, '.zshrc'), 'utf8')
  assert.match(zshrc, /source .*ttheme\.zsh/)
  assert.ok(!zshrc.includes('export TTHEME_'))
  const config = readFileSync(join(paths.configHome, 'ttheme', 'config.zsh'), 'utf8')
  assert.match(config, /^# : \$\{TTHEME_TAB_PALETTE:=off\}$/m)
})

test('applyInit seeds config.zsh once and keeps user edits on rerun', () => {
  const paths = makeFixture()
  applyInit(planInit(options(), paths))
  const configPath = join(paths.configHome, 'ttheme', 'config.zsh')
  const first = readFileSync(configPath, 'utf8')
  assert.match(first, /^# : \$\{TTHEME_TAB_PALETTE:=off\}$/m)
  assert.match(first, /^# : \$\{TTHEME_ANNOUNCE:=1\}$/m)
  writeFileSync(
    configPath,
    first
      .replace(/^# : \$\{TTHEME_TAB_PALETTE[^\n]*$/m, ': ${TTHEME_TAB_PALETTE:=seq}')
      .replace(/^# : \$\{TTHEME_FX[^\n]*$/m, ': ${TTHEME_FX:=glitch}'),
  )
  applyInit(planInit(options(), paths))
  const second = readFileSync(configPath, 'utf8')
  assert.match(second, /^: \$\{TTHEME_TAB_PALETTE:=seq\}$/m)
  assert.match(second, /^: \$\{TTHEME_FX:=glitch\}$/m)
})

test('init wears the first palette and leaves the new-tab setting at its default', () => {
  const paths = makeFixture()
  const tab = /^(?:# )?: \$\{TTHEME_TAB_PALETTE:=(\w+)\}$/m
  applyInit(planInit(options({ palettes: ['neutral', 'miku'] }), paths))
  assert.match(readFileSync(join(paths.configHome, 'ghostty', 'config'), 'utf8'), /^theme = ttheme-neutral$/m)
  assert.equal(readFileSync(join(paths.configHome, 'ttheme', 'config.zsh'), 'utf8').match(tab)?.[1], 'off')
})

test('init writes the Warp tab-switch answer only when it differs from the default, and an upgrade keeps it', () => {
  const paths = makeFixture()
  const fast = () =>
    readFileSync(join(paths.configHome, 'ttheme', 'config.zsh'), 'utf8')
      .match(/^(# )?: \$\{TTHEME_WARP_FAST:=(\w+)\}$/m)
      ?.slice(1)
      .join('')
  applyInit(planInit(options({ warpFast: false }), paths))
  assert.equal(fast(), 'off')
  applyInit(planUpgrade(installedState(paths.configHome) as Installed, paths))
  assert.equal(fast(), 'off')
  applyInit(planInit(options({ warpFast: true }), paths))
  assert.equal(fast(), '# on')
})

test('applyInit is idempotent', () => {
  const paths = makeFixture()
  const plan = planInit(options(), paths)
  applyInit(plan)
  const before = plan.edits.map((e) => readFileSync(e.file, 'utf8'))
  applyInit(planInit(options(), paths))
  for (const [i, e] of plan.edits.entries()) {
    const after = readFileSync(e.file, 'utf8')
    assert.equal(after, before[i])
    assert.equal(after.split('# ttheme begin').length, 2, `duplicated block in ${e.file}`)
  }
})

test('applyInit preserves existing zshrc content', () => {
  const paths = makeFixture()
  writeFileSync(join(paths.home, '.zshrc'), 'alias ll="ls -l"\n')
  applyInit(planInit(options(), paths))
  const zshrc = readFileSync(join(paths.home, '.zshrc'), 'utf8')
  assert.ok(zshrc.startsWith('alias ll="ls -l"\n'))
  assert.match(zshrc, /# ttheme begin/)
})

test('init writes its own alacritty block but never edits an alacritty.toml that imports already', () => {
  const paths = makeFixture()
  const config = join(paths.configHome, 'alacritty', 'alacritty.toml')
  applyInit(planInit(options({ terminals: ['alacritty'] }), paths))
  assert.match(readFileSync(config, 'utf8'), /# ttheme begin/)

  mkdirSync(join(paths.configHome, 'alacritty'), { recursive: true })
  writeFileSync(config, '[general]\nimport = ["mine.toml"]\n')
  const foreign = planInit(options({ terminals: ['alacritty'] }), paths)
  assert.ok(foreign.notes.some((n) => n.includes('already imports files under [general]')))
  applyInit(foreign)
  assert.equal(readFileSync(config, 'utf8'), '[general]\nimport = ["mine.toml"]\n')
})

test('an upgrade keeps what is installed and only replaces the layer', () => {
  const paths = makeFixture()
  applyInit(planInit(options({ palettes: ['neutral', 'miku'] }), paths))
  const installedPath = join(paths.configHome, 'ttheme', 'installed.json')
  const state = { ...JSON.parse(readFileSync(installedPath, 'utf8')), startup: 'miku', off: true }
  writeFileSync(installedPath, JSON.stringify(state))
  const configPath = join(paths.configHome, 'ttheme', 'config.zsh')
  writeFileSync(
    configPath,
    readFileSync(configPath, 'utf8').replace(/^# : \$\{TTHEME_FX[^\n]*$/m, ': ${TTHEME_FX:=glitch}'),
  )
  writeFileSync(join(paths.root, 'shell', 'ttheme.zsh'), 'ttheme layer, next version')
  const current = installedState(paths.configHome)
  assert.ok(current)
  applyInit(planUpgrade(current, paths))
  assert.deepEqual(installedState(paths.configHome), {
    terminals: ['ghostty'],
    startup: 'miku',
    off: true,
    palettes: ['neutral', 'miku'],
  })
  assert.match(readFileSync(configPath, 'utf8'), /^: \$\{TTHEME_FX:=glitch\}$/m)
  assert.equal(readFileSync(join(paths.configHome, 'ttheme', 'ttheme.zsh'), 'utf8'), 'ttheme layer, next version')
})

test('an upgrade lets the new layer ask again whether Ghostty names the terminal in front', () => {
  const paths = makeFixture()
  applyInit(planInit(options({ palettes: ['miku'] }), paths))
  const stateDir = join(paths.home, '.local', 'state', 'ttheme')
  const blind = join(stateDir, 'ghostty', '.blind')
  mkdirSync(join(stateDir, 'ghostty'), { recursive: true })
  writeFileSync(blind, '1.3.2\n')
  writeFileSync(join(stateDir, 'ghostty', 'ttys001'), '1 miku miku /dev/ttys001\n')
  const current = installedState(paths.configHome)
  assert.ok(current)
  applyInit(planUpgrade(current, { ...paths, stateDir }))
  assert.equal(existsSync(blind), false)
  assert.equal(existsSync(join(stateDir, 'ghostty', 'ttys001')), true)
})

test('an upgrade drops palettes the catalog no longer has, and a default among them', () => {
  const paths = makeFixture()
  const plan = planUpgrade({ terminals: ['ghostty'], startup: 'gone', palettes: ['miku', 'gone'] }, paths)
  assert.deepEqual(plan.installed, { terminals: ['ghostty'], palettes: ['miku'] })
  assert.match(plan.notes[0] ?? '', /^Dropped gone/)
})

test('there is no install to upgrade before the first init', () => {
  assert.equal(installedState(makeFixture().configHome), undefined)
})

test('setting it up again keeps the markets, their auto-update, the handle and what was installed from them', () => {
  const paths = makeFixture()
  applyInit(planInit(options({ palettes: ['miku'] }), paths))
  const dust = withMarkets(paths)
  const installedPath = join(paths.configHome, 'ttheme', 'installed.json')
  const markets = ['official', 'alice/pastel#v1', dust]
  const palettes = ['miku', 'alice@pastel/dusk', 'kec@moss/fern']
  writeFileSync(
    installedPath,
    JSON.stringify({
      terminals: ['ghostty'],
      author: 'kec',
      startup: 'alice@pastel/dusk',
      markets,
      updates: { 'alice/pastel#v1': true },
      palettes,
    }),
  )
  const state = installedState(paths.configHome)
  assert.ok(state)
  assert.deepEqual(
    againCatalog(state, paths)
      .palettes.filter((e) => !e.default)
      .map((e) => e.name),
    palettes,
  )
  applyInit(planAgain(state, options({ terminals: ['ghostty', 'kitty'], palettes }), paths))
  assert.deepEqual(installedState(paths.configHome), {
    terminals: ['ghostty', 'kitty'],
    author: 'kec',
    startup: 'alice@pastel/dusk',
    markets,
    updates: { 'alice/pastel#v1': true },
    palettes,
  })
  assert.match(
    readFileSync(join(paths.configHome, 'ghostty', 'config'), 'utf8'),
    /^theme = ttheme-alice--pastel--dusk$/m,
  )
})

test('an upgrade keeps what came from markets when the caches it finds were written before schemas existed', () => {
  const paths = makeFixture()
  applyInit(planInit(options({ palettes: ['miku'] }), paths))
  const dust = withMarkets(paths)
  const home = join(paths.configHome, 'ttheme')
  for (const file of [join(home, 'catalog.json'), join(home, 'markets', 'alice--pastel.json')]) {
    const { schema: _, ...before } = JSON.parse(readFileSync(file, 'utf8'))
    writeFileSync(file, JSON.stringify(before))
  }
  const palettes = ['miku', 'alice@pastel/dusk', 'kec@moss/fern']
  writeFileSync(
    join(home, 'installed.json'),
    JSON.stringify({ terminals: ['ghostty'], markets: ['official', 'alice/pastel', dust], palettes }),
  )
  const state = installedState(paths.configHome)
  assert.ok(state)
  assert.deepEqual(planUpgrade(state, paths).installed.palettes, palettes)
})

test('setting it up again offers no official palette once the official catalog was removed', () => {
  const paths = makeFixture()
  withMarkets(paths)
  const state = { terminals: ['ghostty' as const], markets: ['alice/pastel'], palettes: [] }
  writeFileSync(join(paths.configHome, 'ttheme', 'installed.json'), JSON.stringify(state))
  const catalog = againCatalog(state, paths)
  assert.deepEqual(
    catalog.palettes.map((e) => e.name),
    ['alice@pastel/dusk'],
  )
})

test('setting it up again carries every setting it does not ask about again', () => {
  const paths = makeFixture()
  const state: Required<Installed> = {
    terminals: ['ghostty', 'windows-terminal'],
    author: 'kec',
    startup: 'miku',
    off: true,
    itermBase: 'A1B2C3',
    konsoleBase: 'Mine.profile',
    terminalBase: 'Clear Dark',
    wtHome: '/mnt/c/Users/kec/AppData/Local',
    wtProfile: '{61c54bbd-c2c6-5271-96e7-009a87ff44bf}',
    markets: ['official', 'alice/pastel#v1'],
    updates: { 'alice/pastel#v1': true },
    palettes: ['miku'],
  }
  const { installed } = planAgain(state, options({ terminals: ['kitty'], palettes: ['neutral'] }), paths)
  const asked: (keyof Installed)[] = ['terminals', 'palettes', 'off', 'startup', 'wtHome', 'wtProfile']
  for (const key of Object.keys(state) as (keyof Installed)[]) {
    if (!asked.includes(key)) {
      assert.deepEqual(installed[key], state[key], key)
    }
  }
  assert.deepEqual(installed.terminals, ['kitty'])
  assert.equal(installed.startup, undefined)
  assert.equal(installed.wtHome, undefined)
})
