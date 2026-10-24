# Pictures

A palette can carry a picture of its character behind your text. ttheme finds
one on the image boards, cuts the character out, and keeps it faint enough that
your text still passes the contrast gate.

## Where pictures show

| Terminal | Shows |
|---|---|
| Ghostty | one picture for the whole app, following the tab in front |
| iTerm2 3.7 or newer | one per tab |
| kitty | one per window, a split pane included |
| WezTerm | the active tab's, per window |
| Konsole | one per tab |
| Terminal.app | one per tab, through the palette's profile |
| Warp | one for the whole app, through its theme |
| Alacritty, Windows Terminal | none |

ttheme ships no pictures. They are downloaded to your machine and stay in
`~/.config/ttheme/backgrounds`.

## Find one

In `ttheme`, put the cursor on a palette and press `tab` to open its panel. The
**Images** row at the top holds the palette's pictures. On an empty frame,
`enter` opens **find**, and `f` does from anywhere in the panel.

find searches danbooru, konachan, yande.re and zerochan for the character and
lays the posts out as a grid of thumbnails.

- `tab` moves between **all** and each site on its own.
- `c` narrows the grid to cutouts, posts with a transparent background.
- `/` edits the search: type another tag, or paste a post's link or number to
  go straight to it.
- `s` opens the filters: ratings, blocked tags, cutouts only, order, minimum
  score and size.

find draws its grid in the text area, so it is not offered in Terminal.app or
inside tmux. By default it lists only posts rated safe, and none tagged with
nudity or underwear. Each post shows its number and artist, and a click on the number
opens the post.

## Try it on

`enter` on a thumbnail paints the whole window the way the installed picture
will look, over a sample of a shell session.

- On macOS 14 or newer, an opaque picture has its character cut out by the
  system's own Vision framework. Nothing is installed or uploaded. `x` switches
  between the cut-out and the whole picture.
- `c` draws it in its own colors or tinted in one color of the palette.
- `t` opens the tuning below over the picture.
- `←` `→` try the neighbouring posts, and `i` shows the post's details.

`enter` installs it, keeping the artist and the artwork's page with the
picture.

## Your own picture

Drop an image file on the window while find is open, or paste one: a file
copied in Finder, its path or a link. `ctrl+v` reads the clipboard itself, which
is how a screenshot gets in. PNG and JPEG work everywhere; macOS also converts
HEIC, WebP, GIF and TIFF.

## Tune it

The panel tunes the picture in place, row by row:

| Row | `←` `→` change |
|---|---|
| **Images** | which of the palette's pictures shows |
| **Colors** | its own colors, or one color of the palette |
| **Size** | from 20% up to the whole picture (100%), then larger around the face, up to **fill** |
| **Position** | the nine anchors; `1`–`9` jump to one |
| **Opacity** | by 0.01; shift moves ten steps |

`=` puts the row back to its default and `+` every row. `space` hides the
picture, `s` saves, and `esc` drops what you changed since the last save. A
saved change reaches every terminal you wired.

The opacity starts at the highest value at which the palette's text still
passes the [contrast gate](../reference/contrast-gate.md). You can raise it
further; the panel does not stop you.

## Several pictures

A palette keeps every picture you install on it. `,` and `.` move along the
Images row from any row, and `s` makes the one you land on the palette's
picture. `D` removes the picture under the cursor, files and all.

## Credit the artist

`y` copies a line that credits the picture on screen, ready to paste beside a
screenshot:

```text
Background art by yoshio_296 (x.com/yoshio_296) · https://www.pixiv.net/artworks/102307058
```

The panel names the artist and links their pages under the picture.

## Settings

| Setting | Does |
|---|---|
| `TTHEME_BG_COLORS` | the colors new pictures are drawn in: `original` or `tone` |
| `TTHEME_BG_BLUR` | softens every picture by up to 8 screen pixels |
| `TTHEME_FIND_RATING`, `TTHEME_FIND_BLOCK` | what find lists |

[Settings](../reference/settings.md) lists every `TTHEME_FIND_*` filter.
