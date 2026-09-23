import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { backgroundsDir, readBackdrop } from './backdrop.ts'
import { gateFailures, readCatalog } from './catalog.ts'
import { alacritty, type Emitter, ghostty, iterm2, kitty, warp, wezterm, windowsTerminal } from './emit/index.ts'
import { itermProfiles, type ProfileBackground } from './emit/iterm2.ts'
import { kittyWatcher } from './emit/kitty.ts'
import { listed, type Manifest, type PaletteEntry } from './emit/manifest.ts'
import { palettesZsh } from './emit/shell.ts'
import { weztermModule } from './emit/wezterm.ts'
import { wtFragment } from './emit/windows-terminal.ts'
import type { Theme } from './theme.ts'
import {
  ghosttyBlock,
  INIT_TERMINALS,
  type InitTerminal,
  kittyBlock,
  upsertAlacrittyImport,
  upsertBlock,
  upsertLuaBlock,
  warpThemeOf,
  warpThemeValue,
  weztermBlock,
  withWarpTheme,
} from './wiring.ts'

const EMITTERS: Record<InitTerminal, Emitter> = {
  ghostty,
  kitty,
  alacritty,
  wezterm,
  iterm2,
  'windows-terminal': windowsTerminal,
  warp,
}

export interface Installed {
  terminals: InitTerminal[]
  startup?: string
  off?: true
  itermBase?: string
  wtHome?: string
  wtProfile?: string
  palettes: string[]
}

export const ITERM_DEFAULT = 'ttheme-default'

export interface ItermDefaults {
  read(): string | undefined
  write(guid: string): void
  running(): boolean
}

export function itermDefaults(suite = process.env.TTHEME_ITERM_SUITE ?? 'com.googlecode.iterm2'): ItermDefaults {
  const run = (command: string, args: string[]) =>
    execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  return {
    read: () => {
      try {
        return process.platform === 'darwin'
          ? run('defaults', ['read', suite, 'Default Bookmark Guid']) || undefined
          : undefined
      } catch {
        return undefined
      }
    },
    write: (guid) => {
      if (process.platform === 'darwin') {
        run('defaults', ['write', suite, 'Default Bookmark Guid', '-string', guid])
      }
    },
    running: () => {
      try {
        return run('pgrep', ['-x', 'iTerm2']) !== ''
      } catch {
        return false
      }
    },
  }
}

export function worn(state: Installed): string | undefined {
  return state.off ? undefined : startupPalette(state)
}

export function withItermBase(state: Installed, prefs: ItermDefaults): Installed {
  if (!state.terminals.includes('iterm2')) {
    return state
  }
  const current = prefs.read()
  return current && !current.startsWith('ttheme-') ? { ...state, itermBase: current } : state
}

export function pointItermDefault(state: Installed, prefs: ItermDefaults): boolean {
  if (!state.terminals.includes('iterm2')) {
    return false
  }
  const current = prefs.read()
  const want = worn(state) ? ITERM_DEFAULT : current === ITERM_DEFAULT ? state.itermBase : undefined
  if (!want || want === current) {
    return false
  }
  prefs.write(want)
  return true
}

export function configHome(): string {
  return process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config')
}

export function itermProfilesPath(home: string): string {
  return join(home, 'Library', 'Application Support', 'iTerm2', 'DynamicProfiles', 'ttheme.json')
}

export function installedPath(configHome: string): string {
  return join(configHome, 'ttheme', 'installed.json')
}

export function readInstalled(configHome: string): Installed {
  const path = installedPath(configHome)
  if (!existsSync(path)) {
    throw new Error(`nothing installed yet at ${path} — run \`ttheme init\` first`)
  }
  const doc = JSON.parse(readFileSync(path, 'utf8')) as Installed
  if (!Array.isArray(doc?.palettes) || !Array.isArray(doc.terminals)) {
    throw new Error(`${path} has no palettes or terminals`)
  }
  return {
    terminals: doc.terminals.filter((t): t is InitTerminal => INIT_TERMINALS.includes(t)),
    ...(doc.startup ? { startup: doc.startup } : {}),
    ...(doc.off ? { off: true as const } : {}),
    ...(doc.itermBase ? { itermBase: doc.itermBase } : {}),
    ...(doc.wtHome ? { wtHome: doc.wtHome } : {}),
    ...(doc.wtProfile ? { wtProfile: doc.wtProfile } : {}),
    palettes: doc.palettes,
  }
}

