# kitty, Alacritty, WezTerm and Terminal.app windows

```zsh
W=.agents/skills/sandbox/scripts/window.zsh
TTHEME_KITTY_APP=<kitty.app> zsh $W --kitty --shots <scratchpad>/k ttheme/asuka ttheme/gojo -- 'ttheme use ttheme/gojo' 'sb_report "ansi1 $(sb_color 1)"'
```

`--kitty`, `--alacritty` or `--wezterm` picks the terminal; `TTHEME_KITTY_APP`, `TTHEME_ALACRITTY_APP` and `TTHEME_WEZTERM_APP` name an app outside `/Applications` (download the release into the scratchpad and point at it). Everything else is Ghostty mode's: the same commands and the same report.

`--terminal-app` opens a window in the user's own Terminal.app, from `env -i`; the commands run in the sandbox shell `sandbox.command` execs from the user's login shell.

- The run wires the user's real Terminal settings, so it saves them first and puts them back at its end; after a `--keep` run, close the window and run `zsh tests/terminal-prefs.zsh restore`.
- Compare `defaults export com.apple.Terminal -` before and after a series.
- The wired look shows only when the run starts Terminal itself.
- `sb_drive` hands its child the real tab's tty (`SB_TTY`).
- Delete the user's `colors.terminal-app` in their state dir after a series.
- kitty and Alacritty draw nothing while covered or behind a locked screen, so their screenshots come out blank; queries still work.
