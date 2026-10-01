import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { writeCatalog } from './catalog.ts'
import { warpPictureFile } from './emit/warp.ts'
import { type Manifest, type PaletteEntry, toTheme } from './manifest.ts'
import {
  forget,
  type Installed,
  pointDefaults,
  readInstalled,
  refreshPictures,
  resolve,
  startupPalette,
  sync,
  withBases,
  writeInstalled,
} from './palettes.ts'
import { decodePng, encodeRgba } from './png.ts'
import { itermProfilesPath } from './terminals/iterm2.ts'
import type { Host } from './terminals/types.ts'
import { warpSettings, warpThemes, warpThemeValue } from './terminals/warp.ts'
import { wtFragmentPath } from './terminals/windows-terminal.ts'

function entry(name: string, order: number, partial: Partial<PaletteEntry> = {}): PaletteEntry {
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
    ...partial,
  }
}

const catalog: Manifest = {
  version: '0.1.0',
  gate: [],
  placement: { tall: 1.15, reach: 0.4, widest: 0.95, headroom: 0.04, margin: 0.03, stands: 12 },
  palettes: [entry('neutral', 1, { default: true }), entry('gojo', 2), entry('geto', 3)],
}

function fixture(): string {
  return mkdtempSync(join(tmpdir(), 'ttheme-palettes-'))
}

test('toTheme derives the ghostty icon colors from the palette', () => {
  const theme = toTheme(entry('gojo', 2))
  assert.equal(theme.ghostty.iconGhost, '#7cc1d6')
  assert.deepEqual(theme.ghostty.iconScreen, ['#7cc1d6', '#383b5b', '#11191c'])
  assert.equal(theme.selectionBackground, '#383b5b')
})

test('toTheme carries the default role through as a role, not a flag', () => {
  assert.equal(toTheme(entry('neutral', 1, { default: true })).role, 'default')
  assert.equal(toTheme(entry('gojo', 2)).role, undefined)
})

test('resolve rejects a name the catalog does not carry', () => {
  assert.throws(() => resolve(catalog, ['gojo', 'nobody']), /not in any market: nobody/)
})

test('resolve returns catalog order, not the order asked for', () => {
  assert.deepEqual(
    resolve(catalog, ['geto', 'gojo']).map((p) => p.name),
    ['gojo', 'geto'],
  )
})

test('sync writes a theme file per terminal and the zsh table', () => {
  const home = fixture()
  const written = sync(home, catalog, {
    terminals: ['ghostty', 'kitty'],
    palettes: ['neutral', 'gojo'],
  })
  assert.ok(existsSync(join(home, 'ghostty', 'themes', 'ttheme-gojo')))
  assert.ok(existsSync(join(home, 'kitty', 'themes', 'ttheme-gojo.conf')))
  assert.ok(existsSync(join(home, 'ttheme', 'palettes.zsh')))
  assert.ok(written.includes(join(home, 'ghostty', 'config')))
  assert.ok(written.includes(join(home, 'kitty', 'kitty.conf')))

  const table = readFileSync(join(home, 'ttheme', 'palettes.zsh'), 'utf8')
  assert.match(table, /TTHEME_ORDER=\(gojo\)/)
  assert.match(table, /^typeset -ga TTHEME_TERMINALS=\(ghostty kitty\)$/m)
  assert.doesNotMatch(table, /geto/)
})

test('sync leaves palettes.zsh and its compiled copy alone when nothing it holds changed', () => {
  const home = fixture()
  const state: Installed = { terminals: ['ghostty'], palettes: ['gojo', 'geto'] }
  sync(home, catalog, state)
  const table = join(home, 'ttheme', 'palettes.zsh')
  writeFileSync(`${table}.zwc`, '')
  utimesSync(table, new Date(0), new Date(0))
  sync(home, catalog, state)
  assert.equal(statSync(table).mtimeMs, 0)
  assert.ok(existsSync(`${table}.zwc`))
  sync(home, catalog, { ...state, startup: 'geto' })
  assert.ok(statSync(table).mtimeMs > 0)
  assert.ok(!existsSync(`${table}.zwc`))
})

