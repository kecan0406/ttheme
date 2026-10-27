# Keys

Every screen lists its own keys with `?`, for the mode it is in. This page
gathers them. A key drawn dim after a chip or a button is that control's own
key. Keys are written by name here; on a Mac the screens draw Apple's
symbols instead (`↩` for `enter`, `⎋` for `esc`, `⌃R` for `ctrl+r`).

Preview and Browse filter as you type, so a letter is never a command there:
what they do sits on the arrows, `enter`, `space`, `tab`, `esc` and `ctrl` or
`alt` with a key. Every click has a key that does the same.

`ctrl+j` and `ctrl+k` step a line like `↓` and `↑` on every list, filtering or
not, so a screen that filters as you type still moves from the home row. Where
pictures are listed (find's grid and its try view, and the Pictures row of the
palette panel) `h` and `l` move like `←` and `→`.

## Preview

The first tab of `ttheme`.

| Key | Does |
|---|---|
| `↑` `↓` `ctrl+j` `ctrl+k` `home` `end` `pgup` `pgdn` | move; the tab shows the palette under the cursor |
| `←` `→`, or `enter` or `space` on a work | close and open a work |
| any text, `bksp`, `ctrl+u` | filter by palette, work or character, in their original language too; `ctrl+u` clears |
| `⇧←` `⇧→` | the sample's scene: shell, code, diff, logs, monitor |
| `enter` | use the palette, asking Default or This tab |
| `tab` `→` `ctrl+e` | the palette's panel: its colors and picture |
| `alt+g`, or a click on the chip above the list | group and sort the list: `↑` `↓` a choice, `space` or `enter` picks it and saves it, `esc` closes |
| `alt+c` | settings: `↑` `↓` a setting, `←` `→` its value, `enter` saves, `esc` cancels |
| `shift+tab`, or `tab` on a work | to Browse |
| `esc` | clear the filter, then leave and put the tab back |

## The palette panel

`tab` on a palette in Preview.

| Key | Does |
|---|---|
| `↑` `↓` `j` `k` `ctrl+j` `ctrl+k` `home` `end` | the picture's rows, the palette, then Apply |
| `←` `→` or `h` `l` on Pictures, or `,` `.` anywhere | pick one of the palette's pictures |
| `enter` on the empty frame, or `f` | find a picture |
| `←` `→` or `h` `l` on a row, `⇧` for ×10, `1`–`9` on Position | tune size, position or opacity |
| `=` and `+` | reset this row, or every row |
| `c` | the picture's own colors, or tinted in the palette's color |
| `space` | hide or show the picture |
| `D` | remove the picture |
| `y` | copy a line crediting the artist |
| `enter` on Edit palette | change the colors in the palette editor |
| `enter` on Apply, or `⇧enter` anywhere | save, then ask where to use it |
| `s` | keep the picture's tuning |
| `esc` | back to the list, dropping picture changes since `s` |

## Browse

The second tab of `ttheme`.

| Key | Does |
|---|---|
| `↑` `↓` `ctrl+j` `ctrl+k` `home` `end` `pgup` `pgdn` | move |
| `→` `enter` | a marketplace into the panel, or open a work |
| `←` `esc` | from the panel back to the marketplaces |
| any text, `bksp`, `ctrl+u` | filter every marketplace |
| `space` | mark a palette, a work or a whole marketplace |
| `↓` past the last palette, then `enter` | the marketplace's own actions: update, auto-update, remove |
| `enter` on `+ Add marketplace` | add a repository or a folder, in the panel |
| `enter` on `⌕ Search marketplace` | find one on GitHub |
| `ctrl+r` on a palette marked `⇡`, or on a work | stage its update, or every update under the work |
| `enter` on a palette | review and apply what you marked |
| `tab` `shift+tab` | to Preview |
| `esc` | clear the filter, then leave |

In Search marketplace, `space` adds a marketplace (again to undo), `enter` adds
it and goes back to its card, and `ctrl+r` reloads the list.

## The palette editor

`ttheme new`, `ttheme edit`, or Edit palette in the panel.

| Key | Does |
|---|---|
| `↑` `↓` `ctrl+j` `ctrl+k` | a color |
| `←` `→` | its normal or bright |
| `pgup` `pgdn` | the base colors, or the ANSI ones |
| `enter` `tab` | open the picker under the color |
| `n` `N` | the next or previous color that fails a contrast check |
| `f` | move the failing colors until they pass |
| `g` | every ANSI color's lightness, chroma and hue at once |
| `i`, or a click on the sample | find the colors a spot uses |
| `w` | dim every part of the sample that does not use the color |
| `m` | only the colors that changed |
| `⇧←` `⇧→` | another tab of the sample |
| `l`, `=` | link a bright to its normal; snap it to its normal |
| `#` | type a color: `#rrggbb`, `rgb(r g b)` or `oklch(l c h)` |
| `c` `v` | copy a color and paste it into another |
| `r` `R` | put back this color, or every color |
| `*` | mark a signature color, on your own palette |
| `o`, `I` | take colors from another palette, or a share code |
| `x` | copy the share code, an add command or the file |
| `p`, `b` | find a picture; show or hide it behind the editor |
| `u`, `ctrl+r` | undo, redo |
| `space` | compare with the colors you started from |
| `s` | save |
| `esc` | leave, asking first when something changed |

### In the picker

| Key | Does |
|---|---|
| `↑` `↓` `ctrl+j` `ctrl+k` | lightness |
| `←` `→` | chroma |
| `⇧←` `⇧→`, or `,` `.` | hue by 5, or by 1 |
| `pgup` `pgdn` | lightness by 5 |
| `home` `end`, `0`–`9` | the ends of the last channel moved, or a point along it |
| `tab` | ◐: set lightness by contrast; `home` the lowest ratio that passes, `1`–`9` a ratio |
| `a` | widen what moves: this color, its pair, the normals, the brights or every accent |
| `u`, `ctrl+r`, `r` | undo a step, redo, put the color back |
| `enter` | keep |
| `esc` | cancel, putting back every color the tune moved |

## find

`f` in the palette panel, or `p` in the editor.

| Key | Does |
|---|---|
| `←` `↑` `↓` `→` `h` `j` `k` `l` `ctrl+j` `ctrl+k` `home` `end` `pgup` `pgdn` | move |
| `enter` | try the picture on |
| `tab` `shift+tab` | all sites, or one at a time |
| `c` | cutouts only, or every post |
| `/` | search a tag, a post's link or its number |
| `1`–`9` | turn a tag of the tags row on or off |
| `space` | unfold a set marked `×N` |
| `ctrl+v` or `v` | a picture from the clipboard |
| `o` `O` | open the artwork's page, or the post's |
| `s`, `a` | settings, and the advanced ones |
| `esc` | back to Preview |

### Trying a picture on

| Key | Does |
|---|---|
| `←` `→` or `h` `l` | the neighbouring posts |
| `enter` | install it |
| `t` | tune size, position and opacity |
| `c` | its own colors, or tinted in the palette's color |
| `x` | cut the background out, or keep it |
| `i` | the post's details |
| `⇧←` `⇧→` | switch the sample |
| `esc` | back to the grid |

## Everywhere

`?` lists the keys of the screen you are in. `ctrl+c` leaves Browse, the editor
and find, asking first where something would be lost; a second `ctrl+c` leaves
anyway.
`TTHEME_KEYS` picks how keys are drawn, and `TTHEME_MOUSE=off` leaves the mouse
to the terminal.
