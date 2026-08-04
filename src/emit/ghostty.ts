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
      "palette-generate = true",
      "",
      "macos-icon = custom-style",
      `macos-icon-ghost-color = ${theme.ghostty.iconGhost}`,
      `macos-icon-screen-color = ${theme.ghostty.iconScreen.join(",")}`,
      "macos-icon-frame = chrome",
      "",
    ].join("\n");

    return [{ path: `ghostty/themes/${theme.name}`, content: colors }];
  },

  emitShared(themes: Theme[]): Output[] {
    const [first] = themes;
    if (!first) return [];

    for (const t of themes) {
      if (
        JSON.stringify(t.font) !== JSON.stringify(first.font) ||
        t.ghostty.shader !== first.ghostty.shader
      ) {
        throw new Error(
          `${t.name}: per-theme font/shader overrides cannot be expressed` +
            ` in the shared ghostty/ttheme.conf`,
        );
      }
    }

    const config = [
      "# ttheme — shared font and shader, identical for every palette.",
      "# Pick colors with:  theme = <palette>",
      `font-family = ${first.font.family}`,
      `font-size = ${first.font.size}`,
      ...first.font.codepointMap.map(
        (m) => `font-codepoint-map = ${m.range}=${m.family}`,
      ),
      ...(first.ghostty.shader
        ? [
            "",
            `custom-shader = ~/.config/ghostty/shaders/${first.ghostty.shader}`,
            "custom-shader-animation = true",
          ]
        : []),
      "",
    ].join("\n");

    return [{ path: "ghostty/ttheme.conf", content: config }];
  },
};
