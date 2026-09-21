---
name: sandbox
description: Drive ttheme for real inside the throwaway sandbox (`mise run sandbox`) and read back what happened — text screens and key-driven flows through tmux, real Ghostty windows (painted colors, config reloads, screenshots) through a separate Ghostty instance, and real iTerm2 windows (profiles, backgrounds, kitty graphics, tabs, permission prompts) through an iTerm2 instance on its own settings suite. Use whenever a change to shell/, the terminal adapters, src/init.ts, src/market.ts, src/palettes.ts or the emitted dist/ needs checking beyond `mise run ci`, when the user asks to run, try, launch, screenshot or see ttheme working, or before claiming a terminal-side fix works. It is the only sanctioned way to exercise ttheme end to end — never use the real ~/.config or ~/.zshrc for that.
---

# Driving the ttheme sandbox

`mise run sandbox` rebuilds, then wires this checkout into a throwaway home at `$TMPDIR/ttheme-sandbox` exactly as `init` would for a new user and installs every palette on top — wiped on every run, left in place afterwards. The scripts here drive it and hand back evidence (screens, measured colors, reload counts, a screenshot) so a runtime claim rests on something observed.

## Is this a runtime question?

`mise run ci` already covers logic: unit tests, the contrast gate, `shell:check` (the zsh layer, sourced), `bin:check` (init under node) and `tui` (every TUI screen as text). Reach for the sandbox only for what a live terminal alone can answer — painting and OSC colors, Ghostty config and reloads, the installed layer starting up in a real shell, init → browse/add → preview flows end to end, what a window actually looks like. If a test or `shell:check` can answer it, use that instead; Ghostty mode interrupts the user's screen.

## Pick the mode by what the question needs

| Needs | Mode |
|---|---|
| keystrokes (preview, browse, prompts), command output, files the flow writes | shell |
| colors the terminal really shows, Ghostty reloads, a new tab's look, a screenshot | Ghostty |
| anything iTerm2: dynamic profiles, per-tab backgrounds, kitty graphics, escape-sequence permissions | iTerm2 |

A flow that needs both — "keep from preview, then does only this Ghostty reload?" — is two runs: drive the keys in shell mode and check what it wrote, then call the same functions in Ghostty mode and read the reload count.

## Shell mode: keys and text (tmux, no window)

```zsh
S=.claude/skills/sandbox/scripts/shell.zsh
zsh $S start gojo konata          # build, wire, install these palettes, print the first screen
                                  # no palettes installs all of them; --empty none (init's new-user state)
zsh $S send 'ttheme list' Enter   # tmux key names; prints the screen once it settles
zsh $S send Down Right Enter
zsh $S show -e                    # current screen with SGR colors — shows which option is highlighted
zsh $S stop
```

The shell inherits the terminal identity of wherever Claude runs, so inside Ghostty the adapter is `ghostty` and the Ghostty-only paths (keep, background saves) are live. Their reload is replaced with a line in `~/reload.log` (the sandbox home): from tmux it could not find its own Ghostty and would signal every Ghostty, the user's included. Count those lines to see that a reload was asked for.

tmux swallows palette OSCs, so colors on this screen mean nothing — measure them in Ghostty mode.

## Ghostty mode: a real window

```zsh
G=.claude/skills/sandbox/scripts/ghostty.zsh
zsh $G --shots <scratchpad>/paint gojo konata -- 'ttheme gojo' 'sb_report "fg $(sb_color fg) ansi1 $(sb_color 1)"'
```

The script starts a fresh sandbox with those palettes (every palette when none are named, none with `--empty`) and opens a second Ghostty instance on it — its own config only, no saved window state — then hands focus back to whatever the user had in front as soon as the window exists. The commands after `--` run once, at the first prompt of that first window. Then it prints the results and closes the instance; `--keep` leaves it open. Anything longer than a line or two goes in a file in the scratchpad, passed as `-- "source <file>"`; the arguments are joined with `; ` and nested quotes get painful fast.

That first window is what a new tab gets: Ghostty started it through `launch-tab.zsh`, so the tab rotation, the `theme =` line and background confs apply as they would for a new tab.

Inside the commands (both window modes):