export function writeInstalled(configHome: string, state: Installed): void {
  const path = installedPath(configHome)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`)
}

export function toTheme(entry: PaletteEntry, catalog: Manifest): Theme {
  return {
    name: entry.name,
    group: entry.group,
    ...(entry.native ? { native: entry.native } : {}),
    lead: entry.lead === true,
    order: entry.order,
    ...(entry.default ? { role: 'default' as const } : {}),
    ansiSource: entry.ansiSource,
    ...(entry.booru ? { booru: entry.booru } : {}),
    ...(entry.booruSites ? { booruSites: entry.booruSites } : {}),
    background: entry.background,
    foreground: entry.foreground,
    cursor: entry.cursor,
    selectionBackground: entry.selection,
    ansi: entry.ansi,
    signature: entry.signature,
    signatureSlots: entry.signatureSlots,
    font: catalog.font,
    ghostty: {
      ...(catalog.shader ? { shader: catalog.shader } : {}),
      iconGhost: entry.cursor,
      iconScreen: [entry.cursor, entry.selection, entry.background],
    },
    waive: entry.waived ?? [],
  }
}

export function resolve(catalog: Manifest, names: string[]): PaletteEntry[] {
  const known = new Map(catalog.palettes.map((p) => [p.name, p]))
  const missing = names.filter((n) => !known.has(n))
  if (missing.length > 0) {
    throw new Error(`not in the catalog: ${missing.join(', ')} — \`ttheme list\` shows what is there`)
  }
  const failed = names.flatMap((name) => {
    const failures = gateFailures(known.get(name) as PaletteEntry)
    return failures.length > 0 ? [`${name}: ${failures.join(', ')}`] : []
  })
  if (failed.length > 0) {
    throw new Error(`these palettes fail the contrast gate:\n  ${failed.join('\n  ')}`)
  }
  return catalog.palettes.filter((p) => names.includes(p.name))
}

function themeFiles(terminal: InitTerminal, theme: Theme): { file: string; content: string }[] {
  const wanted = terminal === 'wezterm' ? 'colors' : 'themes'
  return (EMITTERS[terminal].emit?.(theme) ?? []).flatMap((out) => {
    const [, section, file] = out.path.split('/')
    return section === wanted && file !== undefined ? [{ file, content: out.content }] : []
  })
}

export function warpThemes(home: string): string {
  return process.platform === 'darwin'
    ? join(home, '.warp', 'themes')
    : join(process.env.XDG_DATA_HOME ?? join(home, '.local', 'share'), 'warp-terminal', 'themes')
}

function themeDir(terminal: InitTerminal, configHome: string, home: string): string {
  if (terminal === 'warp') {
    return warpThemes(home)
  }
  return join(configHome, terminal, terminal === 'wezterm' ? 'colors' : 'themes')
}

export function warpSettings(home: string, configHome: string): string {
  return process.platform === 'darwin'
    ? join(home, '.warp', 'settings.toml')
    : join(configHome, 'warp-terminal', 'settings.toml')
}

const WARP_DEFAULT = '"dark"'

const WARP_LATER =
  "setTimeout(() => { const fs = require('node:fs'); const [file, next, seen] = process.argv.slice(-3); if (fs.readFileSync(file, 'utf8') === seen) fs.writeFileSync(file, next) }, 1500)"

