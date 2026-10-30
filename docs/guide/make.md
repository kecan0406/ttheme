# Make a palette

Tune twenty colors in the palette editor, check them against the contrast
checks, and share the result as a link or a marketplace.

## Start a palette

```sh
ttheme new dusk                    # from blank
ttheme new rei --from ttheme/rei   # starting from another palette's colors
ttheme edit dusk                   # change it later
```

`ttheme new` opens the palette editor. You tune twenty colors while a mock
terminal shows them in a shell, an editor and a process monitor. The editor needs
a window of 80×24; from 96×28 it becomes the builder, with the colors on the
left and the mock terminal on the right.

A blank palette starts on the seeds: the background and foreground lightness, a
hue and tint for the neutrals and the cursor, and one lightness and chroma the
accents share. Whatever you pick, the twenty colors they grow pass every
contrast check. `enter` moves on to the colors. `--from` and `edit` skip the
seeds.

## Tune the colors

The twenty colors are the background, foreground, cursor and selection, then the
eight ANSI colors with their bright pairs, each shown as lightness, chroma and
hue (OKLCH).

- `↑` `↓` pick a color, and `enter` or a click opens its picker. In the picker,
  `↑` `↓` move lightness, `←` `→` chroma, and `⇧←` `⇧→` hue.
- `#` takes a color as `#rrggbb`, `rgb(…)` or `oklch(…)`, and so does a paste.
  `enter` keeps the color, `esc` puts it back, and `u` takes back one step.
- A bright starts linked to its normal when their hues are close; `l` links and
  unlinks a pair.
- `✗` marks a color that fails a check, `n` and `N` walk them, and `f` moves the
  failing colors until they pass. `i` names the colors a spot of the mock
  terminal is drawn with.
- `p` opens find on the colors being edited, so you can try a picture on at once.
- `s` saves, and `esc` leaves, asking first when something changed. `?` lists
  every key of the mode you are in.

Your palettes live in a marketplace of your own on your machine. The first `new`
asks for its name and creates `~/.config/ttheme/marketplace/<name>`. Each palette
there is named `<you>@<marketplace>/<palette>`. A palette made `--from` another
keeps the work or character that one is of, and follows it: when the upstream
palette changes, Browse marks yours `⇡`, and `ttheme update` takes the change
into every color you left as it was. A color you both changed stays yours, and
`ttheme edit` then opens on it, where `r` takes the upstream's color.

## Tune a palette that is not yours

```sh
ttheme edit miku   # a built-in palette: your changes are kept as its tuning
```

In `ttheme`, the same editor opens from a palette's panel: `tab`, then `enter` on
**Edit palette**. Tuning is just the colors you moved, laid over the colors the
palette's marketplace gives, in `~/.config/ttheme/tone.json`.

- Every terminal you wired, the shell and the pictures' tint follow it at once.
- `ttheme update` leaves it in place; a new version of the palette shows through
  every color you did not tune.
- It belongs to one mode, so light and dark can be tuned apart. Preview and
  Browse mark a tuned palette with a yellow `●`.
- In the editor, `R` puts every color back and `s` after it drops your tuning.
  **Reset palette** in the panel does the same.

## Contrast checks

```sh
ttheme check miku         # every check's numbers for a palette
ttheme check --fix miku   # colors that pass, saved as its tuning (or into your own palette's set)
```

