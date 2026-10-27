# Light, dark and auto

Every palette comes in a light and a dark mode. One setting picks the mode all
of them show in, and `auto` follows your system's appearance as it changes.

## Switch the mode

```sh
ttheme light   # dark text on a light background
ttheme dark    # light text on a dark background
ttheme auto    # the system's appearance, followed as it changes
```

A switch changes every open tab, whether you set its palette or not, in every
terminal you wired, and moves each palette's pictures to the new mode. `alt+c`
in `ttheme` has the same setting as its **Mode** row, and `init` asks for it the
first time.

## How auto works

`auto` follows the appearance a wired terminal reports:

| Terminal | Hears a change |
|---|---|
| Ghostty | from the system, or its own `window-theme`, in any tab at its prompt |
| iTerm2 | from the system, through ttheme's profiles, which carry both modes |
| kitty, WezTerm | from the system, through ttheme's watcher and module |
| Contour | from the system, in any tab at its prompt |

It is offered only where one of these is wired. Once one of them hears a
change, every terminal you wired switches with it, Warp and Terminal.app
included. A change made while every tab was busy is heard at the next prompt.
When nothing reports it, `auto` starts from the system's setting.

## Where the light mode comes from

The built-in palettes carry both modes in their files, each passing the same
[contrast checks](../reference/contrast-gate.md). A marketplace palette made in
one mode gets the other by the same rules: each color keeps its hue, its
lightness moves to the other side, and the colors that identify the character
are kept apart.

Your [tuning](../creating-palettes/tune.md) belongs to the mode it was made in, so
a palette can be tuned differently in light and dark.

## In your editor

Neovim asks the terminal for its background when it starts and sets
`background` to match, so a colorscheme with light and dark variants follows
the palette's mode.
