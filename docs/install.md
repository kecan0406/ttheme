# Install

**Ghostty, kitty, Alacritty, WezTerm, iTerm2, Windows Terminal or Warp** — one command, no clone:

```sh
npx @kecan0406/ttheme@latest init
```

## What init asks

1. **Which terminals to wire** — the one you are in comes preselected.
2. **Which series to install** — `space` marks one, `select all` takes the lot,
   enter moves on.
3. **Whether to wear them** — with one palette picked, `wear <palette> in every
   tab?`; with several, whether to pick the default in `ttheme preview` once
   everything is installed. No installs ttheme off: your terminal keeps its own
   colors until `ttheme on`.

Then it lists every file it is about to change and the keys its blocks set, and
writes nothing until you confirm, so cancelling before that touches nothing. It
ends with a receipt, paints the default palette onto the tab you ran it in (when
you chose to wear one) and
lists what to do next (`exec zsh` for the `ttheme` command here, a terminal
restart for new tabs).

Running it again updates in place. `--yes` (`-y`) skips every prompt and installs
no palettes, and init refuses to run without a terminal unless it is given —
`ttheme browse` opens the full catalog any time, to add or drop single palettes.

## What init changes

It places the zsh layer under `~/.config/ttheme` and edits your terminal config
and `~/.zshrc` between `# ttheme begin` / `# ttheme end` markers — everything
outside the markers is left alone, and what goes in is colors only.

- **Backups and symlinks** — before its first edit of a file it keeps a copy
  beside it, `<file>.ttheme.bak`, and it writes through symlinks, so a dotfiles
  repo keeps its links.
- **Your keys stay yours** — a Ghostty `command` or `shell-integration`, kitty's
  `window_logo_scale` and `window_logo_alpha`: a key you set yourself drops out
  of the block. Alacritty lets its own config win over an import, so colors set
  in `alacritty.toml` hide the default palette — init says so when it finds them.
- **Its own names** — every file it adds to a terminal's own folders is named
  `ttheme-<palette>`, so a theme of yours is never overwritten.
- **iTerm2** has no config file to edit, so it gets one profile per installed
  palette instead — `ttheme · miku` and so on, in
  `~/Library/Application Support/iTerm2/DynamicProfiles/ttheme.json`, which
  iTerm2 reloads by itself whenever `ttheme browse` adds or drops one. One more,
  `ttheme · default`, always wears your default palette, and init makes it
  iTerm2's default profile, so new tabs and windows open wearing the palette and
  its picture from their first frame and follow `ttheme default` from then on.
  iTerm2 reads its default profile only when it starts, so quit and reopen it
  once after init. The profile it replaces stays the parent of every ttheme
  profile, so your font and keys carry over, and `ttheme off` gives it back.
- **WezTerm**'s config is Lua, so init puts a two-line block that runs
  `~/.config/ttheme/wezterm.lua` just before your config's `return config` (or
  writes a small `wezterm.lua` when there is none); WezTerm reloads it by itself.
- **Windows Terminal** gets a fragment,
  `%LOCALAPPDATA%\Microsoft\Windows Terminal\Fragments\ttheme\ttheme.json`,
  with every installed scheme and the default palette on the profile init ran
  in — `settings.json` is never edited, only touched so the terminal reloads.
- **Warp** gets a theme per palette, `~/.warp/themes/ttheme-<palette>.yaml`, and
  the default palette as the one `theme` key of `[appearance.themes]` in
  `~/.warp/settings.toml` — Warp applies it within a few seconds, and
  `ttheme off` puts back the theme you had.

## Uninstall

```sh
npx @kecan0406/ttheme@latest uninstall
```

This takes it all back out, after listing what it will do: every ttheme block
leaves its config, Warp gets its theme back and iTerm2 its own default profile,
and the `ttheme-*` theme files, `~/.config/ttheme` (installed pictures
included), the cache and the iTerm2 and Windows Terminal files are deleted. A
config you did not touch since ttheme first edited it comes back byte for byte
and its backup goes; one you edited since keeps `<file>.ttheme.bak`. Open shells
drop the layer at their next prompt.

## By hand

One archive per terminal in the
[latest release](https://github.com/kecan0406/ttheme/releases/latest):

```sh
REL=https://github.com/kecan0406/ttheme/releases/latest/download

# kitty
curl -L $REL/ttheme-kitty.tar.gz | tar xz
cp kitty/themes/ttheme-miku.conf ~/.config/kitty/themes/
#   kitty.conf:  include themes/ttheme-miku.conf

# alacritty
curl -L $REL/ttheme-alacritty.tar.gz | tar xz
cp alacritty/themes/ttheme-miku.toml ~/.config/alacritty/themes/
#   alacritty.toml:  [general]
#                    import = ["~/.config/alacritty/themes/ttheme-miku.toml"]

# wezterm
curl -L $REL/ttheme-wezterm.tar.gz | tar xz
cp wezterm/colors/ttheme-miku.toml ~/.config/wezterm/colors/
#   wezterm.lua:  config.color_scheme = "ttheme-miku"

# iTerm2 — open a .itermcolors to add it to Settings > Profiles > Colors presets
curl -L $REL/ttheme-iterm2.tar.gz | tar xz

# windows terminal — every scheme in one fragment
curl -L $REL/ttheme-windows-terminal.tar.gz | tar xz
#   copy windows-terminal/ttheme.json into
#   %LOCALAPPDATA%\Microsoft\Windows Terminal\Fragments\ttheme\

# warp
curl -L $REL/ttheme-warp.tar.gz | tar xz
cp warp/themes/ttheme-miku.yaml ~/.warp/themes/
```

Each Ghostty theme file also carries the dock-icon colors, derived from the
palette.

## From a checkout

Building from a checkout works too: `mise install && bun install && mise run
build` writes the same tree to `dist/`, `mise run sandbox` tries it in a
throwaway home, and `mise run bin:build && node bin/ttheme.js init` installs
it for real.
