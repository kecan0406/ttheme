import assert from 'node:assert/strict'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { backupPath } from './edits.ts'
import { type Manifest, type PaletteEntry, SCHEMA } from './manifest.ts'
import { type Installed, sync, writeInstalled } from './palettes.ts'
import type { Host } from './terminals/types.ts'
import { applyUninstall, planUninstall, type UninstallPaths } from './uninstall.ts'

function entry(name: string, order: number): PaletteEntry {
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
  }
}

const catalog: Manifest = {
  schema: SCHEMA,
  version: '0.1.0',
  gate: [],
  palettes: [entry('gojo', 1), entry('geto', 2)],
}

const host: Host = { platform: 'linux', env: {}, run: () => undefined }

function paths(): UninstallPaths {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-uninstall-'))
  return {
    home,
    configHome: join(home, '.config'),
    zdotdir: home,
    cacheDir: join(home, '.cache', 'ttheme'),
    stateDir: join(home, '.local', 'state', 'ttheme'),
  }
}

function put(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, content)
}

function install(p: UninstallPaths, state: Installed): void {
  writeInstalled(p.configHome, state)
  sync(p.configHome, catalog, state, p.home)
}

test('uninstall gives every config back as it was and deletes only what ttheme wrote', () => {
  const p = paths()
  const ghostty = join(p.configHome, 'ghostty', 'config')
  const kitty = join(p.configHome, 'kitty', 'kitty.conf')
  const mine = join(p.configHome, 'ghostty', 'themes', 'gojo')
  put(ghostty, 'font-size = 13\ntheme = Dracula\n')
  put(mine, 'background = #000000\n')
  install(p, { terminals: ['ghostty', 'kitty', 'alacritty', 'wezterm'], palettes: ['gojo', 'geto'], startup: 'gojo' })
  install(p, { terminals: ['ghostty', 'kitty', 'alacritty', 'wezterm'], palettes: ['gojo', 'geto'], startup: 'geto' })
  assert.equal(readFileSync(backupPath(ghostty), 'utf8'), 'font-size = 13\ntheme = Dracula\n')
  assert.ok(!existsSync(backupPath(kitty)))

  applyUninstall(planUninstall(p), p, host)

  assert.equal(readFileSync(ghostty, 'utf8'), 'font-size = 13\ntheme = Dracula\n')
  assert.ok(!existsSync(backupPath(ghostty)))
  assert.ok(!existsSync(kitty))
  assert.ok(!existsSync(join(p.configHome, 'alacritty', 'alacritty.toml')))
  assert.ok(!existsSync(join(p.configHome, 'wezterm', 'wezterm.lua')))
  assert.equal(readFileSync(mine, 'utf8'), 'background = #000000\n')
  assert.ok(!existsSync(join(p.configHome, 'ghostty', 'themes', 'ttheme-gojo')))
  assert.ok(!existsSync(join(p.configHome, 'ttheme')))
  assert.deepEqual(planUninstall(p), { edits: [], removals: [], touches: [] })
})

test("uninstall also deletes the palette files ttheme 1.0.34 and older wrote without its prefix, and nothing of the user's", () => {
  const p = paths()
  const at = (...parts: string[]) => join(p.configHome, ...parts)
  install(p, { terminals: ['ghostty', 'kitty', 'alacritty', 'wezterm'], palettes: ['gojo'], startup: 'gojo' })
  const old = [
    [at('ghostty', 'themes', 'geto'), '# geto — Jujutsu Kaisen (呪術廻戦)\n# ANSI: Horizon\nbackground = #11191c\n'],
    [at('kitty', 'themes', 'geto.conf'), '# geto — Jujutsu Kaisen\n# ANSI: Horizon\nbackground #11191c\n'],
    [at('alacritty', 'themes', 'geto.toml'), '# geto — Jujutsu Kaisen\n# ANSI: Horizon\n[colors.primary]\n'],
    [at('wezterm', 'colors', 'geto.toml'), '[metadata]\nname = "geto"\norigin_url = "Horizon"\n\n[colors]\n'],
  ]
  const mine = [
    [at('ghostty', 'themes', 'Dracula'), '# Dracula — a theme\npalette = 0=#000000\n'],
    [at('wezterm', 'colors', 'night.toml'), '[metadata]\nname = "Night"\norigin_url = "x"\n'],
    [at('ghostty', 'shaders', 'cursor_tail.glsl'), 'void mainImage() {}\n'],
  ]
  for (const [path, text] of [...old, ...mine]) {
    put(path as string, text as string)
  }

  applyUninstall(planUninstall(p), p, host)

  for (const [path] of old) {
    assert.ok(!existsSync(path as string), path)
  }
  for (const [path, text] of mine) {
    assert.equal(readFileSync(path as string, 'utf8'), text)
  }
})

