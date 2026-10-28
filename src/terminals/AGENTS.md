# src/terminals

Each terminal's wiring, emitter and live paint. The rules that only one terminal follows are in `.claude/rules/terminals.md` and the terminal's own file beside it.

- An `Emitter` (`emit/`) writes the archive, the files a release carries and a user installs by hand; a terminal's `Wiring` (`types.ts`) writes the install, the same theme files under the user's own paths plus the terminal's block, profile or scheme. `src/cli/archive.test.ts` holds every emitted file to the file the install writes, byte for byte. A terminal whose install writes another form of it names the file and the reason there, and a new terminal's emitter and wiring are held to the same table.
- Every file ttheme adds to a terminal's own folders, and every scheme name there, is `owned(<palette>)` = `ttheme-<stem>`. That is how `uninstall` finds them, and it removes everything `init` adds: a config equal to its backup loses the backup, one edited since keeps it.
- Every Ghostty theme goes out in both modes, `ttheme-<stem>.dark` and `.light`. A wiring's `sync` removes every other `ttheme-*` theme file in its folder (`pruneThemes`), so a mode switch rewrites only the file that names the startup palette's theme.
- Ghostty's file sets `command` (and with it `shell-integration`) only while `TTHEME_TAB_PALETTE` is not `off` and no file Ghostty reads sets its own; kitty's drops `window_logo_scale` and `window_logo_alpha` the same way. `launch-tab.zsh` execs `$SHELL`, not `/bin/zsh`.
- bash and fish get the `ttheme` command through zsh (`shells.ts`). `.zshrc` is found by asking zsh for `ZDOTDIR` when the environment carries none (`zdotdirOf`), and `init` stops before any change when there is no zsh.
- `init` preselects only the terminal it runs in, lists every file it will edit, and refuses to run without a TTY unless given `--yes`.
