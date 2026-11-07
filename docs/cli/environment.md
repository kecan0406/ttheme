# Environment variables

The variables ttheme reads from your environment: where it keeps its files, the
proxy its requests go through, and the editor and colors it uses. Every setting
in [Configuration](configuration.md) is a variable too, and one you export
before ttheme loads wins over `config.zsh`.

## Folders

| Variable | Default | What ttheme keeps there |
|---|---|---|
| `XDG_CONFIG_HOME` | `~/.config` | `ttheme/`, your settings, palettes and pictures and the command itself |
| `XDG_STATE_HOME` | `~/.local/state` | `ttheme/`, what it remembers between runs |
| `XDG_DATA_HOME` | `~/.local/share` | On Linux, the themes it writes for Warp and Konsole |

Set them before you run `init`, and the same way for every shell: the line
`init` adds to your shell's startup file looks for ttheme under
`XDG_CONFIG_HOME`.

## Network

The `ttheme` command sends its requests through `HTTPS_PROXY` and `HTTP_PROXY`,
leaving out the hosts `NO_PROXY` names, on Node.js 22.21 or newer. An older
Node.js goes direct.

## Editor and colors

- `ttheme config` opens `config.zsh` in `VISUAL`, or `EDITOR` when `VISUAL` is
  not set, or `vi` when neither is.
- `NO_COLOR`, set to anything, or `TERM=dumb` leaves the color out of ttheme's
  own messages and help. Palettes still reach your tabs.
