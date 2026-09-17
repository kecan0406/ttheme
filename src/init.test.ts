import assert from 'node:assert/strict'
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { test } from 'node:test'

import { applyInit, type InitOptions, type InitPaths, planInit } from './init.ts'

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
    ansi: Array.from({ length: 16 }, (_, i) => `#${i.toString(16).repeat(6)}`),
    gate: [21, 21, 0, 21, 21],
  })
  return {
    version: '0.0.0',
    gate: [],
    font: { family: 'Fixture Mono', size: 14, codepointMap: [] },
    palettes: [palette('neutral', 1, 'default'), palette('miku', 2)],
  }
}

function makeFixture(): InitPaths {
  const base = mkdtempSync(join(tmpdir(), 'ttheme-init-'))
  const root = join(base, 'repo')
  const files: Record<string, string> = {
    'src/cli.ts': '',
    'shell/ttheme.zsh': 'ttheme layer',
    'shell/launch-tab.zsh': '#!/bin/zsh -f',
    'shell/adapters/_osc.zsh': 'osc',
    'shell/adapters/kitty.zsh': 'kitty adapter',
    'ghostty/shaders/cursor.glsl': 'shader',
    'dist/shell/palettes.zsh': 'palettes',
    'dist/ghostty/ttheme.conf': 'font',
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
  return { terminals: ['ghostty'], tabPalette: 'seq', announce: true, link: false, ...partial }
}

test('planInit places the runtime layer and touches only .zshrc', () => {
  const paths = makeFixture()
  const plan = planInit(options({ terminals: ['ghostty', 'kitty'] }), paths)
  const tthemeDir = join(paths.configHome, 'ttheme')
  const targets = plan.copies.map((c) => c.to)
  for (const expected of [
    join(tthemeDir, 'ttheme.zsh'),
    join(tthemeDir, 'launch-tab.zsh'),
    join(tthemeDir, 'ttheme.conf'),
    join(tthemeDir, 'adapters', '_osc.zsh'),
    join(paths.configHome, 'ghostty', 'shaders', 'cursor.glsl'),
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
  assert.equal(plan.installed.tabPalette, 'seq')
  assert.ok(!plan.copies.some((c) => c.to.includes(`${sep}themes${sep}`)))
})

test('applyInit leaves a fresh install with an empty table and no terminal theme', () => {
  const paths = makeFixture()
  applyInit(planInit(options({ terminals: ['ghostty'] }), paths), false)
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
  applyInit(plan, false)
  const launcher = join(paths.configHome, 'ttheme', 'launch-tab.zsh')
  assert.ok(statSync(launcher).mode & 0o100, 'launcher is not executable')
  const ghostty = readFileSync(join(paths.configHome, 'ghostty', 'config'), 'utf8')
  assert.match(ghostty, /# ttheme begin/)
  assert.match(ghostty, /command = .*launch-tab\.zsh/)
  const zshrc = readFileSync(join(paths.home, '.zshrc'), 'utf8')
  assert.match(zshrc, /source .*ttheme\.zsh/)
  assert.ok(!zshrc.includes('export TTHEME_'))
  const config = readFileSync(join(paths.configHome, 'ttheme', 'config.zsh'), 'utf8')
  assert.match(config, /^: \$\{TTHEME_TAB_PALETTE:=seq\}$/m)
})

test('applyInit lands non-default settings in config.zsh and keeps user edits on rerun', () => {
  const paths = makeFixture()
  applyInit(planInit(options({ tabPalette: 'off', announce: false }), paths), false)
  const configPath = join(paths.configHome, 'ttheme', 'config.zsh')
  const first = readFileSync(configPath, 'utf8')
  assert.match(first, /^: \$\{TTHEME_TAB_PALETTE:=off\}$/m)
  assert.match(first, /^: \$\{TTHEME_ANNOUNCE:=0\}$/m)
  writeFileSync(configPath, first.replace(/^: \$\{TTHEME_FX[^\n]*$/m, ': ${TTHEME_FX:=glitch}'))
  applyInit(planInit(options(), paths), false)
  const second = readFileSync(configPath, 'utf8')
  assert.match(second, /^: \$\{TTHEME_TAB_PALETTE:=seq\}$/m)
  assert.match(second, /^: \$\{TTHEME_ANNOUNCE:=1\}$/m)
  assert.match(second, /^: \$\{TTHEME_FX:=glitch\}$/m)
})

test('applyInit is idempotent', () => {
  const paths = makeFixture()
  const plan = planInit(options(), paths)
  applyInit(plan, false)
  const before = plan.edits.map((e) => readFileSync(e.file, 'utf8'))
  applyInit(planInit(options(), paths), false)
  for (const [i, e] of plan.edits.entries()) {
    const after = readFileSync(e.file, 'utf8')
    assert.equal(after, before[i])
    assert.equal(after.split('# ttheme begin').length, 2, `duplicated block in ${e.file}`)
  }
})

test('applyInit preserves existing zshrc content', () => {
  const paths = makeFixture()
  writeFileSync(join(paths.home, '.zshrc'), 'alias ll="ls -l"\n')
  applyInit(planInit(options(), paths), false)
  const zshrc = readFileSync(join(paths.home, '.zshrc'), 'utf8')
  assert.ok(zshrc.startsWith('alias ll="ls -l"\n'))
  assert.match(zshrc, /# ttheme begin/)
})

test('init writes its own alacritty block but never edits a foreign alacritty.toml', () => {
  const paths = makeFixture()
  const config = join(paths.configHome, 'alacritty', 'alacritty.toml')
  applyInit(planInit(options({ terminals: ['alacritty'] }), paths), false)
  assert.match(readFileSync(config, 'utf8'), /# ttheme begin/)

  mkdirSync(join(paths.configHome, 'alacritty'), { recursive: true })
  writeFileSync(config, '[general]\nimport = ["mine.toml"]\n')
  const foreign = planInit(options({ terminals: ['alacritty'] }), paths)
  assert.ok(foreign.notes.some((n) => n.includes('alacritty.toml already exists')))
  applyInit(foreign, false)
  assert.equal(readFileSync(config, 'utf8'), '[general]\nimport = ["mine.toml"]\n')
})

test('applyInit with link symlinks back to the checkout', () => {
  const paths = makeFixture()
  applyInit(planInit(options({ link: true }), paths), true)
  const layer = join(paths.configHome, 'ttheme', 'ttheme.zsh')
  assert.ok(lstatSync(layer).isSymbolicLink())
  assert.equal(readFileSync(layer, 'utf8'), 'ttheme layer')
})
