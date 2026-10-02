import { createHash } from 'node:crypto'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { writeAtomic } from './edits.ts'
import { type SchemeColors, schemeLines } from './emit/konsole.ts'
import type { PaletteEntry } from './manifest.ts'
import { colorless, paletteOsc, queryTerminalColors, restoreOsc, SLOT_CODES, schemeOsc } from './osc.ts'
import type { Wired } from './terminals/types.ts'
import { owned } from './theme.ts'

type Env = Record<string, string | undefined>

export type Terminal = Wired | 'terminal-app' | 'foot' | 'editor' | 'unknown'

export function editorOf(env: Env): string | undefined {
  if (env.NVIM) {
    return 'nvim'
  }
  if (env.VIM_TERMINAL) {
    return 'vim'
  }
  if (env.INSIDE_EMACS) {
    return 'emacs'
  }
  return env.TERM_PROGRAM === 'vscode' ? 'vscode' : undefined
}

export function detectTerminal(env: Env): Terminal {
  if (editorOf(env)) {
    return 'editor'
  }
  if (env.TERM_PROGRAM === 'WarpTerminal') {
    return 'warp'
  }
  if (env.GHOSTTY_RESOURCES_DIR || env.TERM_PROGRAM === 'ghostty') {
    return 'ghostty'
  }
  if (env.KITTY_WINDOW_ID) {
    return 'kitty'
  }
  if (env.WEZTERM_PANE) {
    return 'wezterm'
  }
  if (env.ALACRITTY_WINDOW_ID) {
    return 'alacritty'
  }
  if (env.KONSOLE_VERSION) {
    return 'konsole'
  }
  if (env.ITERM_SESSION_ID || env.TERM_PROGRAM === 'iTerm.app') {
    return 'iterm2'
  }
  if (env.TERM_PROGRAM === 'Apple_Terminal') {
    return 'terminal-app'
  }
  if (env.WT_SESSION && !env.TERM_PROGRAM) {
    return 'windows-terminal'
  }
  if (env.TERM?.startsWith('foot')) {
    return 'foot'
  }
  return 'unknown'
}

export interface Traits {
  links: boolean
  pictures: boolean
  bands: boolean
  files: boolean
  moves: boolean
  layers: boolean
  paints: boolean
  repaint?: readonly number[]
  hex?: true
  schemes?: true
}

export const TRAITS: Record<Terminal, Traits> = {
  ghostty: { links: true, pictures: true, bands: false, files: true, moves: true, layers: true, paints: true },
  kitty: { links: true, pictures: true, bands: false, files: true, moves: true, layers: true, paints: true },
  iterm2: {
    links: true,
    pictures: true,
    bands: true,
    files: true,
    moves: true,
    layers: true,
    paints: true,
    repaint: [0, 1],
  },
  wezterm: { links: true, pictures: false, bands: false, files: true, moves: true, layers: true, paints: true },
  alacritty: { links: true, pictures: false, bands: false, files: true, moves: true, layers: true, paints: true },
  'windows-terminal': {
    links: true,
    pictures: false,
    bands: false,
    files: true,
    moves: true,
    layers: true,
    paints: true,
  },
  konsole: {
    links: false,
    pictures: true,
    bands: false,
    files: true,
    moves: true,
    layers: true,
    paints: true,
    repaint: [0, 1],
    hex: true,
    schemes: true,
  },
  foot: { links: true, pictures: false, bands: false, files: true, moves: true, layers: true, paints: true },
  'terminal-app': { links: false, pictures: false, bands: false, files: true, moves: true, layers: true, paints: true },
  warp: { links: true, pictures: true, bands: true, files: false, moves: false, layers: false, paints: false },
  editor: { links: false, pictures: false, bands: false, files: true, moves: true, layers: true, paints: false },
  unknown: { links: false, pictures: false, bands: false, files: true, moves: true, layers: true, paints: true },
}

export function linkable(env: Env): boolean {
  return TRAITS[detectTerminal(env)].links
}

export function showsPictures(env: Env): boolean {
  return TRAITS[detectTerminal(env)].pictures && !env.TMUX
}

export function cropsInBands(env: Env): boolean {
  return TRAITS[detectTerminal(env)].bands
}

export function readsFiles(env: Env): boolean {
  return TRAITS[detectTerminal(env)].files
}

export function layersUnderCells(env: Env): boolean {
  return TRAITS[detectTerminal(env)].layers
}

export function movesPlacements(env: Env): boolean {
  return TRAITS[detectTerminal(env)].moves
}

export const CLEAR = '\x1b[H\x1b[K\x1b[2H\x1b[J\x1b[H'

export interface Live {
  slots: readonly number[]
  paint(entry: PaletteEntry): string
  look?(name: string, shown: readonly string[]): void
  wear(entry: PaletteEntry, wired: readonly string[]): string | undefined
  saved(): Promise<Map<string, string>>
  restore(saved: ReadonlyMap<string, string>): string
  stop?(): void
}

export const SETTLE_MS = 120
const SLICE = 4
const PACE_MS = 40

function itermProfileOf(env: Env): string | undefined {
  const shown = env.TTHEME_ITERM_SHOWN
  return env.TTHEME_ITERM_SWITCH === '1' && env.TTHEME_ITERM_DYED === '0' && shown ? `ttheme · ${shown}` : undefined
}