test('sync moves palettes.zsh whenever it touches Windows Terminal settings, so open tabs repaint after the reset', () => {
  const configHome = fixture()
  const wtHome = fixture()
  const settings = join(wtHome, 'Microsoft', 'Windows Terminal', 'settings.json')
  mkdirSync(join(settings, '..'), { recursive: true })
  writeFileSync(settings, '{}\n')
  const state: Installed = {
    terminals: ['windows-terminal'],
    palettes: ['gojo'],
    wtHome,
    wtProfile: '{00000000-0000-0000-0000-000000000001}',
  }
  sync(configHome, catalog, state)
  const table = join(configHome, 'ttheme', 'palettes.zsh')
  utimesSync(table, new Date(0), new Date(0))
  sync(configHome, catalog, state)
  assert.equal(statSync(table).mtimeMs, 0)
  sync(configHome, catalog, { ...state, wtProfile: '{00000000-0000-0000-0000-000000000002}' })
  assert.ok(statSync(table).mtimeMs > 0)
})

test('sync writes an empty but valid table when nothing is installed', () => {
  const home = fixture()
  sync(home, catalog, { terminals: ['ghostty'], palettes: [] })
  const table = readFileSync(join(home, 'ttheme', 'palettes.zsh'), 'utf8')
  assert.match(table, /TTHEME_ORDER=\(\)/)
  assert.doesNotMatch(readFileSync(join(home, 'ghostty', 'config'), 'utf8'), /^theme = /m)
})

test('sync points the terminal at the startup palette once one is installed', () => {
  const home = fixture()
  sync(home, catalog, { terminals: ['ghostty'], palettes: ['gojo'] })
  assert.match(readFileSync(join(home, 'ghostty', 'config'), 'utf8'), /^theme = ttheme-gojo$/m)
})

test('sync leaves the terminal theme alone while ttheme is off', () => {
  const home = fixture()
  sync(home, catalog, { terminals: ['ghostty', 'kitty'], off: true, palettes: ['gojo'] })
  const config = readFileSync(join(home, 'ghostty', 'config'), 'utf8')
  assert.doesNotMatch(config, /^theme = /m)
  assert.match(config, /^config-file = \?.*\/backgrounds\/shown\.conf$/m)
  assert.doesNotMatch(readFileSync(join(home, 'kitty', 'kitty.conf'), 'utf8'), /^include /m)
  assert.ok(existsSync(join(home, 'ghostty', 'themes', 'ttheme-gojo')))
})

test('sync wires WezTerm through a module its config runs, and creates the config when there is none', () => {
  const configHome = fixture()
  const home = fixture()
  sync(configHome, catalog, { terminals: ['wezterm'], palettes: ['gojo'] }, home)
  const module = join(configHome, 'ttheme', 'wezterm.lua')
  assert.ok(existsSync(join(configHome, 'wezterm', 'colors', 'ttheme-gojo.toml')))
  assert.match(readFileSync(module, 'utf8'), /^local STARTUP = "ttheme-gojo"$/m)
  assert.match(readFileSync(module, 'utf8'), /^ {2}\["gojo"\] = "#11191c",$/m)
  const config = readFileSync(join(configHome, 'wezterm', 'wezterm.lua'), 'utf8')
  assert.match(
    config,
    new RegExp(`-- ttheme begin\\ndofile\\("${module}"\\)\\(config\\)\\n-- ttheme end\\n\\nreturn config\\n$`),
  )
})

test('sync wires an existing wezterm.lua before its last return, and leaves one without it alone', () => {
  const configHome = fixture()
  const home = fixture()
  const dotfile = join(home, '.wezterm.lua')
  writeFileSync(dotfile, 'local config = {}\nconfig.font_size = 13\nreturn config\n')
  sync(configHome, catalog, { terminals: ['wezterm'], palettes: ['gojo'] }, home)
  assert.match(readFileSync(dotfile, 'utf8'), /font_size = 13\n-- ttheme begin\n.*\n-- ttheme end\n\nreturn config\n$/)
  assert.ok(!existsSync(join(configHome, 'wezterm', 'wezterm.lua')))

  writeFileSync(dotfile, 'return { font_size = 13 }\n')
  sync(configHome, catalog, { terminals: ['wezterm'], palettes: ['gojo'] }, home)
  assert.equal(readFileSync(dotfile, 'utf8'), 'return { font_size = 13 }\n')
})

