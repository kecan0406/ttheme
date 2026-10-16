---
paths:
  - "shell/adapters/wezterm.zsh"
  - "src/terminals/wezterm.ts"
  - "src/terminals/emit/wezterm.ts"
  - "shell/adapters/_wired.zsh"
  - "src/terminals/terminal.ts"
  - "tests/parity/**"
  - "tests/compat/**"
  - ".claude/skills/sandbox/**"
---

# WezTerm

The shell layer's, the wiring's and the picture model's general rules are in `terminals.md`; these are what only WezTerm does.

## Conventions

- WezTerm's config is Lua, so `sync` writes `~/.config/ttheme/wezterm.lua` (`weztermModule`, `src/terminals/emit/wezterm.ts`: the startup `color_scheme`, the colors dir, and a picture handler) and keeps a `-- ttheme begin`/`-- ttheme end` block that `dofile`s it, once `io.open` finds it, just before the user config's last `return config` (`upsertLuaBlock`; `~/.wezterm.lua` wins over `$XDG_CONFIG_HOME/wezterm/wezterm.lua`, as in WezTerm) — a config with no such line is left alone and init says so; WezTerm reloads the module on its own because it watches it. Its OSC palette is per pane but a `background` is per window: the shell's `__tt_shown` (wezterm adapter) sets the pane's `ttheme_shown` user var, and the module's `user-var-changed` and `update-status` handlers put the active pane's picture on its window through `set_config_overrides`, reading `backgrounds/<palette>.conf` with its `.tune`/`.off` includes itself, so nothing reloads when a picture changes elsewhere; while preview is open it sends `ttheme_view` instead — the frame `__tt_bg_frame` computed over the grid, with the picture, its opacity and position — which the module (`framed`) maps onto the window the way WezTerm draws the saved conf, the grid canvas scaled to cover the window and aligned by the position, so its tuning panel shows what saving writes (measured: the live and the saved picture's edges within 2 px); closing preview clears it and the window goes back to `ttheme_shown`. A tuned picture is written through `_bg.zsh` as in every other terminal, and `__tt_bg_refresh` sends `ttheme_shown` again so the module rereads the confs.

## Gotchas

- WezTerm attaches a kitty image to the cells it covers: text written over it and ECH leave it (an image with a placement id survives a print), but EL and ED take it away with the cells they erase, and every negative `z` is drawn above non-default cell backgrounds — there is no tier below them. Preview's layers and find's cover would hide the selection bar and every background-colored cell, and each EL in their frames would punch a hole in the picture, so WezTerm draws no layer under the cells (`TRAITS.wezterm.layers` false, held by `terminal.test.ts` to compat's `kitty-under-bg`): find runs there (`pictures`) and places every image again whose rows a frame rewrote (`wipes`, held to compat's `kitty-el`; the image data outlives the erase, so `a=p` with the same `i` and `p` puts it back without sending it again), and its cover and its try-on go to the window background through the module's `ttheme_view` user var instead of a placement (`views`, `viewVar`) — a color-only view hides the tab's picture while the grid is up, the try-on's frame covers the whole canvas — and `findFor` clears the view when it returns to the palette editor, while preview, which launches find, sets its own view again (`__tt_bg_hide` leaves `TTHEME_WEZTERM_VIEW` at `find`, so the next show or close always sends); the editor and preview offer find only where WezTerm is wired, since the view goes nowhere without the module (measured on 20260929-043349-cab25161: grid, glide, try-on and the way back, thumbnails intact through every redraw); preview shows its pictures and tuning through the window background instead (above), and the tuning panel's strip, the one kitty placement left there, is placed again after every frame (`__tt_bg_lasting`). WezTerm also holds every answer to a query until a synchronized update ends (compat's `sync-query`), so preview asks for its cell size before it begins one, and `latency.zsh check` fails when it does not. The rest works there: a source rectangle keeps its `y`, a placement deleted by id and `p` can be placed again without resending, `t=f` loads, `CSI 16t` answers, and placing a full-window image cost about 0.3 ms at 80×24 (measured on 20260917-114457-b09b56c2).
