# Terminal support

ttheme wires eleven terminals, and every one of them repaints per tab. Nothing is
emulated: a terminal that cannot express something does not get it.

| | Ghostty | iTerm2 | kitty | Alacritty | WezTerm | Windows Terminal | Warp | Konsole | Terminal.app | Rio | Contour |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Set up by `init` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| A palette per tab | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pictures | ✓ | ✓ | ✓ | – | ✓ | – | ✓ | ✓ | ✓ | – | – |
| Follows the system's appearance | ✓ | ✓ | ✓ | – | ✓ | – | – | – | – | – | ✓ |

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
- **Repaints itself.** A tab only ever repaints itself, so a palette you used
  there by hand stays until you change it.

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
- **cmux** runs on Ghostty and reads Ghostty's config, so wiring Ghostty sets it
  up too. It picks up ttheme's changes by itself, with no reload sent. It shows
  the one picture that config names, as Ghostty does, so a picture put up in
  Ghostty shows in cmux as well. A cmux tab busy with a program catches up at
  its next prompt rather than when it comes to the front.

## iTerm2

- Each palette gets a `ttheme · <palette>` profile, and `ttheme · default` is
  the default profile, built on your own so your font and keys carry over.
- The first time ttheme switches a tab's profile, iTerm2 asks whether a control
  sequence may do that. **Always Allow** lets a tab switch to its palette's profile,
  colors and picture in one step. Refused, tabs still show the colors without
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
- **Kaku** is built on WezTerm, so wiring WezTerm sets it up too: `init` adds
  the same block to `~/.config/kaku/kaku.lua`. Kaku writes that file the first
  time it opens, so open Kaku once before `init`.

## Rio

- `init` puts `theme = "ttheme"` at the top of Rio's `config.toml`, and ttheme
  keeps that theme in the default palette. Rio reloads by itself.
- A reload redraws every tab on the default palette's background, so when the
  default changes, a tab that uses another palette paints itself again right
  after.
- With a theme set, Rio uses the theme's colors in place of your own
  `[colors]`. While ttheme is off, the theme holds a copy of your `[colors]`,
  so Rio looks as it did before.
- A config that already names a theme, or sets an `[adaptive-theme]`, keeps
  it, and `init` says so.
- Rio shows no picture ttheme can change per tab, so there are no pictures.

## Contour

- `init` adds a `ttheme` profile, built on your default one so your font and
  keys carry over, and makes it the default in Contour's `settings.yml`.
- Contour reads its profiles when it starts, so restart it once after `init`.
  Until then, and after a new default, ttheme gives every tab the default
  palette itself.
- Contour does not yet draw a background it is given while it runs
  ([contour#2182](https://github.com/contour-terminal/contour/issues/2182)). A
  tab that uses another palette, or follows a new default, takes its text,
  cursor and ANSI colors but keeps the background of the palette Contour
  started with. Once Contour draws it, the tab shows the whole palette, with
  nothing to update in ttheme.
- `ttheme off` reaches a running Contour at its next start. Until then its tabs
  keep the palette that was the default.
- Under `auto`, Contour switches between the palette's dark and light colors
  by itself. When the system switches, Contour puts every tab back on its
  profile's colors, so a tab that uses another palette takes it back after its
  next command.
- Contour shows no picture ttheme can change per tab, so there are no pictures.

## Windows Terminal

- From WSL, or a native Windows zsh, `init` writes a fragment with every scheme;
  `settings.json` is only touched so the terminal reloads.
- A profile holds one picture that a pane cannot change, so there are no
  pictures.

## Warp

- Warp shows one theme for the whole app, so the tab in front decides it, and
  switching tabs puts on the palette of the one you switch to.
- Following the tab in front needs `sqlite3`, which macOS ships. Without it, a
  tab puts its palette back at its next prompt.
- Split panes of one tab share its palette.
- With Sync with OS on, the palette goes in as both its light and dark theme, so
  the system's appearance never switches it away. `ttheme off` gives yours
  back.
- Warp Preview, Dev and the open-source build keep settings of their own.
  The default palette goes into every one ttheme finds, and a tab sets the theme of
  the Warp it runs in.
- Warp's theme picker lists each palette by its mode, as `miku · dark` and
  `miku · light`, and a palette with a picture once more as
  `miku · dark · picture`.
- Warp's Enforce minimum contrast lifts text that reads below 4.5:1 toward
  white or black: dim gray text gets lighter, and light text on a colored
  background turns nearly black. While ttheme is on it sets that to Never, so
  you see each palette's own colors, unless you chose a setting yourself.
  `ttheme off` puts it back.
- A theme you pick in Warp lasts until a tab puts a palette on again.
  `ttheme off` gives back the one you picked last, not the one from before
  ttheme.
- With Warp's Settings sync on, the theme goes to your account too, so your
  other devices take each palette a tab puts on: one without the same theme
  file falls back to Warp's dark theme. `init` says so when a Warp has it on.

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
- A tab shows a palette by switching to its profile, through Terminal.app's own
  scripting.
- A profile stretches its picture over the window, so ttheme lays it out for
  your window's shape. find is not offered, since Terminal.app cannot draw a
  picture in its text area.
- A palette added while Terminal.app runs gets its profile at the next start.

## Editors

An editor's colorscheme and ttheme share the screen without overlapping.

- **Neovim** with `termguicolors` draws every cell itself, so its colorscheme
  decides the editor and the palette shows around it. It reads the terminal's
  background at start, so a colorscheme with light and dark variants follows
  the palette's mode.
- **Show the palette in the editor** with `set notermguicolors`: Neovim's
  default colorscheme then uses the 16 ANSI colors, so each tab's editor shows
  its tab's palette.
- **256 colors** stay as every terminal ships them, so a colorscheme written
  for the 256-color palette looks the way its author made it.
- **Color resets**: Neovim and some plugins put the terminal's colors back as
  they exit. A tab showing a palette repaints itself after the command in Ghostty, kitty,
  Alacritty, WezTerm and Windows Terminal; iTerm2 lands on the palette's
  profile; Terminal.app and Konsole ignore resets.

## tmux

Inside tmux the colors belong to the terminal tab, not the pane. ttheme passes
its colors through to the terminal, and a pane shows its palette again when it
takes focus. Preview draws no picture inside tmux, and find is not offered
there.

ttheme tells which terminal holds tmux by the one the tmux server started in,
so a server started in Warp and attached from Rio still counts as Warp. In
Terminal.app a palette used in a pane brings its colors but not its picture,
since a pane cannot move the tab to another profile.
