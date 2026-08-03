import type { Theme } from "../theme.ts";
import type { Emitter, Output } from "./index.ts";

export const ghostty: Emitter = {
  id: "ghostty",

  emit(theme: Theme): Output[] {
    const colors = [
      `# ${theme.name} — ${theme.group}${theme.native ? ` (${theme.native})` : ""}`,
      `# ANSI: ${theme.ansiSource}`,
      `background = ${theme.background}`,
      `foreground = ${theme.foreground}`,
      `cursor-color = ${theme.cursor}`,
      `selection-background = ${theme.selectionBackground}`,
      `selection-foreground = ${theme.foreground}`,
      ...theme.ansi.map((c, i) => `palette = ${i}=${c}`),
      "",
    ].join("\n");

    const config = [
      `# ${theme.name} — font, shader and dock icon.`,
      `# Pair with the palette:  theme = ${theme.name}`,
      `font-family = ${theme.font.family}`,
      `font-size = ${theme.font.size}`,
      ...theme.font.codepointMap.map(
        (m) => `font-codepoint-map = ${m.range}=${m.family}`,
      ),
      "",
      ...(theme.ghostty.shader
        ? [
            `custom-shader = ~/.config/ghostty/shaders/${theme.ghostty.shader}`,
            "custom-shader-animation = true",
            "",
          ]
        : []),
      "macos-icon = custom-style",
      `macos-icon-ghost-color = ${theme.ghostty.iconGhost}`,
      ...(theme.ghostty.iconScreen
        ? [`macos-icon-screen-color = ${theme.ghostty.iconScreen}`]
        : []),
      "macos-icon-frame = chrome",
      "",
    ].join("\n");

    return [
      { path: `ghostty/themes/${theme.name}`, content: colors },
      { path: `ghostty/config/${theme.name}.conf`, content: config },
    ];
  },
};
