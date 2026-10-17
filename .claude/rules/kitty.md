---
paths:
  - "shell/adapters/kitty.zsh"
  - "src/terminals/kitty*.ts"
  - "src/terminals/emit/kitty*.ts"
---

# kitty

The shell layer's, the wiring's and the picture model's general rules are in `terminals.md`; these are what only kitty does.

## Conventions

- kitty is wired through a watcher `sync` writes to `~/.config/ttheme/kitty.py` (`kittyWatcher`, `src/terminals/emit/kitty.ts`), loaded by ttheme's `~/.config/ttheme/kitty.conf`, which the kitty block includes (`watcher`, plus `window_logo_scale 100` and `window_logo_alpha 1` unless kitty.conf sets them itself, and an include of the startup palette's theme file). The kitty adapter talks to it through user vars (`__tt_kitty_var`, the value base64'd in zsh by `__tt_b64s`, so a paint — every preview hover among them — forks nothing): `ttheme_worn` on every paint and reset, sent ahead of the colors so a reload landing between the two puts back the new palette, not the old (the `__tt_worn` hook in `_osc.zsh`), `ttheme_shown` from `__tt_shown`, and `ttheme_startup` from `__tt_reloaded` after `palettes.zsh` moves. A window's picture is its logo, read from `backgrounds/<palette>.conf` with its includes and re-read on focus; kitty 0.49 draws logos at the global alpha and scale only (`draw_window_logo`), so the watcher fades the PNG's alpha to the opacity itself (`load_png_data`/`png_from_32bit_rgba_data`, about 0.3 s for a 1880×1008 picture, cached). kitty's `auto_reload_config` (on by default) reloads when `kitty.conf` or any file it includes changes, and a reload resets every OSC color (measured): the watcher wraps `boss.load_config_file` and puts each window's `ttheme_worn` palette back right after it, and `ttheme_startup` patches the configured colors (`patch_colors(…, True, ())`, which leaves open windows alone) for a kitty whose auto reload is off. Preview and find reuse `_bg.zsh`: kitty draws below-background placements above the logo, so preview's layers cover it; the adapter places them absolutely (no relative placements, no margins). `sync` writes a file only when its content changed, so an add or remove that leaves kitty's files alone reloads nothing.

## Gotchas

- kitty on macOS draws nothing while its window is occluded or the screen is locked (`windowDidChangeOcclusionState`), and `get_window_logo_settings_if_not_default` reads a logo only once it has been drawn — so a kitty screenshot needs the window in front on an unlocked screen, while OSC queries and user vars work either way. `ioreg -n Root -d1 | grep CGSSessionScreenIsLocked` tells.
