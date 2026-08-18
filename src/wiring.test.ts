import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  alacrittyBlock,
  configFile,
  configTemplate,
  detectTerminal,
  ghosttyBlock,
  kittyBlock,
  upsertBlock,
  zshrcBlock,
} from './wiring.ts'

test('upsertBlock appends a marked block to empty content', () => {
  assert.equal(upsertBlock('', 'a = 1'), '# ttheme begin\na = 1\n# ttheme end\n')
})

test('upsertBlock separates the block from existing content with a blank line', () => {
  const out = upsertBlock('font-size = 14', 'a = 1')
  assert.equal(out, 'font-size = 14\n\n# ttheme begin\na = 1\n# ttheme end\n')
})

test('upsertBlock replaces an existing block and preserves surrounding content', () => {
  const content = 'before\n\n# ttheme begin\nold = 1\n# ttheme end\n\nafter\n'
  const out = upsertBlock(content, 'new = 2')
  assert.equal(out, 'before\n\n# ttheme begin\nnew = 2\n# ttheme end\n\nafter\n')
})

test('upsertBlock is idempotent', () => {
  const once = upsertBlock('user content\n', 'a = 1')
  assert.equal(upsertBlock(once, 'a = 1'), once)
})

test('detectTerminal mirrors the shell adapter detection', () => {
  assert.equal(detectTerminal({ GHOSTTY_RESOURCES_DIR: '/x' }), 'ghostty')
  assert.equal(detectTerminal({ TERM_PROGRAM: 'ghostty' }), 'ghostty')
  assert.equal(detectTerminal({ KITTY_WINDOW_ID: '1' }), 'kitty')
  assert.equal(detectTerminal({ WEZTERM_PANE: '0' }), 'wezterm')
  assert.equal(detectTerminal({ ALACRITTY_WINDOW_ID: '2' }), 'alacritty')
  assert.equal(detectTerminal({ ITERM_SESSION_ID: 'w0' }), 'iterm2')
  assert.equal(detectTerminal({ TERM_PROGRAM: 'iTerm.app' }), 'iterm2')
  assert.equal(detectTerminal({ TERM: 'foot-extra' }), 'foot')
  assert.equal(detectTerminal({}), 'unknown')
})

test('ghosttyBlock wires the tab launcher only in seq mode', () => {
  const seq = ghosttyBlock('/cfg/ttheme', 'miku', 'seq')
  assert.equal(
    seq,
    'command = /cfg/ttheme/launch-tab.zsh\nshell-integration = zsh\ntheme = miku\nconfig-file = /cfg/ttheme/ttheme.conf',
  )
  const off = ghosttyBlock('/cfg/ttheme', 'miku', 'off')
  assert.equal(off, 'theme = miku\nconfig-file = /cfg/ttheme/ttheme.conf')
})

test('zshrcBlock only sources the layer', () => {
  assert.equal(zshrcBlock('/cfg/ttheme'), 'source /cfg/ttheme/ttheme.zsh')
})

test('configFile seeds the template with every default spelled out', () => {
  const out = configFile('', { tabPalette: 'seq', announce: true })
  assert.equal(out, configTemplate())
  assert.equal(
    out,
    [
      '# ttheme settings — exported variables win over this file',
      '',
      '# new tabs: seq rotates through the palettes, off keeps the configured terminal theme (default seq)',
      ': ${TTHEME_TAB_PALETTE:=seq}',
      '',
      '# the palette notice under "Last login:": 1 shows it, 0 silences it (default 1)',
      ': ${TTHEME_ANNOUNCE:=1}',
      '',
      '# search hint animation: typewriter, decode or glitch (default typewriter)',
      ': ${TTHEME_FX:=typewriter}',
      '',
    ].join('\n'),
  )
})

test('configFile writes chosen values and reverts them to defaults', () => {
  const off = configFile('', { tabPalette: 'off', announce: false })
  assert.match(off, /^: \$\{TTHEME_TAB_PALETTE:=off\}$/m)
  assert.match(off, /^: \$\{TTHEME_ANNOUNCE:=0\}$/m)
  const back = configFile(off, { tabPalette: 'seq', announce: true })
  assert.match(back, /^: \$\{TTHEME_TAB_PALETTE:=seq\}$/m)
  assert.match(back, /^: \$\{TTHEME_ANNOUNCE:=1\}$/m)
})

test('configFile is idempotent and preserves user edits', () => {
  const edited = configFile('', { tabPalette: 'off', announce: true }).replace(
    /^: \$\{TTHEME_FX[^\n]*$/m,
    ': ${TTHEME_FX:=glitch}',
  )
  const rerun = configFile(edited, { tabPalette: 'off', announce: true })
  assert.equal(rerun, edited)
  assert.match(rerun, /^: \$\{TTHEME_FX:=glitch\}$/m)
})

test('configFile appends a documented line when a setting is missing', () => {
  const out = configFile('TTHEME_CUSTOM=1\n', { tabPalette: 'off', announce: true })
  assert.ok(out.startsWith('TTHEME_CUSTOM=1\n'))
  assert.match(out, /^# new tabs: .*\n: \$\{TTHEME_TAB_PALETTE:=off\}$/m)
  assert.match(out, /^# the palette notice .*\n: \$\{TTHEME_ANNOUNCE:=1\}$/m)
  assert.match(out, /^# search hint animation: .*\n: \$\{TTHEME_FX:=typewriter\}$/m)
})

test('kitty and alacritty blocks reference the chosen palette', () => {
  assert.equal(kittyBlock('miku'), 'include themes/miku.conf')
  assert.equal(
    alacrittyBlock('/cfg/alacritty/themes/miku.toml'),
    '[general]\nimport = ["/cfg/alacritty/themes/miku.toml"]',
  )
})
