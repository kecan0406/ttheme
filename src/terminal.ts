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
    pictures: false,
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
}

export function livePaint(env: Env, tty: boolean): Live | undefined {
  const terminal = detectTerminal(env)
  const traits = TRAITS[terminal]
  if (!tty || colorless(env) || env.TMUX || !traits.paints) {
    return undefined
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
