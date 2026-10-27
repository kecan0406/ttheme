# Contributing

This file is for anyone opening an issue or a pull request. A pull request
that changes code also follows [HACKING.md](HACKING.md), which says how the code
is put together: the terminal checks, the shell layer, and how every screen is
drawn and keyed. How every screen and message is worded is in
[`.claude/rules/text.md`](.claude/rules/text.md).

A ttheme palette is someone's reading of a character or a work, in twenty
colors. The built-in palettes are the `ttheme` marketplace, which ships inside
the package: `builtin/ttheme-marketplace.toml` and
`builtin/palettes/<palette>.toml`. What they are of lives apart from them, in
the commons: `commons/works/<work>.toml`, one file per work with its characters,
which every marketplace's palettes name and no marketplace owns. A merged
palette ships with the next release, and `ttheme update` makes it available to
everyone.

## Issues

Every issue starts from a form:

- **Bug report** — paste what `ttheme info` prints in the terminal where it
  happened (`npx @kecan0406/ttheme@latest info` when ttheme is not set up or
  `init` failed), and any error text, or what `TTHEME_DEBUG=1 ttheme …` prints.
- **Feature request** — the situation you are in, before any solution.
- **Palette request** — a character you would like a built-in palette of, and
  the colors fans know them by: color values and post numbers, never pictures.
- **Something else** — a question or a note.

Report a vulnerability privately, as [SECURITY.md](SECURITY.md) says, never in
a public issue.

## Your own marketplace first

You do not need this repository to share a palette. Every palette you make
lives in a marketplace of your own, and once you publish it, anyone can add it:

```sh
ttheme marketplace init dust       # <you>@dust, in ~/.config/ttheme/marketplace/dust
ttheme new rei --from ttheme/rei   # <you>@dust/rei: your own rei, starting from the built-in one's colors
ttheme new dusk                    # <you>@dust/dusk: an original, from the seeds in the palette editor
ttheme edit dusk                   # the same editor; the contrast checks' numbers are shown, never enforced
ttheme share                       # A marketplace on GitHub: creates the repository with gh and pushes, and again whenever it changes
```

