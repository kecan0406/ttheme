# Warp: a window in the user's own Warp

```zsh
W=.agents/skills/sandbox/scripts/window.zsh
zsh $W --warp --shots <scratchpad>/w ttheme/rei ttheme/asuka -- "sb_drive 'ttheme' 2 text:rei 1 right end f 12 shot:find"
```

`--warp` opens a window in the user's own Warp, from `env -i`. The tab's first shell is the user's own before `sandbox.command` execs the sandbox shell, and opening the window can move the user's own Warp to another palette: tell the user. At the end the run hangs up that window's shell instead of quitting Warp.

Warp reads only the real `~/.warp`, so what the adapter writes to `$SANDBOX/.warp` never reaches the screen. To see a theme or picture change for real:

1. Back up the real `settings.toml` and `~/.warp/themes`.
2. Link the real `~/.warp` in for one run (`rm -rf $HOME/.warp && ln -s <real home>/.warp $HOME/.warp`, first in the commands).
3. Put the themes back, then the settings a second later.

Following the tab in front also needs `<real home>/Library/Group Containers/2BBY89MBSN.dev.warp` linked into `$HOME/Library/Group Containers/`. To switch without the keyboard, open a second window on the same launch line and alternate `env -i open warp://session/<uuid>` between the two shells' `WARP_TERMINAL_SESSION_UUID`.

Guard any `rm -rf $HOME/.warp` in a `--zshenv` hook with `[[ $HOME == */ttheme-sandbox ]]`.
