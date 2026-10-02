import type { Emitter } from '../emit/types.ts'
import type { PaletteEntry } from '../manifest.ts'
import type { Installed } from '../palettes.ts'
import type { Theme } from '../theme.ts'

export const WIRED = [
  'ghostty',
  'kitty',
  'alacritty',
  'wezterm',
  'iterm2',
  'windows-terminal',
  'warp',
  'konsole',
  'terminal-app',
] as const
export type Wired = (typeof WIRED)[number]

export interface At {
  configHome: string
  home: string
}

export interface Setup extends At {
  wtHome?: string
  wtProfile?: string
}

export interface Now extends At {
  state: Installed
  startup: string | undefined
}

export interface Ctx extends Now {
  entries: PaletteEntry[]
  themes: Theme[]
  host: Host
}

export interface Out {
  write(path: string, content: string): boolean
  wire(path: string, content: string): void
  note(path: string): void
  remove(path: string): void
  themes(wiring: Wiring): void
  repaint(): void
}

export interface Unwired {
  edits: { file: string; content: string }[]
  removals: string[]
  touches: string[]
}

export interface Host {
  platform: NodeJS.Platform
  env: Record<string, string | undefined>
  run(command: string, args: readonly string[]): string | undefined
}

export interface Moment extends Now {
  host: Host
}

export interface Pointed {
  restart: boolean
}

export interface Defaults {
  key: 'itermBase' | 'konsoleBase' | 'terminalBase'
  profile(startup: string): string
  base(moment: Moment): Installed
  point(moment: Moment, take: boolean): Pointed | undefined
}

export interface Shelf {
  from: string
  dir(at: At): string
}

export interface Wiring {
  id: Wired
  name: string
  emitter: Emitter
  shelf?: Shelf
  bakes?: true
  offered(setup: Setup, host: Host): boolean
  present(setup: Setup): boolean
  installs?(setup: Setup): Partial<Installed>
  sync(ctx: Ctx, out: Out): void
  pictures?(ctx: Ctx, out: Out): void
  layer?(now: Now, host: Host): Record<string, string>
  plan(now: Now): string[]
  notes(now: Now): string[]
  next(now: Now, pointed: Pointed | undefined): string[]
  unwire(at: At, state: Installed | undefined): Unwired
  defaults?: Defaults
}
