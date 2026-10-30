# iTerm2 mode: a real window on its own settings

```zsh
I=.agents/skills/sandbox/scripts/iterm.zsh
zsh $I --shots <scratchpad>/it ttheme/gojo ttheme/miku -- 'ttheme use ttheme/gojo' 'sb_wear ttheme/miku' 'sleep 1' 'sb_report "bg $(sb_color bg)"'
```

`--pictured` works as in Ghostty mode. The run wires the sandbox as `init` does for iTerm2 and starts a second iTerm2 with `-suite ttheme-sandbox`, its own preferences and its own `iTermServer`, so the user's iTerm2 is never touched; every run deletes both and rebuilds. Check that `defaults read com.googlecode.iterm2` is unchanged after a series.

The window opens on `ttheme · default`, as a user's new tab does, and every sandbox shell exports `TTHEME_ITERM_SUITE=ttheme-sandbox`.

Extra commands in this mode:

- `sb_profile JQ` rewrites the window's profile, `ttheme · default` in `ttheme.json`, through a jq filter (`sb_profile '.Blend = 0.5'`); `sb_wear NAME` copies `ttheme · NAME`'s colors and picture onto it; `sb_ttheme NAME JQ` rewrites that palette's profile; `sb_itc '#rrggbb'` prints an iTerm2 color dictionary. Sleep a second, or poll with `sb_color`, before reading a rewrite.
- `sb_var NAME` reads a session variable: `id`, `tab.id`, `tab.window.id`, `profileName` or `user.ttheme_bg`.
- `sb_it2 …` runs the bundled `it2` CLI against this instance. **Each shell gets exactly one call**, and the window is not key, so pass `--window "$(sb_var tab.window.id)"`.
- `sb_tab 'commands' [PROFILE]` spends that call on a new tab whose first prompt runs the commands (`REPLY` is its number); `sb_tab_wait N` waits for it.

`--trust` pre-answers the permission bars as Always Allow; without it the bars show in screenshots and any keystroke dismisses them as a denial. `--legacy` turns the Metal renderer off; without it Metal stays on whatever the power source.

- In `sb_drive` into a TUI with a filter typed, quit with `esc 0.5 esc`.
- To time a bigger window, give the `sandbox.json` profile `Columns` and `Rows` before launch.
- Time a frame by how long after the last key the terminal answers, not by one round trip.
