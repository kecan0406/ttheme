# Quick start

Install ttheme, load its command and pick a palette. Nothing in your configs
changes until you confirm.

1. **Run init.**

   ```sh tab="npx"
   npx @kecan0406/ttheme@latest init
   ```

   ```sh tab="bunx"
   bunx @kecan0406/ttheme@latest init
   ```

   ttheme requires Node.js `>=22` and zsh, which macOS ships, with bunx too. It
   asks a few questions, lists every file it will change, and writes nothing
   until you say yes. `ttheme update` later updates it the same way, through npx
   or bunx.

   See [Terminal support](../reference/terminals.md) for the terminals it wires.

2. **Load the command.**

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

3. **Pick a palette.**

   ```sh
   ttheme
   ```

   The tab shows each palette the cursor lands on. `enter` asks whether it
   becomes the default for new tabs or stays in this tab, and `esc` leaves the
   tab as it was.

For everything else, see [Use ttheme](use.md), [Make a palette](make.md) and
[Commands](../reference/commands.md).
