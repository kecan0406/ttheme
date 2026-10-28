# Ghostty mode: a real window

```zsh
G=.agents/skills/sandbox/scripts/ghostty.zsh
zsh $G --shots <scratchpad>/paint ttheme/gojo ttheme/konata -- 'ttheme use ttheme/gojo' 'sb_report "fg $(sb_color fg) ansi1 $(sb_color 1)"'
```

The script starts a fresh sandbox with those palettes (every palette when none are named, none with `--empty`, the user's own install with `--mine`; `--pictured` puts a test picture on the last one named, as a find install would) and opens a second Ghostty instance on it — its own config only, no saved window state — then hands focus back to whatever the user had in front as soon as the window exists. The commands after `--` run once, at the first prompt of that first window. Then it prints the results and closes the instance; `--keep` leaves it open. Anything longer than a line or two goes in a file in the scratchpad, passed as `-- "source <file>"`; the arguments are joined with `; ` and nested quotes get painful fast.

That first window is what a new tab gets: Ghostty started it as it starts any new tab — through `launch-tab.zsh` once `TTHEME_TAB_PALETTE` rotates, since ttheme's `ghostty.conf` sets `command` only then — so the tab rotation, the `theme =` line and background confs apply as they would for a new tab.

Inside the commands (both window modes):

- `sb_color bg|fg|cursor|0-255` prints the `#rrggbb` the terminal is showing, measured with an OSC query.
- `sb_query SEQ` writes a raw sequence and prints whatever the terminal answers, escapes made visible (`^[`) — `sb_query $'\e[16t'`, `sb_query $'\e_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA\e\\'`. It appends a DSR and reads up to its reply, so an unanswered query comes back empty instead of hanging.
- `sb_shot NAME` has the driver screenshot the window right now into `--shots DIR/NAME.png` and waits for it — for before/after pairs inside one run.
- `sb_drive COMMAND STEP…` plays keys into a TUI in the real window: it runs `zsh -i -c COMMAND` (`'ttheme'`, which opens Preview and Browse) on a pty of its own sized like the window, relays its output to the window and the window's replies back — so OSC colors, kitty graphics and cell-size queries all work — and takes the steps in order: a key name (`up` `down` `left` `right` `shift-left`… `home` `end` `pgup` `pgdn` `enter` `esc` `tab` `space` `bs` `ctrl-c` `ctrl-u` `ctrl-v` `shift-tab` `alt-c` `alt-g` `alt-v` `focus-in` `focus-out`), a single character, `text:miku` typed one character at a time, `paste:TEXT` sent as one bracketed paste (what a terminal sends for a drop or Cmd+V), a key held down as `hold:right:20` (twenty presses 30 ms apart, as macOS key repeat sends them), a number of seconds to wait (so a digit key goes as `text:9`), `wait:TEXT` (hold the next step until TEXT is on the screen, up to 10 s; past that the drive stops, hangs the child up, prints the screen on stderr and fails), or `shot:NAME` (as `sb_shot`, and the screen as text beside it, `NAME.txt`). The screen text comes from a copy of the child's output run through `@xterm/headless` (`screen.mjs`, from the repo's `node_modules`), so it is what the TUI drew, not what the window shows. Keys go 0.25 s apart, and the child is hung up 10 s after the last step (SIGHUP: it is an interactive zsh, which ignores SIGTERM, so a TUI left open would keep the run waiting until the driver gave up). The child's shell variables do not come back: read the outcome from files, `sb_var`, `sb_color` or a screenshot. The commands' own shell still believes in its old palette, so its next prompt may put that palette's picture back (one extra Ghostty reload) — the product never does this, since preview runs in the shell that wears the result.
  ```zsh
  sb_drive 'ttheme' 2 text:miku 1 shot:on-miku right 1 end up right right shot:tuned enter 0.5 right enter 3
  ```
- `sb_report text…` adds a line to the results.
- All of ttheme is loaded: `ttheme use <name>`, the adapter functions, and the pieces preview runs on enter. Preview's "keep as default" is `__tt_apply`, `__tt_announce`, then `__tt_keep <name>`, and it is only offered when `TTHEME_TAB_PALETTE=off` — `__tt_keep` alone records the default through `ttheme default` (`installed.json`, then every wired terminal's config) and reloads, but leaves the window's colors alone.
- stdout stays on the window because ttheme paints through stdout — redirecting it would paint a file, so never `ttheme use <name> > /dev/null` when the colors matter. stderr is collected and shown.

The output, in order:

- `instance`: the sandbox instance's pid.
- `status`: the commands' exit status.
- Your `sb_report` lines.
- `palette`, `installed` and `bg` as they stand after the commands.
- `reloads` (Ghostty only): every `pid×count` that logged "reloading configuration in response to SIGUSR2" since launch. The instance's own pid alone means the reload stayed in the sandbox.
- Any stderr, then every screenshot path and every `shot:` screen text (`text`); `end.png` is taken 0.6 s after the commands.

`pixel.zsh FILE X Y [X Y…]` reads colors back out of a screenshot, in Display P3 and sRGB (the screenshots carry the display's profile; ttheme's iTerm2 profiles are P3). Screenshots are downscaled to 1200 px wide — Ghostty's window is wider than tall, so its shots are about 1200×655 — so pick coordinates on that image and sample flat areas; a point outside it says so. Every shot keeps its full-resolution capture beside it (`NAME.full.png`), and `zoom.zsh FILE X Y W H [LONGEST]` crops that area — given in the 1200 px image's coordinates — out of it and scales it to LONGEST px (900 by default) as `NAME.x…y…w…h….png`. A one-pixel dim line, a box's border among them, can vanish in the downscaled shot: zoom before calling one missing.

Log lines such as "config reload notification" also show up at launch and are not reloads.

What a window shows after a reload: an existing window keeps its colors. After `__tt_osc_reset` and a keep that rewrote `theme =`, the background was still the old theme two seconds after the reload — the reset landed before Ghostty applied the reload; another `__tt_osc_reset` once it has shows the new default (`__tt_reset_reloaded` does that for `ttheme off`). Calling `__tt_precmd` inside the commands turns focus reporting on outside a prompt, so the window losing focus prints `^[[O`; that is the harness, not ttheme. The config line and the next run's first window are where a kept default shows. Measured colors are only meaningful against the theme file at `$TMPDIR/ttheme-sandbox/.config/ghostty/themes/<name>`. Painted (OSC) colors hide the config's, so call `__tt_osc_reset` first when the question is about the config.

Keep screenshots in the session scratchpad, never the repo, and read them with the Read tool. The window is unfocused, so the cursor is drawn hollow.

Every Ghostty run briefly puts a window in front of the user (Ghostty on macOS only creates its first window once it is active, so it cannot start hidden). For the same reason Ghostty mode fails while the screen is locked (`ioreg -n Root -d1 | grep CGSSessionScreenIsLocked`): the instance starts but never opens a window, and the run times out. iTerm2 mode works locked. Batch the checks of one question into a single run, don't loop runs, and say so before a series. The window takes no keystrokes from here; a second run rebuilds the sandbox rather than opening another tab.

In Ghostty mode the shell's `HOME` is the user's real home, because macOS `login` resets it. The sandbox reaches the shell through `ZDOTDIR`/`XDG_*`, so the prompt shows the long `/var/folders/…` path. Ghostty itself runs with the sandbox as `HOME`, so a `~` in its config resolves inside the sandbox.
