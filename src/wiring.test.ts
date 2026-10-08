import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { alacrittyColors, alacrittyConfig, upsertAlacrittyImport } from './terminals/alacritty.ts'
import { ghosttyBlock, ghosttyOwnText } from './terminals/ghostty.ts'
import { kittyBlock, kittyOwnText } from './terminals/kitty.ts'
import { removeLuaBlock, upsertLuaBlock, weztermBlock } from './terminals/wezterm.ts'
import {
  blurOf,
  coloringFor,
  configFile,
  configTemplate,
  GENERATED,
  MANAGED,
  removeBlock,
  SETTING_NAMES,
  settingDefault,
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

test('the Ghostty block only includes the file ttheme owns, optionally and from the home folder', () => {
  assert.equal(
    ghosttyBlock('/home/u/.config/ttheme', '/home/u'),
    `# ${MANAGED}\nconfig-file = ?~/.config/ttheme/ghostty.conf`,
  )
  assert.equal(ghosttyBlock('/cfg/ttheme', '/home/u'), `# ${MANAGED}\nconfig-file = ?/cfg/ttheme/ghostty.conf`)
})

test("ttheme's Ghostty file routes new tabs through the launcher only while they rotate, and always includes the shown background", () => {
  assert.equal(
    ghosttyOwnText('/cfg/ttheme', 'miku', true, true),
    `# ${GENERATED}\ncommand = /cfg/ttheme/launch-tab.zsh\nshell-integration = zsh\ntheme = ttheme-miku\nconfig-file = ?backgrounds/shown.conf\n`,
  )
  assert.equal(
    ghosttyOwnText('/cfg/ttheme', undefined, false, true),
    `# ${GENERATED}\nconfig-file = ?backgrounds/shown.conf\n`,
  )
})

test('zshrcBlock sources the layer only while it is there, from where the layer itself finds its config', () => {
  const layer = '"${XDG_CONFIG_HOME:-$HOME/.config}/ttheme/ttheme.zsh"'
  assert.equal(zshrcBlock(), `# ${MANAGED}\n[[ -r ${layer} ]] && source ${layer}`)
})

test('the WezTerm block runs the module only while it is there', () => {
  assert.equal(
    weztermBlock('/home/u/.config/ttheme/wezterm.lua', '/home/u'),
    `-- ${MANAGED}\ndo local path = require('wezterm').home_dir .. "/.config/ttheme/wezterm.lua" local file = io.open(path) if file then file:close() dofile(path)(config) end end`,
  )
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
      '# catalogs and palettes in ttheme and preview: abc sorts them by name, catalog keeps the order they were added (default abc)',
      '# : ${TTHEME_SORT:=abc}',
      '',
      '# clicks, the wheel and drags in preview, browse, the palette editor and find: on, or off to leave the mouse to the terminal, so a drag selects text again without a modifier (default on)',
      '# : ${TTHEME_MOUSE:=on}',
      '',
      '# soften the background pictures behind the text: a blur radius in screen pixels, 0 keeps them sharp — changing it draws every picture again (default 0)',
      '# : ${TTHEME_BG_BLUR:=0}',
      '',
      '# the colors new background pictures are drawn in: tone tints a picture in one color of its palette, original keeps its own — preview switches each picture later (default tone)',
      '# : ${TTHEME_BG_COLORS:=tone}',
      '',
      '# Warp tab switches: on keeps Warp rereading its settings while it is in front with tabs of different palettes, so the tab you switch to shows its palette in about 0.2 s instead of 0.6 s — about 8% CPU meanwhile; off leaves it to Warp (default on)',
      '# : ${TTHEME_WARP_FAST:=on}',
      '',
      "# character names in every language for searching palettes and find's search box, from aninames' weekly release: on downloads them (about 7 MB) and checks once a day in the background; off leaves them as they are (default on)",
      '# : ${TTHEME_NAMES:=on}',
      '',
      '# checks in the background: on refreshes the marketplaces you set to update on their own once a day and says when a newer ttheme is out; off leaves both to ttheme update (default on)',
      '# : ${TTHEME_AUTO_UPDATE:=on}',
      '',
      '# GitHub lookups in browse: on looks GitHub up by itself — the marketplaces carrying the ttheme-marketplace topic when browse opens or you type, and the palettes of a repository you type or move onto; off waits for space (default on)',
      '# : ${TTHEME_MARKETPLACE_LOOKUP:=on}',
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
      '# on keeps the posts tagged solo, the character alone, by danbooru or zerochan; off lists every post (default on)',
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
      '# the lowest score find lists: off, or a number such as 5, 10, 25, 50 or 100 — danbooru, konachan and yande.re filter by it, zerochan keeps no score (default off)',
      '# : ${TTHEME_FIND_MIN_SCORE:=off}',
      '',
      '# the shortest side a picture find lists must reach, in pixels: off, or a number such as 720, 1080, 1440, 1800 or 2560 (default off)',
      '# : ${TTHEME_FIND_MIN_SIZE:=off}',
      '',
      '# the sites find mixes in its all tab: any of danbooru, konachan, yande.re and zerochan (default all four)',
      '# : ${TTHEME_FIND_SITES:=danbooru konachan yande.re zerochan}',
      '',
      '# the kinds of picture find leaves out by tag: comic, monochrome, sketch, chibi, or none to keep them all (default none)',
      '# : ${TTHEME_FIND_HIDE:=none}',
      '',
      '# more tags find leaves out, spaced — e.g. "cosplay multiple_girls" (default none)',
      '# : ${TTHEME_FIND_HIDE_TAGS:=}',
      '',
      '# on lists PNG originals only — a zerochan post counts only where danbooru holds the same file (default off)',
      '# : ${TTHEME_FIND_PNG:=off}',
      '',
      '# send a find site somewhere else, as key=https://host pairs — e.g. "danbooru=https://danbooru.donmai.us" (default none)',
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
  assert.match(out, /^# catalogs and palettes .*\n# : \$\{TTHEME_SORT:=abc\}$/m)
})

test("the kitty block includes ttheme's file, which wears the chosen palette and loads the watcher", () => {
  assert.equal(kittyBlock('/home/u/.config/ttheme', '/home/u'), `# ${MANAGED}\ninclude ~/.config/ttheme/kitty.conf`)
  assert.equal(
    kittyOwnText('/cfg/kitty/themes/ttheme-miku.conf', '/cfg/ttheme/kitty.py'),
    `# ${GENERATED}\ninclude /cfg/kitty/themes/ttheme-miku.conf\nwatcher /cfg/ttheme/kitty.py\nwindow_logo_scale 100\nwindow_logo_alpha 1\n`,
  )
  assert.doesNotMatch(kittyOwnText(undefined, '/cfg/ttheme/kitty.py'), /include/)
})

test('upsertAlacrittyImport appends a [general] block to a config without one', () => {
  const own = '~/.config/ttheme/alacritty.toml'
  assert.equal(
    upsertAlacrittyImport('', own),
    `# ttheme begin\n# ${MANAGED}\n[general]\nimport = ["${own}"]\n# ttheme end\n`,
  )
  const mine = upsertAlacrittyImport('[font]\nsize = 14\n', own)
  assert.equal(
    mine,
    `[font]\nsize = 14\n\n# ttheme begin\n# ${MANAGED}\n[general]\nimport = ["${own}"]\n# ttheme end\n`,
  )
  assert.equal(upsertAlacrittyImport(mine ?? '', own), mine)
})

test('upsertAlacrittyImport joins an existing [general] table and keeps it on rewrite', () => {
  const own = '~/.config/ttheme/alacritty.toml'
  const wired = upsertAlacrittyImport('[general]\nlive_config_reload = true\n\n[font]\nsize = 14\n', own)
  assert.equal(
    wired,
    `[general]\n# ttheme begin\n# ${MANAGED}\nimport = ["${own}"]\n# ttheme end\nlive_config_reload = true\n\n[font]\nsize = 14\n`,
  )
  assert.equal(upsertAlacrittyImport(wired ?? '', own), wired)
})

test('Alacritty is wired through the config it reads, never one that would hide it', () => {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-alacritty-'))
  const at = { home, configHome: join(home, '.config') }
  assert.deepEqual(alacrittyConfig(at), { file: join(home, '.config', 'alacritty', 'alacritty.toml') })
  writeFileSync(join(home, '.alacritty.toml'), '[font]\nsize = 14\n')
  assert.deepEqual(alacrittyConfig(at), { file: join(home, '.alacritty.toml') })
  mkdirSync(join(home, '.config'), { recursive: true })
  writeFileSync(join(home, '.config', 'alacritty.toml'), '[font]\nsize = 15\n')
  assert.deepEqual(alacrittyConfig(at), { file: join(home, '.config', 'alacritty.toml') })
  const yaml = mkdtempSync(join(tmpdir(), 'ttheme-alacritty-'))
  mkdirSync(join(yaml, '.config', 'alacritty'), { recursive: true })
  writeFileSync(join(yaml, '.config', 'alacritty', 'alacritty.yml'), 'font:\n  size: 14\n')
  assert.deepEqual(alacrittyConfig({ home: yaml, configHome: join(yaml, '.config') }), {
    file: join(yaml, '.config', 'alacritty', 'alacritty.toml'),
    yaml: join(yaml, '.config', 'alacritty', 'alacritty.yml'),
  })
})

test('upsertAlacrittyImport leaves a config alone when it already imports or defines general otherwise', () => {
  const theme = '~/.config/ttheme/alacritty.toml'
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

test("ttheme's kitty file leaves the logo settings the user set to the user", () => {
  assert.equal(
    kittyOwnText(undefined, '/cfg/ttheme/kitty.py', 'window_logo_alpha 0.4\n'),
    `# ${GENERATED}\nwatcher /cfg/ttheme/kitty.py\nwindow_logo_scale 100\n`,
  )
})

test('removeBlock gives back the content upsertBlock started from', () => {
  for (const mine of ['', 'font-size = 14\n', 'font-size = 14\n\n\n']) {
    assert.equal(removeBlock(upsertBlock(mine, 'a = 1')), mine.replace(/\n+$/, '\n'))
  }
  assert.equal(removeBlock('font-size = 14\n'), 'font-size = 14\n')
  const general = '[general]\nlive_config_reload = true\n\n[font]\nsize = 14\n'
  assert.equal(removeBlock(upsertAlacrittyImport(general, '/t.toml') ?? ''), general)
})

test('upsertAlacrittyImport keeps the line ending of a CRLF [general] header, so the block comes out as it went in', () => {
  const crlf = '[general]\r\nlive_config_reload = true\r\n\r\n[font]\r\nsize = 14\r\n'
  const once = upsertAlacrittyImport(crlf, '/t.toml') ?? ''
  assert.equal(upsertAlacrittyImport(once, '/t.toml'), once)
  assert.equal(removeBlock(once), crlf)
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

test('the blur comes from config.zsh itself, commented out meaning the default and out of range held to it', () => {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-blur-'))
  const at = (text: string) => {
    mkdirSync(join(home, 'ttheme'), { recursive: true })
    writeFileSync(join(home, 'ttheme', 'config.zsh'), text)
    return blurOf(home)
  }
  assert.equal(blurOf(join(home, 'nowhere')), 0)
  assert.equal(at(configFile('')), 0)
  assert.equal(at(withSetting(configFile(''), 'TTHEME_BG_BLUR', '2.5')), 2.5)
  assert.equal(at(': ${TTHEME_BG_BLUR:="3"}\n'), 3)
  assert.equal(at(': ${TTHEME_BG_BLUR:=40}\n'), 8)
  assert.equal(at(': ${TTHEME_BG_BLUR:=soft}\n'), 0)
})

test('new pictures are drawn in the colors config.zsh names, tone unless it says original', () => {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-colors-'))
  const at = (text: string) => {
    mkdirSync(join(home, 'ttheme'), { recursive: true })
    writeFileSync(join(home, 'ttheme', 'config.zsh'), text)
    return coloringFor(home)
  }
  assert.equal(coloringFor(join(home, 'nowhere')), 'tone')
  assert.equal(at(configFile('')), 'tone')
  assert.equal(at(withSetting(configFile(''), 'TTHEME_BG_COLORS', 'original')), 'original')
  assert.equal(at(': ${TTHEME_BG_COLORS:="original"}\n'), 'original')
  assert.equal(at(': ${TTHEME_BG_COLORS:=sepia}\n'), 'tone')
})

test('the shell layer falls back to the same default config.zsh documents for every setting it reads', () => {
  const layer = ['ttheme.zsh', 'preview.zsh']
    .map((file) => readFileSync(join(import.meta.dirname, '..', 'shell', file), 'utf8'))
    .join('\n')
  const defaults = [...layer.matchAll(/^: \$\{(TTHEME_\w+):=(.*)\}$/gm)]
  assert.ok(defaults.length > 0)
  for (const [, name = '', value] of defaults) {
    assert.ok(SETTING_NAMES.includes(name), `${name} is not a config.zsh setting`)
    assert.equal(value, settingDefault(name), name)
  }
})