test('sync gives Windows Terminal a fragment that dresses the zsh profile, and nudges it to reload', () => {
  const configHome = fixture()
  const wtHome = fixture()
  const settings = join(wtHome, 'Packages', 'Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'LocalState', 'settings.json')
  mkdirSync(join(settings, '..'), { recursive: true })
  writeFileSync(settings, '{\n  // mine\n  "defaultProfile": "{2c4de342-38b7-51cf-b940-2309a097f518}",\n}\n')
  utimesSync(settings, new Date(0), new Date(0))
  sync(configHome, catalog, { terminals: ['windows-terminal'], palettes: ['gojo'], wtHome })
  const fragment = JSON.parse(readFileSync(wtFragmentPath(wtHome), 'utf8'))
  assert.deepEqual(fragment.profiles, [
    { updates: '{2c4de342-38b7-51cf-b940-2309a097f518}', colorScheme: 'ttheme-gojo' },
  ])
  assert.equal(fragment.schemes[0].name, 'ttheme-gojo')
  assert.equal(fragment.schemes[0].brightPurple, '#808080')
  assert.ok(statSync(settings).mtimeMs > 0)

  sync(configHome, catalog, {
    terminals: ['windows-terminal'],
    palettes: ['gojo'],
    off: true,
    wtHome,
    wtProfile: '{00000000-0000-0000-0000-000000000001}',
  })
  assert.equal(JSON.parse(readFileSync(wtFragmentPath(wtHome), 'utf8')).profiles, undefined)
})

test('sync drops Warp themes into its themes folder and wires nothing else', () => {
  const configHome = fixture()
  const home = fixture()
  const written = sync(configHome, catalog, { terminals: ['warp'], palettes: ['gojo'] }, home)
  const theme = readFileSync(join(warpThemes(home), 'ttheme-gojo.yaml'), 'utf8')
  assert.match(theme, /^background: "#11191c"$/m)
  assert.match(theme, /^details: darker$/m)
  assert.deepEqual(written, [join(warpThemes(home), 'ttheme-gojo.yaml'), join(configHome, 'ttheme', 'palettes.zsh')])
})

test('sync puts the startup palette on Warp through its settings file, and gives the old theme back while off', () => {
  const configHome = fixture()
  const home = fixture()
  sync(configHome, catalog, { terminals: ['warp'], palettes: ['gojo', 'geto'] }, home)
  const settings = warpSettings(home, configHome)
  mkdirSync(join(settings, '..'), { recursive: true })
  const mine = '[appearance]\n\n[appearance.themes]\ntheme = "Dracula"\n\n[appearance.vertical_tabs]\nenabled = true\n'
  writeFileSync(settings, mine)
  sync(configHome, catalog, { terminals: ['warp'], palettes: ['gojo'] }, home)
  assert.match(
    readFileSync(settings, 'utf8'),
    /^\[appearance\.themes\]\ntheme = \{ custom = \{ name = "gojo", path = "ttheme-gojo\.yaml" \} \}\n\n\[appearance\.vertical_tabs\]/m,
  )
  sync(configHome, catalog, { terminals: ['warp'], palettes: ['gojo', 'geto'], startup: 'geto' }, home)
  assert.match(readFileSync(settings, 'utf8'), /name = "geto"/)
  sync(configHome, catalog, { terminals: ['warp'], palettes: ['gojo'], off: true }, home)
  assert.equal(readFileSync(settings, 'utf8'), mine)
})

test('sync adds the Warp theme table when there is none, gives Warp its default back while off, and leaves Warp alone without a settings file', () => {
  const configHome = fixture()
  const home = fixture()
  sync(configHome, catalog, { terminals: ['warp'], palettes: ['gojo'] }, home)
  assert.ok(!existsSync(warpSettings(home, configHome)))
  const settings = warpSettings(home, configHome)
  mkdirSync(join(settings, '..'), { recursive: true })
  writeFileSync(settings, '[general]\ndefault_session_mode = "agent"\n')
  sync(configHome, catalog, { terminals: ['warp'], palettes: ['gojo'] }, home)
  assert.match(
    readFileSync(settings, 'utf8'),
    /^default_session_mode = "agent"\n\n\[appearance\.themes\]\ntheme = \{ custom/m,
  )
  sync(configHome, catalog, { terminals: ['warp'], palettes: ['gojo'], off: true }, home)
  assert.match(readFileSync(settings, 'utf8'), /^theme = "dark"$/m)
})

function pictured(configHome: string, opacity: number): void {
  const dir = join(configHome, 'ttheme', 'backgrounds')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'gojo.conf'), `background-image = gojo@fill-40.png\nbackground-image-opacity = ${opacity}\n`)
  writeFileSync(
    join(dir, 'gojo@fill-40.png'),
    encodeRgba({ width: 2, height: 1, data: new Uint8Array([255, 255, 255, 255, 255, 255, 255, 0]) }),
  )
}

