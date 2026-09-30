# Terminals

Nothing is emulated — a terminal that cannot express something simply does not
get it.

| Feature | Ghostty | iTerm2 | kitty | Alacritty | WezTerm | Windows Terminal | Warp | Konsole | Terminal.app | Other |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Setup with `init`** | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![No][no] | ![No][no] |
| **Palette files** | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![No][no] | ![No][no] |
| **Runtime repaint** | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Partial][partial] |
| **Background pictures** | ![Done][done] | ![Done][done] | ![Done][done] | ![No][no] | ![Partial][partial] | ![No][no] | ![Done][done] | ![No][no] | ![No][no] | ![No][no] |

- **Setup with `init`** — iTerm2 is offered on macOS only, Windows Terminal
  from WSL (or a native Windows zsh), where init writes a settings fragment on
  the Windows side, and Konsole on Linux. Warp gets its themes, and the default
  palette through its `settings.toml` (the Warp builds that have one).
- **Palette files** — iTerm2 gets one dynamic profile per palette, plus
  `.itermcolors` in the archive; Windows Terminal gets one fragment carrying
  every installed scheme; Konsole gets a color scheme and a `ttheme · <palette>`
  profile per palette.
- **Runtime repaint** — OSC escape sequences everywhere, per pane in kitty,
  WezTerm and Windows Terminal, one color per sequence (Alacritty drops an OSC 4
  carrying more than seven). kitty and Windows Terminal reset every OSC color
  when their config reloads, so a changed default would undo the palettes open
  tabs wear: kitty's watcher puts each window's palette back as the reload ends,
  and a Windows Terminal tab repaints itself once the reset reaches it — the
  tab that changed the default at once, every other one at its next prompt or
  focus.
  Terminal.app takes every OSC color but no OSC reset, so ttheme reads its
  colors when the shell starts and puts them back itself. Warp answers OSC
  color queries but paints one theme app-wide and never the background an OSC
  sets, so a Warp tab wears its palette through that theme: `ttheme use`,
  `next`, a pin, preview and browse switch it, and switching tabs or windows
  puts on the palette of the one in front, about 0.7 s later — most of it
  Warp's own wait before it reloads its settings. Warp records no switch
  between split panes, so the panes of a tab share the palette the tab came to
  the front with.
  Konsole draws a background and foreground an OSC sets but never an OSC 4, so
  a Konsole tab repaints by switching to the palette's own color scheme (OSC 50)
  — the scheme init wrote, which is why the shell layer paints Konsole only once
  init wired it. Any other terminal that speaks OSC 4/10/11 (foot, VTE-based
  terminals…) gets repainting and nothing else.
- **Colors only** — ttheme sets no font, font size or shader anywhere; those
  stay what you configured in your terminal.
- **Background pictures** — `find`, `ttheme image` and `preview`'s live
  backdrop. Ghostty shows one picture app-wide, following the focused tab;
  iTerm2 (3.7 or newer) shows one per tab and kitty one per window (a split
  pane included), both with the same preview, tuning and find. WezTerm shows the
  picture of the active tab per window and switches it as `preview` moves, but
  has no in-terminal preview or tuning — find and tune from Ghostty, iTerm2 or
  kitty. Warp shows one picture for the whole app, through its theme, with
  find, preview and tuning as in Ghostty — a tuning step reaches the window
  about a second after the key. Alacritty has no graphics at all. Konsole passes the kitty graphics
  cases, but keeps a color scheme's wallpaper for as long as any tab shows the
  scheme, so a picture tuned elsewhere could not reach an open tab — it shows
  none. Cut-outs and baked crops need macOS.

[done]: https://img.shields.io/badge/Done-2ea44f?style=flat-square
[partial]: https://img.shields.io/badge/Partial-e3b341?style=flat-square
[no]: https://img.shields.io/badge/Not%20supported-d0d7de?style=flat-square

## One state, every terminal

