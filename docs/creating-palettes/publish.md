# Publish a marketplace

A marketplace is a GitHub repository of palette files. Anyone can add it with
one command, and their copies update when you push. There is nothing to build:
ttheme reads the files as you pushed them.

## Publish from ttheme

```sh
ttheme share   # choose "a marketplace on GitHub"
```

`share` picks one of your local marketplaces, or makes one, and opens the
palette list on what it holds. Pick the palettes to publish: a palette from
elsewhere is copied in, keeping the work or character it is of and naming the
palette it came from — with that work's record in `works/` when the commons
does not hold it — and one you unpick is deleted. The first time it asks for
the repository's name and who can see it, then shows what it will push and
asks once more.

It needs [GitHub CLI](https://cli.github.com) (`gh`) logged in. It creates the
repository, pushes it, and adds the `ttheme-marketplace` topic to a public one.
Run it again to push changes.

## Add a published marketplace

```sh
ttheme marketplace add alice/ttheme-pastel      # follows the default branch
ttheme marketplace add alice/ttheme-pastel#v1   # pinned to a tag, branch or commit
```

A public repository with the `ttheme-marketplace` topic shows in Browse's
`⌕ Search marketplace` and on [ttheme.dev/marketplace](https://ttheme.dev/marketplace)
within the hour.

## The layout

```text
ttheme-marketplace.toml
palettes/
  rei.toml
  dusk.toml
works/
  starfall-academy.toml
```

Every palette is a file straight under `palettes/`, and its file's name is its
name: `palettes/dusk.toml` in alice's `pastel` marketplace is
`alice@pastel/dusk`. A file in a folder under `palettes/` is not read.

`works/` is optional. It holds the works and characters your palettes are of
that the commons does not hold yet, below.

## ttheme-marketplace.toml

```toml title="ttheme-marketplace.toml"
"$schema" = "https://www.schemastore.org/ttheme-marketplace.json"
name = "pastel"
description = "Soft palettes for long nights"

[owner]
name = "alice"   # your GitHub handle

[renames]
dawn = "dusk"    # old name to new name; installs follow it
sunset = false   # gone: installs drop it
```

`force_remove_deleted_palettes = true` drops a palette from everyone's install
when its file disappears, instead of keeping their copy. The `$schema` line
gives your editor completion and checks.

## A palette file

```toml title="palettes/rei.toml"
"$schema" = "https://www.schemastore.org/ttheme-palette.json"
subject = "evangelion/rei"                 # what it is of: a work, or a work's character
from = "ttheme/rei"                        # the palette it was copied from, if any
signature = ["cursor", "ansi1", "ansi12"]  # the three colors that identify it
ansi_source = "Idle Toes"                  # where its ANSI colors came from

[colors]
background = "#201516"
foreground = "#fbdbdd"
cursor = "#ffc1c6"
selection_background = "#553444"
ansi = [ ... 16 colors ... ]
```

`subject` says what the palette is of: a work in the commons, such as
`undertale`, or one of its characters, such as `evangelion/rei`. ttheme's lists
shelve it under that work, beside every other marketplace's palettes of it. A
palette without one is an original, which lists under your marketplace.
`ansi_source` reads `original` when you leave it out.

`[colors.light]` (or `[colors.dark]`) may hold the palette in its other mode;
without it, ttheme mirrors one. `[[picture]]` tables list background posts by
number, which an install fetches. The schema names every field.

## A work the commons lacks

The commons is ttheme's list of works and characters, in the ttheme
repository. When your palette is of a work it does not hold, or of a character
missing from a work it does, describe it in `works/<work>.toml`:

```toml title="works/starfall-academy.toml"
"$schema" = "https://www.schemastore.org/ttheme-work.json"
name = "Starfall Academy"
native = "スターフォール学園"   # its title in the original language

[[character]]
id = "mira"
native = ["星野ミラ"]
danbooru = "mira_(starfall_academy)"   # the character's danbooru tag, which find searches
```

A palette of her then names `subject = "starfall-academy/mira"`. The file's
name is the work's id. An install takes a work the commons lacks, and the
characters a work in the commons lacks; for everything the commons already
holds, the commons wins. Offer the work to the commons too, with a pull request
to the ttheme repository, and it reads the same for every marketplace.

## Check before you push

```sh
ttheme marketplace check ./ttheme-pastel
```

It reads the folder as an install would and lists every problem: a palette that
does not parse, a palette file in a folder under `palettes/`, which no install
reads, a subject neither the commons nor your `works/` holds, a character you
propose that the commons already holds under another name, a key ttheme does
not know, a rename that loops, and the
[contrast checks](../reference/contrast-gate.md) for each palette. It writes
nothing.

## Rename or retire a palette

Keep a palette's name once people have it. When you must change it, rename the
file and add the old name to `[renames]`: installs follow the new name and keep
their tuning, pictures and pins. `false` retires a palette.
