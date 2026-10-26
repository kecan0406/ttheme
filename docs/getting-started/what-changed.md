# What changed, and how to undo it

`init` adds one guarded line to each config it wires and keeps everything else
in its own folder. Nothing outside that line is touched, and one command takes
it all back out.

## The line in your configs

Your terminal's config and `~/.zshrc` each get a short block:

```text title="~/.zshrc"
# ttheme begin
# Managed by ttheme — npx @kecan0406/ttheme@latest uninstall takes it out
[[ -r "${XDG_CONFIG_HOME:-$HOME/.config}/ttheme/ttheme.zsh" ]] && source "${XDG_CONFIG_HOME:-$HOME/.config}/ttheme/ttheme.zsh"
# ttheme end
```

The line loads a file ttheme keeps under `~/.config/ttheme`, and only while
that file is there. So:

- Changing the default, turning ttheme off or installing a palette rewrites
  ttheme's own files, never your config again.
- A config synced to a machine without ttheme still loads.
- Everything outside `# ttheme begin` and `# ttheme end` stays yours.

## What ttheme sets

**Colors only.** No font, font size or shader, in any terminal. Of the colors,
a palette sets the 16 ANSI colors, the background, the foreground, the cursor
and the selection, and leaves the 240 extended colors as every terminal ships
them.

Settings you made yourself win:

- A Ghostty `command` or `shell-integration` of yours stays, and so do kitty's
  `window_logo_scale` and `window_logo_alpha`.
- Color keys you set yourself (`background`, `palette` and the like) win over
  any theme, and Alacritty lets its own `[colors]` win over an import. `init`
  says when it finds them.

## Backups and dotfiles

- Before its first edit of a file, `init` keeps a copy beside it:
  `<file>.ttheme.bak`.
- It writes through symlinks, so a dotfiles repository keeps its links.
- Every file it adds to a terminal's own folders is named `ttheme-<palette>`,
  or `ttheme` for Rio's one theme and Contour's profile and its two color
  schemes, so a theme of yours is never overwritten.

## Terminal by terminal

| Terminal | What it adds |
|---|---|
| Ghostty | an include of `~/.config/ttheme/ghostty.conf` in your config, and themes named `ttheme-<palette>.dark` and `.light`; cmux reads the same config |
| kitty | an include of `$HOME/.config/ttheme/kitty.conf`, which also loads ttheme's watcher for pictures |
| Alacritty | an import of `~/.config/ttheme/alacritty.toml` in the `alacritty.toml` Alacritty reads first |
| Rio | `theme = "ttheme"` at the top of `config.toml`, the `themes/ttheme.toml` it names, and themes named `ttheme-<palette>.dark.toml` and `.light.toml` beside it |
| WezTerm | a block before `return config` that runs `~/.config/ttheme/wezterm.lua`, and the same block in Kaku's `~/.config/kaku/kaku.lua` once Kaku has made it |
| iTerm2 | a `ttheme · <palette>` dynamic profile per palette, and `ttheme · default` as the default profile, built on yours so your font and keys carry over |
| Windows Terminal | a fragment with every scheme; `settings.json` is only touched so it reloads |
| Warp | a theme per palette in `~/.warp/themes`, and the default palette as the `theme` key in `~/.warp/settings.toml` (and in `selected_system_themes` while Warp follows the system; Warp Preview's `~/.warp-preview` the same way), and `enforce_minimum_contrast = "never"` under `[appearance.text]` unless you set that yourself |
| Konsole | a color scheme and a `ttheme · <palette>` profile per palette, built on your default profile |
| Terminal.app | a `ttheme · <palette>` profile per palette, copied from your default one |
| Contour | `default_profile: ttheme` at the top of `settings.yml` (a `default_profile` of yours stays in a comment there, for `uninstall`), the `profiles/ttheme.yml` it names, built on your default profile, its colors in `colorschemes/ttheme.dark.yml` and `.light.yml`, and themes named `ttheme-<palette>.dark.yml` and `.light.yml` beside them |

Profiles are read when the app starts, so iTerm2, Konsole, Terminal.app and
Contour need one restart after `init`.

## Turn it off

```sh
ttheme off   # every tab back to the terminal's own colors
ttheme on    # the default palette again
```

`off` takes the palette and picture off every open tab and keeps everything
installed. Pins and rotating new tabs rest until `on`.

## Uninstall

```sh
npx @kecan0406/ttheme@latest uninstall
```

It lists what it will do, then takes every ttheme block out of your configs and
startup files, gives Warp its theme and iTerm2, Konsole and Terminal.app their
own default profiles back, and deletes `~/.config/ttheme`, the `ttheme-*` theme
files and the cache.

> [!WARNING]
> Your own palettes live in `~/.config/ttheme/marketplace` and go with the rest.
> [Publish them](../creating-palettes/publish.md) or copy the folder first.

A config you did not touch since `init` comes back byte for byte and loses its
backup. One you edited since keeps `<file>.ttheme.bak`. Open shells drop
ttheme at their next prompt.
