---
name: sandbox
description: Drive ttheme for real inside the throwaway sandbox (`mise run sandbox`) and read back what happened — text screens and key-driven flows through tmux, and real Ghostty windows (painted colors, config reloads, screenshots) through a separate Ghostty instance. Use whenever a change to shell/, the terminal adapters, src/init.ts, src/market.ts, src/palettes.ts or the emitted dist/ needs checking beyond `mise run ci`, when the user asks to run, try, launch, screenshot or see ttheme working, or before claiming a terminal-side fix works. It is the only sanctioned way to exercise ttheme end to end — never use the real ~/.config or ~/.zshrc for that.
---

# Driving the ttheme sandbox

`mise run sandbox` rebuilds, then wires this checkout into a throwaway home at `$TMPDIR/ttheme-sandbox` exactly as `init` would for a new user — wiped on every run, left in place afterwards. The two scripts here drive it and hand back evidence (screens, measured colors, reload counts, a screenshot) so a runtime claim rests on something observed.

## Is this a runtime question?

`mise run ci` already covers logic: unit tests, the contrast gate, `shell:check` (the zsh layer, sourced), `bin:check` (init under node) and `tui` (every TUI screen as text). Reach for the sandbox only for what a live terminal alone can answer — painting and OSC colors, Ghostty config and reloads, the installed layer starting up in a real shell, init → browse/add → preview flows end to end, what a window actually looks like. If a test or `shell:check` can answer it, use that instead; Ghostty mode interrupts the user's screen.

## Pick the mode by what the question needs

| Needs | Mode |
|---|---|
| keystrokes (preview, browse, prompts), command output, files the flow writes | shell |
| colors the terminal really shows, Ghostty reloads, a new tab's look, a screenshot | Ghostty |

A flow that needs both — "keep from preview, then does only this Ghostty reload?" — is two runs: drive the keys in shell mode and check what it wrote, then call the same functions in Ghostty mode and read the reload count.

## Shell mode: keys and text (tmux, no window)

```zsh
S=.claude/skills/sandbox/scripts/shell.zsh
zsh $S start gojo konata          # build, wire, install these palettes, print the first screen
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
zsh $G --shot <scratchpad>/paint.png gojo konata -- 'ttheme gojo' 'sb_report "fg $(sb_color fg) ansi1 $(sb_color 1)"'
```

The script starts a fresh sandbox with those palettes and opens a second Ghostty instance on it — its own config only, no saved window state — then hands focus back to whatever the user had in front as soon as the window exists. The commands after `--` run once, at the first prompt of that first window. Then it prints the results and closes the instance; `--keep` leaves it open. Anything longer than a line or two goes in a file in the scratchpad, passed as `-- "source <file>"`; the arguments are joined with `; ` and nested quotes get painful fast.

That first window is what a new tab gets: Ghostty started it through `launch-tab.zsh`, so the tab rotation, the `theme =` line and background confs apply as they would for a new tab.

Inside the commands:

- `sb_color bg|fg|cursor|0-15` prints the `#rrggbb` the terminal is showing, measured with an OSC query.
- `sb_report text…` adds a line to the results.
- All of ttheme is loaded: `ttheme <name>`, the adapter functions, and the pieces preview runs on enter. Preview's "keep as default" is `__tt_apply`, `__tt_announce`, then `__tt_keep <name>`, and it is only offered when `TTHEME_TAB_PALETTE=off` — `__tt_keep` alone records the default through `ttheme default` (`installed.json`, then every wired terminal's config) and reloads, but leaves the window's colors alone.
- stdout stays on the window because ttheme paints through stdout — redirecting it would paint a file. stderr is collected and shown.

The output, in order:

- `instance`: the sandbox Ghostty's pid.
- `status`: the commands' exit status.
- Your `sb_report` lines.
- `palette`, `installed` and `bg` as they stand after the commands.
- `reloads`: every `pid×count` that logged "reloading configuration in response to SIGUSR2" since launch. The instance's own pid alone means the reload stayed in the sandbox.
- Any stderr, then the screenshot path.

Log lines such as "config reload notification" also show up at launch and are not reloads.

What a window shows after a reload: an existing window keeps its colors. After `__tt_osc_reset` and a keep that rewrote `theme =`, the background was still the old theme two seconds after the reload. The config line and the next run's first window are where a kept default shows. Measured colors are only meaningful against the theme file at `$TMPDIR/ttheme-sandbox/.config/ghostty/themes/<name>`. Painted (OSC) colors hide the config's, so call `__tt_osc_reset` first when the question is about the config.

The screenshot is taken 0.6 s after the commands and downscaled to 1200 px. Keep it in the session scratchpad, never the repo, and read it with the Read tool. The window is unfocused, so the cursor is drawn hollow. A colored smear on the prompt's first cell shows up on every run; it is most likely the cursor-tail shader stalling in an unfocused window, not ttheme output.

Every run briefly puts a window in front of the user (Ghostty on macOS only creates its first window once it is active, so it cannot start hidden). Batch the checks of one question into a single run, don't loop runs, and say so before a series. The window takes no keystrokes from here; a second run rebuilds the sandbox rather than opening another tab.

In this mode the shell's `HOME` is the user's real home, because macOS `login` resets it. The sandbox reaches the shell through `ZDOTDIR`/`XDG_*`, so the prompt shows the long `/var/folders/…` path. Ghostty itself runs with the sandbox as `HOME`, so a `~` in its config resolves inside the sandbox.

## Rules of the road

- One sandbox at a time. Every start wipes the directory and closes a previous sandbox Ghostty, so never run two drives in parallel — subagents included.
- A leftover instance: `pkill -f -- "--config-file=${TMPDIR%/}/ttheme-sandbox/"`. That pattern only matches the sandbox, never the user's Ghostty.
- `pgrep ghostty` from Claude's shell misses the user's Ghostty (BSD pgrep skips its own ancestors) — that does not mean it is not running.
- Ghostty's full log: `/usr/bin/log show --info --last 2m --predicate 'process == "ghostty"'` — `log` alone is a zsh builtin.
- Report what was measured (colors, screens, reload counts, log lines) apart from what was inferred.
