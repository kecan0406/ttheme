# Terminal support

ttheme wires nine terminals, and every one of them repaints per tab. Nothing is
emulated: a terminal that cannot express something does not get it.

| | Ghostty | iTerm2 | kitty | Alacritty | WezTerm | Windows Terminal | Warp | Konsole | Terminal.app |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Set up by `init` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| A palette per tab | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pictures | ✓ | ✓ | ✓ | – | ✓ | – | ✓ | ✓ | ✓ |
| Follows the system's appearance | ✓ | ✓ | ✓ | – | ✓ | – | – | – | – |

`init` offers iTerm2 and Terminal.app on macOS, Konsole on Linux, and Windows
Terminal from WSL. "Follows the system's appearance" means the terminal tells ttheme when the
system switches between light and dark, for [auto](../usage/modes.md). Once one
wired terminal does, every terminal you wired switches with it.

Any other terminal that speaks the OSC color sequences, such as foot or a
VTE-based one, gets `ttheme use` and nothing else.

## What every terminal shares

- **Colors only.** ttheme sets no font, font size or shader anywhere.
- **One state.** Whichever terminal you run a command in, the change reaches
  every terminal you wired.
- **Repaints itself.** A tab only ever repaints itself, so a palette you painted
  by hand stays until you change it.

## Ghostty

- A new default reaches open tabs through a config reload ttheme sends.
- Ghostty shows one picture for the whole app. The tab in front decides it:
  taking focus puts its picture up. A tab busy with a program catches up when it
  comes to the front, on macOS through a small helper that watches the window in
  front.
- A tab you switch to can show the last tab's picture for a frame or two before
  its own arrives, since Ghostty draws a tab the moment it shows it.
- Each palette ships as `ttheme-<palette>.dark` and `.light`, so under `auto`
  Ghostty switches new windows by itself.

## iTerm2

- Each palette gets a `ttheme · <palette>` profile, and `ttheme · default` is
  the default profile, built on your own so your font and keys carry over.
- The first time ttheme switches a tab's profile, iTerm2 asks whether a control
  sequence may do that. **Always Allow** lets a tab wear its palette's profile,
  colors and picture in one step. Refused, tabs still wear the colors without
  the picture.
- iTerm2 reads its default profile at launch, so restart it once after `init`.
- Pictures need iTerm2 3.7 or newer.

## kitty

- A watcher ttheme adds puts each window's palette back after a config reload,
  and shows its picture as the window's logo, one per window.
- The watcher reaches kitty windows opened after `init`.

## Alacritty

- `init` wires the `alacritty.toml` Alacritty reads first. A config Alacritty
  still reads as `alacritty.yml` is left alone until `alacritty migrate` turns
  it into TOML.
- Colors in your own `[colors]` win over ttheme's import.
- Alacritty has no background pictures.

## WezTerm

- `init` adds a block before your config's `return config`, and WezTerm reloads
  by itself.
- The picture belongs to the window and follows its active tab.

## Windows Terminal

- From WSL, or a native Windows zsh, `init` writes a fragment with every scheme;
  `settings.json` is only touched so the terminal reloads.
- A profile holds one picture that a pane cannot change, so there are no
  pictures.

## Warp

- Warp wears one theme for the whole app, so the tab in front decides it, and
  switching tabs puts on the palette of the one you switch to.
- Following the tab in front needs `sqlite3`, which macOS ships. Without it, a
  tab puts its palette back at its next prompt.
- Split panes of one tab share its palette.
- With Sync with OS on, the palette goes in both its light and dark slots, so
  the system's appearance never switches it away. `ttheme off` gives yours
  back.
- Warp Preview, Dev and the open-source build keep settings of their own.
  The default palette goes into every one ttheme finds, and a tab paints the
  Warp it runs in.
- With Warp's settings sync on, the theme goes to your account too.

## Konsole

- Each palette gets a color scheme and a `ttheme · <palette>` profile built on
  your default one. Konsole reads its profiles at launch, so restart it once.
- A tab repaints by switching color scheme, and shows its picture as the
  scheme's wallpaper. Konsole 23.08 draws a wallpaper only where a compositor
  runs.
- Links open only where your profile allows escape sequences for links.

## Terminal.app

- Each palette gets a `ttheme · <palette>` profile, a copy of your default one
  in its colors and with its picture. Restart Terminal.app once after `init`.
- A tab wears a palette by switching to its profile, through Terminal.app's own
  scripting.
- A profile stretches its picture over the window, so ttheme lays it out for
  your window's shape. find is not offered, since Terminal.app cannot draw a
  picture in its text area.
- A palette added while Terminal.app runs gets its profile at the next start.

## Editors

An editor's colorscheme and ttheme share the screen without overlapping.

- **Neovim** with `termguicolors` paints every cell itself, so its colorscheme
  decides the editor and the palette shows around it. It reads the terminal's
  background at start, so a colorscheme with light and dark variants follows
  the palette's mode.
- **Wear the palette in the editor** with `set notermguicolors`: Neovim's
  default colorscheme then uses the 16 ANSI colors, so each tab's editor wears
  its tab's palette.
- **256 colors** stay as every terminal ships them, so a colorscheme written
  for the 256-color palette looks the way its author made it.
- **Color resets**: Neovim and some plugins put the terminal's colors back as
  they exit. A painted tab repaints itself after the command in Ghostty, kitty,
  Alacritty, WezTerm and Windows Terminal; iTerm2 lands on the palette's
  profile; Terminal.app and Konsole ignore resets.

## tmux

Inside tmux the colors belong to the terminal tab, not the pane. ttheme passes
its colors through to the terminal, and a pane wears its palette again when it
takes focus. Preview draws no picture inside tmux, and find is not offered
there.
