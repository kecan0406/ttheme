import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  alacrittyColors,
  configFile,
  configTemplate,
  detectTerminal,
  ghosttyBlock,
  kittyBlock,
  removeBlock,
  removeLuaBlock,
  upsertAlacrittyImport,
  upsertBlock,
  upsertLuaBlock,
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
  assert.equal(detectTerminal({ TERM_PROGRAM: 'WarpTerminal', GHOSTTY_RESOURCES_DIR: '/x' }), 'warp')
  assert.equal(detectTerminal({ WT_SESSION: 'a-b' }), 'windows-terminal')
  assert.equal(detectTerminal({ TERM_PROGRAM: 'Apple_Terminal' }), 'terminal-app')
  assert.equal(detectTerminal({ WT_SESSION: 'a-b', TERM_PROGRAM: 'vscode' }), 'unknown')
  assert.equal(detectTerminal({}), 'unknown')
})

test('ghosttyBlock routes every new tab through the launcher', () => {
  assert.equal(
    ghosttyBlock('/cfg/ttheme', 'miku'),
    'command = /cfg/ttheme/launch-tab.zsh\nshell-integration = zsh\ntheme = ttheme-miku\nconfig-file = ?/cfg/ttheme/backgrounds/shown.conf',
  )
})

test('ghosttyBlock includes the shown background even with no startup palette', () => {
  assert.equal(
    ghosttyBlock('/cfg/ttheme', undefined),
    'command = /cfg/ttheme/launch-tab.zsh\nshell-integration = zsh\nconfig-file = ?/cfg/ttheme/backgrounds/shown.conf',
  )
})

test('zshrcBlock only sources the layer', () => {
  assert.equal(zshrcBlock('/cfg/ttheme'), 'source /cfg/ttheme/ttheme.zsh')
})

test('configFile seeds the template with every default spelled out on a commented line', () => {
  const out = configFile('')
  assert.equal(out, configTemplate())
  assert.equal(
    out,
    [
      '# ttheme settings — uncomment a line to change it; exported variables win over this file',
      '',
      '# new tabs: off keeps the configured terminal theme, seq rotates through the palettes (default off)',
      '# : ${TTHEME_TAB_PALETTE:=off}',
      '',
      '# the palette notice under "Last login:": 1 shows it, 0 silences it (default 1)',
      '# : ${TTHEME_ANNOUNCE:=1}',
      '',
      '# search hint animation: typewriter, decode or glitch (default typewriter)',
      '# : ${TTHEME_FX:=typewriter}',
      '',
      '# series and palettes in ttheme and preview: abc sorts them by name, series keeps the order they were added (default abc)',
      '# : ${TTHEME_SORT:=abc}',
      '',
      '# the ratings find lists, any of safe, questionable and explicit, each booru read in its own rating vocabulary (default safe)',
      '# : ${TTHEME_FIND_RATING:=safe}',
      '',
      '# the posts find drops by tag: nudity, underwear, both, or none to keep them all (default "nudity underwear")',
      '# : ${TTHEME_FIND_BLOCK:=nudity underwear}',
      '',
      '# what find lists first: all is every post of the character, cutouts are the transparent ones (default all)',
      '# : ${TTHEME_FIND_POSTS:=all}',
      '',
      '# on keeps the danbooru posts tagged solo, the character alone; off lists every post (default on)',
      '# : ${TTHEME_FIND_SOLO:=on}',
      '',
      '# the tags find calls a transparent cutout, per site as key=tag,tag pairs — e.g. "konachan=transparent,vector yande=transparent_png" (default the built-in tags)',
      '# : ${TTHEME_FIND_CUTOUTS:=}',
      '',
      '# the order find lists posts in: fit ranks each page by how well it makes a backdrop, newest or score (default fit)',
      '# : ${TTHEME_FIND_ORDER:=fit}',
      '',
      '# runs of the same picture at the same size from one uploader: fold shows them as one tile, show lists each (default fold)',
      '# : ${TTHEME_FIND_SETS:=fold}',
      '',
      '# an opaque picture tried on in find: on cuts the character out with macOS Vision, off leaves it as it is (default on)',
      '# : ${TTHEME_FIND_REMOVE_BG:=on}',
      '',
      '# when a network blocks a booru by name, 1 sends find through a local proxy that splits the TLS handshake — find offers to turn it on (default 0)',
      '# : ${TTHEME_FIND_UNBLOCK:=0}',
      '',
      '# send a find site somewhere else, as key=https://host pairs — e.g. "danbooru=https://safebooru.donmai.us" (default none)',
      '# : ${TTHEME_FIND_HOSTS:=}',
      '',
    ].join('\n'),
  )
})

