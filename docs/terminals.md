# Terminals

Nothing is emulated — a terminal that cannot express something simply does not
get it.

| Feature | Ghostty | iTerm2 | kitty | Alacritty | WezTerm | Windows Terminal | Warp | Konsole | Terminal.app | Other |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Setup with `init`** | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![No][no] |
| **Palette files** | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![No][no] |
| **Runtime repaint** | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Partial][partial] |
| **Background pictures** | ![Done][done] | ![Done][done] | ![Done][done] | ![No][no] | ![Done][done] | ![No][no] | ![Done][done] | ![Done][done] | ![Done][done] | ![No][no] |

- **Setup with `init`** — iTerm2 and Terminal.app are offered on macOS only,
  Windows Terminal from WSL (or a native Windows zsh), where init writes a
  settings fragment on the Windows side, and Konsole on Linux. Warp gets its
  themes, and the default palette through its `settings.toml` (the Warp builds
  that have one).
- **Palette files** — iTerm2 gets one dynamic profile per palette, plus
  `.itermcolors` in the archive; Windows Terminal gets one fragment carrying
  every installed scheme; Konsole gets a color scheme and a `ttheme · <palette>`
  profile per palette; Terminal.app gets a `ttheme · <palette>` profile per
  palette in its own settings — a copy of your profile, its font, window and
  transparency included, in the palette's colors and with its picture — and the
  default palette's becomes the one new windows and tabs open with.
- **Runtime repaint** — OSC escape sequences everywhere, per pane in kitty,
  WezTerm and Windows Terminal, one color per sequence (Alacritty drops an OSC 4
  carrying more than seven). kitty and Windows Terminal reset every OSC color
  when their config reloads, so a changed default would undo the palettes open
  tabs wear: kitty's watcher puts each window's palette back as the reload ends,
  and a Windows Terminal tab repaints itself once the reset reaches it — the
  tab that changed the default at once, every other one at its next prompt or
  focus.
  Terminal.app takes every OSC color but no OSC reset, so ttheme reads its
  colors when the shell starts and puts them back itself. Once init wired it, a
  tab wears an installed palette by switching to that palette's profile — its
  colors and its picture in one step — through Terminal's own scripting, about
  0.17 s for `ttheme use` and 16–33 ms a hover in preview; `ttheme off` moves a tab
  onto your own profile, which drops every color an OSC set, and a `ttheme
  default` run in any terminal reaches a running Terminal.app at the next prompt
  one of its tabs shows. A palette added while Terminal.app runs gets its
  profile at Terminal.app's next start and is painted with OSC colors until
  then. Warp answers OSC
  color queries but paints one theme app-wide and never the background an OSC
  sets, so a Warp tab wears its palette through that theme: `ttheme use`,
  a pin, preview and browse switch it, and switching tabs or windows
  puts on the palette of the one in front — about 0.2 s later with
  `TTHEME_WARP_FAST` on, 0.6 s with it off, which is Warp's own wait before it
  reloads its settings. Warp records no switch
  between split panes, so the panes of a tab share the palette the tab came to
  the front with. Where init did not wire Warp, `ttheme use` in a Warp tab shows
  what wiring it would edit and asks first; yes wires Warp then and there and
  puts the palette on.
  iTerm2 turns every OSC color into a change to the tab's profile, so once it
  lets a control sequence switch profiles (its Always Allow) a tab wears a
  palette by switching to that palette's `ttheme · <palette>` profile — every
  color and the picture in one step, and a program's reset lands on the palette
  — while browse and init's picker repaint the background and foreground at
  once and the other colors once the cursor rests.
  Konsole draws a background and foreground an OSC sets but never an OSC 4, so
  a Konsole tab repaints by switching color scheme (OSC 50) — the palette's own
  scheme where init wired Konsole, and otherwise, or for colors no palette
  holds (a tone being tuned, browse's catalog), a short-lived scheme the shell
  writes and deletes again. Konsole opens a link only where your profile allows
  escape sequences for links (`AllowEscapedLinks`, off by default), so preview
  marks a picture's post as a link only there. Any other terminal that speaks OSC 4/10/11 (foot, VTE-based
  terminals…) gets repainting and nothing else.
- **Colors only** — ttheme sets no font, font size or shader anywhere; those
  stay what you configured in your terminal.