function wearWarp(configHome: string, home: string, startup: string | undefined, later: boolean): string | undefined {
  const file = warpSettings(home, configHome)
  if (!existsSync(file)) {
    return undefined
  }
  const base = join(configHome, 'ttheme', 'warp.base')
  const content = readFileSync(file, 'utf8')
  const current = warpThemeOf(content)
  const ours = current?.includes('path = "ttheme-') === true
  let value: string
  if (startup) {
    if (!ours && !existsSync(base)) {
      mkdirSync(dirname(base), { recursive: true })
      writeFileSync(base, current ?? '')
    }
    value = warpThemeValue(startup)
  } else {
    if (!ours) {
      return undefined
    }
    value = (existsSync(base) && readFileSync(base, 'utf8')) || WARP_DEFAULT
    rmSync(base, { force: true })
  }
  const next = withWarpTheme(content, value)
  if (next === content) {
    return undefined
  }
  if (later) {
    spawn(process.execPath, ['-e', WARP_LATER, file, next, content], { detached: true, stdio: 'ignore' }).unref()
  } else {
    writeFileSync(file, next)
  }
  return file
}

export function kittyWatcherPath(configHome: string): string {
  return join(configHome, 'ttheme', 'kitty.py')
}

export function weztermConfig(configHome: string, home: string): string {
  const dotfile = join(home, '.wezterm.lua')
  return existsSync(dotfile) ? dotfile : join(configHome, 'wezterm', 'wezterm.lua')
}

export function wtFragmentPath(wtHome: string): string {
  return join(wtHome, 'Microsoft', 'Windows Terminal', 'Fragments', 'ttheme', 'ttheme.json')
}

export function wtSettings(wtHome: string): string[] {
  return [
    join(wtHome, 'Packages', 'Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'LocalState', 'settings.json'),
    join(wtHome, 'Packages', 'Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe', 'LocalState', 'settings.json'),
    join(wtHome, 'Microsoft', 'Windows Terminal', 'settings.json'),
  ].filter((file) => existsSync(file))
}

function wtDefaultProfile(settings: string[]): string | undefined {
  for (const file of settings) {
    const guid = /"defaultProfile"\s*:\s*"(\{[0-9a-fA-F-]+\})"/.exec(readFileSync(file, 'utf8'))?.[1]
    if (guid) {
      return guid
    }
  }
  return undefined
}

export function startupPalette(state: Installed): string | undefined {
  return state.startup && state.palettes.includes(state.startup) ? state.startup : state.palettes[0]
}

function blockFor(terminal: 'ghostty' | 'kitty', configHome: string, startup: string | undefined) {
  if (terminal === 'ghostty') {
    return { file: join(configHome, 'ghostty', 'config'), body: ghosttyBlock(join(configHome, 'ttheme'), startup) }
  }
  return { file: join(configHome, 'kitty', 'kitty.conf'), body: kittyBlock(startup, kittyWatcherPath(configHome)) }
}

export function alacrittyConfig(configHome: string): string {
  return join(configHome, 'alacritty', 'alacritty.toml')
}

export function alacrittyTheme(configHome: string, palette: string | undefined): string | undefined {
  return palette ? join(configHome, 'alacritty', 'themes', `${palette}.toml`) : undefined
}

function itermFile(
  configHome: string,
  catalog: Manifest,
  entries: PaletteEntry[],
  state: Installed,
  home: string,
): string {
  const dir = backgroundsDir(configHome)
  const themes = entries.map((entry) => toTheme(entry, catalog))
  const pictures = new Map<string, ProfileBackground>()
  for (const theme of themes) {
    const picture = readBackdrop(dir, theme.name, home)
    if (picture) {
      pictures.set(theme.name, picture)
    }
  }
  const shown = new Set(listed(entries).map((entry) => entry.name))
  return itermProfiles(
    themes.filter((theme) => shown.has(theme.name)),
    pictures,
    themes.find((theme) => theme.name === worn(state)),
    state.itermBase,
  )
}

export function refreshProfiles(configHome: string, home = homedir()): void {
  const state = readInstalled(configHome)
  if (!state.terminals.includes('iterm2')) {
    return
  }
  const catalog = readCatalog(configHome)
  const path = itermProfilesPath(home)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, itermFile(configHome, catalog, resolve(catalog, state.palettes), state, home))
}

