import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { backupPath } from '../edits.ts'
import { konsoleScheme } from '../emit/konsole.ts'
import { type Manifest, type PaletteEntry, SCHEMA, toTheme } from '../manifest.ts'
import { commit, type Installed, sync, wiringNext, wiringPlan, writeInstalled } from '../palettes.ts'
import { applyUninstall, planUninstall } from '../uninstall.ts'
import { baseLook, iniValue, konsole, konsoleData, konsoleProfile, konsolerc, withDefaultProfile } from './konsole.ts'
import type { Host } from './types.ts'

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
    ansi: Array.from({ length: 16 }, (_, i) => `#${(i * 16).toString(16).padStart(2, '0')}8080`),
    gate: [13.8, 6.8, 0.02, 10.4, 4.0],
    backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
    ...partial,
  }
}

const catalog: Manifest = {
  schema: SCHEMA,
  version: '0.1.0',
  gate: [],
  placement: { tall: 1.15, reach: 0.4, widest: 0.95, headroom: 0.04, margin: 0.03, stands: 12 },
  palettes: [
    entry('neutral', 1, { default: true }),
    entry('gojo', 2, { cursor: '#ff0000' }),
    entry('geto', 3),
    entry('kec@dust/fern', 4),
  ],
}

function fixture(): { configHome: string; home: string } {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-konsole-'))
  return { configHome: join(home, '.config'), home }
}

function put(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, content)
}

const nobody: Host = { platform: 'linux', env: {}, run: () => undefined }

function bus(konsoles: { service: string; loaded: string[] }[]): { host: Host; defaults: Map<string, string> } {
  const defaults = new Map<string, string>()
  const host: Host = {
    platform: 'linux',
    env: {},
    run: (command, args) => {
      if (command !== 'dbus-send') {
        return undefined
      }
      const dest = args.find((arg) => arg.startsWith('--dest='))?.slice('--dest='.length)
      const [method = '', value] = args.slice(args.indexOf(`--dest=${dest}`) + 2)
      if (dest === 'org.freedesktop.DBus') {
        return [
          'method return time=1 sender=org.freedesktop.DBus -> destination=:1.20 serial=3 reply_serial=2',
          '   array [',
          '      string "org.freedesktop.DBus"',
          ...konsoles.map((k) => `      string "${k.service}"`),
          '   ]',
        ].join('\n')
      }
      const konsole = konsoles.find((k) => k.service === dest)
      if (!konsole) {
        return undefined
      }
      if (method.endsWith('Introspect')) {
        return 'method return time=1\n   string "<!DOCTYPE node>\n<node>\n  <interface name="x"/>\n  <node name="3"/>\n</node>\n"'
      }
      if (method.endsWith('setDefaultProfile')) {
        const name = value?.slice('string:'.length) ?? ''
        if (konsole.loaded.includes(name)) {
          defaults.set(konsole.service, name)
        }
        return 'method return time=1'
      }
      if (method.endsWith('defaultProfile')) {
        return `method return time=1\n   string "${defaults.get(konsole.service) ?? 'Built-in'}"`
      }
      return undefined
    },
  }
  return { host, defaults }
}

test('a color scheme carries all thirty of Konsole entries: normal, intense from the brights, faint halfway to the background', () => {
  const theme = toTheme(entry('gojo', 2))
  const scheme = konsoleScheme(theme)
  const groups = [...scheme.matchAll(/^\[(\w+)\]$/gm)].map(([, group]) => group)
  assert.equal(new Set(groups).size, 31)
  assert.equal(iniValue(scheme, 'Background', 'Color'), '17,25,28')
  assert.equal(iniValue(scheme, 'Color1', 'Color'), '16,128,128')
  assert.equal(iniValue(scheme, 'Color1Intense', 'Color'), '144,128,128')
  assert.equal(iniValue(scheme, 'Color1Faint', 'Color'), '17,77,78')
  assert.equal(iniValue(scheme, 'ForegroundIntense', 'Color'), '227,226,231')
  assert.equal(iniValue(scheme, 'General', 'Description'), 'ttheme · gojo')
  assert.equal(iniValue(scheme, 'General', 'Wallpaper'), '')
  const pictured = konsoleScheme(theme, { image: '/p/gojo.png', opacity: 0.3, cover: true, position: 'top-right' })
  assert.equal(iniValue(pictured, 'General', 'Wallpaper'), '/p/gojo.png')
  assert.equal(iniValue(pictured, 'General', 'FillStyle'), 'Crop')
  assert.equal(iniValue(pictured, 'General', 'Anchor'), '1,0')
  assert.equal(iniValue(pictured, 'General', 'WallpaperOpacity'), '0.3')
  const contained = konsoleScheme(theme, { image: '/p/gojo.png', opacity: 0.3, cover: false, position: 'center' })
  assert.equal(iniValue(contained, 'General', 'FillStyle'), 'Adapt')
  assert.equal(iniValue(contained, 'General', 'Anchor'), '0.5,0.5')
  const hidden = konsoleScheme(theme, { image: '/p/gojo.png', opacity: 0, cover: true, position: 'center' })
  assert.equal(iniValue(hidden, 'General', 'Wallpaper'), '')
})

