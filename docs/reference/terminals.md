# Terminal support

ttheme wires eleven terminals, and every one of them shows a palette per tab. Nothing
is emulated: a terminal that cannot express something does not get it.

| | Ghostty | iTerm2 | kitty | Alacritty | WezTerm | Windows Terminal | Warp | Konsole | Terminal.app | Rio | Contour |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Set up by `init` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| A palette per tab | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pictures | ✓ | ✓ | ✓ | – | ✓ | – | ✓ | ✓ | ✓ | – | – |
| Follows the system's appearance | ✓ | ✓ | ✓ | – | ✓ | – | – | – | – | – | ✓ |

`init` offers iTerm2 and Terminal.app on macOS, Konsole on Linux, and Windows
Terminal from WSL. "Follows the system's appearance" means the terminal tells
ttheme when the system switches between light and dark, for `auto`; once one
wired terminal does, every terminal you wired switches with it. Any other
terminal that speaks the OSC color sequences, such as foot or a VTE-based one,
gets `ttheme use` and nothing else.

Every terminal shares three things: ttheme sets **colors only** (no font, font
size or shader), a change made in one terminal reaches **every terminal you
wired**, and a tab only ever changes its own colors, so a palette you used there
by hand stays until you change it.

iTerm2, Konsole, Terminal.app and Contour read their profiles when they start, so
restart each once after `init`.

## Per terminal

- **Ghostty** reloads its config when the default changes. It shows one picture
  for the whole app, decided by the tab in front, so a tab you switch to can show
  the last tab's picture for a frame or two. Each palette ships as `.dark` and
  `.light`, so under `auto` new windows switch by themselves. **cmux** runs on
  Ghostty and reads its config, so wiring Ghostty sets it up too.
- **iTerm2** gets a `ttheme · <palette>` profile per palette, and
  `ttheme · default` as the default profile, built on yours so your font and keys
  carry over. The first time ttheme switches a tab's profile, iTerm2 asks whether
  a control sequence may do that: **Always Allow** switches colors and picture in
  one step, and refused, tabs show the colors without the picture. Pictures need
  iTerm2 `>=3.7`.
- **kitty** gets a watcher that puts each window's palette back after a config
  reload and shows its picture as the window's logo, one per window. It reaches
  windows opened after `init`.
- **Alacritty** is wired through the `alacritty.toml` it reads first; a config it
  still reads as `alacritty.yml` is left alone until `alacritty migrate`. Colors
  in your own `[colors]` win over ttheme's import. No pictures.
- **WezTerm** gets a block before your config's `return config`, and reloads by
  itself. The picture belongs to the window and follows its active tab. **Kaku**
  is built on WezTerm, so wiring WezTerm sets it up too; open Kaku once before
  `init`, since it writes its config on first start.
- **Rio** gets `theme = "ttheme"` at the top of `config.toml`. A config that
  already names a theme, or sets an `[adaptive-theme]`, keeps it, and `init` says
  so. With a theme set, Rio uses the theme's colors in place of your own
  `[colors]`. When the default changes, a tab on another palette uses it again
  right after the reload. No pictures.
- **Contour** gets a `ttheme` profile built on your default one. It does not yet
  draw a background it is given while it runs
  ([contour#2182](https://github.com/contour-terminal/contour/issues/2182)), so a
  tab on another palette keeps the background of the palette Contour started
  with. `ttheme off` reaches a running Contour at its next start. No pictures.
- **Windows Terminal** gets a fragment with every scheme from WSL or a native
  Windows zsh. A profile holds one picture that a pane cannot change, so no
  pictures.
- **Warp** shows one theme for the whole app, so the tab in front decides it, and
  split panes of one tab share its palette. Following the tab in front needs
  `sqlite3`, which macOS ships. With Sync with OS on, the palette goes in as both
  its light and dark theme. While ttheme is on it sets Enforce minimum contrast
  to Never, unless you chose a setting yourself, and `ttheme off` puts it back. A
  theme you pick in Warp lasts until a tab puts a palette on again. With
  Settings sync on, your other devices without the same theme file fall back to
  Warp's dark theme; `init` says so when a Warp has it on.
- **Konsole** gets a color scheme and a `ttheme · <palette>` profile per palette,
  and shows the picture as the scheme's wallpaper. Konsole `23.08` draws a
  wallpaper only where a compositor runs. Links open only where your profile
  allows escape sequences for links.
- **Terminal.app** gets a `ttheme · <palette>` profile per palette, copied from
  your default one, and a tab shows a palette by switching to it. A palette added
  while Terminal.app runs gets its profile at the next start. A profile stretches
  its picture over the window, so ttheme lays it out for your window's shape, and
  find is not offered.

## Editors and tmux

- **Neovim** with `termguicolors` draws every cell itself, so its colorscheme
  decides the editor and the palette shows around it. To show the palette inside
  the editor too, put `set notermguicolors` in `init.vim`: its default
  colorscheme then uses the 16 ANSI colors. Neovim reads the terminal's
  background at start, so a colorscheme with light and dark variants follows the
  palette's mode.
- **An editor's terminal** (Neovim's `:terminal`, Vim's, Emacs, VS Code) draws in
  the editor's own theme, so ttheme stays out of it.
- **Color resets**: Neovim and some plugins put the terminal's colors back as
  they exit, and `reset` puts back the 16 ANSI colors in Ghostty and Alacritty.
  A tab showing a palette shows it again after the command in Ghostty, kitty,
  Alacritty, WezTerm and Windows Terminal; iTerm2 lands on the palette's
  profile; Terminal.app and Konsole ignore resets. The 256-color extension stays
  as every terminal ships it.
- **tmux**: the colors belong to the terminal tab, not the pane, so a pane shows
  its palette again when it takes focus. Preview draws no picture inside tmux,
  and find is not offered there. In Terminal.app a palette used in a pane brings
  its colors but not its picture.
