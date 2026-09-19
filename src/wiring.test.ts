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
  withSetting,
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

test('ghosttyBlock routes every new tab through the launcher', () => {
  assert.equal(
    ghosttyBlock('/cfg/ttheme', 'miku'),
    'command = /cfg/ttheme/launch-tab.zsh\nshell-integration = zsh\ntheme = miku\nconfig-file = /cfg/ttheme/ttheme.conf\nconfig-file = ?/cfg/ttheme/backgrounds/miku.conf',
  )
})

test('zshrcBlock only sources the layer', () => {
  assert.equal(zshrcBlock('/cfg/ttheme'), 'source /cfg/ttheme/ttheme.zsh')
})

test('configFile seeds the template with every default spelled out', () => {
  const out = configFile('')
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
      '# series and palettes in ttheme and preview: abc sorts them by name, series keeps the order they were added (default abc)',
      ': ${TTHEME_SORT:=abc}',
      '',
      '# how far find goes: safe, questionable or all, each booru read in its own rating vocabulary (default safe)',
      ': ${TTHEME_FIND_RATING:=safe}',
      '',
      '# posts tagged with nudity or underwear: block drops them, allow keeps them (default block)',
      ': ${TTHEME_FIND_TAGS:=block}',
      '',
      '# what find lists first: cutouts are the transparent ones, all is every post of the character (default cutouts)',
      ': ${TTHEME_FIND_POSTS:=cutouts}',
      '',
      '# the order find lists posts in: newest or score (default newest)',
      ': ${TTHEME_FIND_ORDER:=newest}',
      '',
      '# runs of the same picture at the same size from one uploader: fold shows them as one tile, show lists each (default fold)',
      ': ${TTHEME_FIND_SETS:=fold}',
      '',
      '# when a network blocks a booru by name, 1 sends find through a local proxy that splits the TLS handshake (default 0)',
      ': ${TTHEME_FIND_UNBLOCK:=0}',
      '',
      '# send a find site somewhere else, as key=https://host pairs — e.g. "konachan=https://konachan.com danbooru=https://danbooru.donmai.us" (default none)',
      ': ${TTHEME_FIND_HOSTS:=}',
      '',
    ].join('\n'),
  )
})

test('configFile is idempotent and preserves user edits', () => {
  const edited = configFile('').replace(/^: \$\{TTHEME_FX[^\n]*$/m, ': ${TTHEME_FX:=glitch}')
  const rerun = configFile(edited)
  assert.equal(rerun, edited)
  assert.match(rerun, /^: \$\{TTHEME_FX:=glitch\}$/m)
})

test('configFile appends a documented line when a setting is missing', () => {
  const out = configFile('TTHEME_CUSTOM=1\n')
  assert.ok(out.startsWith('TTHEME_CUSTOM=1\n'))
  assert.match(out, /^# new tabs: .*\n: \$\{TTHEME_TAB_PALETTE:=seq\}$/m)
  assert.match(out, /^# the palette notice .*\n: \$\{TTHEME_ANNOUNCE:=1\}$/m)
  assert.match(out, /^# search hint animation: .*\n: \$\{TTHEME_FX:=typewriter\}$/m)
  assert.match(out, /^# series and palettes .*\n: \$\{TTHEME_SORT:=abc\}$/m)
})

test('kitty and alacritty blocks reference the chosen palette', () => {
  assert.equal(kittyBlock('miku'), 'include themes/miku.conf')
  assert.equal(
    alacrittyBlock('/cfg/alacritty/themes/miku.toml'),
    '[general]\nimport = ["/cfg/alacritty/themes/miku.toml"]',
  )
})

test('withSetting rewrites the line a setting already has, and adds one when it is missing', () => {
  const file = configTemplate()
  const changed = withSetting(file, 'TTHEME_FIND_RATING', 'questionable')
  assert.match(changed, /: \$\{TTHEME_FIND_RATING:=questionable\}/)
  assert.equal(changed.split('TTHEME_FIND_RATING').length - 1, 1)
  assert.equal(changed.replace(':=questionable}', ':=safe}'), file)
  const added = withSetting('# mine\n', 'TTHEME_FIND_TAGS', 'allow')
  assert.equal(added, '# mine\n\n: ${TTHEME_FIND_TAGS:=allow}\n')
  assert.match(
    withSetting('#: ${TTHEME_FIND_SETS:=fold}\n', 'TTHEME_FIND_SETS', 'show'),
    /^: \$\{TTHEME_FIND_SETS:=show\}\n$/,
  )
})
