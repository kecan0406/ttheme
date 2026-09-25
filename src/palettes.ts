import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { backgroundsDir, readBackdrop, readStore } from './backdrop.ts'
import { available, nearest, readAvailable, writeKept } from './catalog.ts'
import { backupOnce, editUserFile, writeAtomic } from './edits.ts'
import { alacritty, type Emitter, ghostty, iterm2, kitty, owned, warp, wezterm, windowsTerminal } from './emit/index.ts'
import { itermProfiles, type ProfileBackground } from './emit/iterm2.ts'
import { kittyWatcher } from './emit/kitty.ts'
import { listed, type Manifest, type PaletteEntry, toTheme } from './emit/manifest.ts'
import { palettesZsh } from './emit/shell.ts'
import { weztermModule } from './emit/wezterm.ts'
import { wtFragment } from './emit/windows-terminal.ts'
import { installedPath } from './sources.ts'
import { marketOf, type Theme } from './theme.ts'
import {
  alacrittyColors,
  ghosttyBlock,
  INIT_TERMINALS,
  type InitTerminal,
  kittyBlock,
  upsertAlacrittyImport,
  upsertBlock,
  upsertLuaBlock,
  userSets,
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
  author?: string
  startup?: string
  off?: true
  itermBase?: string
  wtHome?: string
  wtProfile?: string
  markets?: string[]
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
    ...(doc.author ? { author: doc.author } : {}),
    ...(doc.startup ? { startup: doc.startup } : {}),
    ...(doc.off ? { off: true as const } : {}),
    ...(doc.itermBase ? { itermBase: doc.itermBase } : {}),
    ...(doc.wtHome ? { wtHome: doc.wtHome } : {}),
    ...(doc.wtProfile ? { wtProfile: doc.wtProfile } : {}),
    ...(Array.isArray(doc.markets) ? { markets: doc.markets.filter((m) => typeof m === 'string') } : {}),
    palettes: doc.palettes,
  }
}

export function writeInstalled(configHome: string, state: Installed): void {
  writeAtomic(installedPath(configHome), `${JSON.stringify(state, null, 2)}\n`)
}