The checks tell a palette's author what it fails and never refuse a palette; the
built-in marketplace holds its own palettes to every one, in both modes. The
editor measures every color as you tune, Browse shows a palette's score in its
panel, and the [builder](https://ttheme.dev/builder) shows the checks under its
mock terminal.

| Rule | Asks | Rests on |
|---|---|---|
| `foreground` | foreground on background ≥ 7:1 | WCAG AAA, enhanced contrast |
| `accents` | every accent on background ≥ 4.5:1 | WCAG AA, contrast minimum |
| `ansi0-dark` | ANSI 0 luminance ≤ 0.15, in a dark palette | ANSI 0 as black |
| `light-ansi` | ANSI 7 and 15 on background ≥ 7:1 | WCAG AAA, body text |
| `ansi8-visible` | ANSI 8 on background ≥ 3:1 | WCAG's floor for normal vision |
| `selection` | foreground on the selection ≥ 7:1 | WCAG AAA, body text |
| `ansi-role` | each accent's hue inside its role's band | the meaning of each ANSI color |
| `bright-follows` | a bright within 25° of its normal | terminals that brighten bold |
| `distinct` | no two accents in a row that read as one color | a size model of color difference |
| `ansi0-on-accents` | ANSI 0 as text on ANSI 1–6 ≥ 4.5:1 | WCAG AA, programs' colored grounds |
| `ansi7-on-ansi8` | ANSI 7 as text on ANSI 8 ≥ 3:1 | fish's selection |
| `cvd-red-green` | red and green apart for a deuteranope | a dichromat simulation |

## With a coding agent

`init` offers the `ttheme-palette` skill to coding agents such as Claude Code.
Ask one for a character's palette and it researches the character, measures the
colors on official art, and lets ttheme harmonize, check and install the result.

```sh
npx skills add kecan0406/ttheme   # the same skill, for Claude Code, Codex, Cline and others
```

In Claude Code, `/plugin install ttheme-palette --marketplace kecan0406/ttheme`
adds it as a plugin. A skill older than the ttheme it runs against asks you to
update it first: run `init` again, `npx skills add kecan0406/ttheme`, or update
the plugin, whichever way you added it.

## On the web

[ttheme.dev/builder](https://ttheme.dev/builder) is the same builder in the
browser: start from any palette, a share link or blank seeds, and tune both
modes against the contrast checks. A palette you changed stays in that browser as
a draft, up to thirty, which its **drafts** tab lists and reopens. Export takes
the palette open with every draft of the same work as one set: a `.toml` that
`ttheme add <file>.toml` installs into your own marketplace, a share link, or a
marketplace ready to push.

When a search on [ttheme.dev/marketplace](https://ttheme.dev/marketplace) finds
no palette of a work or a character, **make one** opens the builder on blank
seeds under its name, and **request a palette** asks for one on GitHub.

## Share a link

A share link carries the palette itself, so nothing is uploaded or stored. It
opens the palette in the builder, and `ttheme add` installs it from there.

```sh
ttheme share rei       # one palette
ttheme share           # asks how to share, then which palettes
ttheme share | pbcopy  # the palette this tab shows, straight to the clipboard
ttheme add https://ttheme.dev/builder/tt8:…   # install a link; the bare code works too
```

`share` prints the link, and in a terminal its QR code under it. One link can
carry several palettes, each with its twenty colors, its other mode, the work or
character it is of and the posts of its pictures, checked by a hash so a
mistyped link is refused. A tuned palette goes out as `miku-tuned`, a palette of
no marketplace, so whoever adds the link keeps it in their own marketplace. A
link to a palette you already have installs yours when the colors match and
leaves it out when they differ. In the editor, pasting a link takes its colors
into the palette you are editing.

## Publish a marketplace

A marketplace is a GitHub repository of palettes. Anyone can add it with one
command, and what you push reaches them as an update they take. There is nothing
to build: ttheme reads the files as you pushed them.

```sh
ttheme share   # choose "a marketplace on GitHub"
```

`share` picks one of your local marketplaces, or makes one, and opens the palette
list on what it holds: pick the palettes to publish, and one you unpick is
deleted. It needs [GitHub CLI](https://cli.github.com) (`gh`) logged in, creates
the repository, adds the `ttheme-marketplace` topic to a public one, shows what it
will push and asks once more. Run it again to push changes. A public repository
with the topic shows in Browse's `⌕ Search marketplace` and on
[ttheme.dev/marketplace](https://ttheme.dev/marketplace) within the hour.

```text
ttheme-marketplace.toml
sets/
  evangelion.toml
  original.toml
works/
  starfall-academy.toml
```

```toml title="ttheme-marketplace.toml"
"$schema" = "https://www.schemastore.org/ttheme-marketplace.json"
name = "pastel"
description = "Soft palettes for long nights"

[owner]
name = "alice"   # your GitHub handle
```

Every file straight under `sets/` is a set: one or more palettes, usually one
work's. A palette's name is its `slug`, whichever set holds it, and no two
palettes of a marketplace share a slug.

```toml title="sets/evangelion.toml"
"$schema" = "https://www.schemastore.org/ttheme-set.json"

[[palette]]
slug = "rei"                               # its name in the marketplace
subject = "evangelion/rei"                 # what it is of: a work, or a work's character
upstream.palette = "ttheme/rei"            # the palette it was copied from, if any

[palette.colors]
background = "#201516"
foreground = "#fbdbdd"
cursor = "#ffc1c6"
selection_background = "#553444"
ansi = [ ... 16 colors ... ]
```

`subject` says what the palette is of, so lists shelve it under that work beside
every other marketplace's palettes of it; without one it is an original.
`[palette.colors.light]` (or `.dark`) may hold the other mode, and without it
ttheme mirrors one. `[[palette.picture]]` tables list background posts by
number. The schema names every field, and `ttheme add evangelion.toml` installs
every palette of a set into your own marketplace.

When a palette is of a work the commons (ttheme's list of works and characters)
lacks, describe it in `works/<work>.toml`, and name a character of it as
`subject = "starfall-academy/mira"`:

```toml title="works/starfall-academy.toml"
"$schema" = "https://www.schemastore.org/ttheme-work.json"
name = "Starfall Academy"
native = "スターフォール学園"   # its title in the original language
danbooru = "starfall_academy"   # its danbooru copyright tag, what the work is

[[character]]
id = "mira"
native = ["星野ミラ"]
danbooru = "mira_(starfall_academy)"   # the character's danbooru tag, which find searches
```

For everything the commons already holds, the commons wins.

```sh
ttheme marketplace check ./ttheme-pastel
```

It reads the folder as an install would and lists every problem, such as a set
that does not parse, a slug two palettes share, a subject neither the commons nor
your `works/` holds, a key ttheme does not know, and the contrast checks for each
palette. It writes nothing.
