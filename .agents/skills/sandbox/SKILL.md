---
name: sandbox
description: Drive ttheme for real inside the throwaway sandbox (`mise run sandbox`) and read back what happened — text screens and key-driven flows through tmux, real Ghostty windows (painted colors, config reloads, screenshots) through a separate Ghostty instance, and real iTerm2 windows (profiles, backgrounds, kitty graphics, tabs, permission prompts) through an iTerm2 instance on its own settings suite. Use when the user asks to run, try, launch, screenshot or see ttheme working, a change to shell/, the terminal adapters, src/cli/init.ts, src/cli/installs.ts, src/cli/sync.ts or the emitted dist/ included, and before claiming a terminal-side fix works; neither a round of changes with the user nor the ci run before `main` runs it unasked (`AGENTS.md`), so until then a report says real terminals are unchecked. It is the only sanctioned way to exercise ttheme end to end — never use the real ~/.config or ~/.zshrc for that.
metadata:
  internal: true
---

# Driving the ttheme sandbox

`mise run sandbox` rebuilds, then wires this checkout into a throwaway home at `$TMPDIR/ttheme-sandbox` exactly as `init` would for a new user and installs every palette on top — wiped on every run, left in place afterwards. The scripts here drive it and hand back evidence (screens, measured colors, reload counts, a screenshot) so a runtime claim rests on something observed.

## Is this a runtime question?

`mise run ci` already covers logic: unit tests, the contrast gate, `shell:check` (the zsh layer, sourced), `bin:check` (init under node), `tui` (every TUI screen as text) and `parity` (every journey walked in a model of every terminal and held to the spec its looks state, Ghostty included — `mise run parity --only iterm2 --journey default --show 'default.*'` prints what a model tab shows at each look). Whether a terminal behaves like Ghostty is a parity question first: the model answers it for every terminal in seconds without a window. Reach for the sandbox only for what a live terminal alone can answer — painting and OSC colors, Ghostty config and reloads, the installed layer starting up in a real shell, init → browse/add → preview flows end to end, what a window actually looks like, and any terminal behavior the model assumes rather than measures (a `?` in `tests/compat/expect.tsv`: measure it, add the compat case, and the parity test then holds the model to it). If a test, `shell:check` or `parity` can answer it, use that instead; Ghostty mode interrupts the user's screen.

## A TUI change, fast

A change to a screen is checked in this order, each step only as wide as the change:

1. What the screen draws, colors included, with no window: `mise run look <scenario or screen> <size> [keys]` (about 1.5 s) writes a PNG and a text grid — the `look` task in `mise.toml` lists its options.
2. Keys and text in shell mode (below), for what a capture cannot reach: a flow across commands, a prompt's answer, files a flow writes.
3. The golden screens it moves, by name or glob: `mise run tui theme-edit 'browse-*'` (about 3 s for two, against about 28 s for all), then `mise run tui --update <same names>` and `git diff tests/screens`.
4. The parity journeys whose looks hold its text: `mise run parity --journey preview-tune --show 'preview-tune.*'` prints them, `--update` with the same `--journey` records them (seconds for one journey in every terminal, against minutes for the whole walk), and `git diff tests/parity/facts.tsv` shows what moved. The whole walk runs once, in `mise run ci`, at the end.
5. One window run, only for what a capture cannot show — a picture, the frame a terminal draws, the colors a real terminal paints. `--pictured` gives the last palette named a test picture first; `wait:TEXT` steps replace guessed pauses, and every `shot:NAME` brings its screen text beside the picture. Judge a thin or dim line on `zoom.zsh`'s crop, never on the 1200 px shot.

## Pick the mode by what the question needs

| Needs | Mode | Read |
|---|---|---|
| keystrokes (preview, browse, prompts), command output, files the flow writes | shell | below |
| colors the terminal really shows, Ghostty reloads, a new tab's look, a screenshot | Ghostty | `references/ghostty.md` |
| anything iTerm2: dynamic profiles, per-tab backgrounds, kitty graphics, escape-sequence permissions | iTerm2 | `references/iterm2.md` |
| anything Konsole: color schemes, the default profile over D-Bus (Linux) | Konsole | `references/linux.md` |
| Terminal.app's own colors and resets, or kitty/Alacritty/WezTerm/Warp windows | `window.zsh --<terminal>` | `references/window-zsh.md`, and `references/warp.md` for Warp |

