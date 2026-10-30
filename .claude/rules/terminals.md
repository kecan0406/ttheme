---
paths:
  - "shell/**"
  - "src/terminals/**"
  - "src/core/{backdrop-tone,wired}.ts"
  - "src/store/{wiring,edits,installed,host}*.ts"
  - "src/pictures/{backdrop,drawn,redrawing}*.ts"
  - "src/cli/{sync,images,redraw,init,uninstall}*.ts"
  - "tests/terminal-prefs.zsh"
  - "tests/{compat,sandbox,tui}*"
  - "tests/compat/**"
  - "tests/parity/**"
  - ".agents/skills/sandbox/**"
  - ".claude/skills/sandbox/**"
---

# Terminals, pictures and the shell layer

## Pictures

- A picture's files are never moved, and a changed picture always gets a new file name.
- Bump `DRAWING` whenever `draw`, `made` or the encoders change what they produce.
- The drawing cache is never keyed by the tone color, and a drawing that writes a cut-out is never cached.
- No adapter names a picture's coloring, and a coloring change is a redraw, never staged or undone with esc.
- The CLI reads `TTHEME_BG_BLUR` from `config.zsh`, never from the environment.
- Every file a terminal or another shell reads is written to a temp file and renamed over (`writeAtomic`, `__tt_put`).
- `backgrounds/shown.conf` names the one picture up: always the palette the front tab claimed, picture or not.
- Only a tab the terminal said is in front takes the picture, and a verb typed in the tab claims with `force`.
- A verb that changes a tab's colors and picture together goes through `__tt_wear`.

## Wirings and adapters

- `src/cli/sync.ts` names no terminal: a new terminal is a module implementing `Wiring`, an emitter, a `TRAITS` row and an adapter.
- A new terminal also needs a `TERMS` entry, a `BEHAVIOR` row, an `identity`, a `Kind`, a compat column, and its facts and gaps.
- Every external command a wiring runs goes through `Host.run`.
- A config ttheme cannot edit safely is left alone, and init says so.
- Everything a terminal does differently is an adapter hook over `_osc.zsh`'s default.
- The detection block names Rio and Contour ahead of Ghostty.
- `livePaint` is the one way a TUI repaints the tab while it browses.

## What a tab shows

- A tab that never painted stays that way when something only passes over it: give it back with the adapter's reset, never a paint.
- Preview's `painted` and the layers' `bg*` say only what the terminal is believed to hold, and whatever deletes the layers forgets them (`__tt_pv_bg_lost`).
- Every screen preview hands the terminal to goes through `__tt_pv_leave` and `__tt_pv_back`; the hub hands Browse its look as `TTHEME_HUB_LOOK`, and Browse's `restore` puts exactly that back.
- Every paint exports `TTHEME_PAINTED` and a reset unsets it; only a tab's own colors are kept.
- `line-init` is one widget, `__tt_line_init`: never add another `add-zle-hook-widget`.
- Preview's key loop never waits on a process for a picture: ask `_bg.zsh`'s runner (`__tt_bg_ask`).
- On a hot path use `$(<file)`, `zstat`, `sysread -t`, `__tt_b64s` and parameter expansion, never `$(…)`, a pipe or an external command.
- A zle widget's own processes never reach the fork ratchet's trace.
- `auto` is offered only beside a terminal that passes the appearance on (`TRAITS.appears`).
- `__tt_appearance_heard` always returns 0.

## Traps

- Every function the shell calls on its own, and every block that runs while the layer is sourced, starts with `emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}`.
- Every question to the terminal goes through `__tt_ask`.
- Open the tty as `{ exec {fd}<>/dev/tty } 2>/dev/null`, never `exec {fd}<>/dev/tty 2>/dev/null`.
- Never run `stty` inside zle or preview, and run preview's `stty -echo -icanon` in the foreground, never from `$(…)`.
- Inside double quotes spell an escape in `${var//pattern/replacement}` through a variable (`local e=$'\e'`), never `$'…'`.
- Ghostty, Alacritty and Warp leave OSC 17 unanswered: a color query ends at a DSR answer.
- Turn focus reporting on from zle's `line-init`, never from precmd.
- Ghostty applies a reload asynchronously: `ttheme off` writes everything first and reloads once.
- `TRAPURG` is defined at the top level, never over a `.zshrc`'s own, and acts only at an idle prompt.
- Inside tmux only the pane tmux last reported in front acts on a wake.
- Inside tmux the layer never tells tmux its colors, and `__tt_out` wraps every color OSC in `\ePtmux;…\e\\`.
- An ssh pin is worn from preexec, never from the remote side.
- Every reader of `TTHEME_PINS` as paths skips a key that does not start with `/`.
- Whatever rewrites a file the layer sources deletes its `.zwc`.
- Steer a Ghostty-launched shell with `ZDOTDIR` and `XDG_*`, never `HOME`.
- Preview's search row starts with ECH, never `\e[K`.
- The parity harness answers every query from the PTY data callback, never from xterm's parser.

