---
paths:
  - "shell/adapters/rio.zsh"
  - "src/terminals/rio*.ts"
  - "src/terminals/emit/rio*.ts"
---

# Rio

The shell layer's, the wiring's and the picture model's general rules are in `terminals.md`; these are what only Rio does.

## Conventions

- Rio (`raphamorim/rio`) reads `$XDG_CONFIG_HOME/rio/config.toml` (`RIO_CONFIG_HOME` before it, which ttheme does not follow), and a top-level `theme = "<name>"` there loads `themes/<name>.toml` beside it in place of the config's own `[colors]` (`Config::load`/`try_load` in `rio-backend/src/config/mod.rs`; a theme that does not load leaves the config's colors and shows an error). Its config has no include, so the startup palette goes through a theme of a fixed name: `sync` puts a block holding `theme = "ttheme"` at the top of the config (`upsertRioTheme`, `src/terminals/rio.ts`: a top-level key must come before the first table) once, and from then on rewrites only `themes/ttheme.toml` — the startup palette's theme in the mode worn (`rioTheme`, the same text as its `ttheme-<stem>.<mode>.toml`), or, with no startup palette, a copy of the config's own `[colors]` table (`ownColors`, cut from the text, so Rio looks as it does without ttheme while ttheme is off). A config that already sets a top-level `theme` is left alone and init says so, as it does for an `[adaptive-theme]`, whose colors Rio puts over the theme's by the system's appearance.
- Rio watches its config folder without recursion (`frontends/rioterm/src/watcher.rs`, `RecursiveMode::NonRecursive`), so a write under `themes/` is never seen: whenever `themes/ttheme.toml` changes, `sync` touches `config.toml`'s times (`utimesSync`), as the Windows Terminal wiring touches `settings.json`. A reload rebuilds the renderer from the new config and keeps the colors an OSC set (the terminal's own overrides), so a tab that never painted follows a new default and a painted one keeps its palette — parity's `reload: 'keep'`, whose model watches `config.toml` alone (`rioFiles`), so a sync that forgot the touch shows up there.
- The detection block names Rio by `TERM_PROGRAM=rio` ahead of Ghostty, since a Rio started from a Ghostty tab carries `GHOSTTY_RESOURCES_DIR`. Rio sets and answers OSC 4, 10, 11 and 12 and resets 104 and 110–112 (`rio-vt/src/performer/handler.rs`), reports focus (mode 1004) and carries the kitty graphics protocol, but leaves OSC 17 alone and answers no DSR 996, so `auto` is offered only beside a terminal that reports the appearance. Its one picture is `[window.background-image]` in the config itself, which ttheme would have to rewrite at every switch, so it gets none (`@pictures`). Read in its source at 59203ccd (2026-10-27); compat's `rio` column is unmeasured on macOS.
