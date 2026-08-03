import type { Theme } from "../theme.ts";
import type { Emitter, Output } from "./index.ts";

const NAMES = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
];

function block(header: string, colors: readonly string[]): string {
  return [
    header,
    ...NAMES.map((name, i) => `${name} = '${colors[i]}'`),
    "",
  ].join("\n");
}

export const alacritty: Emitter = {
  id: "alacritty",
  limits: "no shaders, no runtime color API (OSC only)",

  emit(theme: Theme): Output[] {
    const colors = [
      `# ${theme.name} — ${theme.group}${theme.native ? ` (${theme.native})` : ""}`,
      `# ANSI: ${theme.ansiSource}`,
      "",
      "[colors.primary]",
      `background = '${theme.background}'`,
      `foreground = '${theme.foreground}'`,
      "",
      "[colors.cursor]",
      `cursor = '${theme.cursor}'`,
      `text = '${theme.background}'`,
      "",
      "[colors.selection]",
      `background = '${theme.selectionBackground}'`,
      `text = '${theme.foreground}'`,
      "",
      block("[colors.normal]", theme.ansi.slice(0, 8)),
      block("[colors.bright]", theme.ansi.slice(8, 16)),
    ].join("\n");

    const config = [
      `# ${theme.name} — font settings.`,
      `# Pair with the palette:  import = ["~/.config/alacritty/themes/${theme.name}.toml"]`,
      "",
      "[font]",
      `size = ${theme.font.size}`,
      "",
      "[font.normal]",
      `family = '${theme.font.family}'`,
      "",
    ].join("\n");

    return [
      { path: `alacritty/themes/${theme.name}.toml`, content: colors },
      { path: `alacritty/config/${theme.name}.toml`, content: config },
    ];
  },
};