function itermLive(env: Env, write: (text: string) => void): Live {
  const slots = TRAITS.iterm2.repaint ?? []
  const rest = SLOT_CODES.map((_, slot) => slot).filter((slot) => !slots.includes(slot))
  const sent = new Set(slots)
  const profile = itermProfileOf(env)
  let timers: ReturnType<typeof setTimeout>[] = []
  const stop = () => {
    for (const timer of timers) {
      clearTimeout(timer)
    }
    timers = []
  }
  return {
    slots,
    paint(entry) {
      stop()
      for (let at = 0; at < rest.length; at += SLICE) {
        const part = rest.slice(at, at + SLICE)
        const timer = setTimeout(
          () => {
            for (const slot of part) {
              sent.add(slot)
            }
            write(paletteOsc(entry, part))
          },
          SETTLE_MS + (at / SLICE) * PACE_MS,
        )
        timer.unref?.()
        timers.push(timer)
      }
      return paletteOsc(entry, slots)
    },
    wear: (entry) => paletteOsc(entry),
    saved: () => queryTerminalColors(),
    restore(saved) {
      stop()
      const codes = SLOT_CODES.filter((_, slot) => sent.has(slot))
      return profile
        ? `\x1b[?2026h${restoreOsc(new Map(), codes)}\x1b]1337;SetProfile=${profile}\x07\x1b[?2026l`
        : restoreOsc(saved, codes)
    },
    stop,
  }
}

const KONSOLE_VIEWS = 3

const WALLPAPER = /^(Wallpaper|FillStyle|Anchor|WallpaperOpacity|WallpaperFlipType)=/

function konsoleDirs(env: Env): string[] {
  return [
    env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'),
    ...(env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':'),
  ].map((dir) => join(dir, 'konsole'))
}

function wallpaperOf(dirs: readonly string[], look: string): string[] {
  const scheme = /(?:^|;)ColorScheme=([^;]+)/.exec(look)?.[1]
  const file = scheme && dirs.map((dir) => join(dir, `${scheme}.colorscheme`)).find((path) => existsSync(path))
  if (!file) {
    return ['Wallpaper=']
  }
  const lines = readFileSync(file, 'utf8').split('\n')
  const at = lines.findIndex((line) => line.trim() === '[General]')
  const end = lines.findIndex((line, i) => i > at && line.trimStart().startsWith('['))
  const general = at < 0 ? [] : lines.slice(at + 1, end < 0 ? undefined : end).filter((line) => WALLPAPER.test(line))
  return general.length > 0 ? general : ['Wallpaper=']
}

function konsoleLive(env: Env, look: string, write: (text: string) => void): Live {
  const dirs = konsoleDirs(env)
  const dir = dirs[0] as string
  const general = wallpaperOf(dirs, look)
  const views: string[] = []
  const show = (name: string, colors: SchemeColors, cursor: string) => {
    const text = schemeLines(colors, `ttheme · ${name}`, general).join('\n')
    const scheme = `${owned('view')}.${createHash('sha1').update(text).digest('hex').slice(0, 10)}`
    const file = join(dir, `${scheme}.colorscheme`)
    if (!existsSync(file)) {
      writeAtomic(file, text)
    }
    if (!views.includes(file)) {
      views.push(file)
    }
    for (const old of views.splice(0, Math.max(0, views.length - KONSOLE_VIEWS))) {
      rmSync(old, { force: true })
    }
    return schemeOsc(scheme, cursor)
  }
  const sweep = () => {
    for (const file of views.splice(0)) {
      rmSync(file, { force: true })
    }
  }
  return {
    slots: [],
    paint: (entry) => show(entry.name, entry, entry.cursor),
    look: (name, shown) => {
      const [background = '', foreground = '', cursor = '', , ...ansi] = shown
      write(show(name, { background, foreground, ansi }, cursor))
    },
    wear: (entry, wired) => (wired.includes('konsole') ? schemeOsc(owned(entry.name), entry.cursor) : undefined),
    saved: async () => new Map(),
    restore: () => {
      sweep()
      return `\x1b]50;${look}\x07`
    },
    stop: sweep,
  }
}

export function livePaint(
  env: Env,
  tty: boolean,
  write: (text: string) => void = (text) => {
    process.stdout.write(text)
  },
): Live | undefined {
  const terminal = detectTerminal(env)
  const traits = TRAITS[terminal]
  if (!tty || colorless(env) || env.TMUX || !traits.paints) {
    return undefined
  }
  if (terminal === 'iterm2') {
    return itermLive(env, write)
  }
  if (terminal === 'konsole' && env.TTHEME_KONSOLE_LOOK) {
    return konsoleLive(env, env.TTHEME_KONSOLE_LOOK, write)
  }
  const slots = traits.repaint ?? SLOT_CODES.map((_, slot) => slot)
  const codes = SLOT_CODES.filter((_, slot) => slots.includes(slot))
  return {
    slots,
    paint: (entry) => paletteOsc(entry, slots),
    wear: (entry, wired) =>
      !traits.schemes
        ? paletteOsc(entry)
        : wired.includes(terminal)
          ? schemeOsc(owned(entry.name), entry.cursor)
          : undefined,
    saved: () => queryTerminalColors(codes),
    restore: (saved) => restoreOsc(saved, codes, traits.hex === true),
  }
}
