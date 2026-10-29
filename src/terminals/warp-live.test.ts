import assert from 'node:assert/strict'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { test } from 'node:test'
import type { PaletteEntry } from '../core/manifest.ts'
import type { Wired } from '../core/wired.ts'
import { writeInstalled } from '../store/installed.ts'
import { warpTheme, warpThemeFile } from './emit/warp.ts'
import { WARP_SPACED, warpBasePath, warpSettings, warpThemeOf, warpThemes, warpThemeValue } from './warp.ts'
import { WARP_SETTLE, warpInstalled, warpLive } from './warp-live.ts'

const env = { TERM_PROGRAM: 'WarpTerminal' }

const settled = () => new Promise((resolve) => setTimeout(resolve, WARP_SETTLE + WARP_SPACED + 150))

function palette(name: string, background: string): PaletteEntry {
  return {
    name,
    background,
    foreground: '#e0f4f2',
    cursor: '#39c5bb',
    selection: '#1b3b3e',
    signature: ['#39c5bb', '#e0f4f2', '#0e2124'],
    signatureSlots: ['cursor', 'foreground', 'background'],
    ansi: Array.from({ length: 16 }, () => '#808080'),
    gate: [],
    backdrop: { slot: 'cursor', color: '#39c5bb', opacity: 0.2 },
  }
}

function warp(terminals: Wired[] = ['warp']) {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-warp-live-'))
  const configHome = join(home, '.config')
  writeInstalled(configHome, { terminals, palettes: ['orla'] })
  const settings = warpSettings(home, configHome)
  mkdirSync(dirname(settings), { recursive: true })
  writeFileSync(settings, '[general]\nx = 1\n\n[appearance.themes]\ntheme = "Dracula"\n')
  const themes = warpThemes(home)
  mkdirSync(themes, { recursive: true })
  writeFileSync(join(themes, 'ttheme-orla.dark.89abcdef.yaml'), 'name: "orla · dark"\n')
  writeFileSync(join(themes, 'ttheme-orla.dark.0123abcd.yaml'), 'name: "orla · dark"\n')
  utimesSync(join(themes, 'ttheme-orla.dark.89abcdef.yaml'), 1_600_000_000, 1_600_000_000)
  utimesSync(join(themes, 'ttheme-orla.dark.0123abcd.yaml'), 1_600_000_100, 1_600_000_100)
  const worn = () => warpThemeOf(readFileSync(settings, 'utf8'))
  const views = () => readdirSync(themes).filter((file) => file.includes('.view-'))

  return { home, configHome, settings, themes, worn, views }
}

test('a TUI paints Warp live only where a tab of it can wear a palette', () => {
  const { home, configHome, settings } = warp()
  assert.ok(warpLive(env, true, configHome, home))
  assert.equal(warpLive(env, false, configHome, home), undefined)
  assert.equal(warpLive({ ...env, NO_COLOR: '1' }, true, configHome, home), undefined)
  assert.equal(warpLive({ ...env, TMUX: '/tmp/tmux-501/default,1,0' }, true, configHome, home), undefined)
  assert.equal(warpLive({ GHOSTTY_RESOURCES_DIR: '/x' }, true, configHome, home), undefined)
  const other = warp(['ghostty'])
  assert.equal(warpLive(env, true, other.configHome, other.home), undefined)
  writeFileSync(settings, '')
  assert.ok(warpLive(env, true, configHome, home))
  const bare = mkdtempSync(join(tmpdir(), 'ttheme-warp-live-'))
  writeInstalled(join(bare, '.config'), { terminals: ['warp'], palettes: ['orla'] })
  assert.equal(warpLive(env, true, join(bare, '.config'), bare), undefined)
})

test("a hover in Warp puts on an installed palette's newest theme once the keys settle, keeping the user's theme", async () => {
  const { home, configHome, themes, worn, views } = warp()
  const live = warpLive(env, true, configHome, home)
  assert.ok(live)
  assert.equal(warpInstalled(themes, 'orla', 'dark'), 'ttheme-orla.dark.0123abcd.yaml')
  assert.equal(live.paint(palette('pip', '#302010')), '')
  live.paint(palette('orla', '#0e2124'))
  await settled()
  assert.equal(worn(), warpThemeValue('orla · dark', 'ttheme-orla.dark.0123abcd.yaml'))
  assert.equal(readFileSync(warpBasePath(configHome), 'utf8'), '"Dracula"')
  assert.deepEqual(views(), [])
})

test('a hover in Warp writes a linked settings file through its link, which an identical link then replaces so Warp hears it', async () => {
  const { home, configHome, settings, worn } = warp()
  const real = join(home, 'dotfiles', 'warp.toml')
  mkdirSync(dirname(real), { recursive: true })
  renameSync(settings, real)
  const text = relative(dirname(settings), real)
  symlinkSync(text, settings)
  const link = lstatSync(settings).ino
  const live = warpLive(env, true, configHome, home)
  assert.ok(live)
  live.paint(palette('orla', '#0e2124'))
  await settled()
  assert.equal(worn(), warpThemeValue('orla · dark', 'ttheme-orla.dark.0123abcd.yaml'))
  assert.equal(readlinkSync(settings), text)
  assert.notEqual(lstatSync(settings).ino, link)
})

test('an uninstalled palette reaches Warp through a short-lived theme, and an installed one through its plain theme', async () => {
  const { home, configHome, themes, worn, views } = warp()
  const live = warpLive(env, true, configHome, home)
  assert.ok(live)
  live.paint(palette('pip', '#302010'))
  await settled()
  const [pip = ''] = views()
  assert.ok(pip.startsWith('ttheme-pip.view-'))
  assert.equal(worn(), warpThemeValue('pip · dark', pip))
  assert.match(readFileSync(join(themes, pip), 'utf8'), /^background: "#302010"$/m)
  const bram = palette('bram', '#102030')
  writeFileSync(join(themes, warpThemeFile(bram)), warpTheme(bram))
  live.paint(bram)
  await settled()
  assert.equal(worn(), warpThemeValue('bram · dark', warpThemeFile(bram)))
  assert.deepEqual(views(), [])
})

test('closing a TUI in Warp puts back the theme the tab wore and takes its views away', async () => {
  const { home, configHome, worn, views, settings } = warp()
  const live = warpLive(env, true, configHome, home)
  assert.ok(live)
  const saved = await live.saved()
  live.paint(palette('pip', '#302010'))
  await settled()
  live.paint(palette('orla', '#0e2124'))
  assert.equal(live.restore(saved), '')
  await settled()
  assert.equal(worn(), '"Dracula"')
  assert.ok(!existsSync(warpBasePath(configHome)))
  assert.deepEqual(views(), [])
  assert.match(readFileSync(settings, 'utf8'), /^\[general\]\nx = 1\n/)
})

test('init wears the default in Warp through sync alone, and tells the tab wears it', () => {
  const { home, configHome } = warp()
  const live = warpLive(env, true, configHome, home)
  assert.equal(live?.wear(palette('orla', '#0e2124'), ['warp']), '')
  assert.equal(live?.wear(palette('orla', '#0e2124'), ['ghostty']), undefined)
})
