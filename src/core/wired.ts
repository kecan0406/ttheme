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
  'rio',
] as const

export type Wired = (typeof WIRED)[number]