function picturedThemes(home: string): string[] {
  return readdirSync(warpThemes(home)).filter((file) => /^ttheme-gojo\.[0-9a-f]{8}\.yaml$/.test(file))
}

test("sync gives a palette's Warp theme its picture under a name of its own, and Warp wears that one", () => {
  const configHome = fixture()
  const home = fixture()
  pictured(configHome, 0.2)
  const state: Installed = { terminals: ['warp'], palettes: ['gojo', 'geto'] }
  sync(configHome, catalog, state, home)
  const themes = warpThemes(home)
  const first = picturedThemes(home)
  assert.equal(first.length, 1)
  const theme = readFileSync(join(themes, first[0] as string), 'utf8')
  const flat = /^ {2}path: "(.+)"$/m.exec(theme)?.[1] ?? ''
  assert.match(flat, new RegExp(`^${themes}/ttheme-gojo\\.[0-9a-f]{8}\\.png$`))
  assert.match(theme, /^background_image:\n {2}path: ".+"\n {2}opacity: 20$/m)
  assert.deepEqual([...decodePng(readFileSync(flat)).data], [255, 255, 255, 255, 17, 25, 28, 255])
  assert.doesNotMatch(readFileSync(join(themes, 'ttheme-gojo.yaml'), 'utf8'), /background_image/)
  assert.ok(!readdirSync(themes).some((file) => file.startsWith('ttheme-geto.') && file !== 'ttheme-geto.yaml'))
  const settings = warpSettings(home, configHome)
  mkdirSync(join(settings, '..'), { recursive: true })
  writeFileSync(settings, '[appearance.themes]\ntheme = "Dracula"\n')
  sync(configHome, catalog, state, home)
  assert.match(readFileSync(settings, 'utf8'), new RegExp(`path = "${first[0]?.replace(/\./g, '\\.')}"`))
  pictured(configHome, 0.5)
  sync(configHome, catalog, state, home)
  assert.match(readFileSync(settings, 'utf8'), new RegExp(`path = "${first[0]?.replace(/\./g, '\\.')}"`))
  sync(configHome, catalog, state, home)
  sync(configHome, catalog, state, home)
  const now = picturedThemes(home)
  assert.deepEqual(now.length, 1)
  assert.notEqual(now[0], first[0])
  assert.match(readFileSync(settings, 'utf8'), new RegExp(`path = "${now[0]?.replace(/\./g, '\\.')}"`))
  const again = readFileSync(join(themes, now[0] as string), 'utf8')
  assert.match(again, new RegExp(`^ {2}path: "${flat}"\\n {2}opacity: 50$`, 'm'))
  assert.deepEqual(
    readdirSync(themes).filter((file) => file.endsWith('.png')),
    [flat.slice(themes.length + 1)],
  )
})

test('Warp wears the plain theme of a palette whose picture cannot be read', () => {
  const configHome = fixture()
  const home = fixture()
  const dir = join(configHome, 'ttheme', 'backgrounds')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'geto.conf'), 'background-image = geto@fill-40.png\n')
  const settings = warpSettings(home, configHome)
  mkdirSync(join(settings, '..'), { recursive: true })
  writeFileSync(settings, '[appearance.themes]\ntheme = "Dracula"\n')
  const state: Installed = { terminals: ['warp'], palettes: ['gojo', 'geto'], startup: 'geto' }
  sync(configHome, catalog, state, home)
  sync(configHome, catalog, state, home)
  assert.match(readFileSync(settings, 'utf8'), /name = "geto", path = "ttheme-geto\.yaml"/)
  assert.deepEqual(
    readdirSync(warpThemes(home)).filter((file) => file.startsWith('ttheme-geto.')),
    ['ttheme-geto.yaml'],
  )
})

