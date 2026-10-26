# Add and update palettes

Palettes come from marketplaces. The built-in one ships with ttheme, and anyone
can publish another from a GitHub repository. Browse adds and drops palettes;
`ttheme update` brings new versions.

## Works, characters and originals

A palette is someone's take on a character, or on a whole work — a series, a
game, a franchise — in colors. Which work and character it is of comes from
the commons: one list of works and their characters that every marketplace's
palettes name and no marketplace owns. So a character is the same character
whichever marketplace a palette of it comes from, and Preview and `init`'s list
show every palette under its work, the palettes of one character side by side,
the built-in one first.

A palette of no work or character is an original. Originals come after the
works, one shelf per marketplace.

A character who appears in more than one work, such as a crossover guest, is
listed under each of them. A marketplace can also bring a work or a character
the commons does not hold yet, which then shows as any other.

## Names

Every palette has a full name: `ttheme/rei` for a built-in one,
`alice@pastel/rei` for the rei in alice's `pastel` marketplace. A name typed
alone works when only one palette has it, or only one installed palette:

```sh
ttheme use rei                # the one rei you have
ttheme use alice@pastel/rei   # this one, when you have two
```

When a name could mean more than one, ttheme lists their full names, so you can
type the one you mean. Its messages show a palette by its name alone wherever
that is enough, and `tab` completes full names once you type `/` or `@`, or
where two palettes share a name.

## Browse

`ttheme`, then `tab`, opens Browse. Each marketplace you added is a card — the
built-in one is `ttheme` — and the panel beside it lists that marketplace's
palettes by work, its originals after them.

- `→` or `enter` on a card moves into its panel, and `←` or `esc` comes back.
- Typing filters every marketplace at once: palette names, works, characters
  and their names in their original language.
- `space` marks a palette, a work or a whole marketplace to install.
  Unmarking a palette you have removes it.
- `enter` on a palette reviews everything you marked, and `enter` again applies
  it. Nothing is written before that.

The tab repaints as the cursor lands on a palette in the panel, and the panel's
foot says whether it is installed and how it scores on the
[contrast checks](../reference/contrast-gate.md).

## From the command line

```sh
ttheme add gojo geto           # install palettes by name
ttheme add alice@pastel/dusk   # a palette from another marketplace
```

`add` also takes a [share link](../creating-palettes/share.md) or a palette file
(`ttheme add dusk.toml`).

## Marketplaces

A marketplace is named `<owner>@<name>`, and its palettes
`<owner>@<name>/<palette>`. In Preview its palettes join the works they are
of, beside the built-in ones, and its originals get a shelf of their own.

```sh
ttheme marketplace add alice/ttheme-pastel      # a GitHub repository
ttheme marketplace add alice/ttheme-pastel#v1   # pinned to a tag, branch or commit
ttheme marketplace add ./my-marketplace         # a folder, always up to date
ttheme marketplace remove alice@pastel          # installed palettes keep working
```

In Browse, `+ Add marketplace` takes the same sources, and
`⌕ Search marketplace` lists every public marketplace on GitHub, read every half
hour. `space` there adds one.

Only the built-in palettes must pass every contrast check before they ship. A
marketplace palette installs whatever its numbers, and Browse shows them.

## Update

```sh
ttheme update                  # ttheme itself, then every marketplace
ttheme update alice@pastel     # one marketplace
```

The built-in palettes come with ttheme, so a new release is how they change.
Other marketplaces are fetched again.

An installed palette keeps the colors it was installed with until you take its
update. `ttheme update` names the palettes that have one, and Browse marks them
`⇡`: `ctrl+r` there stages one, or every one under a work, for `enter` to
apply. Your tuning stays on top of the update.

## Updates on their own

Once a day, in the background of any command, ttheme checks whether npm has a
newer version and says so once. A marketplace you switched to update on its own
is fetched again when its copy is a day old. `ttheme marketplace add` asks for
a repository, and its **Auto-update** row in Browse switches it later.

`TTHEME_AUTO_UPDATE=off` in `ttheme config` stops both checks. A prompt never
fetches a marketplace.

## Renamed and removed palettes

A marketplace can rename a palette. An update follows the rename and keeps your
tuning, pictures, pins and default under the new name. A palette the
marketplace marks as removed comes off. One that simply disappears from it stays
installed from your copy, and Browse marks it.

When the commons moves a work or a character to a new name, every palette of it
follows on its own, whichever marketplace it comes from.
