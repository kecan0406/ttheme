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
elsewhere is copied in under its own catalog, and one you unpick is deleted.
The first time it asks for the repository's name and who can see it, then
shows what it will push and asks once more.

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
  night/
    dusk.toml
    moon.toml
  day/
    noon.toml
  rei.toml
```

Each folder under `palettes/` is a catalog, and a palette straight under
`palettes/` sits after them. A palette is named
`<owner>@<marketplace>/<palette>`, so the folder it sits in is never part of
its name, and a name is used once per marketplace.

## ttheme-marketplace.toml

```toml title="ttheme-marketplace.toml"
"$schema" = "https://www.schemastore.org/ttheme-marketplace.json"
name = "pastel"
description = "Soft palettes for long nights"

[owner]
name = "alice"   # your GitHub handle

[[catalog]]
name = "night"   # the folder
native = "夜"    # its title in its original language, shown beside it
lead = "dusk"    # the palette whose colors stand for the catalog

[renames]
dawn = "dusk"    # old name to new name; installs follow it
sunset = false   # gone: installs drop it
```

The catalogs show in the order their tables give. A folder no table names
follows by name. `force_remove_deleted_palettes = true` drops a palette from
everyone's install when its file disappears, instead of keeping their copy.
The `$schema` line gives your editor completion and checks.

## A palette file

```toml title="palettes/night/dusk.toml"
"$schema" = "https://www.schemastore.org/ttheme-palette.json"

[meta]
name = "dusk"                              # the file's name
native_names = ["夕暮れ"]                   # names preview's search matches
# booru = "kaname_madoka"                  # for a character: the tag find searches
signature = ["cursor", "ansi1", "ansi12"]  # the three slots that identify it

[colors]
background = "#201516"
foreground = "#fbdbdd"
cursor = "#ffc1c6"
selection_background = "#553444"
ansi = [ ... 16 colors ... ]
```

`[colors.light]` (or `[colors.dark]`) may hold the palette in its other mode;
without it, ttheme mirrors one. `[[picture]]` tables list background posts by
number, which an install fetches. The schema names every field.

## Check before you push

```sh
ttheme marketplace check ./ttheme-pastel
```

It reads the folder as an install would and lists every problem: a palette that
does not parse, a key ttheme does not know, a rename that loops, a catalog table
with no folder, and the [contrast checks](../reference/contrast-gate.md) for each
palette. It writes nothing.

## Rename or retire a palette

Keep a palette's name once people have it. When you must change it, move the
file and add the old name to `[renames]`: installs follow the new name and keep
their tuning, pictures and pins. `false` retires a palette.