## Ghostty

- The follower asks Ghostty through raw Apple Events addressed to the owning Ghostty's pid, never JXA's `Application(pid)`.
- A shell records nothing and starts no follower where none can run: Linux Ghostty, tmux, the latency harness.
- Preview lays its picture on the window's surface, padding included, balanced as Ghostty 1.4's `Size.balancePadding` does.
- Ghostty 1.3.1 and before pins the default a reset found, which `__tt_followed` covers; the parity model keeps 1.4's reset.
- cmux is wired as Ghostty: under `TTHEME_GHOSTTY_EMBEDDED`, `__tt_reload_ghostty` signals nothing and the follower stays off.
- BSD `pkill` skips its own ancestors: `__tt_reload_ghostty` walks up to the owning Ghostty and signals only it.

## iTerm2

- `sync` owns `DynamicProfiles/ttheme.json` whole, and its temp file is made beside the folder, never inside it.
- A dynamic profile keeps a key its file drops: write `""` for a palette without a picture.
- A new tab is created wearing `ttheme · default` and never switches profile after it opens.
- `Default Bookmark Guid` moves only on `init`, `ttheme default`, and a change that makes a startup palette appear or vanish.
- While off, `ttheme · default` stays as a bare child of `itermBase`: never drop it from the file.
- Profiles and `.itermcolors` are written in Display P3, and set `Use Separate Colors for Light and Dark Mode` false outside `auto`.
- A profile sets no key bindings.
- An OSC color divorces a session from its profile until the next `SetProfile`: track it in `TTHEME_ITERM_DYED`, and reset the dyed slots before a switch.
- iTerm2 ignores a switch to a profile it has not read yet: `__tt_profiled` paints OSC colors for a second after `ttheme.json` moves.
- Never use a color preset (`SetColors=preset=`) as a shortcut.
- iTerm2 shares kitty placement ids across images: every placement takes its own image's id.
- `a=d,d=i` frees the image's data too: take a picture down with `d=i,i=N,p=N`.
- iTerm2 answers no `CSI 16t`: the cell size comes from `OSC 1337;ReportCellSize`.
- iTerm2 keeps its default profile in memory and undoes an outside write while that default is dynamic.
- The Metal renderer flips a kitty source rectangle's `y` and draws no placement that leaves the grid: a crop is a band cut first.
- Preview and find clear with `\e[K\e[2H\e[J` and delete images with `a=d,d=A`, never ED 2.
- iTerm2 keeps its sessions across a quit and saves dynamic profiles into its prefs, so a test run can come back on an old session or profile.

## kitty

- The adapter sends `ttheme_worn` ahead of the colors, base64'd in zsh (`__tt_b64s`), so a paint forks nothing.
- A config reload resets every OSC color: the watcher puts each window's `ttheme_worn` palette back after it.
- Every solid layer is a 3×3 of one color placed through its middle pixel (`solid`, `SOLID`).
- The appearance hook wraps `boss.on_system_color_scheme_change` and leaves kitty alone where it has none; never use kitty's `dark-theme.auto.conf` or `light-theme.auto.conf`.
- The block names its include from `$HOME`, never `~`.
- A kitty screenshot needs the window in front on an unlocked screen.

## Alacritty

- No `alacritty.toml` is made where Alacritty already reads one, and none is wired while it reads an `alacritty.yml`.
- `sync` writes the import before the themes whenever the file it names is already there.
- Every OSC 4 carries one color.

## WezTerm

- The block goes just before the user config's last `return config`.
- A window `background` covers an OSC 11, so the module lays the palette's background under the picture.
- A painted tab never sets `ttheme_reload`.
- The appearance handler lives in `window-config-reloaded`, never in the config's body, and writes only when the shade differs from the file.
- Kaku is wired as WezTerm: the block goes into `kaku.lua` only once Kaku wrote it, and no `wezterm.lua` is made where only `kaku.lua` exists.
- WezTerm draws no layer under the cells: find places again every image whose rows a frame rewrote, and its cover and try-on go through `ttheme_view`.
- WezTerm holds every query answer until a synchronized update ends: ask before beginning one.