Every window mode starts from Ghostty mode's: read `references/ghostty.md` before any window run, since its commands (`sb_color`, `sb_query`, `sb_shot`, `sb_drive`, `sb_report`), its report and its screenshot tools are every window mode's, then the file the table names. On Linux every terminal runs as `references/linux.md` says.

A flow that needs both — "keep from preview, then does only this Ghostty reload?" — is two runs: drive the keys in shell mode and check what it wrote, then call the same functions in Ghostty mode and read the reload count.

## Shell mode: keys and text (tmux, no window)

```zsh
S=.agents/skills/sandbox/scripts/shell.zsh
zsh $S start ttheme/gojo ttheme/konata   # build, wire, install these palettes, print the first screen
                                        # no palettes installs all of them; --empty none (init's new-user state);
                                        # --mine the user's own install, copied (palettes, default, marketplaces, pins, tone, pictures, settings)
zsh $S send 'ttheme pins' Enter         # tmux key names; prints the screen once it settles
zsh $S send Down Right Enter
zsh $S show -e                          # current screen with SGR colors — shows which option is highlighted
zsh $S stop
```

The shell inherits the terminal identity of wherever Claude runs, so inside Ghostty the adapter is `ghostty` and the Ghostty-only paths (keep, background saves) are live. Their reload is replaced with a line in `~/reload.log` (the sandbox home): from tmux it could not find its own Ghostty and would signal every Ghostty, the user's included. Count those lines to see that a reload was asked for.

tmux swallows palette OSCs, so colors on this screen mean nothing — measure them in Ghostty mode.

## Rules of the road

- Go through the scripts, never `mise run sandbox` bare: bare is the user's mode and opens a window in front of them. `shell.zsh` passes `--here`, `ghostty.zsh` and `iterm.zsh` pass `--behind`.
- One sandbox at a time. Every start wipes the directory and closes a previous sandbox Ghostty or iTerm2, so never run two drives in parallel — subagents included. A user's own `mise run sandbox` window counts: a drive closes it.
- A leftover instance: `pkill -f -- "--config-file=${TMPDIR%/}/ttheme-sandbox/"` for Ghostty; `pkill -f -- '^[^ ]*/iTerm2 -suite ttheme-sandbox( |$)'`, then `pkill -f -- "^$HOME/Library/Application Support/ttheme-sandbox/iTermServer"` for iTerm2. Those patterns only match the sandbox, never the user's terminals — keep the `^` anchors, or the pattern also matches the shell that runs it.
- `pgrep ghostty` from Claude's shell misses the user's Ghostty (BSD pgrep skips its own ancestors) — that does not mean it is not running.
- Ghostty's full log: `/usr/bin/log show --info --last 2m --predicate 'process == "ghostty"'` — `log` alone is a zsh builtin.
- To test Ghostty and iTerm2 wired together, add `ghostty` to `installed.json`'s terminals inside an iTerm2 run and resync (`ttheme default <name>`), never the reverse: a Ghostty-mode shell has the user's real `HOME`, so syncing with `iterm2` wired there overwrites the user's own `DynamicProfiles/ttheme.json`. Append a logging `__tt_reload_ghostty` to `$ZDOTDIR/.zshrc` first (and define it in the run's shell) — it is the one function that signals Ghostty, behind both `__tt_reload` and `__tt_pictured` — because from iTerm2 a Ghostty reload falls back to `pkill -USR2 -x ghostty` and would reach the user's Ghostty; `sb_drive` children read `.zshrc`, so they log too.
- A bash or fish started inside the sandbox runs `ttheme` through `zsh -c`, which never reaches the quiet hook's `precmd`, so its Ghostty reload falls back to `pkill -USR2 -x ghostty` and reaches the user's Ghostty: put a logging `pkill` first on `PATH` before any command that reloads, and again inside `bash -l`, whose `/etc/profile` (`path_helper`) moves `/usr/bin` ahead of it.
- Report what was measured (colors, screens, reload counts, log lines) apart from what was inferred.
