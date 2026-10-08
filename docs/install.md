# Install

**Ghostty, kitty, Alacritty, WezTerm, iTerm2, Windows Terminal, Warp or Konsole** — one command, no clone:

```sh
npx @kecan0406/ttheme@latest init
```

It needs Node 22 or newer and zsh, which macOS ships. Your shell can be zsh,
bash or fish — see [Shells](#shells).

## What init asks

1. **Which terminals to wire** — the one you are in comes preselected.
2. **Which series to install** — `space` marks one, `Select all` takes the lot,
   enter moves on.
3. **Whether to wear them** — with one palette picked, `Wear <palette> in every
   tab?`; with several, whether to pick the default in `ttheme` once
   everything is installed. No installs ttheme off: your terminal keeps its own
   colors until `ttheme on`.

Then it lists every file it is about to change and the keys its blocks set, and
writes nothing until you confirm, so cancelling before that touches nothing. It
ends with a receipt, paints the default palette onto the tab you ran it in (when
you chose to wear one) and
lists what to do next (`exec zsh` — `exec bash -l` or `exec fish` from those —
for the `ttheme` command here, a terminal restart for new tabs).

Running it again updates in place. `--yes` (`-y`) skips every prompt and installs
no palettes, and init refuses to run without a terminal unless it is given —
Browse, the second tab of `ttheme`, opens the full catalog any time, to add or drop single palettes.

## What init changes

It places the zsh layer under `~/.config/ttheme` and edits your terminal config
and `~/.zshrc` between `# ttheme begin` / `# ttheme end` markers — everything
outside the markers is left alone. What goes between them is one line that
loads a file ttheme keeps beside the layer, and only while that file is there:
Ghostty's block includes `~/.config/ttheme/ghostty.conf` with an optional
`config-file = ?…`, kitty's includes `~/.config/ttheme/kitty.conf`, Alacritty's
imports `~/.config/ttheme/alacritty.toml`, WezTerm's runs
`~/.config/ttheme/wezterm.lua` once it finds it, and `~/.zshrc` sources the
layer once it finds it. So `ttheme default`, `off` and `on` rewrite ttheme's
own files and never your config again, a config synced to a machine without
ttheme still loads, and deleting `~/.config/ttheme` by hand leaves every
terminal starting as before — `uninstall` is still the way to take the lines
out. What ttheme's files set is colors — no font, font size or shader — plus,
in Ghostty while new tabs rotate palettes, the `command` that opens them on the
next one.

- **Backups and symlinks** — before its first edit of a file it keeps a copy
  beside it, `<file>.ttheme.bak`, and it writes through symlinks, so a dotfiles
  repo keeps its links.
- **Your keys stay yours** — a Ghostty `command` or `shell-integration` in any
  of the files Ghostty reads (`config`, `config.ghostty`, and on macOS the
  Application Support ones), kitty's `window_logo_scale` and
  `window_logo_alpha`: ttheme sets none you set yourself. Ghostty loads ttheme's
  file after all of yours, so its `theme` is the default palette while one is
  set — `ttheme off` gives yours back — but the colors you set yourself
  (`background`, `palette` and the like) win over any theme, and Alacritty lets
  its own config win over an import: init says so when it finds them.
- **The config your terminal reads** — Alacritty reads the first
  `alacritty.toml` it finds in `~/.config/alacritty`, `~/.config` or your home,
  and init wires that one; a config Alacritty still reads as `alacritty.yml` is
  left alone until `alacritty migrate` turns it into TOML.
- **Its own names** — every file it adds to a terminal's own folders is named
  `ttheme-<palette>`, so a theme of yours is never overwritten.
- **iTerm2** has no config file to edit, so it gets one profile per installed
  palette instead — `ttheme · miku` and so on, in
  `~/Library/Application Support/iTerm2/DynamicProfiles/ttheme.json`, which
  iTerm2 reloads by itself whenever Browse adds or drops one. One more,
  `ttheme · default`, always wears your default palette, and init makes it
  iTerm2's default profile, so new tabs and windows open wearing the palette and
  its picture from their first frame and follow `ttheme default` from then on.
  iTerm2 reads its default profile only when it starts, so quit and reopen it
  once after init. The profile it replaces stays the parent of every ttheme
  profile, so your font and keys carry over. While ttheme is off,
  `ttheme · default` sets nothing of its own and shows that profile, so open
  tabs turn off at once and `ttheme on` brings the palette back without a
  restart; removing your last palette, or uninstalling, makes your own profile
  iTerm2's default again.
- **WezTerm**'s config is Lua, so init puts a block that runs
  `~/.config/ttheme/wezterm.lua` when it is there just before your config's
  `return config` (or writes a small `wezterm.lua` when there is none); WezTerm
  reloads it by itself.
- **Windows Terminal** gets a fragment,
  `%LOCALAPPDATA%\Microsoft\Windows Terminal\Fragments\ttheme\ttheme.json`,
  with every installed scheme and the default palette on the profile init ran
  in — `settings.json` is never edited, only touched so the terminal reloads.
- **Warp** gets a theme per palette, `~/.warp/themes/ttheme-<palette>.yaml`, and
  the default palette as the one `theme` key of `[appearance.themes]` in
  `~/.warp/settings.toml` — Warp applies it within a second, and `ttheme off`
  puts back the theme you had. That key is also how a tab wears a palette of its
  own there, so following the tab in front needs `sqlite3`, which macOS ships
  and most Linux systems have: without it a tab puts its palette back at its
  next prompt instead of the moment you switch to it.
- **Konsole** gets a color scheme and a `ttheme · <palette>` profile per
  palette in `~/.local/share/konsole`, each profile on top of your own default
  profile (its parent), so your font and keys carry over, and the default
  palette's profile as `DefaultProfile` in `~/.config/konsolerc`. Konsole reads
  its profiles when it starts, so quit and reopen it once after init; from then
  on `ttheme default` moves every running Konsole to the new default. `ttheme
  off` gives your own profile back.

## Shells

The layer runs in zsh, so zsh has to be there even when it is not your shell —
macOS ships it. When init runs from bash or fish, or your login shell is one,
that shell gets the `ttheme` command too, which runs it through zsh: bash a
function in `~/.bashrc` and in the startup file a login bash reads
(`~/.bash_profile`, `~/.bash_login` or `~/.profile`), fish
`~/.config/fish/functions/ttheme.fish`, which it loads by itself. Preview,
Browse, `ttheme use`, editing and every other command work there; what runs at
each prompt stays with zsh tabs — a directory pin taking effect on `cd`, Ghostty's
picture following the tab in front, and the repaint after a program resets the
colors.

## Uninstall

```sh
npx @kecan0406/ttheme@latest uninstall
```

This takes it all back out, after listing what it will do: every ttheme block
leaves its config and your shells' startup files, fish loses ttheme's
function, Warp gets its theme back and iTerm2 its own default profile,
and the `ttheme-*` theme files, `~/.config/ttheme` (installed pictures
included), the cache and the iTerm2 and Windows Terminal files are deleted. A
config you did not touch since ttheme first edited it comes back byte for byte
and its backup goes; one you edited since keeps `<file>.ttheme.bak`. Konsole
gets its own default profile back too, and loses every `ttheme-*` scheme and
profile. Open shells drop the layer at their next prompt.

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

# konsole — then pick ttheme-miku under Edit Current Profile › Appearance
curl -L $REL/ttheme-konsole.tar.gz | tar xz
cp konsole/ttheme-miku.colorscheme ~/.local/share/konsole/
```

Each Ghostty theme file also carries the dock-icon colors, derived from the
palette.

## From a checkout

Building from a checkout works too: `mise install && bun install && mise run
build` writes the same tree to `dist/`, `mise run sandbox` tries it in a
throwaway home, and `mise run bin:build && node bin/ttheme.js init` installs
it for real.
