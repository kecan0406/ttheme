import assert from 'node:assert/strict'
import { test } from 'node:test'

import { alacrittyBlock, detectTerminal, ghosttyBlock, kittyBlock, upsertBlock, zshrcBlock } from './wiring.ts'

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

test('zshrcBlock only exports non-default settings', () => {
  assert.equal(zshrcBlock('/cfg/ttheme', { tabPalette: 'seq', announce: true }), 'source /cfg/ttheme/ttheme.zsh')
  assert.equal(
    zshrcBlock('/cfg/ttheme', { tabPalette: 'off', announce: false }),
    'export TTHEME_TAB_PALETTE=off\nexport TTHEME_ANNOUNCE=0\nsource /cfg/ttheme/ttheme.zsh',
  )
})

test('kitty and alacritty blocks reference the chosen palette', () => {
  assert.equal(kittyBlock('miku'), 'include themes/miku.conf')
  assert.equal(
    alacrittyBlock('/cfg/alacritty/themes/miku.toml'),
    '[general]\nimport = ["/cfg/alacritty/themes/miku.toml"]',
  )
})
