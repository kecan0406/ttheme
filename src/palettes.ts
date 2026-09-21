import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { backgroundsDir, readBackdrop } from './backdrop.ts'
import { gateFailures, readCatalog } from './catalog.ts'
import { alacritty, type Emitter, ghostty, iterm2, kitty } from './emit/index.ts'
import { itermProfiles, type ProfileBackground } from './emit/iterm2.ts'
import { listed, type Manifest, type PaletteEntry } from './emit/manifest.ts'
import { palettesZsh } from './emit/shell.ts'
import type { Theme } from './theme.ts'
import { alacrittyBlock, ghosttyBlock, INIT_TERMINALS, type InitTerminal, kittyBlock, upsertBlock } from './wiring.ts'

const EMITTERS: Record<InitTerminal, Emitter> = { ghostty, kitty, alacritty, iterm2 }

export interface Installed {
  terminals: InitTerminal[]
  startup?: string
  keepTheme?: true
  itermBase?: string
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
  return state.keepTheme ? undefined : startupPalette(state)
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
    ...(doc.keepTheme ? { keepTheme: true as const } : {}),
    ...(doc.itermBase ? { itermBase: doc.itermBase } : {}),
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
  return (EMITTERS[terminal].emit?.(theme) ?? []).flatMap((out) => {
    const [, section, file] = out.path.split('/')
    return section === 'themes' && file !== undefined ? [{ file, content: out.content }] : []
  })
}

export function startupPalette(state: Installed): string | undefined {
  return state.startup && state.palettes.includes(state.startup) ? state.startup : state.palettes[0]
}

function blockFor(terminal: Exclude<InitTerminal, 'iterm2'>, configHome: string, startup: string | undefined) {
  const tthemeDir = join(configHome, 'ttheme')
  if (terminal === 'ghostty') {
    return { file: join(configHome, 'ghostty', 'config'), body: ghosttyBlock(tthemeDir, startup) }
  }
  if (terminal === 'kitty') {
    return { file: join(configHome, 'kitty', 'kitty.conf'), body: kittyBlock(startup) }
  }
  const themePath = startup ? join(configHome, 'alacritty', 'themes', `${startup}.toml`) : undefined
  return { file: join(configHome, 'alacritty', 'alacritty.toml'), body: alacrittyBlock(themePath) }
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
  const write = (path: string, content: string) => {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
    written.push(path)
  }

  const startup = worn(state)
  for (const terminal of state.terminals) {
    if (terminal === 'iterm2') {
      write(itermProfilesPath(home), itermFile(configHome, catalog, entries, state, home))
      continue
    }
    for (const entry of entries) {
      for (const { file, content } of themeFiles(terminal, toTheme(entry, catalog))) {
        write(join(configHome, terminal, 'themes', file), content)
      }
    }
    const { file, body } = blockFor(terminal, configHome, startup)
    const current = existsSync(file) ? readFileSync(file, 'utf8') : ''
    if (terminal === 'alacritty' && current !== '' && !current.includes('# ttheme begin')) {
      continue
    }
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, upsertBlock(current, body))
    written.push(file)
  }

  const table = join(configHome, 'ttheme', 'palettes.zsh')
  write(table, palettesZsh(entries, startup, state.terminals))
  rmSync(`${table}.zwc`, { force: true })
  return written
}

export function forget(configHome: string, catalog: Manifest, terminals: InitTerminal[], names: string[]): string[] {
  const removed: string[] = []
  for (const terminal of terminals) {
    for (const entry of catalog.palettes.filter((p) => names.includes(p.name))) {
      for (const { file } of themeFiles(terminal, toTheme(entry, catalog))) {
        const path = join(configHome, terminal, 'themes', file)
        if (existsSync(path)) {
          rmSync(path, { force: true })
          removed.push(path)
        }
      }
    }
  }
  return removed
}
