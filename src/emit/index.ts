import { stem, type Theme } from '../theme.ts'

export interface Output {
  path: string
  content: string
}

export interface Emitter {
  id: string
  limits?: string
  emit?(theme: Theme): Output[]
  emitShared?(themes: Theme[]): Output[]
}

export function owned(name: string): string {
  return `ttheme-${stem(name)}`
}

export function banner(theme: Theme): string[] {
  return [`# ${theme.name} — ${theme.group}${theme.native ? ` (${theme.native})` : ''}`, `# ANSI: ${theme.ansiSource}`]
}

export { alacritty } from './alacritty.ts'
export { ghostty } from './ghostty.ts'
export { iterm2 } from './iterm2.ts'
export { kitty } from './kitty.ts'
export { meta } from './manifest.ts'
export { shell } from './shell.ts'
export { warp } from './warp.ts'
export { wezterm } from './wezterm.ts'
export { windowsTerminal } from './windows-terminal.ts'
