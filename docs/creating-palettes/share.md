# Share a link

A share link carries the palette itself, so nothing is uploaded or stored. The
link opens the palette in the builder on ttheme.dev, and `ttheme add` installs
it from there.

## Make a link

```sh
ttheme share rei       # one palette
ttheme share           # asks how to share, then which palettes
ttheme share | pbcopy  # the palette this tab shows, straight to the clipboard
```

`share` prints the link, and in a terminal its QR code under it. The QR code is
a picture in Ghostty, kitty, iTerm2, WezTerm and Konsole outside tmux, and text
elsewhere.

```text
https://ttheme.dev/builder/tt5:…
```

One link can carry several palettes. Everything after `/builder/` is the code:
each palette's name, its twenty colors and its other mode where it keeps one,
its signature, the work or character it is of and the posts of its pictures,
checked by a hash so a mistyped link is refused. A palette from a marketplace
goes by its full name, such as `ttheme/rei`; one that lives in no marketplace,
such as a tuned copy, goes by its own name and says which palette it came
from.

## Open a link

The link opens [the builder](https://ttheme.dev/builder) on the palette: a mock
terminal in its colors, its color list, the contrast checks, and its pictures' posts
with their artists. A change there makes a copy of your own, which the builder
exports as a [set](publish.md#a-set).

## Install a link

```sh
ttheme add https://ttheme.dev/builder/tt5:…
ttheme add tt5:…              # the bare code works too
ttheme add ~/Downloads/rei.toml   # a set the builder exported
```

A link installs its palettes as they are, with the pictures it names. A link to
a palette you already have, such as a built-in one, installs yours when the
colors match and leaves it out when they differ. A palette the link carries
that lives in no marketplace joins your own, as every palette of a set you add
does, where you can edit it.

In the palette editor, pasting a link takes its colors into the palette you are
editing, and `x` copies the palette's code, its `ttheme add` command or a set
that holds it.

## Share as a marketplace

For palettes you want others to add and keep updated, publish them as a
[marketplace](publish.md) instead: `ttheme share` with no palette named offers
both.