## Windows Terminal

- `sync` touches `settings.json` only when the fragment changed.
- `__tt_reloaded` repaints a painted tab once the reload's reset has reached it, and leaves a tab that never painted to the reset.

## Warp

- ttheme edits only the `theme` key of `[appearance.themes]`, keeps the value it replaced in `warp.base` and writes it back while off, `"dark"` where there was none.
- A theme picked in Warp's own picker while ttheme wore a palette is the one `ttheme off` gives back.
- Every write that names a ttheme theme fills both slots of `selected_system_themes` too.
- Only the CLI's `sync` touches `enforce_minimum_contrast`: `never` where the file sets nothing while ttheme wears a palette, then exactly what it added taken back; a value the user set stays.
- init only notes Warp's Settings sync; turning it off is the user's.
- Write the settings through `__tt_put`, and put an identical link back over a linked one (`__tt_warp_relink`, `relink`).
- Every change to a theme is a new file name: never rewrite or rename over a theme file Warp has read.
- Never name a new theme file in the settings before it is ready (`warpReady`, `__tt_warp_ripe`).
- Warp finds a theme by its `name` and path together: every write reads the name from the file it names.
- A picture goes out laid opaque on the palette's background, and the opacity stays Warp's.
- Never add a warming loop that rewrites the settings on a timer.
- A new tab hears the default palette instead of asking Warp.
- A tab behind another writes nothing itself; the follower puts on the front tab's look.
- One follower per user, kept single by a `zsystem flock`, keeps one `sqlite3` open as a coprocess.
- Preview ignores SIGURG while it is open.
- Warp refuses `t=f`: a picture goes out as chunked base64 written with one `printf`.
- Warp ignores a source rectangle, draws every negative `z` above cell backgrounds, and adds a placement where another terminal moves it, so find deletes one before placing it again.
- After an OSC 112 Warp answers `#000000` for the cursor while it draws the theme's.

## Terminal.app

- Terminal.app ignores the OSC resets: a tab's startup answer is all 20 colors, the base `__tt_osc_reset` puts back.
- A ttheme profile is a copy of the user's own profile (`terminalBase`) with the palette's 20 colors as device RGB and the base's background alpha kept.
- AppleScript never writes a color.
- A picture goes out laid opaque on the palette's background at its opacity, on a canvas of the window's shape.
- A changed picture is written into the palette's existing file and renamed (`rewrite`), never given a new file.
- A running Terminal takes a new default only from one of its own tabs (`__tt_terminal_tell`), and only to a profile it has loaded.
- A one-shot `osascript` is paid by verbs, pins and a follow, never by a prompt that changes nothing; preview runs the script as a coprocess.
- A run that wires the user's real Terminal settings saves them first (`tests/terminal-prefs.zsh save`) and restores them when it ends.

## Konsole

- Konsole never draws an OSC 4, 12 or 17, and its bare OSC resets do nothing: a palette reaches a tab only through a color scheme.
- An OSC 10/11 color is restored in `#rrggbb`, never `rgb:`.
- Each palette's scheme is written twice: under the stable name its profile names, and under a versioned name that changes with its content.
- A palette is worn with one `OSC 50 ColorScheme=…` and never an OSC 11 in the same burst, with `customCursorColor` spelled lowercase.
- ttheme never sets `AllowEscapedLinks`: a post is a link only where the default profile allows escaped links.

## Rio

- `sync` puts `theme = "ttheme"` at the top of the config once and then rewrites only `themes/ttheme.toml`, which holds a copy of the config's own `[colors]` while there is no startup palette.
- Whenever `themes/ttheme.toml` changes, `sync` touches `config.toml`'s times, and after Rio's reload `__tt_reloaded` paints a painted tab again.

## Contour

- The wiring owns `profiles/ttheme.yml` and `colorschemes/ttheme.dark.yml` and `ttheme.light.yml`, and edits only `settings.yml`, once.
- Never send `DCS $p <name> ST`.
- `sync` touches `contour.yml`'s times whenever one of its files changed.
- The layer sends OSC 11 in Contour as everywhere, though Contour draws the background it started with; once it draws an OSC 11, run `mise run compat --linux --update contour`.
- The compat image is amd64 and takes Ubuntu's `nodejs`, never a Node tarball.
