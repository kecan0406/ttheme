import assert from 'node:assert/strict'
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { applyInit, type InitOptions, type InitPaths, planInit } from './init.ts'

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
  return { terminals: ['ghostty'], palette: 'neutral', tabPalette: 'seq', announce: true, link: false, ...partial }
}

test('planInit places the runtime layer and wires ghostty and kitty', () => {
  const paths = makeFixture()
  const plan = planInit(options({ terminals: ['ghostty', 'kitty'], palette: 'miku' }), paths)
  const tthemeDir = join(paths.configHome, 'ttheme')
  const targets = plan.copies.map((c) => c.to)
  for (const expected of [
    join(tthemeDir, 'ttheme.zsh'),
    join(tthemeDir, 'launch-tab.zsh'),
    join(tthemeDir, 'palettes.zsh'),
    join(tthemeDir, 'ttheme.conf'),
    join(tthemeDir, 'adapters', '_osc.zsh'),
    join(paths.configHome, 'ghostty', 'themes', 'miku'),
    join(paths.configHome, 'ghostty', 'shaders', 'cursor.glsl'),
    join(paths.configHome, 'kitty', 'themes', 'miku.conf'),
  ]) {
    assert.ok(targets.includes(expected), `missing copy target ${expected}`)
  }
  assert.deepEqual(
    plan.edits.map((e) => e.file),
    [
      join(paths.home, '.zshrc'),
      join(paths.configHome, 'ghostty', 'config'),
      join(paths.configHome, 'kitty', 'kitty.conf'),
    ],
  )
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

test('planInit creates alacritty.toml when absent but falls back to a note when present', () => {
  const paths = makeFixture()
  const fresh = planInit(options({ terminals: ['alacritty'] }), paths)
  const config = join(paths.configHome, 'alacritty', 'alacritty.toml')
  assert.deepEqual(
    fresh.edits.map((e) => e.file),
    [join(paths.home, '.zshrc'), config],
  )
  applyInit(fresh, false)
  assert.match(readFileSync(config, 'utf8'), /\[general\]\nimport = \[/)
  const rerun = planInit(options({ terminals: ['alacritty'] }), paths)
  assert.ok(
    rerun.edits.some((e) => e.file === config),
    'own marker block should stay editable',
  )
  mkdirSync(join(paths.configHome, 'alacritty'), { recursive: true })
  writeFileSync(config, '[general]\nimport = ["mine.toml"]\n')
  const foreign = planInit(options({ terminals: ['alacritty'] }), paths)
  assert.ok(!foreign.edits.some((e) => e.file === config))
  assert.ok(foreign.notes.some((n) => n.includes('alacritty.toml already exists')))
})

test('applyInit with link symlinks back to the checkout', () => {
  const paths = makeFixture()
  applyInit(planInit(options({ link: true }), paths), true)
  const layer = join(paths.configHome, 'ttheme', 'ttheme.zsh')
  assert.ok(lstatSync(layer).isSymbolicLink())
  assert.equal(readFileSync(layer, 'utf8'), 'ttheme layer')
})