[Your own palette](docs/creating-palettes/your-own.md) and
[Publish a marketplace](docs/creating-palettes/publish.md) cover the rest: the
files a marketplace holds, what `subject` and `from` say, proposing a work the
commons lacks, renaming a palette, and `ttheme marketplace check`. Give the
repository the `ttheme-marketplace` topic — `ttheme share` does for a public
one — and Browse's search and the
[marketplace page](https://ttheme.dev/marketplace) find it.

Open a pull request here when a palette belongs in the built-in marketplace: it
then has to pass the contrast checks and everything below.

## Works and characters

The commons is the list of works and characters palettes are of:
`commons/works/<work>.toml`, one file per work. Every built-in palette's
subject is in it — `mise run build` refuses one that is not — so a palette of a
new work or character comes in the same pull request as the record that adds
it:

```toml
"$schema" = "https://www.schemastore.org/ttheme-work.json"
name = "Madoka Magica"                     # as lists show it; they sort the works by it
native = "魔法少女まどか☆マギカ"              # its title in the original language, shown dim beside it
lead = "madoka-magica/madoka"              # optional: who stands for the work, the first character by default

[[character]]                              # in cast order
id = "madoka"                              # her palettes' subject is madoka-magica/madoka
native = ["鹿目まどか"]                      # her names in the original language, the full name first
danbooru = "kaname_madoka"                 # her danbooru tag: who she is

[[character]]
id = "kyoko"
native = ["佐倉杏子"]
danbooru = "sakura_kyoko"
sites = { konachan = "sakura_kyouko", yande = "sakura_kyouko", zerochan = "sakura_kyouko" }
```

- One work per franchise: the file's name is the work's id (`madoka-magica`), in
  lowercase letters, digits and single hyphens, at most 40 characters and never
  `ttheme`, and `name` is its English title as fans write it. A sequel, a
  spin-off or a game of the same franchise joins its work's file rather than
  starting another.
- The `[[character]]` tables come in cast order — the order the work's own
  materials list its cast, the leads first — which `TTHEME_SORT=cast` lists a
  work's palettes in. A place, an object or an idea from the work is one of its
  `[[character]]` tables too (`undertale/determination`, `evangelion/magi`), so
  it keeps its native name and its place in the cast; a palette of the work as a
  whole names the work alone (`subject = "undertale"`).
- `lead` names who stands for the work where one palette stands for all of it:
  the character it is known by, whatever their colors, or the work itself.
- `danbooru` is who the character is: its danbooru tag (`kaname_madoka`,
  `lucy_(cyberpunk)`), checked on danbooru first — a character tag with posts.
  No two characters in the commons share one, so a character is never added
  twice under two works. `find` searches it for pictures. A work's own subject
  has none.
- `native` lists the character's names in its original language (or the Japanese
  release's), which search matches alongside the palette's name: the full name
  first, then any other it goes by — a code name, an avatar name, a civilian one
  (`["雨宮蓮", "来栖暁", "ジョーカー"]`). Check them against the tag's danbooru wiki, whose
  other names list them; a name may not contain `|`.
- `also` names the other works a character appears in, whose shelves list its
  palettes too (`also = ["pop-n-music"]` for a jubeat character who is in pop'n
  music as well). The character stays in its home work alone.
- `sites` gives the tag on a site that names the character otherwise, so it
  needs `danbooru`: one tag, or a list `find` searches together where the site
  can (any number on konachan and yande.re, two on danbooru, one on zerochan),
  and `[]` for a site that has none, which `find` then skips. A site it leaves
  out is searched for the danbooru tag. It is a search term; posts go in a
  palette's `[[picture]]`, by number.
- An id that has to move — a work renamed, a character's id corrected — moves
  in `commons/renames.toml`, which maps the old subject to the new
  (`"old-work" = "new-work"` moves a work and its characters,
  `"evangelion/eva-01" = "evangelion/eva01"` one character), and the new
  subject must be one the commons holds. Every other marketplace's palettes
  that name the old subject follow it, but the built-in ones do not: the same
  pull request moves their `subject` to the new id, or `mise run build`
  refuses them. Keep the entry, and never give an old id to something else.

## What this project accepts

**Color values, names and post numbers only.** A palette is twenty hex colors
in each mode, the work or character it is of and, optionally, the numbers of
booru posts that suit it as a background; a work is its title, its characters'
names and their booru tags. That is the whole contribution, released under the
project's MIT license.

**No character assets.** This repository does not accept, host or redistribute
character art, wallpapers, vector traces or any other asset made of a character
— transparent PNGs least of all. (The site's own fonts and the README's demo are
the project's own files, not contributions.) `.gitignore` blocks the common
image formats and a PR that adds one will be closed. Terminal background images
are built on your own machine by a local tool and written to
`~/.config/ttheme/backgrounds/`, with the posts they come from cached under
`~/.cache/ttheme/`; they never enter this repository or the npm package.

That line is deliberate. Color values carry no copyright, so a palette named
after a character is safe to share. A character image is a different thing
entirely, and this project stays out of distributing it.

A palette may name posts by number, with how to frame them:

```toml
[[picture]]
site = "yande"          # danbooru, konachan, yande or zerochan
id = 825034             # the post's number on that site — never a URL
size = 60               # optional: "fill" (the default) or a percentage, 20-999
position = "center"     # optional: top-left … bottom-right, top-right by default
opacity = 0.2           # optional: 0 to 1; by default the picture's own, or the palette's tint strength for a picture drawn in its tone
```

`ttheme add` fetches each post from the site itself on the user's machine,
checks it against their own rating and block settings, cuts it out where the
system can, and draws it in their own coloring setting there, as `find` would.
`ttheme new`, `ttheme edit` and `ttheme share` fill this in from the pictures
you have up.

## The file

One file — copy any of `builtin/palettes/*.toml`:

```toml
"$schema" = "https://www.schemastore.org/ttheme-palette.json"
subject = "madoka-magica/madoka"           # the work and character in the commons
signature = ["cursor", "ansi1", "ansi3"]   # the three colors the site draws as its identity
ansi_source = "Elegant + Magica"           # what the harmonizer was fed

[colors]
background = "#201516"
foreground = "#fbdbdd"
cursor = "#ffc1c6"
selection_background = "#553444"
ansi = [ ... 16 colors ... ]

[colors.light]                             # the same palette in its other mode
background = "#fff8f7"
...
```

The file's name is the palette's: `builtin/palettes/madoka.toml` is
`ttheme/madoka`. The folder holds files only — the shelf a palette sits on is
its subject's work, whose title, cast and lead live once, in
`commons/works/<work>.toml`, never in a palette file.

## Rules

One palette per pull request. At most three open at a time.

- `builtin/palettes/<name>.toml`, where `<name>` is lowercase letters, digits
  and single hyphens, at most 40 characters, and no other built-in palette has
  it.
- `subject` names a work or a character the commons holds: a new one comes
  with its record in `commons/works/` in the same pull request, and
  `mise run build` refuses a subject the commons lacks. The one built-in
  palette with no subject, `neutral`, is the marketplace's `fallback`: no list
  or new-tab rotation shows it, while `ttheme use neutral` still uses it in a
  tab.
- `signature` names three of the palette's colors (`cursor`, `foreground`,
  `background`, `selection`, `ansi0`–`ansi15`) that must differ in both modes —
  they are what the site draws as the palette's identity.
- `ansi_source` records what the ANSI ramp was actually derived from, and must
  stay accurate; a built-in palette cannot leave it out. Take base schemes from
  [mbadolato/iTerm2-Color-Schemes](https://github.com/mbadolato/iTerm2-Color-Schemes),
  or from a source whose license permits it — say which in the PR.
- `[colors]` is the palette in the mode it was made in, and `[colors.light]`
  (`[colors.dark]` for a light palette) the same palette in the other one, which
  people who use the other mode see. Write it with
  `bun .claude/skills/palette/scripts/light.ts --write <file>`, which mirrors
  `[colors]` into the other mode; `mise run build` refuses a built-in palette
  without it.
- Every palette passes the contrast gate in both modes (`GATE_RULES` in
  `src/core/contrast.ts`; why each threshold:
  [docs/reference/contrast-gate.md](docs/reference/contrast-gate.md)): body text
  and ANSI 7 and 15 on the background, and the text on the selection, at 7:1;
  every accent on the background, and black on each accent, at 4.5:1; ANSI 8 on
  the background, and white on ANSI 8, at 3:1; black dark enough in a dark
  palette; each accent's hue inside its ANSI role's band and each bright within
  25° of its normal; no two accents in a row that read as one color at text
  size; and red and green apart for a deuteranope. ANSI slots named in
  `signature`, and their normal or bright twins, are exempt from the band and
  the comparisons. `mise run build` fails on a violation. A waiver needs
  `[contrast] waive = [...]` **plus** a `reason`; a file that waives with no
  reason is refused when it is read.

Every built-in palette passes the gate unwaived, in both modes. If a palette
genuinely has to break a rule, waive it by name and say why:

```toml
[contrast]
waive = ["foreground"]     # foreground | accents | ansi0-dark | light-ansi | ansi8-visible | selection | ansi-role | bright-follows | distinct | ansi0-on-accents | ansi7-on-ansi8 | cvd-red-green
reason = "why this palette is the exception"
```

`.claude/skills/palette/SKILL.md` documents how the existing palettes were
measured and harmonized, if you want to build one the same way.

## Setting up

ttheme's tasks run through [mise](https://mise.jdx.dev), which also installs
the bun and node versions `mise.toml` names. The checks need zsh, tmux and
sqlite3 on your `PATH`.

```sh
git clone https://github.com/kecan0406/ttheme
cd ttheme
mise install   # bun 1.3 and node 22
bun install
```

Every task is `mise run <task>`; `package.json` has no scripts, and takes none.

## Before you open the PR

```sh
mise run format   # fixes most of what lint would fail on
mise run ci
```

That runs lint, typecheck, tests, the build with its contrast gate, the shell
check, the Ghostty config check (where `ghostty` is installed, which it is not
on CI), the node bundle check, the TUI screens, the site's typecheck and XSS
scan, the cost ratchet and the parity walk — exactly what CI runs.

```sh
mise run build                # regenerates dist/ for every terminal — fails on bad contrast or a subject the commons lacks
mise run build --only kitty   # one terminal's subtree, plus the shared files, still gating every palette
```

A change to the shell layer, a terminal or a screen has checks of its own,
which [HACKING.md](HACKING.md) describes.

## Using AI tools

Use whatever tools you like. You are the author of what you submit, whichever
tool wrote it: read all of it before you ask for a review, run `mise run ci`
yourself, and be ready to answer questions about it in the review.

If a tool wrote a substantial part, say so at the end of the commit message: an
`Assisted-by: <tool>` line, or the tool's own `Co-Authored-By:` trailer. It only
helps the review; nothing is refused for having it or for leaving it out. The
repository's own agent rules are in `AGENTS.md`.
