import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

import type { PaletteEntry } from './manifest.ts'
import { writeInstalled } from './palettes.ts'
import type { Wired } from './terminals/index.ts'
import { warpBasePath, warpSettings, warpThemeOf, warpThemes, warpThemeValue } from './terminals/warp.ts'
import { WARP_KNOWN, WARP_SETTLE, warpInstalled, warpLive } from './warp-live.ts'

const env = { TERM_PROGRAM: 'WarpTerminal' }

const settled = () => new Promise((resolve) => setTimeout(resolve, WARP_SETTLE + WARP_KNOWN + 150))

function palette(name: string, background: string): PaletteEntry {
  return {
    name,
    catalog: 'Vocaloid',
    order: 1,
    ansiSource: 'Test',
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
  writeInstalled(configHome, { terminals, palettes: ['miku'] })
  const settings = warpSettings(home, configHome)
  mkdirSync(dirname(settings), { recursive: true })
  writeFileSync(settings, '[general]\nx = 1\n\n[appearance.themes]\ntheme = "Dracula"\n')
  const themes = warpThemes(home)
  mkdirSync(themes, { recursive: true })
  writeFileSync(join(themes, 'ttheme-miku.yaml'), 'name: "miku"\n')
  writeFileSync(join(themes, 'ttheme-miku.0123abcd.yaml'), 'name: "miku"\n')
  utimesSync(join(themes, 'ttheme-miku.yaml'), 1_600_000_000, 1_600_000_000)
  utimesSync(join(themes, 'ttheme-miku.0123abcd.yaml'), 1_600_000_100, 1_600_000_100)
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
  writeInstalled(join(bare, '.config'), { terminals: ['warp'], palettes: ['miku'] })
  assert.equal(warpLive(env, true, join(bare, '.config'), bare), undefined)
})

test("a hover in Warp puts on an installed palette's newest theme once the keys settle, keeping the user's theme", async () => {
  const { home, configHome, themes, worn, views } = warp()
  const live = warpLive(env, true, configHome, home)
  assert.ok(live)
  assert.equal(warpInstalled(themes, 'miku'), 'ttheme-miku.0123abcd.yaml')
  assert.equal(live.paint(palette('rin', '#302010')), '')
  live.paint(palette('miku', '#0e2124'))
  await settled()
  assert.equal(worn(), warpThemeValue('miku', 'ttheme-miku.0123abcd.yaml'))
  assert.equal(readFileSync(warpBasePath(configHome), 'utf8'), '"Dracula"')
  assert.deepEqual(views(), [])
})

test('an uninstalled palette reaches Warp through a short-lived theme', async () => {
  const { home, configHome, themes, worn, views } = warp()
  const live = warpLive(env, true, configHome, home)
  assert.ok(live)
  live.paint(palette('rin', '#302010'))
  await settled()
  const [rin = ''] = views()
  assert.ok(rin.startsWith('ttheme-rin.view-'))
  assert.equal(worn(), warpThemeValue('rin', rin))
  assert.match(readFileSync(join(themes, rin), 'utf8'), /^background: "#302010"$/m)
})

test('closing a TUI in Warp puts back the theme the tab wore and takes its views away', async () => {
  const { home, configHome, worn, views, settings } = warp()
  const live = warpLive(env, true, configHome, home)
  assert.ok(live)
  const saved = await live.saved()
  live.paint(palette('rin', '#302010'))
  await settled()
  live.paint(palette('miku', '#0e2124'))
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
  assert.equal(live?.wear(palette('miku', '#0e2124'), ['warp']), '')
  assert.equal(live?.wear(palette('miku', '#0e2124'), ['ghostty']), undefined)
})
