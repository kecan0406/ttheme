# Ghostty mode: a real window

```zsh
G=.agents/skills/sandbox/scripts/ghostty.zsh
zsh $G --shots <scratchpad>/paint ttheme/gojo ttheme/konata -- 'ttheme use ttheme/gojo' 'sb_report "fg $(sb_color fg) ansi1 $(sb_color 1)"'
```

The script starts a fresh sandbox with those palettes (every palette when none are named, none with `--empty`, the user's own install with `--mine`; `--pictured` puts a test picture on the last one named) and opens a second Ghostty instance on it. The commands after `--` run once, at the first prompt of that first window, which starts as any new tab does; then it prints the results and closes the instance (`--keep` leaves it open). Put anything longer than a line or two in a file in the scratchpad and pass `-- "source <file>"`.

Inside the commands (every window mode):

- `sb_color bg|fg|cursor|0-255` prints the `#rrggbb` the terminal shows, through an OSC query.
- `sb_query SEQ` writes a raw sequence and prints the answer with escapes made visible; an unanswered query comes back empty.
- `sb_shot NAME` screenshots the window into `--shots DIR/NAME.png` and waits for it.
- `sb_drive COMMAND STEP…` plays keys into a TUI in the real window through a pty of its own. A step is a key name (`up` `down` `left` `right` `shift-left` `home` `end` `pgup` `pgdn` `enter` `esc` `tab` `space` `bs` `ctrl-c` `ctrl-u` `ctrl-v` `shift-tab` `alt-c` `alt-g` `alt-v` `focus-in` `focus-out`), a single character, `text:miku`, `paste:TEXT` (one bracketed paste), `hold:right:20`, a number of seconds (so a digit key goes as `text:9`), `wait:TEXT` (up to 10 s, then the drive fails and prints the screen) or `shot:NAME` (a screenshot and the screen's text beside it). The child is hung up 10 s after the last step, and its shell variables do not come back: read the outcome from files, `sb_var`, `sb_color` or a screenshot.
  ```zsh
  sb_drive 'ttheme' 2 text:miku 1 shot:on-miku right 1 end up right right shot:tuned enter 0.5 right enter 3
  ```
- `sb_report text…` adds a line to the results.
- All of ttheme is loaded: `ttheme use <name>`, the adapter functions, the pieces preview runs on enter.
- Never redirect ttheme's stdout when the colors matter: it paints through stdout.

The output, in order: `instance` (the instance's pid), `status`, your `sb_report` lines, `palette`, `installed` and `bg` after the commands, `reloads` (every `pid×count` that logged a SIGUSR2 reload; the instance's own pid alone means the reload stayed in the sandbox), stderr, then every screenshot and `shot:` text; `end.png` is taken 0.6 s after the commands.

`pixel.zsh FILE X Y [X Y…]` reads colors out of a screenshot in Display P3 and sRGB. Screenshots are downscaled to 1200 px wide: pick coordinates on that image and sample flat areas. `zoom.zsh FILE X Y W H [LONGEST]` crops that area out of the full-resolution capture beside it (`NAME.full.png`); zoom before calling a thin line missing.

- "config reload notification" log lines at launch are not reloads.
- Painted (OSC) colors hide the config's: call `__tt_osc_reset` first when the question is about the config.
- Calling `__tt_precmd` inside the commands turns focus reporting on outside a prompt, so `^[[O` on screen is the harness.
- Keep screenshots in the session scratchpad, never the repo, and read them with the Read tool.
- Every Ghostty run briefly puts a window in front of the user and fails while the screen is locked: batch one question's checks into a single run and say so before a series.
- The shell's `HOME` is the user's real home in Ghostty mode; the sandbox reaches the shell through `ZDOTDIR` and `XDG_*`.
