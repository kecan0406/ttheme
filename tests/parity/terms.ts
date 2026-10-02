import { SLOT_CODES } from '../../src/osc.ts'
import type { Wired } from '../../src/terminals/types.ts'

export const TERMS = [
  'ghostty',
  'iterm2',
  'kitty',
  'alacritty',
  'wezterm',
  'windows-terminal',
  'warp',
  'konsole',
  'terminal-app',
] as const

export type Term = (typeof TERMS)[number]

export const REFERENCE: Term = 'ghostty'

export const ANSI = SLOT_CODES.filter((code) => code.startsWith('4;'))

export const SEEN = ['11', '10', '12', ...ANSI]

export type Colors = Map<string, string>

export interface Behavior {
  draws: readonly string[]
  answers: readonly string[]
  resets: boolean
  baseline: boolean
  focus: 'answer' | 'change' | 'none'
  cells: readonly ('pixels' | 'points' | 'iterm')[]
  graphics: boolean
  relative: boolean
  syncQuery: boolean
  reload: 'keep' | 'reset' | 'none'
  pictures: 'app' | 'tab' | 'window' | 'none'
  front: 'tty' | 'none'
  promptTrap: boolean
  cache: 'weak' | 'none'
}

const EVERY = SLOT_CODES
const NO_SELECTION = SLOT_CODES.filter((code) => code !== '17')

export const BEHAVIOR: Record<Term, Behavior> = {
  ghostty: {
    draws: NO_SELECTION,
    answers: NO_SELECTION,
    resets: true,
    baseline: false,
    focus: 'answer',
    cells: ['pixels', 'points'],
    graphics: true,
    relative: true,
    syncQuery: true,
    reload: 'keep',
    pictures: 'app',
    front: 'tty',
    promptTrap: true,
    cache: 'none',
  },
  iterm2: {
    draws: EVERY,
    answers: EVERY,
    resets: true,
    baseline: true,
    focus: 'change',
    cells: ['iterm', 'points'],
    graphics: true,
    relative: false,
    syncQuery: true,
    reload: 'keep',
    pictures: 'tab',
    front: 'none',
    promptTrap: true,
    cache: 'none',
  },
  kitty: {
    draws: EVERY,
    answers: EVERY,
    resets: true,
    baseline: false,
    focus: 'change',
    cells: ['pixels', 'points'],
    graphics: true,
    relative: true,
    syncQuery: true,
    reload: 'reset',
    pictures: 'window',
    front: 'none',
    promptTrap: true,
    cache: 'none',
  },
  alacritty: {
    draws: NO_SELECTION,
    answers: NO_SELECTION,
    resets: true,
    baseline: false,
    focus: 'change',
    cells: ['points'],
    graphics: false,
    relative: false,
    syncQuery: true,
    reload: 'keep',
    pictures: 'none',
    front: 'none',
    promptTrap: true,
    cache: 'none',
  },
  wezterm: {
    draws: EVERY,
    answers: EVERY,
    resets: true,
    baseline: false,
    focus: 'change',
    cells: ['pixels', 'points'],
    graphics: true,
    relative: false,
    syncQuery: false,
    reload: 'keep',
    pictures: 'window',
    front: 'none',
    promptTrap: true,
    cache: 'none',
  },
  'windows-terminal': {
    draws: EVERY,
    answers: EVERY,
    resets: true,
    baseline: false,
    focus: 'change',
    cells: [],
    graphics: false,
    relative: false,
    syncQuery: true,
    reload: 'reset',
    pictures: 'none',
    front: 'none',
    promptTrap: true,
    cache: 'none',
  },
  warp: {
    draws: ['10', ...ANSI],
    answers: ['11', '10', '12'],
    resets: true,
    baseline: false,
    focus: 'none',
    cells: ['points'],
    graphics: true,
    relative: false,
    syncQuery: true,
    reload: 'none',
    pictures: 'app',
    front: 'none',
    promptTrap: true,
    cache: 'none',
  },
  konsole: {
    draws: ['11', '10'],
    answers: ['11', '10', ...ANSI],
    resets: false,
    baseline: false,
    focus: 'change',
    cells: ['pixels', 'points'],
    graphics: true,
    relative: false,
    syncQuery: true,
    reload: 'none',
    pictures: 'tab',
    front: 'none',
    promptTrap: true,
    cache: 'weak',
  },
  'terminal-app': {
    draws: EVERY,
    answers: EVERY,
    resets: false,
    baseline: false,
    focus: 'none',
    cells: ['points'],
    graphics: false,
    relative: false,
    syncQuery: true,
    reload: 'none',
    pictures: 'none',
    front: 'none',
    promptTrap: true,
    cache: 'none',
  },
}

const reportsFocus = (b: Behavior) => b.focus !== 'none'