Everything ttheme knows lives in a few files with one owner each —
`installed.json` (what is installed, the default, on or off), the pictures'
store, `config.zsh` and the pins — and each terminal is wired by one module in
`src/terminals/` behind the same interface: it writes its theme files, keeps its
own block in your config (or its profiles, fragment or settings key), says what
init will change, takes it all out again on uninstall, and — for the terminals
whose default is a profile, iTerm2 and Konsole — points new tabs at ttheme's
profile and gives yours back. Every command that changes the state (`init`,
`add`, `remove`, `browse`, `default`, `on`, `off`, a market refresh) writes it
once and hands it to every wired terminal the same way, whichever terminal you
ran it in.

A terminal that watches its files takes the change by itself (kitty, WezTerm,
Alacritty, iTerm2, Warp); the others are told: Ghostty by a reload the shell
layer sends to the Ghostty that owns the tab, Windows Terminal by a touch of its
`settings.json`, Konsole over D-Bus. Open tabs catch up at their next prompt —
the shell layer re-reads `palettes.zsh` when it moves — and a tab only ever
repaints itself, so a palette you painted by hand stays until you change it.

Ghostty is the reference. Every change runs the same journeys — new tabs,
`use`, `default`, `off` and `on` across tabs, preview, pins, browse, pictures
tuned elsewhere — against a model of each terminal built from what was measured
in the real one, and every place a terminal still differs from Ghostty is listed
with its reason in
[`tests/parity/gaps.tsv`](../tests/parity/gaps.tsv): what the terminal cannot
express, what ttheme could still close, and what was left out on purpose.

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

Warp wears one theme for the whole app, the `theme` key of its
`settings.toml`, so a tab's palette is one it puts on that key. Every tab
records the palette it wears in `~/.local/state/ttheme/warp/`, under the id
Warp gives its shell (`WARP_TERMINAL_SESSION_UUID`), and one small background
process — the first tab's prompt starts it, and it leaves with the last ttheme
tab — watches the session database Warp rewrites on every tab and window
switch, reads the tab in front with `sqlite3`, and puts that tab's palette on.
A tab that never took a palette follows the default, and after `ttheme off` a
tab painted before shows your own theme again, as Ghostty's tabs turn off at
their next focus. Without `sqlite3`, or in a Warp too old to name its sessions,
a tab puts its palette back at its next prompt instead. With Warp's settings
sync on, the theme setting goes to your account too, so moving between tabs
that wear different palettes is a preference change there as well.

Alacritty reloads its config by itself and keeps OSC colors through a reload.
`sync` puts its import in the config's own `[general]` table when there is one —
TOML allows a table once — and leaves a config that already imports files
there alone, with a note.

iTerm2 reads the colors an OSC sets as Display P3 — its default color space — so
its profiles and `.itermcolors` files are written in P3 too: a tab opened on a
`ttheme · <palette>` profile and a tab repainted to that palette land on the
same colors, and ttheme recognizes the palette either way.

Konsole reads its profiles and `konsolerc` once, when it starts, and draws a
palette's 16 colors only from a color scheme. init writes a scheme and a
`ttheme · <palette>` profile per palette into `~/.local/share/konsole` — each
profile sets only the scheme and the cursor and names your own default profile
as its parent, so your font, keys and the rest carry over — and makes the
default palette's profile Konsole's default in `konsolerc`, keeping the one it
replaced to give back when ttheme is off or uninstalled. `ttheme default` then
tells every running Konsole the new default over D-Bus; one started before that
profile existed takes it at its next start, and ttheme says so. A tab wears
another palette by switching scheme (`OSC 50 ColorScheme=`), and since Konsole
ignores the OSC resets, a reset switches back to the scheme a new tab would
open with: the default palette's, or your own while ttheme is off. Konsole
answers an OSC 4 query from what an OSC 4 set, not from the scheme it draws, so
`mise run compat` checks its 16 colors on a screenshot (`wear-ansi`). Inside
Yakuake or a Dolphin or Kate terminal panel — Konsole's part in other apps —
tabs repaint the same way, and open on ttheme's default unless the app names a
default profile of its own; they take a new default at their next start.