export function resolve(catalog: Manifest, names: string[]): PaletteEntry[] {
  const known = new Map(catalog.palettes.map((p) => [p.name, p]))
  const missing = names.filter((n) => !known.has(n))
  if (missing.length > 0) {
    const markets = [...new Set(missing.flatMap((n) => marketOf(n) ?? []))].filter(
      (market) => !catalog.palettes.some((p) => marketOf(p.name) === market),
    )
    const hint =
      markets.length > 0
        ? `add ${markets.join(', ')} first — \`ttheme market search\` finds a market's repository`
        : nearest(listed(catalog.palettes), missing)
    throw new Error(`not in any market: ${missing.join(', ')} — ${hint}`)
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

export function themeDir(terminal: InitTerminal, configHome: string, home: string): string {
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

export const WARP_DEFAULT = '"dark"'

export function warpBasePath(configHome: string): string {
  return join(configHome, 'ttheme', 'warp.base')
}

const WARP_LATER =
  "setTimeout(() => { const fs = require('node:fs'); const [file, next, seen] = process.argv.slice(-3); if (fs.readFileSync(file, 'utf8') !== seen) return; const tmp = file + '.ttheme-' + process.pid; fs.writeFileSync(tmp, next); fs.chmodSync(tmp, fs.statSync(file).mode & 0o7777); fs.renameSync(tmp, file) }, 1500)"

function wearWarp(configHome: string, home: string, startup: string | undefined, later: boolean): string | undefined {
  const file = warpSettings(home, configHome)
  if (!existsSync(file)) {
    return undefined
  }
  const base = warpBasePath(configHome)
  const content = readFileSync(file, 'utf8')
  const current = warpThemeOf(content)
  const ours = current?.includes(`path = "${owned('')}`) === true
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
    backupOnce(file)
    spawn(process.execPath, ['-e', WARP_LATER, realpathSync(file), next, content], {
      detached: true,
      stdio: 'ignore',
    }).unref()
  } else {
    editUserFile(file, next)
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

export function blockFile(terminal: 'ghostty' | 'kitty', configHome: string): string {
  return terminal === 'ghostty' ? join(configHome, 'ghostty', 'config') : join(configHome, 'kitty', 'kitty.conf')
}

function blockBody(terminal: 'ghostty' | 'kitty', configHome: string, startup: string | undefined, user: string) {
  return terminal === 'ghostty'
    ? ghosttyBlock(join(configHome, 'ttheme'), startup, user)
    : kittyBlock(startup, kittyWatcherPath(configHome), user)
}

function readText(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

export function alacrittyConfig(configHome: string): string {
  return join(configHome, 'alacritty', 'alacritty.toml')
}

export function alacrittyTheme(configHome: string, palette: string | undefined): string | undefined {
  return palette ? join(configHome, 'alacritty', 'themes', `${owned(palette)}.toml`) : undefined
}

function itermFile(configHome: string, entries: PaletteEntry[], state: Installed, home: string): string {
  const dir = backgroundsDir(configHome)
  const themes = entries.map(toTheme)
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
  writeAtomic(
    itermProfilesPath(home),
    itermFile(configHome, resolve(readAvailable(configHome), state.palettes), state, home),
  )
}

export function sync(configHome: string, catalog: Manifest, state: Installed, home = homedir()): string[] {
  readStore(backgroundsDir(configHome))
  const entries = resolve(available(configHome, catalog), state.palettes)
  writeKept(configHome, entries)
  const written: string[] = []
  const write = (path: string, content: string): boolean => {
    written.push(path)
    if (existsSync(path) && readFileSync(path, 'utf8') === content) {
      return false
    }
    writeAtomic(path, content)
    return true
  }
  const wire = (path: string, content: string): void => {
    written.push(path)
    editUserFile(path, content)
  }

  const startup = worn(state)
  for (const terminal of state.terminals) {
    if (terminal === 'iterm2') {
      write(itermProfilesPath(home), itermFile(configHome, entries, state, home))
      continue
    }
    if (terminal === 'windows-terminal') {
      if (state.wtHome) {
        const settings = wtSettings(state.wtHome)
        const themes = entries.map(toTheme)
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
      startup !== undefined && terminal === 'warp' && !existsSync(join(warpThemes(home), `${owned(startup)}.yaml`))
    const warpFile = terminal === 'warp' ? wearWarp(configHome, home, startup, fresh) : undefined
    for (const entry of entries) {
      for (const { file, content } of themeFiles(terminal, toTheme(entry))) {
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
          palettes: entries.map(toTheme),
        }),
      )
      const config = weztermConfig(configHome, home)
      const wired = upsertLuaBlock(readText(config), weztermBlock(module))
      if (wired !== undefined) {
        wire(config, wired)
      }
      continue
    }
    if (terminal === 'alacritty') {
      const config = alacrittyConfig(configHome)
      const wired = upsertAlacrittyImport(readText(config), alacrittyTheme(configHome, startup))
      if (wired !== undefined) {
        wire(config, wired)
      }
      continue
    }
    if (terminal === 'kitty') {
      write(
        kittyWatcherPath(configHome),
        kittyWatcher({ themes: themeDir('kitty', configHome, home), backgrounds: backgroundsDir(configHome) }),
      )
    }
    const file = blockFile(terminal, configHome)
    const user = readText(file)
    wire(file, upsertBlock(user, blockBody(terminal, configHome, startup, user)))
  }

  const table = join(configHome, 'ttheme', 'palettes.zsh')
  writeAtomic(table, palettesZsh(entries, startup, state.terminals))
  written.push(table)
  rmSync(`${table}.zwc`, { force: true })
  return written
}

function tilde(path: string, home: string): string {
  return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path
}

function blockKeys(body: string): string {
  return [...new Set(body.split('\n').map((line) => line.split(/[ =]/)[0]))].join(', ')
}

export function wiringPlan(configHome: string, state: Installed, home = homedir()): string[] {
  const startup = worn(state)
  const at = (path: string) => tilde(path, home)
  const lines: string[] = []
  for (const terminal of state.terminals) {
    if (terminal === 'iterm2') {
      lines.push(`write ${at(itermProfilesPath(home))} — a "ttheme · <palette>" profile per palette`)
      continue
    }
    if (terminal === 'windows-terminal') {
      if (state.wtHome) {
        lines.push(`write ${wtFragmentPath(state.wtHome)} — its schemes, and touch settings.json so it reloads`)
      }
      continue
    }
    lines.push(`write ${at(themeDir(terminal, configHome, home))}/${owned('*')} — a theme file per palette`)
    if (terminal === 'warp') {
      const file = warpSettings(home, configHome)
      if (startup && existsSync(file)) {
        lines.push(`edit ${at(file)} — [appearance.themes] theme; \`ttheme off\` puts yours back`)
      }
      continue
    }
    if (terminal === 'wezterm') {
      const config = weztermConfig(configHome, home)
      if (upsertLuaBlock(readText(config), '') !== undefined) {
        lines.push(
          `edit ${at(config)} — a ttheme block before \`return config\`: color_scheme_dirs, color_scheme, pictures`,
        )
      }
      continue
    }
    if (terminal === 'alacritty') {
      const config = alacrittyConfig(configHome)
      if (upsertAlacrittyImport(readText(config), undefined) !== undefined) {
        lines.push(`edit ${at(config)} — a ttheme block: general.import`)
      }
      continue
    }
    const file = blockFile(terminal, configHome)
    const user = readText(file)
    lines.push(`edit ${at(file)} — a ttheme block: ${blockKeys(blockBody(terminal, configHome, startup, user))}`)
  }
  return lines
}

export function wiringNotes(configHome: string, terminals: InitTerminal[], home = homedir()): string[] {
  const notes: string[] = []
  const at = (path: string) => tilde(path, home)
  if (terminals.includes('ghostty')) {
    const file = blockFile('ghostty', configHome)
    if (userSets(readText(file), 'command')) {
      notes.push(`${at(file)} sets its own command — ttheme leaves it, so a new tab takes its palette once zsh starts`)
    }
  }
  if (terminals.includes('kitty')) {
    const user = readText(blockFile('kitty', configHome))
    if (userSets(user, 'window_logo_scale') || userSets(user, 'window_logo_alpha')) {
      notes.push('kitty.conf sets its own window_logo_scale or window_logo_alpha — pictures are drawn with them')
    }
  }
  if (terminals.includes('alacritty')) {
    const config = alacrittyConfig(configHome)
    if (alacrittyColors(readText(config))) {
      notes.push(
        `${at(config)} sets its own colors, which win over an imported palette — remove them to open with ttheme's`,
      )
    }
  }
  return notes
}

export function forget(
  configHome: string,
  catalog: Manifest,
  terminals: InitTerminal[],
  names: string[],
  home = homedir(),
): string[] {
  const removed: string[] = []
  const known = available(configHome, catalog, false).palettes
  for (const terminal of terminals) {
    for (const entry of known.filter((p) => names.includes(p.name))) {
      for (const { file } of themeFiles(terminal, toTheme(entry))) {
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

export function commit(home: string, catalog: Manifest, before: Installed, after: Installed): boolean {
  const prefs = itermDefaults()
  const moves = Boolean(worn(before)) !== Boolean(worn(after))
  const next = moves ? withItermBase(after, prefs) : after
  sync(home, catalog, next)
  writeInstalled(home, next)
  return moves && pointItermDefault(next, prefs) && prefs.running()
}
