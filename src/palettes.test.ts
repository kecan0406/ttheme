import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import type { Manifest, PaletteEntry } from './emit/manifest.ts'
import {
  forget,
  type ItermDefaults,
  itermProfilesPath,
  pointItermDefault,
  resolve,
  startupPalette,
  sync,
  toTheme,
  warpSettings,
  warpThemes,
  withItermBase,
  wtFragmentPath,
} from './palettes.ts'

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
  font: { family: 'JetBrainsMono Nerd Font', size: 14, codepointMap: [] },
  shader: 'cursor_tail.glsl',
  palettes: [entry('neutral', 1, { default: true }), entry('gojo', 2), entry('geto', 3)],
}

function fixture(): string {
  return mkdtempSync(join(tmpdir(), 'ttheme-palettes-'))
}

test('toTheme derives the ghostty icon colors from the palette', () => {
  const theme = toTheme(entry('gojo', 2), catalog)
  assert.equal(theme.ghostty.iconGhost, '#7cc1d6')
  assert.deepEqual(theme.ghostty.iconScreen, ['#7cc1d6', '#383b5b', '#11191c'])
  assert.equal(theme.ghostty.shader, 'cursor_tail.glsl')
  assert.equal(theme.selectionBackground, '#383b5b')
})

test('toTheme carries the default role through as a role, not a flag', () => {
  assert.equal(toTheme(entry('neutral', 1, { default: true }), catalog).role, 'default')
  assert.equal(toTheme(entry('gojo', 2), catalog).role, undefined)
})

test('resolve rejects a name the catalog does not carry', () => {
  assert.throws(() => resolve(catalog, ['gojo', 'nobody']), /not in the catalog: nobody/)
})

test('resolve rejects a palette that fails the contrast gate', () => {
  const failing: Manifest = { ...catalog, palettes: [entry('dim', 4, { gate: [2, 1, 0.9, 2, 0.5] })] }
  assert.throws(() => resolve(failing, ['dim']), /fail the contrast gate/)
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
  assert.ok(existsSync(join(home, 'ghostty', 'themes', 'gojo')))
  assert.ok(existsSync(join(home, 'kitty', 'themes', 'gojo.conf')))
  assert.ok(existsSync(join(home, 'ttheme', 'palettes.zsh')))
  assert.ok(written.includes(join(home, 'ghostty', 'config')))
  assert.ok(written.includes(join(home, 'kitty', 'kitty.conf')))

  const table = readFileSync(join(home, 'ttheme', 'palettes.zsh'), 'utf8')
  assert.match(table, /TTHEME_ORDER=\(gojo\)/)
  assert.match(table, /^typeset -ga TTHEME_TERMINALS=\(ghostty kitty\)$/m)
  assert.doesNotMatch(table, /geto/)
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
  assert.match(readFileSync(join(home, 'ghostty', 'config'), 'utf8'), /^theme = gojo$/m)
})

test('sync leaves the terminal theme alone while ttheme is off', () => {
  const home = fixture()
  sync(home, catalog, { terminals: ['ghostty', 'kitty'], off: true, palettes: ['gojo'] })
  const config = readFileSync(join(home, 'ghostty', 'config'), 'utf8')
  assert.doesNotMatch(config, /^theme = /m)
  assert.match(config, /^config-file = \?.*\/backgrounds\/shown\.conf$/m)
  assert.doesNotMatch(readFileSync(join(home, 'kitty', 'kitty.conf'), 'utf8'), /^include /m)
  assert.ok(existsSync(join(home, 'ghostty', 'themes', 'gojo')))
})

test('sync wires WezTerm through a module its config runs, and creates the config when there is none', () => {
  const configHome = fixture()
  const home = fixture()
  sync(configHome, catalog, { terminals: ['wezterm'], palettes: ['gojo'] }, home)
  const module = join(configHome, 'ttheme', 'wezterm.lua')
  assert.ok(existsSync(join(configHome, 'wezterm', 'colors', 'gojo.toml')))
  assert.match(readFileSync(module, 'utf8'), /^local STARTUP = "gojo"$/m)
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
  assert.deepEqual(fragment.profiles, [{ updates: '{2c4de342-38b7-51cf-b940-2309a097f518}', colorScheme: 'gojo' }])
  assert.equal(fragment.schemes[0].name, 'gojo')
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
  assert.equal(gojo['Harmonize 256 Colors'], true)
  assert.equal(gojo['Background Image Location'], '')
  assert.deepEqual(gojo['Background Color'], {
    'Alpha Component': 1,
    'Blue Component': 0x1c / 255,
    'Color Space': 'P3',
    'Green Component': 0x19 / 255,
    'Red Component': 0x11 / 255,
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
    'background-image = gojo@fill-40.png\nbackground-image-fit = cover\nbackground-image-opacity = 0.2\n',
  )
  writeFileSync(
    join(dir, 'gojo.tune.conf'),
    'background-image = ~/gojo@60-center.png\nbackground-image-fit = contain\n',
  )
  writeFileSync(join(dir, 'geto.conf'), `background-image = ${join(dir, 'geto.png')}\n`)
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
  assert.deepEqual(removed, [join(home, 'ghostty', 'themes', 'geto')])
  assert.ok(existsSync(join(home, 'ghostty', 'themes', 'gojo')))
  assert.ok(!existsSync(join(home, 'ghostty', 'themes', 'geto')))
})

function prefsAt(initial: string | undefined): { prefs: ItermDefaults; writes: string[] } {
  let value = initial
  const writes: string[] = []
  return {
    prefs: {
      read: () => value,
      write: (guid) => {
        value = guid
        writes.push(guid)
      },
      running: () => false,
    },
    writes,
  }
}

test('iTerm2 takes ttheme · default as its default profile and gives the one it replaced back while off', () => {
  const { prefs, writes } = prefsAt('USER')
  const state = withItermBase({ terminals: ['iterm2'], palettes: ['gojo'] }, prefs)
  assert.equal(state.itermBase, 'USER')
  assert.equal(pointItermDefault(state, prefs), true)
  assert.equal(pointItermDefault(state, prefs), false)
  assert.equal(withItermBase(state, prefs).itermBase, 'USER')
  assert.equal(pointItermDefault({ ...state, off: true }, prefs), true)
  assert.deepEqual(writes, ['ttheme-default', 'USER'])
})

test('iTerm2 keeps its default profile when nothing is worn or it is not wired', () => {
  const { prefs, writes } = prefsAt('USER')
  assert.equal(pointItermDefault({ terminals: ['iterm2'], palettes: [] }, prefs), false)
  assert.equal(pointItermDefault({ terminals: ['ghostty'], palettes: ['gojo'] }, prefs), false)
  assert.equal(
    withItermBase({ terminals: ['iterm2'], palettes: ['gojo'] }, prefsAt('ttheme-gojo').prefs).itermBase,
    undefined,
  )
  assert.deepEqual(writes, [])
})
