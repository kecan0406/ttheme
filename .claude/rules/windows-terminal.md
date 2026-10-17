---
paths:
  - "shell/adapters/windows-terminal.zsh"
  - "src/terminals/windows-terminal*.ts"
  - "src/terminals/emit/windows-terminal*.ts"
---

# Windows Terminal

The shell layer's, the wiring's and the picture model's general rules are in `terminals.md`; these are what only Windows Terminal does.

## Conventions

- Windows Terminal reads fragments but watches only `settings.json`: `sync` writes `%LOCALAPPDATA%/Microsoft/Windows Terminal/Fragments/ttheme/ttheme.json` (every scheme, plus an `updates` of the profile init ran in — `WT_PROFILE_ID`, else `defaultProfile` — wearing the startup palette) and then touches every `settings.json` it finds so the terminal reloads; init resolves `%LOCALAPPDATA%` (from WSL through `cmd.exe` and `wslpath`) and keeps it as `wtHome` in `installed.json`. A settings reload makes Windows Terminal reset every OSC color in every pane (`Terminal::UpdateColorScheme`, read in its source, not measured), so `sync` touches `settings.json` only when the fragment changed, the windows-terminal adapter's `__tt_reloaded` repaints a painted tab whenever `palettes.zsh` moves (`sync` moves it whenever it touched `settings.json`, even when its content is the same), once the reset has reached it: it asks the background every 50 ms for up to a second while the tab still shows its own palette — in the tab that ran the command and in every tab the wake reaches at its idle prompt, which read `palettes.zsh` within milliseconds, before the reset lands; a tab that reads it at its next prompt or focus, long after, gets `behind` from `__tt_fresh` and repaints at once — and it leaves a tab that never painted to the reset, running again in the tab that ran the command when `__tt_follow` then painted a pin there, so the reset landing after it does not take the pin away (parity's `pin-default`), which puts on the profile the fragment gives the new startup palette.
