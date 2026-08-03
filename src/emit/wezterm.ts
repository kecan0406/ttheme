import type { Theme } from "../theme.ts";
import type { Emitter, Output } from "./index.ts";

const list = (colors: readonly string[]) =>
  `[${colors.map((c) => `"${c}"`).join(", ")}]`;

export const wezterm: Emitter = {
  id: "wezterm",
  limits: "no shaders; runtime overrides are per-window, never per-pane",

  emit(theme: Theme): Output[] {
    const colors = [
      "[metadata]",
      `name = "${theme.name}"`,
      `origin_url = "${theme.ansiSource}"`,
      "",
      "[colors]",
      `foreground = "${theme.foreground}"`,
      `background = "${theme.background}"`,
      `cursor_bg = "${theme.cursor}"`,
      `cursor_border = "${theme.cursor}"`,
      `cursor_fg = "${theme.background}"`,
      `selection_bg = "${theme.selectionBackground}"`,
      `selection_fg = "${theme.foreground}"`,
      "",
      `ansi = ${list(theme.ansi.slice(0, 8))}`,
      `brights = ${list(theme.ansi.slice(8, 16))}`,
      "",
    ].join("\n");

    const config = [
      `-- ${theme.name} — font settings.`,
      `-- Merge into your wezterm.lua config table:`,
      `--   local t = require("ttheme.${theme.name}")`,
      `--   config.color_scheme = "${theme.name}"`,
      `--   config.font = t.font`,
      `--   config.font_size = t.font_size`,
      "return {",
      `  font = require("wezterm").font("${theme.font.family}"),`,
      `  font_size = ${theme.font.size},`,
      "}",
      "",
    ].join("\n");

    return [
      { path: `wezterm/colors/${theme.name}.toml`, content: colors },
      { path: `wezterm/config/${theme.name}.lua`, content: config },
    ];
  },
};
