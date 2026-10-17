---
paths:
  - "shell/adapters/alacritty.zsh"
  - "src/terminals/alacritty*.ts"
  - "src/terminals/emit/alacritty*.ts"
---

# Alacritty

The shell layer's, the wiring's and the picture model's general rules are in `terminals.md`; these are what only Alacritty does.

## Conventions

- Alacritty takes its startup palette through `general.import`: the config Alacritty reads (`alacrittyConfig`, the first `alacritty.toml` of `$XDG_CONFIG_HOME/alacritty/`, `$XDG_CONFIG_HOME/`, `~/.config/alacritty/` and `~/` — Alacritty reads one file, so a new one there would hide the user's, and none is wired while it still reads an `alacritty.yml`) imports `~/.config/ttheme/alacritty.toml`, which imports the startup palette's theme file (nested imports, at most five deep). `upsertAlacrittyImport` (`src/terminals/alacritty.ts`) appends a `[general]` block to a config without that table, or puts the import line inside the config's own `[general]` (TOML defines a table once), and leaves a config that already imports there or defines `general` otherwise alone — init notes it. Alacritty live-reloads the config and its imports and keeps OSC colors through a reload (measured).

## Gotchas

- Alacritty's parser (vte) keeps at most 16 OSC parameters and drops an OSC 4 whose count then comes out even, so a palette in one OSC 4 never reached Alacritty's ANSI colors: every OSC 4 carries one color (`__tt_osc_apply`, `paletteOsc`).
