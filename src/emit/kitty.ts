import type { Theme } from "../theme.ts";
import type { Emitter, Output } from "./index.ts";

export const kitty: Emitter = {
  id: "kitty",
  limits: "no GLSL shaders, no per-codepoint font mapping",

  emit(theme: Theme): Output[] {
    const colors = [
      `# ${theme.name} — ${theme.group}${theme.native ? ` (${theme.native})` : ""}`,
      `# ANSI: ${theme.ansiSource}`,
      `background ${theme.background}`,
      `foreground ${theme.foreground}`,
      `cursor ${theme.cursor}`,
      `cursor_text_color ${theme.background}`,
      `selection_background ${theme.selectionBackground}`,
      `selection_foreground ${theme.foreground}`,
      ...theme.ansi.map((c, i) => `color${i} ${c}`),
      "",
    ].join("\n");

    const config = [
      `# ${theme.name} — font settings.`,
      `# Pair with the palette:  include themes/${theme.name}.conf`,
      `font_family ${theme.font.family}`,
      `font_size ${theme.font.size}`,
      "",
    ].join("\n");

    return [
      { path: `kitty/themes/${theme.name}.conf`, content: colors },
      { path: `kitty/config/${theme.name}.conf`, content: config },
    ];
  },
};
