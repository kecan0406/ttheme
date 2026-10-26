import { WIRED, type Wired } from '../core/wired.ts'
import { alacritty } from './alacritty.ts'
import { ghostty } from './ghostty.ts'
import { iterm2 } from './iterm2.ts'
import { kitty } from './kitty.ts'
import { konsole } from './konsole.ts'
import { rio } from './rio.ts'
import { terminalApp } from './terminal-app.ts'
import type { Wiring } from './types.ts'
import { warp } from './warp.ts'
import { wezterm } from './wezterm.ts'
import { windowsTerminal } from './windows-terminal.ts'

export const WIRINGS: Record<Wired, Wiring> = {
  ghostty,
  kitty,
  alacritty,
  wezterm,
  iterm2,
  'windows-terminal': windowsTerminal,
  warp,
  konsole,
  'terminal-app': terminalApp,
  rio,
}

export function wirings(ids: readonly Wired[] = WIRED): Wiring[] {
  return ids.map((id) => WIRINGS[id])
}