test('configFile is idempotent and preserves user edits', () => {
  const edited = configFile('').replace(/^# : \$\{TTHEME_FX[^\n]*$/m, ': ${TTHEME_FX:=glitch}')
  const rerun = configFile(edited)
  assert.equal(rerun, edited)
  assert.match(rerun, /^: \$\{TTHEME_FX:=glitch\}$/m)
})

test('configFile appends a documented line when a setting is missing', () => {
  const out = configFile('TTHEME_CUSTOM=1\n')
  assert.ok(out.startsWith('TTHEME_CUSTOM=1\n'))
  assert.match(out, /^# new tabs: .*\n# : \$\{TTHEME_TAB_PALETTE:=off\}$/m)
  assert.match(out, /^# the palette notice .*\n# : \$\{TTHEME_ANNOUNCE:=1\}$/m)
  assert.match(out, /^# search hint animation: .*\n# : \$\{TTHEME_FX:=typewriter\}$/m)
  assert.match(out, /^# series and palettes .*\n# : \$\{TTHEME_SORT:=abc\}$/m)
})

test('the kitty block wears the chosen palette and loads the watcher', () => {
  assert.equal(
    kittyBlock('miku', '/cfg/ttheme/kitty.py'),
    'include themes/ttheme-miku.conf\nwatcher /cfg/ttheme/kitty.py\nwindow_logo_scale 100\nwindow_logo_alpha 1',
  )
  assert.doesNotMatch(kittyBlock(undefined, '/cfg/ttheme/kitty.py'), /include/)
})

test('upsertAlacrittyImport appends a [general] block to a config without one', () => {
  const theme = '/cfg/alacritty/themes/miku.toml'
  assert.equal(upsertAlacrittyImport('', theme), `# ttheme begin\n[general]\nimport = ["${theme}"]\n# ttheme end\n`)
  const own = upsertAlacrittyImport('[font]\nsize = 14\n', theme)
  assert.equal(own, `[font]\nsize = 14\n\n# ttheme begin\n[general]\nimport = ["${theme}"]\n# ttheme end\n`)
  assert.equal(upsertAlacrittyImport(own ?? '', theme), own)
})

test('upsertAlacrittyImport joins an existing [general] table and keeps it on rewrite', () => {
  const theme = '/cfg/alacritty/themes/miku.toml'
  const wired = upsertAlacrittyImport('[general]\nlive_config_reload = true\n\n[font]\nsize = 14\n', theme)
  assert.equal(
    wired,
    `[general]\n# ttheme begin\nimport = ["${theme}"]\n# ttheme end\nlive_config_reload = true\n\n[font]\nsize = 14\n`,
  )
  assert.equal(upsertAlacrittyImport(wired ?? '', theme), wired)
  assert.equal(
    upsertAlacrittyImport(wired ?? '', undefined),
    '[general]\n# ttheme begin\n# ttheme end\nlive_config_reload = true\n\n[font]\nsize = 14\n',
  )
})

test('upsertAlacrittyImport leaves a config alone when it already imports or defines general otherwise', () => {
  const theme = '/cfg/alacritty/themes/miku.toml'
  assert.equal(upsertAlacrittyImport('[general]\nimport = ["mine.toml"]\n', theme), undefined)
  assert.equal(upsertAlacrittyImport('import = ["mine.toml"]\n', theme), undefined)
  assert.equal(upsertAlacrittyImport('general.live_config_reload = true\n', theme), undefined)
})

test('withSetting rewrites the line a setting already has, and adds one when it is missing', () => {
  const file = configTemplate()
  const changed = withSetting(file, 'TTHEME_FIND_RATING', 'safe questionable')
  assert.match(changed, /^: \$\{TTHEME_FIND_RATING:=safe questionable\}$/m)
  assert.equal(changed.split('TTHEME_FIND_RATING').length - 1, 1)
  assert.equal(withSetting(changed, 'TTHEME_FIND_RATING', 'safe'), file, 'the default goes back to a commented line')
  const added = withSetting('# mine\n', 'TTHEME_FIND_BLOCK', 'none')
  assert.equal(added, '# mine\n\n: ${TTHEME_FIND_BLOCK:=none}\n')
  assert.match(
    withSetting('#: ${TTHEME_FIND_SETS:=fold}\n', 'TTHEME_FIND_SETS', 'show'),
    /^: \$\{TTHEME_FIND_SETS:=show\}\n$/,
  )
})

test('ghosttyBlock leaves a command and shell-integration the user set to the user', () => {
  const block = ghosttyBlock('/cfg/ttheme', 'miku', 'font-size = 13\ncommand = /opt/homebrew/bin/fish\n')
  assert.equal(block, 'theme = ttheme-miku\nconfig-file = ?/cfg/ttheme/backgrounds/shown.conf')
  assert.equal(
    ghosttyBlock('/cfg/ttheme', undefined, 'shell-integration = none\n'),
    'command = /cfg/ttheme/launch-tab.zsh\nconfig-file = ?/cfg/ttheme/backgrounds/shown.conf',
  )
  const ours = upsertBlock('', ghosttyBlock('/cfg/ttheme', 'miku'))
  assert.match(ghosttyBlock('/cfg/ttheme', 'miku', ours), /^command = /m)
  assert.match(ghosttyBlock('/cfg/ttheme', 'miku', '# command = zsh\ncommand-palette-entry = x\n'), /^command = /m)
})

test('the kitty block leaves the logo settings the user set to the user', () => {
  assert.equal(
    kittyBlock(undefined, '/cfg/ttheme/kitty.py', 'window_logo_alpha 0.4\n'),
    'watcher /cfg/ttheme/kitty.py\nwindow_logo_scale 100',
  )
})

test('removeBlock gives back the content upsertBlock started from', () => {
  for (const mine of ['', 'font-size = 14\n', 'font-size = 14\n\n\n']) {
    assert.equal(removeBlock(upsertBlock(mine, 'a = 1')), mine.replace(/\n+$/, '\n'))
  }
  assert.equal(removeBlock('font-size = 14\n'), 'font-size = 14\n')
  const general = '[general]\nlive_config_reload = true\n\n[font]\nsize = 14\n'
  assert.equal(removeBlock(upsertAlacrittyImport(general, '/t.toml') ?? ''), general)
  assert.equal(removeBlock(upsertAlacrittyImport(general, undefined) ?? ''), general)
})

test('removeLuaBlock gives back the config upsertLuaBlock wired, and empties the one it created', () => {
  const mine = 'local config = {}\nconfig.font_size = 13\nreturn config\n'
  assert.equal(removeLuaBlock(upsertLuaBlock(mine, 'x') ?? ''), mine)
  assert.equal(removeLuaBlock(upsertLuaBlock('', 'x') ?? ''), '')
})

test('alacrittyColors spots colors the user set outside the ttheme block', () => {
  assert.ok(alacrittyColors('[colors.primary]\nbackground = "#000000"\n'))
  assert.ok(alacrittyColors('colors.primary.background = "#000000"\n'))
  assert.ok(!alacrittyColors(upsertAlacrittyImport('[font]\nsize = 14\n', '/t.toml') ?? ''))
})