- **Background pictures** — `find`, `ttheme image` and `preview`'s live
  backdrop. Ghostty shows one picture app-wide, following the focused tab;
  iTerm2 (3.7 or newer) shows one per tab and kitty one per window (a split
  pane included), both with the same preview, tuning and find. WezTerm shows the
  picture of the active tab per window, and its preview, tuning and find draw
  through the window's background. Konsole shows one per tab, through the
  wallpaper of the tab's color scheme, with the same preview, tuning and find —
  every change of a picture writes the scheme under a new name, since Konsole
  keeps a scheme as it read it for as long as a tab shows it (Konsole 23.08
  draws a wallpaper only where a compositor runs; 24.02 and later always).
  Warp shows one picture for the whole app, through its theme, with find,
  preview and tuning as in Ghostty — a tuning step reaches the window about a
  second after the key. Terminal.app shows one per tab, through the tab's
  profile: Terminal.app has no graphics protocol, so a profile carries its
  palette's picture laid on the palette's background, framed for the shape of
  your Terminal.app windows (it stretches a picture over the whole window), and
  a picture's profile is opaque even where your own is translucent. A picture
  tuned, replaced or removed while it runs reaches every tab at its next prompt
  or focus, and preview's tuning shows each step in the tab once the picture
  is laid again; find is not offered there, since its results are pictures,
  and a palette's first picture shows from Terminal.app's next start. Alacritty
  has no graphics and no background image at all, and Windows Terminal keeps a
  picture in a profile, which a pane cannot change, while the settings reload
  that changes a profile puts every pane back on its scheme's colors — so
  neither shows one. Cut-outs and baked crops need macOS.

[done]: https://img.shields.io/badge/Done-2ea44f?style=flat-square
[partial]: https://img.shields.io/badge/Partial-e3b341?style=flat-square
[no]: https://img.shields.io/badge/Not%20supported-d0d7de?style=flat-square

## One state, every terminal

