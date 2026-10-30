---
name: sandbox
description: Drive ttheme for real inside the throwaway sandbox (`mise run sandbox`) and read back what happened — text screens and key-driven flows through tmux, real Ghostty windows (painted colors, config reloads, screenshots) through a separate Ghostty instance, and real iTerm2 windows (profiles, backgrounds, kitty graphics, tabs, permission prompts) through an iTerm2 instance on its own settings suite. Use when the user asks to run, try, launch, screenshot or see ttheme working, a change to shell/, the terminal adapters, src/cli/init.ts, src/cli/installs.ts, src/cli/sync.ts or the emitted dist/ included, and before claiming a terminal-side fix works; neither a round of changes with the user nor the ci run before `main` runs it unasked (`AGENTS.md`), so until then a report says real terminals are unchecked. It is the only sanctioned way to exercise ttheme end to end — never use the real ~/.config or ~/.zshrc for that.
metadata:
  internal: true
---

# Driving the ttheme sandbox

`mise run sandbox` wires this checkout into a throwaway home at `$TMPDIR/ttheme-sandbox` as `init` would for a new user, wiped on every run. The scripts here drive it and hand back evidence: screens, measured colors, reload counts, screenshots.

Use it only for what a live terminal alone can answer: painted colors, config reloads, the installed layer starting in a real shell, a flow end to end, what a window looks like, and a terminal behavior the model leaves `?` in `tests/compat/expect.tsv`. Whatever a test, `shell:check` or `mise run parity` can answer, answer there.

## A TUI change

Check in this order, each step only as wide as the change:

1. `mise run look <scenario or screen> <size> [keys]`: the screen, colors included, with no window.
2. Shell mode (below): a flow across commands, a prompt's answer, the files a flow writes.
3. `mise run tui <names or globs>`, then `--update` with the same names and `git diff tests/screens`.
4. `mise run parity --journey <id> --show '<id>.*'`, then `--update` with the same `--journey` and `git diff tests/parity/facts.tsv`.
5. One window run, only for a picture, a frame or a painted color. Use `wait:TEXT` steps rather than pauses, and judge a thin line on `zoom.zsh`'s crop.

## Pick the mode

| Needs | Mode | Read |
|---|---|---|
| keystrokes, command output, files the flow writes | shell | below |
| colors the terminal shows, Ghostty reloads, a new tab's look, a screenshot | Ghostty | `references/ghostty.md` |
| anything iTerm2 | iTerm2 | `references/iterm2.md` |
| Konsole, or any terminal on Linux | Linux | `references/linux.md` |
| Terminal.app, kitty, Alacritty, WezTerm, Warp | `window.zsh --<terminal>` | `references/window-zsh.md`, and `references/warp.md` for Warp |

Read `references/ghostty.md` before any window run: its commands and report are every window mode's. A flow that needs keys and a reload count is two runs: the keys in shell mode, then the same functions in Ghostty mode.

## Shell mode: keys and text (tmux, no window)

```zsh
S=.agents/skills/sandbox/scripts/shell.zsh
zsh $S start ttheme/gojo ttheme/konata   # build, wire, install these palettes, print the first screen
                                        # no palettes installs all of them; --empty none; --mine the user's own install, copied
zsh $S send 'ttheme pins' Enter         # tmux key names; prints the screen once it settles
zsh $S send Down Right Enter
zsh $S show -e                          # the screen with SGR colors
zsh $S stop
```

A Ghostty reload is logged as a line in `~/reload.log` in the sandbox home instead of sent: count the lines. tmux swallows palette OSCs, so measure colors in Ghostty mode.

## Rules of the road

- Go through the scripts, never `mise run sandbox` bare, which opens a window in front of the user.
- One sandbox at a time, subagents included: every start wipes the directory and closes a previous sandbox window, the user's own `mise run sandbox` included.
- A leftover instance: `pkill -f -- "--config-file=${TMPDIR%/}/ttheme-sandbox/"` for Ghostty; `pkill -f -- '^[^ ]*/iTerm2 -suite ttheme-sandbox( |$)'`, then `pkill -f -- "^$HOME/Library/Application Support/ttheme-sandbox/iTermServer"` for iTerm2. Keep the `^` anchors.
- `pgrep ghostty` from Claude's shell misses the user's Ghostty.
- Ghostty's log: `/usr/bin/log show --info --last 2m --predicate 'process == "ghostty"'`.
- To test Ghostty and iTerm2 wired together, add `ghostty` inside an iTerm2 run, never the reverse, and first define a logging `__tt_reload_ghostty` in `$ZDOTDIR/.zshrc` and the run's shell.
- Before a bash or fish inside the sandbox runs a command that reloads, put a logging `pkill` first on `PATH`, again inside `bash -l`.
- Report what was measured apart from what was inferred.