test('uninstall keeps the backup when the config changed after ttheme first edited it', () => {
  const p = paths()
  const ghostty = join(p.configHome, 'ghostty', 'config')
  put(ghostty, 'font-size = 13\n')
  install(p, { terminals: ['ghostty'], palettes: ['gojo'] })
  writeFileSync(ghostty, `window-padding-x = 4\n${readFileSync(ghostty, 'utf8')}`)

  applyUninstall(planUninstall(p), p, host)

  assert.equal(readFileSync(ghostty, 'utf8'), 'window-padding-x = 4\nfont-size = 13\n')
  assert.equal(readFileSync(backupPath(ghostty), 'utf8'), 'font-size = 13\n')
})

test('uninstall gives back a config that ended without a newline or with blank lines byte for byte, and drops its backup', () => {
  for (const mine of ['font-size = 13', 'font-size = 13\n\n\n']) {
    const p = paths()
    const ghostty = join(p.configHome, 'ghostty', 'config')
    put(ghostty, mine)
    install(p, { terminals: ['ghostty'], palettes: ['gojo'] })

    applyUninstall(planUninstall(p), p, host)

    assert.equal(readFileSync(ghostty, 'utf8'), mine)
    assert.ok(!existsSync(backupPath(ghostty)))
  }
})

test('uninstall takes the block out of ~/.zshrc too when zsh reads its .zshrc from ZDOTDIR', () => {
  const base = paths()
  const zdotdir = join(base.home, '.zsh')
  const p = { ...base, zdotdir }
  const mine = 'export FOO=1\n'
  put(join(zdotdir, '.zshrc'), `${mine}\n# ttheme begin\nsource ~/.config/ttheme/ttheme.zsh\n# ttheme end\n`)
  put(join(p.home, '.zshrc'), '# ttheme begin\nsource ~/.config/ttheme/ttheme.zsh\n# ttheme end\n')

  applyUninstall(planUninstall(p), p, host)

  assert.equal(readFileSync(join(zdotdir, '.zshrc'), 'utf8'), mine)
  assert.ok(!existsSync(join(p.home, '.zshrc')))
})

test('a config kept as a symlink stays one through install and uninstall', () => {
  const p = paths()
  const real = join(p.home, 'dotfiles', 'ghostty')
  const ghostty = join(p.configHome, 'ghostty', 'config')
  put(real, 'font-size = 13\n')
  mkdirSync(join(ghostty, '..'), { recursive: true })
  symlinkSync(real, ghostty)
  install(p, { terminals: ['ghostty'], palettes: ['gojo'] })
  assert.ok(lstatSync(ghostty).isSymbolicLink())
  assert.match(readFileSync(real, 'utf8'), /# ttheme begin/)

  applyUninstall(planUninstall(p), p, host)

  assert.ok(lstatSync(ghostty).isSymbolicLink())
  assert.equal(readFileSync(real, 'utf8'), 'font-size = 13\n')
})

test('uninstall puts back the Warp theme ttheme replaced', () => {
  const p = paths()
  const settings =
    process.platform === 'darwin'
      ? join(p.home, '.warp', 'settings.toml')
      : join(p.configHome, 'warp-terminal', 'settings.toml')
  const before = '[appearance.themes]\ntheme = "Dracula"\n'
  put(settings, before)
  install(p, { terminals: ['warp'], palettes: ['gojo'] })
  install(p, { terminals: ['warp'], palettes: ['gojo'] })
  assert.match(readFileSync(settings, 'utf8'), /ttheme-gojo\.yaml/)

  applyUninstall(planUninstall(p), p, host)

  assert.equal(readFileSync(settings, 'utf8'), before)
  assert.ok(!existsSync(backupPath(settings)))
})

test('uninstall drops the Warp backup that ttheme off already made true again', () => {
  const p = paths()
  const settings =
    process.platform === 'darwin'
      ? join(p.home, '.warp', 'settings.toml')
      : join(p.configHome, 'warp-terminal', 'settings.toml')
  const before = '[appearance.themes]\ntheme = "Dracula"\n'
  put(settings, before)
  install(p, { terminals: ['warp'], palettes: ['gojo'], off: true })
  install(p, { terminals: ['warp'], palettes: ['gojo'] })
  install(p, { terminals: ['warp'], palettes: ['gojo'], off: true })
  assert.equal(readFileSync(settings, 'utf8'), before)
  assert.ok(existsSync(backupPath(settings)))

  applyUninstall(planUninstall(p), p, host)

  assert.equal(readFileSync(settings, 'utf8'), before)
  assert.ok(!existsSync(backupPath(settings)))
})