test('a picture changed anywhere moves Warp to the new pictured theme only while Warp wears that palette', () => {
  const configHome = fixture()
  const home = fixture()
  pictured(configHome, 0.2)
  const state: Installed = { terminals: ['warp'], palettes: ['gojo', 'geto'] }
  writeCatalog(configHome, catalog)
  writeInstalled(configHome, state)
  sync(configHome, catalog, state, home)
  const settings = warpSettings(home, configHome)
  mkdirSync(join(settings, '..'), { recursive: true })
  const mine = '[appearance.themes]\ntheme = "Dracula"\n'
  writeFileSync(settings, mine)
  pictured(configHome, 0.4)
  refreshPictures(configHome, home)
  refreshPictures(configHome, home)
  assert.equal(readFileSync(settings, 'utf8'), mine)
  writeFileSync(settings, `[appearance.themes]\ntheme = ${warpThemeValue('geto')}\n`)
  pictured(configHome, 0.3)
  refreshPictures(configHome, home)
  refreshPictures(configHome, home)
  assert.match(readFileSync(settings, 'utf8'), /path = "ttheme-geto\.yaml"/)
  const gone = `[appearance.themes]\ntheme = ${warpThemeValue('kaito', 'ttheme-kaito.0123abcd.yaml')}\n`
  writeFileSync(settings, gone)
  refreshPictures(configHome, home)
  assert.equal(readFileSync(settings, 'utf8'), gone)
  writeFileSync(settings, `[appearance.themes]\ntheme = ${warpThemeValue('gojo')}\n`)
  refreshPictures(configHome, home)
  const now = picturedThemes(home)
  assert.equal(now.length, 1)
  assert.match(readFileSync(settings, 'utf8'), new RegExp(`name = "gojo", path = "${now[0]?.replace(/\./g, '\\.')}"`))
  assert.match(readFileSync(join(warpThemes(home), now[0] as string), 'utf8'), /^ {2}opacity: 30$/m)
})

test('the shell names a laid Warp picture as the CLI does, so preview draws straight into the file a save shows', () => {
  const layer = readFileSync(join(import.meta.dirname, '..', 'shell', 'adapters', 'warp.zsh'), 'utf8')
  const from = layer.indexOf('__tt_warp_laid() {')
  const laid = layer.slice(from, layer.indexOf('\n}\n', from) + 2)
  const cases: [string, string, string][] = [
    ['asuka', '/Users/kdh/.config/ttheme/backgrounds/asuka.6fc048f5@115-center-right-2912x2040.png', '#211513'],
    [
      'kecan@market/miku',
      '/home/사용자/.config/ttheme/backgrounds/kecan--market--miku.0a1b2c3d@fill-40.png',
      '#2A1B3C',
    ],
  ]
  const shell = spawnSync(
    'zsh',
    [
      '-f',
      '-c',
      `typeset -A TTHEME_PALETTE; TTHEME_WARP_THEMES=/t\n${laid}\nwhile read -r pal bg img; do TTHEME_PALETTE[$pal]="$bg #ffffff"; __tt_warp_laid $pal $img; print -r -- $REPLY; done`,
    ],
    { input: `${cases.map(([pal, image, bg]) => `${pal} ${bg} ${image}`).join('\n')}\n`, encoding: 'utf8' },
  )
  assert.deepEqual(
    shell.stdout.trimEnd().split('\n'),
    cases.map(([pal, image, bg]) => `/t/${warpPictureFile(pal, image, bg)}`),
  )
})