test('sync gives every listed palette and the default a profile on top of the user’s own, and drops the rest', () => {
  const { configHome, home } = fixture()
  const state: Installed = {
    terminals: ['konsole'],
    palettes: ['neutral', 'gojo', 'geto', 'kec@dust/fern'],
    konsoleBase: 'Mine.profile',
  }
  sync(configHome, catalog, state, home)
  const dir = konsoleData(home)
  const versioned = (file: string) => /\.[0-9a-f]{8}\.colorscheme$/.test(file)
  assert.deepEqual(
    readdirSync(dir)
      .filter((file) => !versioned(file))
      .sort(),
    [
      'ttheme-geto.colorscheme',
      'ttheme-geto.profile',
      'ttheme-gojo.colorscheme',
      'ttheme-gojo.profile',
      'ttheme-kec--dust--fern.colorscheme',
      'ttheme-kec--dust--fern.profile',
      'ttheme-neutral.colorscheme',
      'ttheme-neutral.profile',
    ],
  )
  for (const stem of ['geto', 'gojo', 'kec--dust--fern', 'neutral']) {
    const [file, ...more] = readdirSync(dir).filter((f) => versioned(f) && f.startsWith(`ttheme-${stem}.`))
    assert.ok(file && more.length === 0, stem)
    assert.equal(readFileSync(join(dir, file), 'utf8'), readFileSync(join(dir, `ttheme-${stem}.colorscheme`), 'utf8'))
    assert.match(
      readFileSync(join(configHome, 'ttheme', 'palettes.zsh'), 'utf8'),
      new RegExp(
        `^typeset -g TTHEME_KONSOLE_SCHEMES='.*\\b${stem} ${file.slice(`ttheme-${stem}.`.length, -'.colorscheme'.length)}\\b`,
        'm',
      ),
    )
  }
  const gojo = readFileSync(join(dir, 'ttheme-gojo.profile'), 'utf8')
  assert.equal(gojo, konsoleProfile(toTheme(catalog.palettes[1] as PaletteEntry), 'Mine.profile'))
  assert.equal(iniValue(gojo, 'Appearance', 'ColorScheme'), 'ttheme-gojo')
  assert.equal(iniValue(gojo, 'Cursor Options', 'CustomCursorColor'), '255,0,0')
  assert.equal(iniValue(gojo, 'General', 'Name'), 'ttheme · gojo')
  assert.equal(iniValue(gojo, 'General', 'Parent'), 'Mine.profile')

  sync(configHome, catalog, { ...state, palettes: ['gojo'], konsoleBase: undefined }, home)
  assert.ok(!existsSync(join(dir, 'ttheme-geto.profile')))
  assert.ok(!existsSync(join(dir, 'ttheme-neutral.profile')))
  assert.deepEqual(
    readdirSync(dir)
      .filter(versioned)
      .map((file) => file.split('.')[0]),
    ['ttheme-gojo'],
  )
  assert.equal(iniValue(readFileSync(join(dir, 'ttheme-gojo.profile'), 'utf8'), 'General', 'Parent'), 'FALLBACK/')
  assert.match(
    readFileSync(join(configHome, 'ttheme', 'palettes.zsh'), 'utf8'),
    /^typeset -g TTHEME_KONSOLE_BASE='ColorScheme=Breeze;UseCustomCursorColor=false'$/m,
  )
})