- `sb_color bg|fg|cursor|0-255` prints the `#rrggbb` the terminal is showing, measured with an OSC query.
- `sb_query SEQ` writes a raw sequence and prints whatever the terminal answers, escapes made visible (`^[`) — `sb_query $'\e[16t'`, `sb_query $'\e_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA\e\\'`. It appends a DSR and reads up to its reply, so an unanswered query comes back empty instead of hanging.
- `sb_shot NAME` has the driver screenshot the window right now into `--shots DIR/NAME.png` and waits for it — for before/after pairs inside one run.
- `sb_drive COMMAND STEP…` plays keys into a TUI in the real window: it runs `zsh -i -c COMMAND` (`'ttheme preview'`, `'ttheme browse'`) on a pty of its own sized like the window, relays its output to the window and the window's replies back — so OSC colors, kitty graphics and cell-size queries all work — and takes the steps in order: a key name (`up` `down` `left` `right` `shift-left`… `home` `end` `pgup` `pgdn` `enter` `esc` `tab` `space` `bs` `ctrl-c` `ctrl-u` `alt-c`), a single character, `text:miku` typed one character at a time, a number of seconds to wait, or `shot:NAME` (as `sb_shot`). Keys go 0.25 s apart, and the child is killed 10 s after the last step. The child's shell variables do not come back: read the outcome from files, `sb_var`, `sb_color` or a screenshot. The commands' own shell still believes in its old palette, so its next prompt may put that palette's picture back (one extra Ghostty reload) — the product never does this, since preview runs in the shell that wears the result.
  ```zsh
  sb_drive 'ttheme preview' 2 text:miku 1 shot:on-miku tab 1 down down right enter 0.5 enter right enter 3
  ```
- `sb_report text…` adds a line to the results.
- All of ttheme is loaded: `ttheme <name>`, the adapter functions, and the pieces preview runs on enter. Preview's "keep as default" is `__tt_apply`, `__tt_announce`, then `__tt_keep <name>`, and it is only offered when `TTHEME_TAB_PALETTE=off` — `__tt_keep` alone records the default through `ttheme default` (`installed.json`, then every wired terminal's config) and reloads, but leaves the window's colors alone.
- stdout stays on the window because ttheme paints through stdout — redirecting it would paint a file, so never `ttheme <name> > /dev/null` when the colors matter. stderr is collected and shown.

The output, in order:

- `instance`: the sandbox instance's pid.
- `status`: the commands' exit status.
- Your `sb_report` lines.
- `palette`, `installed` and `bg` as they stand after the commands.
- `reloads` (Ghostty only): every `pid×count` that logged "reloading configuration in response to SIGUSR2" since launch. The instance's own pid alone means the reload stayed in the sandbox.
- Any stderr, then every screenshot path; `end.png` is taken 0.6 s after the commands.

`pixel.zsh FILE X Y [X Y…]` reads colors back out of a screenshot, in Display P3 and sRGB (the screenshots carry the display's profile; ttheme's iTerm2 profiles are P3). Screenshots are downscaled to 1200 px wide — Ghostty's window is wider than tall, so its shots are about 1200×655 — so pick coordinates on that image and sample flat areas; a point outside it says so.

Log lines such as "config reload notification" also show up at launch and are not reloads.

What a window shows after a reload: an existing window keeps its colors. After `__tt_osc_reset` and a keep that rewrote `theme =`, the background was still the old theme two seconds after the reload. The config line and the next run's first window are where a kept default shows. Measured colors are only meaningful against the theme file at `$TMPDIR/ttheme-sandbox/.config/ghostty/themes/<name>`. Painted (OSC) colors hide the config's, so call `__tt_osc_reset` first when the question is about the config.

Keep screenshots in the session scratchpad, never the repo, and read them with the Read tool. The window is unfocused, so the cursor is drawn hollow. A colored smear on the prompt's first cell shows up on every Ghostty run; it is most likely the cursor-tail shader stalling in an unfocused window, not ttheme output.

Every Ghostty run briefly puts a window in front of the user (Ghostty on macOS only creates its first window once it is active, so it cannot start hidden). For the same reason Ghostty mode fails while the screen is locked (`ioreg -n Root -d1 | grep CGSSessionScreenIsLocked`): the instance starts but never opens a window, and the run times out. iTerm2 mode works locked. Batch the checks of one question into a single run, don't loop runs, and say so before a series. The window takes no keystrokes from here; a second run rebuilds the sandbox rather than opening another tab.

In Ghostty mode the shell's `HOME` is the user's real home, because macOS `login` resets it. The sandbox reaches the shell through `ZDOTDIR`/`XDG_*`, so the prompt shows the long `/var/folders/…` path. Ghostty itself runs with the sandbox as `HOME`, so a `~` in its config resolves inside the sandbox.

## iTerm2 mode: a real window on its own settings

```zsh
I=.claude/skills/sandbox/scripts/iterm.zsh
zsh $I --shots <scratchpad>/it gojo miku -- 'ttheme gojo' 'sb_wear miku' 'sleep 1' 'sb_report "bg $(sb_color bg)"'
```

`mise run sandbox --iterm` wires the sandbox as `init` does for iTerm2 (`ttheme · <palette>` profiles in `$SANDBOX/Library/Application Support/iTerm2/DynamicProfiles/ttheme.json`) and starts a second iTerm2 with `-suite ttheme-sandbox`: its own preferences (`~/Library/Preferences/ttheme-sandbox.plist`), its own `~/Library/Application Support/ttheme-sandbox/` with its own `iTermServer`, so the user's iTerm2 — running or not — is never touched. Every run deletes both and rebuilds. The launch arguments keep Sparkle and window restoration out of the user's `com.googlecode.iterm2` domain; check that domain is unchanged after a series (`defaults read com.googlecode.iterm2`). It comes to the front for about a quarter second at launch and hands focus straight back; nothing after that takes focus, SetProfile and kitty graphics included.

