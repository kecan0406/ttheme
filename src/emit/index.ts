import type { Theme } from "../theme.ts";

export interface Output {
  path: string;
  content: string;
}

export interface Emitter {
  id: string;
  limits?: string;
  emit(theme: Theme): Output[];
  emitShared?(themes: Theme[]): Output[];
}

export { alacritty } from "./alacritty.ts";
export { ghostty } from "./ghostty.ts";
export { iterm2 } from "./iterm2.ts";
export { kitty } from "./kitty.ts";
export { wezterm } from "./wezterm.ts";
