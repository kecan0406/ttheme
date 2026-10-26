# Install

One command wires ttheme into the terminals you use. It asks a few questions,
shows every file it is about to change, and writes nothing until you say yes.

## What you need

- **Node 22 or newer**, for `npx`.
- **zsh**, which macOS ships. Your own shell can be zsh, bash or fish: bash and
  fish get the `ttheme` command too, and it runs through zsh.
- **A terminal ttheme wires**: Ghostty (and cmux), iTerm2, kitty, Alacritty,
  Rio, Contour, WezTerm (and Kaku), Windows Terminal, Warp, Konsole or
  Terminal.app.
  [Terminal support](../reference/terminals.md) says what each one can show.

## Run init

```sh
npx @kecan0406/ttheme@latest init
```

It asks, in this order:

1. **Which terminals to wire.** The one you are in comes preselected.
2. **Which mode to show the palettes in**: `auto`, `light` or `dark`. Every
   palette comes in both. `auto` follows your system's appearance and is offered
   where Ghostty, iTerm2, kitty or WezTerm is wired.
3. **Which palettes to install**, listed by work. `space` marks a palette or
   a whole work, and `enter` moves on. You can add or drop single palettes
   later.
4. **Whether to use them.** With one palette picked, whether every tab uses
   it. With several, whether to pick the default in `ttheme` afterwards.
5. **Whether to add the palette skill to your coding agents**, when it finds
   Claude Code or another agent's folder. Ask the agent for a character's
   palette and it measures the colors on official art.

Then it lists every file it will change and the settings its own files carry,
and asks once more. Cancelling before that changes nothing.
[What changed](what-changed.md) explains that list.

## Start using it

```sh
exec zsh    # the ttheme command in this tab
ttheme      # pick a palette
```

From bash, run `exec bash -l`; from fish, `exec fish`. New tabs pick ttheme up
by themselves. iTerm2, Konsole, Terminal.app and Contour read their profiles
only when they start, so quit and reopen them once.

Next: [your first palette](first-palette.md).

## Update

```sh
ttheme update
```

This installs the newest ttheme and keeps your terminals, palettes, pins and
settings. Running `init` again does the same: it offers to update in place. Once
a day ttheme checks npm by itself and says when a newer version is out.

## Without questions

`init --yes` (or `-y`) answers every question for you. Over an install it
updates in place and keeps everything. On a first install it wires the terminal
you are in and installs no palettes, so your colors stay as they are until you
pick one. Without a terminal to ask in, `init` stops unless it has `--yes`.

## By hand

Each [release](https://github.com/kecan0406/ttheme/releases/latest) carries one
archive per terminal, holding the built-in palettes' theme files alone, each
named for the palette's full name: `ttheme/miku` is `ttheme-ttheme--miku`.
Copy a palette's file into your terminal's themes folder and point your config
at it:

```sh
curl -L https://github.com/kecan0406/ttheme/releases/latest/download/ttheme-ghostty.tar.gz | tar xz
cp ghostty/themes/ttheme-ttheme--miku.* ~/.config/ghostty/themes/
```

| Terminal | Archive | Then |
|---|---|---|
| Ghostty | `ttheme-ghostty.tar.gz` | `theme = ttheme-ttheme--miku.dark`, or `theme = light:ttheme-ttheme--miku.light,dark:ttheme-ttheme--miku.dark` |
| kitty | `ttheme-kitty.tar.gz` | `include themes/ttheme-ttheme--miku.dark.conf` |
| Alacritty | `ttheme-alacritty.tar.gz` | `import = ["~/.config/alacritty/themes/ttheme-ttheme--miku.dark.toml"]` under `[general]` |
| WezTerm | `ttheme-wezterm.tar.gz` | `config.color_scheme = "ttheme-ttheme--miku.dark"` |
| iTerm2 | `ttheme-iterm2.tar.gz` | open a `.itermcolors` to add it to Settings › Profiles › Colors |
| Windows Terminal | `ttheme-windows-terminal.tar.gz` | copy `ttheme.json` into `%LOCALAPPDATA%\Microsoft\Windows Terminal\Fragments\ttheme\` |
| Warp | `ttheme-warp.tar.gz` | copy a `ttheme-ttheme--miku.dark.*.yaml` into `~/.warp/themes/` |
| Konsole | `ttheme-konsole.tar.gz` | copy the `.colorscheme` into `~/.local/share/konsole/` and pick it in the profile |

Most terminals get each palette in both modes, `.dark` and `.light`.

A palette installed by hand stays one palette: switching per tab, pins,
pictures and the rest need `init`.

## From a checkout

```sh
mise install && bun install
mise run build                         # the same files, into dist/
mise run bin:build && node bin/ttheme.js init
```

`mise run sandbox` tries a checkout in a throwaway home first.

## When something goes wrong

```sh
ttheme info                                 # what a bug report needs
npx @kecan0406/ttheme@latest info           # the same, before ttheme is set up
TTHEME_DEBUG=1 ttheme use miku              # where an error came from
```

[Report a bug](https://github.com/kecan0406/ttheme/issues/new?template=bug.yml)
with the output of `ttheme info`: it names ttheme's version, your system, shell
and terminal, the terminals you wired and the settings you changed, so nothing
has to be typed by hand.