export const MEASURED: { id: string; holds: (b: Behavior) => boolean }[] = [
  { id: 'painted', holds: (b) => b.draws.includes('11') },
  { id: 'fg-painted', holds: (b) => b.draws.includes('10') },
  { id: 'ansi-painted', holds: (b) => b.draws.includes('4;1') },
  { id: 'osc-bg', holds: (b) => b.answers.includes('11') },
  { id: 'osc-fg', holds: (b) => b.answers.includes('10') },
  { id: 'osc-cursor', holds: (b) => b.answers.includes('12') },
  { id: 'osc-selection', holds: (b) => b.answers.includes('17') },
  { id: 'osc-ansi', holds: (b) => b.answers.includes('4;1') },
  { id: 'osc-reset', holds: (b) => b.resets },
  { id: 'reset-baseline', holds: (b) => b.baseline },
  { id: 'cell-size', holds: (b) => b.cells.includes('pixels') || b.cells.includes('iterm') },
  { id: 'cell-points', holds: (b) => b.cells.includes('points') },
  { id: 'kitty-graphics', holds: (b) => b.graphics },
  { id: 'sync-query', holds: (b) => b.syncQuery },
  { id: 'focus-report', holds: reportsFocus },
  { id: 'focus-event', holds: reportsFocus },
  { id: 'focus-answer', holds: (b) => b.focus === 'answer' },
  { id: 'front-tty', holds: (b) => b.front === 'tty' },
  { id: 'prompt-trap', holds: (b) => b.promptTrap },
  { id: 'scheme-picture', holds: (b) => b.pictures !== 'none' && b.cache !== 'none' },
  { id: 'scheme-held', holds: (b) => b.cache !== 'none' },
  { id: 'scheme-released', holds: (b) => b.cache === 'weak' },
  { id: 'scheme-fresh', holds: (b) => b.cache !== 'none' },
]

export const WIRING: Record<Term, Wired | undefined> = {
  ghostty: 'ghostty',
  iterm2: 'iterm2',
  kitty: 'kitty',
  alacritty: 'alacritty',
  wezterm: 'wezterm',
  'windows-terminal': 'windows-terminal',
  warp: 'warp',
  konsole: 'konsole',
  'terminal-app': undefined,
}

export const CAPABILITIES = {
  pictures: (term: Term) => BEHAVIOR[term].pictures !== 'none',
  wired: (term: Term) => WIRING[term] !== undefined,
} as const

export type Capability = keyof typeof CAPABILITIES

export function identity(term: Term, n: number, session: string): Record<string, string> {
  switch (term) {
    case 'ghostty':
      return { GHOSTTY_RESOURCES_DIR: '/nonexistent/ghostty', TERM_PROGRAM: 'ghostty' }
    case 'iterm2':
      return { TERM_PROGRAM: 'iTerm.app', ITERM_SESSION_ID: `w0t${n}p0:${session}`, LC_TERMINAL: 'iTerm2' }
    case 'kitty':
      return { KITTY_WINDOW_ID: String(n + 1) }
    case 'alacritty':
      return { ALACRITTY_WINDOW_ID: String(n + 1) }
    case 'wezterm':
      return { WEZTERM_PANE: String(n), TERM_PROGRAM: 'WezTerm' }
    case 'windows-terminal':
      return { WT_SESSION: session, WT_PROFILE_ID: WT_PROFILE }
    case 'warp':
      return { TERM_PROGRAM: 'WarpTerminal', WARP_TERMINAL_SESSION_UUID: session.replaceAll('-', '') }
    case 'konsole':
      return {
        KONSOLE_VERSION: '230805',
        KONSOLE_DBUS_SERVICE: ':1.7',
        KONSOLE_DBUS_SESSION: `/Sessions/${n + 1}`,
        KONSOLE_DBUS_WINDOW: '/Windows/1',
      }
    case 'terminal-app':
      return { TERM_PROGRAM: 'Apple_Terminal', TERM_SESSION_ID: `w0t${n}p0:${session}` }
  }
}

export const WT_PROFILE = '{2c4de342-38b7-51cf-b940-2309a097f518}'

export const OWN: Colors = new Map([
  ['11', '#101a2c'],
  ['10', '#cfd3dc'],
  ['12', '#cfd3dc'],
  ['17', '#3a4458'],
  ...[
    '#000000',
    '#c23621',
    '#25bc24',
    '#adad27',
    '#492ee1',
    '#d338d3',
    '#33bbc8',
    '#cbcccd',
    '#818383',
    '#fc391f',
    '#31e722',
    '#eaec23',
    '#5833ff',
    '#f935f8',
    '#14f0f0',
    '#e9ebeb',
  ].map((color, i): [string, string] => [`4;${i}`, color]),
])
