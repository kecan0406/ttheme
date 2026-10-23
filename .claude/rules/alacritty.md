---
paths:
  - "shell/adapters/alacritty.zsh"
  - "src/terminals/alacritty*.ts"
  - "src/terminals/emit/alacritty*.ts"
---

# Alacritty

The shell layer's, the wiring's and the picture model's general rules are in `terminals.md`; these are what only Alacritty does.

## Conventions

- Alacritty takes its startup palette through `general.import`: the config Alacritty reads (`alacrittyConfig`, the first `alacritty.toml` of `$XDG_CONFIG_HOME/alacritty/`, `$XDG_CONFIG_HOME/`, `~/.config/alacritty/` and `~/` — Alacritty reads one file, so a new one there would hide the user's, and none is wired while it still reads an `alacritty.yml`) imports `~/.config/ttheme/alacritty.toml`, which imports the startup palette's theme file in the mode worn (`ttheme-<stem>.<mode>.toml`: both modes are written, so a mode switch rewrites only this import, and `sync` writes it before the themes whenever the file it names is already there, since Alacritty reloads 10 ms after a change it sees — measured in a real Alacritty on a copy of a 216-palette install, alternated with the build that rewrote every theme file instead: a verb's window crossed half its change 135–137 ms after the key written first and 146–149 ms written after the other 431 files' comparison, against 107–118 ms then, though `sync` now writes it about 15 ms earlier than it wrote that file, and settled at 145–146 ms against 174–181; nested imports, at most five deep). `upsertAlacrittyImport` (`src/terminals/alacritty.ts`) appends a `[general]` block to a config without that table, or puts the import line inside the config's own `[general]` (TOML defines a table once), and leaves a config that already imports there or defines `general` otherwise alone — init notes it. Alacritty live-reloads the config and its imports and keeps OSC colors through a reload (measured).

## Gotchas

- Alacritty's parser (vte) keeps at most 16 OSC parameters and drops an OSC 4 whose count then comes out even, so a palette in one OSC 4 never reached Alacritty's ANSI colors: every OSC 4 carries one color (`__tt_osc_apply`, `paletteOsc`).
