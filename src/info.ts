import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { arch, platform, release } from 'node:os'
import pkg from '../package.json' with { type: 'json' }
import { configHome, readInstalled } from './palettes.ts'
import { detectTerminal, type Terminal } from './terminal.ts'
import { SETTING_NAMES, settingDefault } from './wiring.ts'

type Env = Record<string, string | undefined>

const PROGRAM: Partial<Record<Terminal, string>> = {
  ghostty: 'ghostty',
  iterm2: 'iTerm.app',
  wezterm: 'WezTerm',
  'terminal-app': 'Apple_Terminal',
  warp: 'WarpTerminal',
}

function terminalVersion(terminal: Terminal, env: Env): string | undefined {
  if (terminal === 'konsole') {
    const parts = /^(\d{2})(\d{2})(\d{2})$/.exec(env.KONSOLE_VERSION ?? '')
    return parts ? `${parts[1]}.${parts[2]}.${Number(parts[3])}` : env.KONSOLE_VERSION
  }
  const program = PROGRAM[terminal]
  return program !== undefined && env.TERM_PROGRAM === program ? env.TERM_PROGRAM_VERSION : undefined
}

export function describeTerminal(env: Env): string {
  const terminal = detectTerminal(env)
  const program = env.TERM_PROGRAM && env.TERM_PROGRAM !== 'tmux' ? env.TERM_PROGRAM : undefined
  const name =
    terminal === 'unknown'
      ? `unknown${program ? ` (TERM_PROGRAM=${program})` : ''}`
      : `${terminal} ${terminalVersion(terminal, env) ?? '(version unknown)'}`
  const tmuxVersion = env.TERM_PROGRAM === 'tmux' ? env.TERM_PROGRAM_VERSION : undefined
  return [
    name,
    env.TMUX ? `tmux ${tmuxVersion ?? 'yes'}` : 'tmux no',
    env.SSH_CONNECTION || env.SSH_TTY ? 'ssh yes' : 'ssh no',
  ].join(' · ')
}

function run(command: string, args: string[]): string | undefined {
  try {
    return execFileSync(command, args, { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return undefined
  }
}

function osLine(): string {
  const cpu = arch()
  if (platform() === 'darwin') {
    return `macOS ${run('sw_vers', ['-productVersion']) ?? `(Darwin ${release()})`} · ${cpu}`
  }
  if (platform() === 'linux') {
    let text = ''
    try {
      text = readFileSync('/etc/os-release', 'utf8')
    } catch {}
    return `${/^PRETTY_NAME="?([^"\n]*)"?$/m.exec(text)?.[1] ?? 'Linux'} · linux ${release()} · ${cpu}`
  }
  return `${platform() === 'win32' ? 'Windows' : platform()} ${release()} · ${cpu}`
}

function shellLine(env: Env): string {
  if (env.TTHEME_ZSH) {
    return `zsh ${env.TTHEME_ZSH}`
  }
  return (env.SHELL ? run(env.SHELL, ['--version'])?.split('\n')[0] : undefined) ?? env.SHELL ?? 'unknown'
}

function wiredLine(home: string): string {
  try {
    const { terminals } = readInstalled(home)
    return terminals.length > 0 ? terminals.join(', ') : 'none'
  } catch {
    return 'installed.json missing or unreadable'
  }
}

function settingsLine(env: Env): string | undefined {
  const changed = SETTING_NAMES.flatMap((name) => {
    const value = env[name]
    return value === undefined || value === settingDefault(name)
      ? []
      : [`${name}=${/\s/.test(value) ? JSON.stringify(value) : value}`]
  })
  return changed.length > 0 ? changed.join(' ') : undefined
}

export function runInfo(): void {
  const env = process.env
  const rows: [string, string | undefined][] = [
    ['ttheme', pkg.version],
    ['OS', osLine()],
    ['Shell', shellLine(env)],
    ['Terminal', describeTerminal(env)],
    ['Wired', wiredLine(configHome())],
    ['Settings', settingsLine(env)],
  ]
  const shown = rows.filter((row): row is [string, string] => row[1] !== undefined)
  const width = Math.max(...shown.map(([label]) => label.length))
  for (const [label, value] of shown) {
    console.log(`${label.padEnd(width)}  ${value}`)
  }
}
