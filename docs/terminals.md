# Terminals

Nothing is emulated — a terminal that cannot express something simply does not
get it.

| Feature | Ghostty | iTerm2 | kitty | Alacritty | WezTerm | Windows Terminal | Warp | Terminal.app | Other |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Setup with `init`** | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![No][no] | ![No][no] |
| **Palette files** | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![No][no] | ![No][no] |
| **Runtime repaint** | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![No][no] | ![Done][done] | ![Partial][partial] |
| **Background pictures** | ![Done][done] | ![Done][done] | ![Done][done] | ![No][no] | ![Partial][partial] | ![No][no] | ![No][no] | ![No][no] | ![No][no] |

- **Setup with `init`** — iTerm2 is offered on macOS only, Windows Terminal
  from WSL (or a native Windows zsh), where init writes a settings fragment on
  the Windows side. Warp gets its themes, and the default palette through its
  `settings.toml` (the Warp builds that have one).
- **Palette files** — iTerm2 gets one dynamic profile per palette, plus
  `.itermcolors` in the archive; Windows Terminal gets one fragment carrying
  every installed scheme.
- **Runtime repaint** — OSC escape sequences everywhere, per pane in kitty,
  WezTerm and Windows Terminal, one color per sequence (Alacritty drops an OSC 4
  carrying more than seven). kitty and Windows Terminal reset every OSC color
  when their config reloads, so a changed default would undo the palettes open
  tabs wear: kitty's watcher puts each window's palette back as the reload ends,
  and a Windows Terminal tab repaints itself at its next prompt or focus.
  Terminal.app takes every OSC color but no OSC reset, so ttheme reads its
  colors when the shell starts and puts them back itself. Warp answers OSC
  color queries but paints one theme app-wide and never the background an OSC
  sets, so the shell layer stays off there and `ttheme use <palette>` points you at
  `ttheme default <palette>`, which puts the palette on every Warp window; any other terminal that speaks OSC 4/10/11 (foot, Konsole,
  VTE-based terminals…) gets repainting and nothing else.
- **Colors only** — ttheme sets no font, font size or shader anywhere; those
  stay what you configured in your terminal.
- **Background pictures** — `find`, `ttheme image` and `preview`'s live
  backdrop. Ghostty shows one picture app-wide, following the focused tab;
  iTerm2 (3.7 or newer) shows one per tab and kitty one per window (a split
  pane included), both with the same preview, tuning and find. WezTerm shows the
  picture of the active tab per window and switches it as `preview` moves, but
  has no in-terminal preview or tuning — find and tune from Ghostty, iTerm2 or
  kitty. Alacritty has no graphics at all. Cut-outs and baked crops need macOS.

[done]: https://img.shields.io/badge/Done-2ea44f?style=flat-square
[partial]: https://img.shields.io/badge/Partial-e3b341?style=flat-square
[no]: https://img.shields.io/badge/Not%20supported-d0d7de?style=flat-square

## Notes per terminal

WezTerm keeps an OSC-set palette per pane, but a picture belongs to the window:
the Lua module ttheme runs follows the active pane's `ttheme_shown` user var,
which the shell layer sets whenever the tab's palette changes, and reads the
picture from `backgrounds/<palette>.conf` itself — so a picture installed or
tuned from Ghostty or iTerm2 reaches WezTerm within a second.

kitty gets a watcher, `~/.config/ttheme/kitty.py`, which the kitty block loads:
the shell layer tells it what a window wears and shows through user vars
(`ttheme_worn`, `ttheme_shown`, `ttheme_startup`), and it answers with the
window's logo — kitty's per-window picture, drawn above the default background
and below any cell with a background of its own, which does not scroll — read
from `backgrounds/<palette>.conf` itself, so a picture tuned in another terminal
shows the next time a kitty window takes focus. kitty 0.49 draws every logo at
the global `window_logo_alpha` and scales every logo by `window_logo_scale`, so
the block sets those to 1 and 100 and the watcher fades the picture's own alpha
to the tuned opacity instead. kitty reloads its config by itself whenever
`kitty.conf` or a file it includes changes, and a reload resets every color an
OSC set; the watcher wraps the reload and puts each window's palette back, and
`sync` writes a file only when its content changed, so installing palettes
reloads nothing. The watcher reaches kitty windows opened after `init`.

Alacritty reloads its config by itself and keeps OSC colors through a reload.
`sync` puts its import in the config's own `[general]` table when there is one —
TOML allows a table once — and leaves a config that already imports files
there alone, with a note.

iTerm2 reads the colors an OSC sets as Display P3 — its default color space — so
its profiles and `.itermcolors` files are written in P3 too: a tab opened on a
`ttheme · <palette>` profile and a tab repainted to that palette land on the
same colors, and ttheme recognizes the palette either way.
