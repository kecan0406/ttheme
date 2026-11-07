# Configuration

Where ttheme keeps your settings and files, and every setting it reads with the
values it takes and its default. The settings below are made from the same
source as the comments in your `config.zsh`.

Settings live in `~/.config/ttheme/config.zsh`. `ttheme config` opens it in
`$EDITOR`, `alt+c` in `ttheme` edits the common ones in place, and `alt+g`
there picks how the list is grouped and sorted. On a Mac where option types
characters, those two work while the filter is empty, and type `ç` and `©` once
it holds text. Each default sits on a commented line, so a default a later
version changes reaches you; a line you uncomment keeps your value. A variable
exported before ttheme loads wins over the file, as
[Environment variables](environment.md) says.

## Files

Everything ttheme keeps is in `~/.config/ttheme`, or under `XDG_CONFIG_HOME`
when you set it. Edit `config.zsh` and your own palettes; ttheme's commands
write the rest.

| File | What it holds | Changed by |
|---|---|---|
| `config.zsh` | Your settings | `ttheme config`, `alt+c` in `ttheme` |
| `marketplace/` | Your own palettes | `ttheme new`, `ttheme edit`, or you |
| `marketplaces/` | The marketplaces you added | `ttheme marketplace`, `ttheme update` |
| `installed.json` | The palettes and terminals you set up, and the palette new tabs start with | `init`, `ttheme add`, `ttheme` |
| `pins` | Your folder and ssh pins | `ttheme pin`, `ttheme unpin` |
| `backgrounds/` | Your pictures and how each is shown | `ttheme find`, `ttheme image` |

The other files there, such as `ttheme.zsh` and `ttheme.js`, are the command
itself, which `init` and `ttheme update` replace. What ttheme remembers between
runs, such as the last release it told you about, is in
`~/.local/state/ttheme`.