export function sync(configHome: string, catalog: Manifest, state: Installed, home = homedir()): string[] {
  const entries = resolve(catalog, state.palettes)
  const written: string[] = []
  const write = (path: string, content: string): boolean => {
    written.push(path)
    if (existsSync(path) && readFileSync(path, 'utf8') === content) {
      return false
    }
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
    return true
  }

  const startup = worn(state)
  for (const terminal of state.terminals) {
    if (terminal === 'iterm2') {
      write(itermProfilesPath(home), itermFile(configHome, catalog, entries, state, home))
      continue
    }
    if (terminal === 'windows-terminal') {
      if (state.wtHome) {
        const settings = wtSettings(state.wtHome)
        const themes = entries.map((entry) => toTheme(entry, catalog))
        const fragment = wtFragment(themes, state.wtProfile ?? wtDefaultProfile(settings), startup)
        if (write(wtFragmentPath(state.wtHome), fragment)) {
          const now = new Date()
          for (const file of settings) {
            utimesSync(file, now, now)
          }
        }
      }
      continue
    }
    const fresh =
      startup !== undefined && terminal === 'warp' && !existsSync(join(warpThemes(home), `ttheme-${startup}.yaml`))
    const warpFile = terminal === 'warp' ? wearWarp(configHome, home, startup, fresh) : undefined
    for (const entry of entries) {
      for (const { file, content } of themeFiles(terminal, toTheme(entry, catalog))) {
        write(join(themeDir(terminal, configHome, home), file), content)
      }
    }
    if (terminal === 'warp') {
      if (warpFile) {
        written.push(warpFile)
      }
      continue
    }
    if (terminal === 'wezterm') {
      const module = join(configHome, 'ttheme', 'wezterm.lua')
      write(
        module,
        weztermModule({
          path: module,
          colors: themeDir('wezterm', configHome, home),
          backgrounds: backgroundsDir(configHome),
          ...(startup ? { startup } : {}),
          palettes: entries.map((entry) => toTheme(entry, catalog)),
        }),
      )
      const config = weztermConfig(configHome, home)
      const wired = upsertLuaBlock(existsSync(config) ? readFileSync(config, 'utf8') : '', weztermBlock(module))
      if (wired !== undefined) {
        write(config, wired)
      }
      continue
    }
    if (terminal === 'alacritty') {
      const config = alacrittyConfig(configHome)
      const wired = upsertAlacrittyImport(
        existsSync(config) ? readFileSync(config, 'utf8') : '',
        alacrittyTheme(configHome, startup),
      )
      if (wired !== undefined) {
        write(config, wired)
      }
      continue
    }
    if (terminal === 'kitty') {
      write(
        kittyWatcherPath(configHome),
        kittyWatcher({ themes: themeDir('kitty', configHome, home), backgrounds: backgroundsDir(configHome) }),
      )
    }
    const { file, body } = blockFor(terminal, configHome, startup)
    write(file, upsertBlock(existsSync(file) ? readFileSync(file, 'utf8') : '', body))
  }

  const table = join(configHome, 'ttheme', 'palettes.zsh')
  mkdirSync(dirname(table), { recursive: true })
  writeFileSync(table, palettesZsh(entries, startup, state.terminals))
  written.push(table)
  rmSync(`${table}.zwc`, { force: true })
  return written
}

export function forget(
  configHome: string,
  catalog: Manifest,
  terminals: InitTerminal[],
  names: string[],
  home = homedir(),
): string[] {
  const removed: string[] = []
  for (const terminal of terminals) {
    for (const entry of catalog.palettes.filter((p) => names.includes(p.name))) {
      for (const { file } of themeFiles(terminal, toTheme(entry, catalog))) {
        const path = join(themeDir(terminal, configHome, home), file)
        if (existsSync(path)) {
          rmSync(path, { force: true })
          removed.push(path)
        }
      }
    }
  }
  return removed
}