The window's profile is `ttheme sandbox` (`sandbox.json` next to `ttheme.json`), the suite's default. Its command sets `HOME` to the sandbox as well, so a `ttheme add` inside writes the sandbox's profiles, not the user's. The suite is seeded with the Python API on, a per-session cookie, and `ReportVariable` allowed for `id`, `tab.id`, `tab.window.id`, `profileName` and `user.ttheme_bg`.

Extra commands in this mode:

- `sb_profile JQ` rewrites the `ttheme sandbox` profile through a jq filter (`sb_profile '.Blend = 0.5'`); `sb_wear NAME` copies `ttheme · NAME`'s colors onto it; `sb_ttheme NAME JQ` rewrites that palette's profile in `ttheme.json`; `sb_itc '#rrggbb'` prints an iTerm2 color dictionary (P3). iTerm2 picks a rewritten file up by itself in about 0.3 s — sleep a second, or poll with `sb_color`.
- `sb_var NAME` reads a session variable through `ReportVariable` (only the allowed names above; others raise a permission bar and come back empty).
- `sb_it2 …` runs the bundled `it2` CLI against this instance. **Each shell gets exactly one call**: the cookie in its environment is single use, and a second call fails authentication. The window is not key, so pass `--window "$(sb_var tab.window.id)"` wherever `it2` would default to the current window.
- `sb_tab 'commands' [PROFILE]` spends that call on a new tab — on that profile when one is named — whose first prompt runs the commands (`REPLY` is its number); `sb_tab_wait N` waits for it. A ttheme profile runs the user's login shell, not the sandbox's, unless it names `ttheme sandbox` as its parent first: `sb_ttheme default '.["Dynamic Profile Parent Name"] = "ttheme sandbox"'`. A tab gets its own call, so it can switch back with `sb_it2 tab select 0 --window "$(sb_var tab.window.id)"` or open the next tab.

`--trust` pre-answers the permission bars as if the user had pressed Always Allow — `SetProfile`, and `SetProfileProperty` for `Blend`, `Background Image Mode` and `Background Image Location` — so a run can test what those sequences do rather than the bar they raise. Without it the bars show up in screenshots, and any keystroke dismisses them as a denial. `--legacy` turns the Metal renderer off; iTerm2 does that by itself on battery.

Measured on 3.7.2, 2026-09-22 — know these before reading results:

- `CSI 16t` gets no answer; `OSC 1337;ReportCellSize` answers `height;width;scale` in points.
- kitty graphics work (Metal and legacy), with Ghostty's layer order, but placement ids are shared across images: `p=1` on a second image removes the first image's `p=1`. Give each image its own `p`. `\e[2J` keeps image data and scrolls placements away rather than deleting them.
- `ED 2`, and `CSI H CSI J` in the alternate screen, push the screen into scrollback with its kitty placements; a scroll thumb showing up in a screenshot of a full-screen TUI is the tell.
- `Blend` is the image's opacity: 0 hides it, 1 shows it whole.
- A tab that painted colors keeps them through a profile rewrite; `__tt_osc_reset` returns it to the profile's colors as they were when it was painted, not the current ones.
- `Harmonize 256 Colors` applies only to sessions created after it is set.
- Twice in thirteen runs a session stopped answering queries (and drawing) after a `\(user.…)`-interpolated `Background Image Location` got its variable; it did not reproduce on demand. A literal path never did.

## Rules of the road

- Go through the scripts, never `mise run sandbox` bare: bare is the user's mode and opens a window in front of them. `shell.zsh` passes `--here`, `ghostty.zsh` and `iterm.zsh` pass `--behind`.
- One sandbox at a time. Every start wipes the directory and closes a previous sandbox Ghostty or iTerm2, so never run two drives in parallel — subagents included. A user's own `mise run sandbox` window counts: a drive closes it.
- A leftover instance: `pkill -f -- "--config-file=${TMPDIR%/}/ttheme-sandbox/"` for Ghostty; `pkill -f -- '^[^ ]*/iTerm2 -suite ttheme-sandbox( |$)'`, then `pkill -f -- "^$HOME/Library/Application Support/ttheme-sandbox/iTermServer"` for iTerm2. Those patterns only match the sandbox, never the user's terminals — keep the `^` anchors, or the pattern also matches the shell that runs it.
- `pgrep ghostty` from Claude's shell misses the user's Ghostty (BSD pgrep skips its own ancestors) — that does not mean it is not running.
- Ghostty's full log: `/usr/bin/log show --info --last 2m --predicate 'process == "ghostty"'` — `log` alone is a zsh builtin.
- Report what was measured (colors, screens, reload counts, log lines) apart from what was inferred.