test('sync writes an iTerm2 profile per listed palette, in P3 with one color set for both modes', () => {
  const configHome = fixture()
  const home = fixture()
  const profiles = itermProfilesPath(home)
  const read = () => JSON.parse(readFileSync(profiles, 'utf8')).Profiles
  sync(
    configHome,
    catalog,
    { terminals: ['iterm2'], startup: 'geto', itermBase: 'BASE', palettes: ['neutral', 'gojo', 'geto'] },
    home,
  )
  const written = read()
  const gojo = written[1]
  assert.ok(written.every((p: Record<string, unknown>) => p['Dynamic Profile Parent GUID'] === 'BASE'))
  assert.deepEqual(
    written.map((p: { Name: string; Guid: string }) => [p.Name, p.Guid]),
    [
      ['ttheme · default', 'ttheme-default'],
      ['ttheme · gojo', 'ttheme-gojo'],
      ['ttheme · geto', 'ttheme-geto'],
    ],
  )
  assert.deepEqual({ ...written[0], Name: 0, Guid: 0 }, { ...written[2], Name: 0, Guid: 0 })
  assert.match(readFileSync(join(configHome, 'ttheme', 'palettes.zsh'), 'utf8'), /^typeset -g TTHEME_STARTUP=geto$/m)
  assert.equal(gojo['Use Separate Colors for Light and Dark Mode'], false)
  assert.equal('Harmonize 256 Colors' in gojo, false)
  assert.equal(gojo['Background Image Location'], '')
  assert.deepEqual(gojo['Background Color'], {
    'Alpha Component': 1,
    'Blue Component': 0x1c / 255,
    'Color Space': 'P3',
    'Green Component': 0x19 / 255,
    'Red Component': 0x11 / 255,
  })
  sync(configHome, catalog, { terminals: ['iterm2'], off: true, itermBase: 'BASE', palettes: ['gojo'] }, home)
  assert.deepEqual(
    read().map((p: { Name: string }) => p.Name),
    ['ttheme · default', 'ttheme · gojo'],
  )
  assert.deepEqual(read()[0], {
    Name: 'ttheme · default',
    Guid: 'ttheme-default',
    'Dynamic Profile Parent GUID': 'BASE',
    'Background Image Location': '',
  })
  sync(configHome, catalog, { terminals: ['iterm2'], off: true, palettes: ['gojo'] }, home)
  assert.deepEqual(
    read().map((p: { Name: string }) => p.Name),
    ['ttheme · gojo'],
  )
  assert.ok(!existsSync(join(configHome, 'iterm2')))
})

test("sync gives a palette's iTerm2 profile its picture, tuning and off switch", () => {
  const configHome = fixture()
  const home = fixture()
  const dir = join(configHome, 'ttheme', 'backgrounds')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'gojo.conf'),
    'background-image = gojo@fill-40.png\nbackground-image-fit = cover\nbackground-image-opacity = 0.2\nconfig-file = ?gojo.tune.conf\n',
  )
  writeFileSync(
    join(dir, 'gojo.tune.conf'),
    'background-image = ~/gojo@60-center.png\nbackground-image-fit = contain\n',
  )
  writeFileSync(join(dir, 'geto.conf'), `background-image = ${join(dir, 'geto.png')}\nconfig-file = ?geto.off.conf\n`)
  writeFileSync(join(dir, 'geto.off.conf'), 'background-image =\n')
  sync(configHome, catalog, { terminals: ['iterm2'], palettes: ['gojo', 'geto'] }, home)
  const pick = ({ Name, ...p }: Record<string, unknown>) => [
    Name,
    p['Background Image Location'],
    p['Background Image Mode'],
    p.Blend,
  ]
  assert.deepEqual(JSON.parse(readFileSync(itermProfilesPath(home), 'utf8')).Profiles.map(pick), [
    ['ttheme · default', join(home, 'gojo@60-center.png'), 3, 0.2],
    ['ttheme · gojo', join(home, 'gojo@60-center.png'), 3, 0.2],
    ['ttheme · geto', '', undefined, undefined],
  ])
})

test('startupPalette keeps an explicit choice and falls to the first otherwise', () => {
  assert.equal(startupPalette({ terminals: [], startup: 'geto', palettes: ['gojo', 'geto'] }), 'geto')
  assert.equal(startupPalette({ terminals: [], startup: 'gone', palettes: ['gojo'] }), 'gojo')
  assert.equal(startupPalette({ terminals: [], palettes: [] }), undefined)
})

test('forget removes only the named palettes', () => {
  const home = fixture()
  sync(home, catalog, { terminals: ['ghostty'], palettes: ['neutral', 'gojo', 'geto'] })
  const removed = forget(home, catalog, ['ghostty'], ['geto'])
  assert.deepEqual(removed, [join(home, 'ghostty', 'themes', 'ttheme-geto')])
  assert.ok(existsSync(join(home, 'ghostty', 'themes', 'ttheme-gojo')))
  assert.ok(!existsSync(join(home, 'ghostty', 'themes', 'ttheme-geto')))
})