test('Konsole opens new tabs on the default palette’s profile, follows ttheme default, and gets the user’s own back while off', () => {
  const { configHome, home } = fixture()
  const rc = konsolerc(configHome)
  const mine = '[General]\nConfigVersion=1\n\n[Desktop Entry]\nDefaultProfile=Mine.profile\n'
  put(rc, mine)
  put(join(konsoleData(home), 'Mine.profile'), '[General]\nName=Mine\nParent=FALLBACK/\n')
  const before: Installed = { terminals: ['konsole'], palettes: ['gojo', 'geto'], off: true }
  writeInstalled(configHome, before)
  const on = commit(
    configHome,
    catalog,
    before,
    { terminals: ['konsole'], palettes: ['gojo', 'geto'] },
    false,
    nobody,
    home,
  )
  assert.deepEqual([...on], [['konsole', { restart: false }]])
  assert.equal(iniValue(readFileSync(rc, 'utf8'), 'Desktop Entry', 'DefaultProfile'), 'ttheme-gojo.profile')
  const state: Installed = { terminals: ['konsole'], palettes: ['gojo', 'geto'], konsoleBase: 'Mine.profile' }
  assert.equal(readFileSync(backupPath(rc), 'utf8'), mine)

  commit(configHome, catalog, state, { ...state, startup: 'geto' }, true, nobody, home)
  assert.equal(iniValue(readFileSync(rc, 'utf8'), 'Desktop Entry', 'DefaultProfile'), 'ttheme-geto.profile')

  commit(configHome, catalog, { ...state, startup: 'geto' }, { ...state, palettes: ['gojo'] }, false, nobody, home)
  assert.equal(iniValue(readFileSync(rc, 'utf8'), 'Desktop Entry', 'DefaultProfile'), 'ttheme-gojo.profile')

  commit(
    configHome,
    catalog,
    { ...state, palettes: ['gojo'] },
    { ...state, palettes: ['gojo'], off: true },
    false,
    nobody,
    home,
  )
  assert.equal(readFileSync(rc, 'utf8'), mine)
})

test('a default the user picks in Konsole stays through an add or remove, and ttheme default takes it back', () => {
  const { configHome, home } = fixture()
  const rc = konsolerc(configHome)
  put(rc, '[Desktop Entry]\nDefaultProfile=Picked.profile\n')
  const state: Installed = { terminals: ['konsole'], palettes: ['gojo', 'geto'], konsoleBase: 'Mine.profile' }
  commit(configHome, catalog, state, { ...state, palettes: ['geto'] }, false, nobody, home)
  assert.equal(iniValue(readFileSync(rc, 'utf8'), 'Desktop Entry', 'DefaultProfile'), 'Picked.profile')
  const pointed = commit(configHome, catalog, state, { ...state, startup: 'geto' }, true, nobody, home)
  assert.ok(pointed.has('konsole'))
  assert.equal(iniValue(readFileSync(rc, 'utf8'), 'Desktop Entry', 'DefaultProfile'), 'ttheme-geto.profile')
})

test('every running Konsole takes the new default over D-Bus, and one that cannot yet asks for a restart', () => {
  const { configHome, home } = fixture()
  const state: Installed = { terminals: ['konsole'], palettes: ['gojo', 'geto'], konsoleBase: 'Mine.profile' }
  const live = bus([
    { service: 'org.kde.konsole-8187', loaded: ['ttheme · gojo', 'ttheme · geto'] },
    { service: 'org.kde.konsole', loaded: ['ttheme · gojo', 'ttheme · geto'] },
  ])
  const took = commit(configHome, catalog, state, { ...state, startup: 'geto' }, true, live.host, home)
  assert.deepEqual([...took], [['konsole', { restart: false }]])
  assert.deepEqual([...live.defaults.values()], ['ttheme · geto', 'ttheme · geto'])

  const stale = bus([{ service: 'org.kde.konsole-9', loaded: ['ttheme · gojo'] }])
  assert.deepEqual(
    [...commit(configHome, catalog, state, { ...state, startup: 'geto' }, true, stale.host, home)],
    [['konsole', { restart: true }]],
  )
})

