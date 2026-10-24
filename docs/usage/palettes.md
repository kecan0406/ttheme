# Add and update palettes

Palettes come from marketplaces. The official one ships with ttheme, and anyone
can publish another from a GitHub repository. Browse adds and drops palettes;
`ttheme update` brings new versions.

## Browse

`ttheme`, then `tab`, opens Browse. Each marketplace you added is a card, and
the panel beside it lists that marketplace's catalogs and palettes.

- `→` or `enter` on a card moves into its panel, and `←` or `esc` comes back.
- Typing filters every marketplace at once.
- `space` marks a palette, a catalog or a whole marketplace to install.
  Unmarking a palette you have removes it.
- `enter` on a palette reviews everything you marked, and `enter` again applies
  it. Nothing is written before that.

The tab repaints as the cursor lands on a palette in the panel, and the panel's
foot says whether it is installed and how it scores on the
[contrast gate](../reference/contrast-gate.md).

## From the command line

```sh
ttheme add gojo geto           # install palettes by name
ttheme add alice@pastel/dusk   # a palette from another marketplace
```

`add` also takes a [share link](../creating-palettes/share.md) or a palette file
(`ttheme add dusk.toml`).

## Marketplaces

A marketplace is named `<owner>@<name>`, and its palettes
`<owner>@<name>/<palette>`. In Preview and Browse they sit below the official
catalogs.

```sh
ttheme marketplace add alice/ttheme-pastel      # a GitHub repository
ttheme marketplace add alice/ttheme-pastel#v1   # pinned to a tag, branch or commit
ttheme marketplace add ./my-marketplace         # a folder, read in place
ttheme marketplace remove alice@pastel          # installed palettes keep working
```

In Browse, `+ Add marketplace` takes the same sources, and
`⌕ Search marketplace` lists every public marketplace on GitHub, read every half
hour. `space` there adds one.

Only the official palettes are held to the contrast gate before they ship. A
marketplace palette installs whatever its numbers, and Browse shows them.

## Update

```sh
ttheme update                  # ttheme itself, then every marketplace
ttheme update alice@pastel     # one marketplace
```

The official palettes come with ttheme, so a new release is how they change.
Other marketplaces are fetched again.

An installed palette keeps the colors it was installed with until you take its
update. `ttheme update` names the palettes that have one, and Browse marks them
`⇡`: `ctrl+r` there stages one, or every one under a catalog, for `enter` to
apply. A tone you tuned stays on top of the update.

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