function defaultsAt(initial: string | undefined): { host: Host; writes: string[] } {
  let value = initial
  const writes: string[] = []
  return {
    host: {
      platform: 'darwin',
      env: {},
      run: (command, args) => {
        if (command === 'defaults' && args[0] === 'read') {
          return value
        }
        if (command === 'defaults' && args[0] === 'write') {
          value = args[4]
          writes.push(args[4] ?? '')
          return ''
        }
        return undefined
      },
    },
    writes,
  }
}

test('iTerm2 takes ttheme · default as its default profile, keeps it while off and gives the one it replaced back once nothing is installed', () => {
  const { host, writes } = defaultsAt('USER')
  const state = withBases('/nowhere', { terminals: ['iterm2'], palettes: ['gojo'] }, host)
  assert.equal(state.itermBase, 'USER')
  assert.ok(pointDefaults('/nowhere', state, true, host).has('iterm2'))
  assert.ok(!pointDefaults('/nowhere', state, true, host).has('iterm2'))
  assert.equal(withBases('/nowhere', state, host).itermBase, 'USER')
  assert.ok(!pointDefaults('/nowhere', { ...state, off: true }, false, host).has('iterm2'))
  assert.ok(pointDefaults('/nowhere', { ...state, palettes: [] }, false, host).has('iterm2'))
  assert.deepEqual(writes, ['ttheme-default', 'USER'])
})

test('iTerm2 keeps its default profile when nothing is worn, it is not wired, or the user picked one ttheme did not take', () => {
  const { host, writes } = defaultsAt('USER')
  assert.equal(pointDefaults('/nowhere', { terminals: ['iterm2'], palettes: [] }, false, host).size, 0)
  assert.equal(pointDefaults('/nowhere', { terminals: ['ghostty'], palettes: ['gojo'] }, true, host).size, 0)
  assert.equal(pointDefaults('/nowhere', { terminals: ['iterm2'], palettes: ['gojo'] }, false, host).size, 0)
  assert.equal(
    withBases('/nowhere', { terminals: ['iterm2'], palettes: ['gojo'] }, defaultsAt('ttheme-gojo').host).itermBase,
    undefined,
  )
  assert.deepEqual(writes, [])
})

test('a palette that leaves the catalog keeps working from the copy the last sync kept', () => {
  const home = fixture()
  sync(home, catalog, { terminals: ['ghostty'], palettes: ['gojo', 'geto'] })
  const without: Manifest = { ...catalog, palettes: catalog.palettes.filter((p) => p.name !== 'geto') }
  sync(home, without, { terminals: ['ghostty'], palettes: ['gojo', 'geto'] })
  assert.match(readFileSync(join(home, 'ttheme', 'palettes.zsh'), 'utf8'), /TTHEME_ORDER=\(gojo geto\)/)
})

test("a market's palette gets theme files and a startup line with -- for the @ and the /", () => {
  const home = fixture()
  const shared: Manifest = { ...catalog, palettes: [...catalog.palettes, entry('kec@dust/rei', 2, { base: 'gojo' })] }
  sync(home, shared, { terminals: ['ghostty', 'kitty'], palettes: ['kec@dust/rei'] })
  assert.ok(existsSync(join(home, 'ghostty', 'themes', 'ttheme-kec--dust--rei')))
  assert.ok(existsSync(join(home, 'kitty', 'themes', 'ttheme-kec--dust--rei.conf')))
  assert.match(readFileSync(join(home, 'ghostty', 'config'), 'utf8'), /^theme = ttheme-kec--dust--rei$/m)
  assert.match(readFileSync(join(home, 'ttheme', 'palettes.zsh'), 'utf8'), /TTHEME_ORDER=\(kec@dust\/rei\)/)
})

test('installed.json keeps every field it holds through a write and a read', () => {
  const home = fixture()
  const state: Required<Installed> = {
    terminals: ['ghostty', 'iterm2', 'windows-terminal'],
    author: 'kec',
    startup: 'gojo',
    off: true,
    itermBase: 'A1B2C3',
    konsoleBase: 'Mine.profile',
    wtHome: '/mnt/c/Users/kec/AppData/Local',
    wtProfile: '{61c54bbd-c2c6-5271-96e7-009a87ff44bf}',
    markets: ['official', 'alice/pastel#v1'],
    updates: { 'alice/pastel#v1': true, official: false },
    palettes: ['gojo', 'alice@pastel/dusk'],
  }
  writeInstalled(home, state)
  assert.deepEqual(readInstalled(home), state)
})
