import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { commit, sync, wiringNext, wiringPlan } from '../cli/sync.ts'
import { applyUninstall, planUninstall } from '../cli/uninstall.ts'
import { type Manifest, type PaletteEntry, toTheme } from '../core/manifest.ts'
import { backupPath } from '../store/edits.ts'
import type { Host } from '../store/host.ts'
import { type Installed, writeInstalled } from '../store/installed.ts'
import { konsoleScheme } from './emit/konsole.ts'
import { baseLook, iniValue, konsole, konsoleData, konsoleProfile, konsolerc, withDefaultProfile } from './konsole.ts'

function entry(name: string, partial: Partial<PaletteEntry> = {}): PaletteEntry {
  return {
    name,
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

const manifest: Manifest = {
  version: '0.1.0',
  gate: [],
  works: [],
  palettes: [entry('neutral'), entry('orla', { cursor: '#ff0000' }), entry('juno'), entry('kai@dust/fern')],
}

function fixture() {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-konsole-'))

  return { configHome: join(home, '.config'), home }
}

function put(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, content)
}

const nobody: Host = { platform: 'linux', env: {}, run: () => undefined }

function bus(konsoles: { service: string; loaded: string[] }[]) {
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
  const theme = toTheme(entry('orla'))
  const scheme = konsoleScheme(theme)
  const groups = [...scheme.matchAll(/^\[(\w+)\]$/gm)].map(([, group]) => group)
  assert.equal(new Set(groups).size, 31)
  assert.equal(iniValue(scheme, 'Background', 'Color'), '17,25,28')
  assert.equal(iniValue(scheme, 'Color1', 'Color'), '16,128,128')
  assert.equal(iniValue(scheme, 'Color1Intense', 'Color'), '144,128,128')
  assert.equal(iniValue(scheme, 'Color1Faint', 'Color'), '17,77,78')
  assert.equal(iniValue(scheme, 'ForegroundIntense', 'Color'), '227,226,231')
  assert.equal(iniValue(scheme, 'General', 'Description'), 'ttheme · orla')
  assert.equal(iniValue(scheme, 'General', 'Wallpaper'), '')
  const pictured = konsoleScheme(theme, { image: '/p/orla.png', opacity: 0.3, cover: true, position: 'top-right' })
  assert.equal(iniValue(pictured, 'General', 'Wallpaper'), '/p/orla.png')
  assert.equal(iniValue(pictured, 'General', 'FillStyle'), 'Crop')
  assert.equal(iniValue(pictured, 'General', 'Anchor'), '1,0')
  assert.equal(iniValue(pictured, 'General', 'WallpaperOpacity'), '0.3')
  const contained = konsoleScheme(theme, { image: '/p/orla.png', opacity: 0.3, cover: false, position: 'center' })
  assert.equal(iniValue(contained, 'General', 'FillStyle'), 'Adapt')
  assert.equal(iniValue(contained, 'General', 'Anchor'), '0.5,0.5')
  const hidden = konsoleScheme(theme, { image: '/p/orla.png', opacity: 0, cover: true, position: 'center' })
  assert.equal(iniValue(hidden, 'General', 'Wallpaper'), '')
})