test('a Konsole reset while off wears the user’s own profile, its scheme and cursor read through its parents', () => {
  const { home } = fixture()
  const dir = konsoleData(home)
  put(join(dir, 'Base.profile'), '[Appearance]\nColorScheme=Solarized\n\n[General]\nName=Base\nParent=FALLBACK/\n')
  put(
    join(dir, 'Mine.profile'),
    '[Cursor Options]\nCustomCursorColor=255,128,0\nUseCustomCursorColor=true\n\n[General]\nName=Mine\nParent=Base.profile\n',
  )
  const at = { configHome: join(home, '.config'), home }
  assert.equal(
    baseLook(at, 'Mine.profile'),
    'ColorScheme=Solarized;UseCustomCursorColor=true;customCursorColor=#ff8000',
  )
  assert.equal(baseLook(at, 'Base.profile'), 'ColorScheme=Solarized;UseCustomCursorColor=false')
  assert.equal(baseLook(at, undefined), 'ColorScheme=Breeze;UseCustomCursorColor=false')
  assert.equal(baseLook(at, 'Gone.profile'), 'ColorScheme=Breeze;UseCustomCursorColor=false')
})

test('DefaultProfile is set, replaced and taken out of konsolerc without touching anything else', () => {
  assert.equal(withDefaultProfile('', 'ttheme-gojo.profile'), '[Desktop Entry]\nDefaultProfile=ttheme-gojo.profile\n')
  assert.equal(withDefaultProfile(withDefaultProfile('', 'ttheme-gojo.profile'), undefined), '')
  const theirs = '[General]\nConfigVersion=1\n'
  assert.equal(withDefaultProfile(withDefaultProfile(theirs, 'ttheme-gojo.profile'), undefined), theirs)
  const both = '[Desktop Entry]\nDefaultProfile=Mine.profile\nOther=1\n\n[MainWindow]\nState=x\n'
  assert.equal(
    withDefaultProfile(both, 'ttheme-geto.profile'),
    '[Desktop Entry]\nDefaultProfile=ttheme-geto.profile\nOther=1\n\n[MainWindow]\nState=x\n',
  )
  assert.equal(withDefaultProfile(both, undefined), '[Desktop Entry]\nOther=1\n\n[MainWindow]\nState=x\n')
  assert.equal(
    withDefaultProfile('[Desktop Entry]\nDefaultProfile=ttheme-geto.profile\n\n[MainWindow]\nState=x\n', undefined),
    '[MainWindow]\nState=x\n',
  )
})

test('uninstall gives Konsole its own default back and deletes every scheme and profile ttheme wrote', () => {
  const { configHome, home } = fixture()
  const rc = konsolerc(configHome)
  const mine = '[Desktop Entry]\nDefaultProfile=Mine.profile\n'
  put(rc, mine)
  put(join(konsoleData(home), 'Mine.profile'), '[General]\nName=Mine\n')
  const off: Installed = { terminals: ['konsole'], palettes: ['gojo'], off: true }
  writeInstalled(configHome, off)
  commit(configHome, catalog, off, { terminals: ['konsole'], palettes: ['gojo'] }, false, nobody, home)
  const paths = {
    home,
    configHome,
    zdotdir: home,
    cacheDir: join(home, '.cache', 'ttheme'),
    stateDir: join(home, '.local', 'state', 'ttheme'),
  }
  applyUninstall(planUninstall(paths), paths, nobody)
  assert.equal(readFileSync(rc, 'utf8'), mine)
  assert.ok(!existsSync(backupPath(rc)))
  assert.deepEqual(readdirSync(konsoleData(home)), ['Mine.profile'])
})

test('init offers Konsole where it runs, preselects it once it has run, and says what it will change', () => {
  const { configHome, home } = fixture()
  assert.equal(konsole.offered({ configHome, home }, { ...nobody, platform: 'linux' }), true)
  assert.equal(konsole.offered({ configHome, home }, { ...nobody, platform: 'darwin' }), false)
  assert.equal(konsole.present({ configHome, home }), false)
  put(konsolerc(configHome), '')
  assert.equal(konsole.present({ configHome, home }), true)
  const state: Installed = { terminals: ['konsole'], palettes: ['gojo'] }
  assert.deepEqual(wiringPlan(configHome, state, home), [
    `Write ${konsoleData(home).replace(home, '~')}/ttheme-* — a theme file per palette`,
    `Write ${konsoleData(home).replace(home, '~')}/ttheme-*.profile — a "ttheme · <palette>" profile per palette, on top of your own`,
    'Edit ~/.config/konsolerc — DefaultProfile; `ttheme off` puts yours back',
  ])
  assert.deepEqual(wiringNext(configHome, state, new Map([['konsole', { restart: true }]]), home), [
    'Konsole profiles  A "ttheme · <palette>" per palette in its profile list',
    'Restart Konsole   New tabs open on "ttheme · gojo"',
  ])
})