Everything ttheme knows lives in a few files with one owner each —
`installed.json` (what is installed, the default, on or off), the pictures'
store, `config.zsh` and the pins — and each terminal is wired by one module in
`src/terminals/` behind the same interface: it writes its theme files, keeps its
own block in your config — one line that loads a file ttheme keeps beside the
layer, so a change after init rewrites that file and never yours — (or its
profiles, fragment or settings key), says what
init will change, takes it all out again on uninstall, and — for the terminals
whose default is a profile, iTerm2 and Konsole — points new tabs at ttheme's
profile and gives yours back. Every command that changes the state (`init`,
`add`, `remove`, `default`, `on`, `off`, Browse's apply, a market refresh) writes it
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

## Editors

An editor's colorscheme and ttheme share the screen without overlapping.
Neovim 0.10 or newer turns `termguicolors` on wherever the terminal speaks
truecolor and then paints every cell of its window itself, so its colorscheme
decides what the editor looks like and the palette shows only around it — in
the window's padding, and behind a colorscheme with a transparent background,
whose text colors were chosen for a background of its own. Neovim also asks the
terminal for its background when it starts and sets `background` to `dark` or
`light` from it, so a colorscheme with both variants follows the palette the
tab wears.

- **Resets** — Neovim resets the cursor color (OSC 112) whenever you enter or
  leave a `:terminal`, with its default settings, and on its way out when
  `guicursor` names a colored highlight; a background sync such as mini.nvim's
  `setup_termbg_sync()` resets the background (OSC 111) on its way out. A
  reset takes a tab back to the terminal's own colors, so after each command a
  tab that wears a palette asks the terminal for its background and cursor and
  repaints itself when either changed — in Ghostty, kitty, Alacritty, WezTerm
  and Windows Terminal, about a quarter of a millisecond in Ghostty.
  Terminal.app and Konsole ignore the resets. iTerm2 needs no asking: a tab
  there sits on its palette's own profile, so a reset lands on the palette —
  once iTerm2 lets the shell switch profiles; until then the tab is painted in
  OSC colors and a reset takes it back to its profile's colors until the next
  `ttheme use`, since iTerm2 answers a question only on its next frame (up to
  20 ms after a command, measured). mini.nvim's `setup_termbg_sync({ explicit_reset = true })`
  puts back the exact background it found instead, which is the palette's.
- **A shell in an editor's terminal** — a shell started in Neovim's or Vim's
  `:terminal`, in Emacs or in VS Code inherits the variables that name your
  terminal, but the editor draws that terminal in its own theme. The shell
  layer recognizes it (`$NVIM`, `$VIM_TERMINAL`, `$INSIDE_EMACS`,
  `TERM_PROGRAM=vscode`) and stays out: it paints nothing, leaves the picture
  of the tab around it alone, and `ttheme use` there says to use a tab outside
  the editor.
- **256 colors** — ttheme sets a palette's 16 ANSI colors and leaves the other
  240 at the values every terminal ships, so a colorscheme written for the
  256-color palette (Vim without `termguicolors`, tmux's `colour` numbers)
  looks the way its author made it.
- **The frame** — with an opaque colorscheme, the window's padding still shows
  the palette's background and picture. In Ghostty,
  `window-padding-color = extend` carries the editor's edge colors into the
  padding instead.
- **Following the palette** — Neovim's default colorscheme uses only the 16
  ANSI colors once truecolor is off, so `set notermguicolors` makes the editor
  wear the tab's palette, a different one per tab, with the picture behind it.

## Notes per terminal

WezTerm keeps an OSC-set palette per pane, but a picture belongs to the window:
the Lua module ttheme runs follows the active pane's `ttheme_shown` user var,
which the shell layer sets whenever the tab's palette changes, and reads the
picture from `backgrounds/<palette>.conf` itself — so a picture installed or
tuned from Ghostty or iTerm2 reaches WezTerm within a second.

kitty gets a watcher, `~/.config/ttheme/kitty.py`, which `~/.config/ttheme/kitty.conf`
loads — the file the kitty block includes:
the shell layer tells it what a window wears and shows through user vars
(`ttheme_worn`, `ttheme_shown`, `ttheme_startup`), and it answers with the
window's logo — kitty's per-window picture, drawn above the default background
and below any cell with a background of its own, which does not scroll — read
from `backgrounds/<palette>.conf` itself, so a picture tuned in another terminal
shows the next time a kitty window takes focus. kitty 0.49 draws every logo at
the global `window_logo_alpha` and scales every logo by `window_logo_scale`, so
ttheme's file sets those to 1 and 100 and the watcher fades the picture's own alpha
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
switch, reads the tab in front through one `sqlite3` it keeps open, and puts
that tab's palette on. Warp reloads `settings.toml` only once a change to it is
half a second old, so while Warp is in front and your tabs wear different
palettes the process rewrites the file's first byte with itself every 0.25 s
(`TTHEME_WARP_FAST`, on by default): there is always an older change about to
be reloaded, and the palette of a tab you switch to rides on it — about 0.2 s
instead of 0.6 s, for about 8% CPU while it lasts. Nothing in the file changes.
A tab that never took a palette follows the default, and after `ttheme off` a
tab painted before shows your own theme again, as Ghostty's tabs turn off at
their next focus. Warp tells a shell waiting at its prompt nothing when its tab
comes to the front, so the same process does: when the tab in front last read
older palettes or pins than there are now, it sends that tab's shell a signal
(SIGURG, which every program ignores unless it asks for it), and a pin set in
another tab, a new default, `ttheme off` or `ttheme on` reach the tab as it
comes to the front. Without `sqlite3`, or in a Warp too old to name its
sessions, a tab puts its palette back at its next prompt instead. With Warp's settings
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

iTerm2 handles each OSC color as a change to the tab's profile, one at a time,
so a palette's twenty colors kept it busy for about 0.2 s, where one switch to
the palette's profile carries all of them and the picture in about 40 ms
(measured on 3.7.3 at 80×25). So once iTerm2 lets a control sequence switch
the profile — Always Allow on the bar it shows the first time, which ttheme
reads at its next `add`, `remove`, `default`, `on` or `off`, or Browse's apply — every palette
goes on that way: `ttheme use`, a pin, preview as the cursor moves, and
the tab's way back to its default, which is iTerm2's own default profile. A tab
that sits on its palette's profile follows a tuned picture or tone at once and
keeps its palette through a program's color reset. Browse and init's picker
repaint the background and foreground as the cursor moves and the other colors
once it has rested for 120 ms, a few at a time, since moving to a palette's
profile there would also put up that palette's picture, and they put the tab
back on its profile when they close. For a second after ttheme rewrites its
profiles, which iTerm2 takes about 0.3 s to read, a palette goes on in OSC
colors instead.

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