test('sync gives every installed palette a profile on top of the user’s own, and drops the rest', () => {
  const { configHome, home } = fixture()

  const state: Installed = {
    terminals: ['konsole'],
    palettes: ['neutral', 'orla', 'juno', 'kai@dust/fern'],
    konsoleBase: 'Mine.profile',
  }

  sync(configHome, manifest, state, home)
  const dir = konsoleData(home)
  const versioned = (file: string) => /\.[0-9a-f]{8}\.colorscheme$/.test(file)
  assert.deepEqual(
    readdirSync(dir)
      .filter((file) => !versioned(file))
      .sort(),
    [
      'ttheme-juno.colorscheme',
      'ttheme-juno.profile',
      'ttheme-kai--dust--fern.colorscheme',
      'ttheme-kai--dust--fern.profile',
      'ttheme-neutral.colorscheme',
      'ttheme-neutral.profile',
      'ttheme-orla.colorscheme',
      'ttheme-orla.profile',
    ],
  )

  for (const stem of ['juno', 'kai--dust--fern', 'neutral', 'orla']) {
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

  const orla = readFileSync(join(dir, 'ttheme-orla.profile'), 'utf8')
  assert.equal(orla, konsoleProfile(toTheme(manifest.palettes[1] as PaletteEntry), 'Mine.profile'))
  assert.equal(iniValue(orla, 'Appearance', 'ColorScheme'), 'ttheme-orla')
  assert.equal(iniValue(orla, 'Cursor Options', 'CustomCursorColor'), '255,0,0')
  assert.equal(iniValue(orla, 'General', 'Name'), 'ttheme · orla')
  assert.equal(iniValue(orla, 'General', 'Parent'), 'Mine.profile')

  sync(configHome, manifest, { ...state, palettes: ['orla'], konsoleBase: undefined }, home)
  assert.ok(!existsSync(join(dir, 'ttheme-juno.profile')))
  assert.ok(!existsSync(join(dir, 'ttheme-neutral.profile')))
  assert.deepEqual(
    readdirSync(dir)
      .filter(versioned)
      .map((file) => file.split('.')[0]),
    ['ttheme-orla'],
  )
  assert.equal(iniValue(readFileSync(join(dir, 'ttheme-orla.profile'), 'utf8'), 'General', 'Parent'), 'FALLBACK/')
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
  const before: Installed = { terminals: ['konsole'], palettes: ['orla', 'juno'], off: true }
  writeInstalled(configHome, before)

  const on = commit(
    configHome,
    manifest,
    before,
    { terminals: ['konsole'], palettes: ['orla', 'juno'] },
    false,
    nobody,
    home,
  )

  assert.deepEqual([...on], [['konsole', { restart: false }]])
  assert.equal(iniValue(readFileSync(rc, 'utf8'), 'Desktop Entry', 'DefaultProfile'), 'ttheme-orla.profile')
  const state: Installed = { terminals: ['konsole'], palettes: ['orla', 'juno'], konsoleBase: 'Mine.profile' }
  assert.equal(readFileSync(backupPath(rc), 'utf8'), mine)

  commit(configHome, manifest, state, { ...state, startup: 'juno' }, true, nobody, home)
  assert.equal(iniValue(readFileSync(rc, 'utf8'), 'Desktop Entry', 'DefaultProfile'), 'ttheme-juno.profile')

  commit(configHome, manifest, { ...state, startup: 'juno' }, { ...state, palettes: ['orla'] }, false, nobody, home)
  assert.equal(iniValue(readFileSync(rc, 'utf8'), 'Desktop Entry', 'DefaultProfile'), 'ttheme-orla.profile')

  commit(
    configHome,
    manifest,
    { ...state, palettes: ['orla'] },
    { ...state, palettes: ['orla'], off: true },
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
  const state: Installed = { terminals: ['konsole'], palettes: ['orla', 'juno'], konsoleBase: 'Mine.profile' }
  commit(configHome, manifest, state, { ...state, palettes: ['juno'] }, false, nobody, home)
  assert.equal(iniValue(readFileSync(rc, 'utf8'), 'Desktop Entry', 'DefaultProfile'), 'Picked.profile')
  const pointed = commit(configHome, manifest, state, { ...state, startup: 'juno' }, true, nobody, home)
  assert.ok(pointed.has('konsole'))
  assert.equal(iniValue(readFileSync(rc, 'utf8'), 'Desktop Entry', 'DefaultProfile'), 'ttheme-juno.profile')
})

test('every running Konsole takes the new default over D-Bus, and one that cannot yet asks for a restart', () => {
  const { configHome, home } = fixture()
  const state: Installed = { terminals: ['konsole'], palettes: ['orla', 'juno'], konsoleBase: 'Mine.profile' }

  const live = bus([
    { service: 'org.kde.konsole-8187', loaded: ['ttheme · orla', 'ttheme · juno'] },
    { service: 'org.kde.konsole', loaded: ['ttheme · orla', 'ttheme · juno'] },
  ])

  const took = commit(configHome, manifest, state, { ...state, startup: 'juno' }, true, live.host, home)
  assert.deepEqual([...took], [['konsole', { restart: false }]])
  assert.deepEqual([...live.defaults.values()], ['ttheme · juno', 'ttheme · juno'])

  const stale = bus([{ service: 'org.kde.konsole-9', loaded: ['ttheme · orla'] }])
  assert.deepEqual(
    [...commit(configHome, manifest, state, { ...state, startup: 'juno' }, true, stale.host, home)],
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
  assert.equal(withDefaultProfile('', 'ttheme-orla.profile'), '[Desktop Entry]\nDefaultProfile=ttheme-orla.profile\n')
  assert.equal(withDefaultProfile(withDefaultProfile('', 'ttheme-orla.profile'), undefined), '')
  const theirs = '[General]\nConfigVersion=1\n'
  assert.equal(withDefaultProfile(withDefaultProfile(theirs, 'ttheme-orla.profile'), undefined), theirs)
  const both = '[Desktop Entry]\nDefaultProfile=Mine.profile\nOther=1\n\n[MainWindow]\nState=x\n'
  assert.equal(
    withDefaultProfile(both, 'ttheme-juno.profile'),
    '[Desktop Entry]\nDefaultProfile=ttheme-juno.profile\nOther=1\n\n[MainWindow]\nState=x\n',
  )
  assert.equal(withDefaultProfile(both, undefined), '[Desktop Entry]\nOther=1\n\n[MainWindow]\nState=x\n')
  assert.equal(
    withDefaultProfile('[Desktop Entry]\nDefaultProfile=ttheme-juno.profile\n\n[MainWindow]\nState=x\n', undefined),
    '[MainWindow]\nState=x\n',
  )
})

test('uninstall gives Konsole its own default back and deletes every scheme and profile ttheme wrote', () => {
  const { configHome, home } = fixture()
  const rc = konsolerc(configHome)
  const mine = '[Desktop Entry]\nDefaultProfile=Mine.profile\n'
  put(rc, mine)
  put(join(konsoleData(home), 'Mine.profile'), '[General]\nName=Mine\n')
  const off: Installed = { terminals: ['konsole'], palettes: ['orla'], off: true }
  writeInstalled(configHome, off)
  commit(configHome, manifest, off, { terminals: ['konsole'], palettes: ['orla'] }, false, nobody, home)

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

test('uninstall drops the konsolerc backup that ttheme off already made true again', () => {
  const { configHome, home } = fixture()
  const rc = konsolerc(configHome)
  const mine = '[Desktop Entry]\nDefaultProfile=Mine.profile\n'
  put(rc, mine)
  put(join(konsoleData(home), 'Mine.profile'), '[General]\nName=Mine\n')
  const off: Installed = { terminals: ['konsole'], palettes: ['orla'], off: true }
  writeInstalled(configHome, off)
  commit(configHome, manifest, off, { terminals: ['konsole'], palettes: ['orla'] }, false, nobody, home)
  const on = JSON.parse(readFileSync(join(configHome, 'ttheme', 'installed.json'), 'utf8')) as Installed
  commit(configHome, manifest, on, { ...on, off: true }, false, nobody, home)
  assert.equal(readFileSync(rc, 'utf8'), mine)
  assert.ok(existsSync(backupPath(rc)))

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
})

test('init offers Konsole where it runs, preselects it once it has run, and says what it will change', () => {
  const { configHome, home } = fixture()
  assert.equal(konsole.offered({ configHome, home }, { ...nobody, platform: 'linux' }), true)
  assert.equal(konsole.offered({ configHome, home }, { ...nobody, platform: 'darwin' }), false)
  assert.equal(konsole.present({ configHome, home }), false)
  put(konsolerc(configHome), '')
  assert.equal(konsole.present({ configHome, home }), true)
  const state: Installed = { terminals: ['konsole'], palettes: ['orla'] }
  assert.deepEqual(wiringPlan(configHome, state, home), [
    `Write ${konsoleData(home).replace(home, '~')}/ttheme-* — the palettes' theme files`,
    `Write ${konsoleData(home).replace(home, '~')}/ttheme-*.profile — a "ttheme · <palette>" profile per palette, on top of your own`,
    'Edit ~/.config/konsolerc — DefaultProfile; `ttheme off` puts yours back',
  ])
  assert.deepEqual(wiringNext(configHome, state, new Map([['konsole', { restart: true }]]), home), [
    'Konsole profiles  A "ttheme · <palette>" per palette in its profile list',
    'Restart Konsole   New tabs open on "ttheme · orla"',
  ])
})
