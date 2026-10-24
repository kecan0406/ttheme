# This tab, new tabs and the default

Every tab wears one palette at a time. You can paint a single tab, set the
palette new tabs open with, or let every new tab take the next character.

## Paint this tab

```sh
ttheme use miku   # this tab only
ttheme use ho     # a unique prefix is enough
```

A tab only ever repaints itself, so the palette you paint stays until you change
it. A mistyped name gets a suggestion instead of an error wall.

## Set the default

```sh
ttheme default kurisu
```

The default is the palette new tabs open with, in every terminal you wired,
whichever one you run the command from. Open tabs you never painted by hand
follow it at once; a tab you painted keeps its palette. In Preview, `enter` on a
palette and then **Default** does the same.

## A new palette for every tab

Set `TTHEME_TAB_PALETTE` to `seq` and each new tab takes the next palette, in
the order you installed them. The count is shared by every tab, so four new
tabs give four different characters.

```sh
ttheme config   # set TTHEME_TAB_PALETTE=seq
```

`alt+c` in `ttheme` changes the same setting in place. Set either way, Ghostty
opens each new tab already wearing its palette. `off`, the default, keeps new
tabs on the default palette.

## Turn it off and on

```sh
ttheme off   # the terminal's own colors in every tab
ttheme on    # the default palette again
```

`off` keeps everything installed. Pins, ssh pins and rotating new tabs rest
until `on`, which paints the tab you run it in and lets the others follow at
their next prompt.

## Changes reach every tab

A change made in one tab, such as a new default, a palette added or a pin set,
reaches every other tab that sits idle at its prompt at once. A tab busy with a
program catches up at its next prompt, or as soon as it comes to the front in a
terminal that reports focus.

## When a program resets the colors

Some programs put the terminal's colors back as they exit, such as Neovim with
its default cursor or a background sync plugin. After each command, a painted
tab checks its colors and repaints itself if they changed. That takes about a
quarter of a millisecond in Ghostty and needs no process.

## Shells inside other programs

- **An editor's terminal**, such as Neovim's `:terminal`, Vim's, Emacs or VS
  Code: ttheme stays out, since the editor draws that terminal in its own
  theme. `ttheme use` there says to run it in a tab outside the editor.
- **tmux**: the colors belong to the terminal tab, not the pane, so a pane
  wears its palette again when it takes focus.
- **bash and fish**: every command works. What runs at each prompt, like a pin
  taking effect on `cd`, stays with zsh tabs.
