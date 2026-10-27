# Quick start

Install ttheme, load its command and pick a palette. Nothing in your configs
changes until you confirm.

1. **Check Node and zsh.**

   ttheme needs Node 22 or newer for `npx`, and zsh, which macOS ships.

   ```sh
   node --version   # v22 or newer
   zsh --version
   ```

2. **Run init.**

   ```sh
   npx @kecan0406/ttheme@latest init
   ```

   It asks which terminals to wire and which palettes to install, lists every
   file it will change, and writes nothing until you say yes.

3. **Load the command.**

   New tabs have it. In the tab you ran `init` from, start your shell again:

   ```sh tab="zsh"
   exec zsh
   ```

   ```sh tab="bash"
   exec bash -l
   ```

   ```sh tab="fish"
   exec fish
   ```

   iTerm2, Konsole, Terminal.app and Contour read their profiles only when they
   start, so quit and reopen them once.

4. **Pick a palette.**

   ```sh
   ttheme
   ```

   The tab shows each palette the cursor lands on. `enter` asks whether it
   becomes the default for new tabs or stays in this tab, and `esc` leaves the
   tab as it was.

## Next

- [Your first palette](first-palette.md) shows what else Preview does.
- [What changed](what-changed.md) lists every file `init` touched, and how to
  undo it.
- [Troubleshooting](troubleshooting.md) has fixes when a step did not work.
