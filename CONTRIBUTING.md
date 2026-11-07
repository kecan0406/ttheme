# Contributing

This file is for anyone opening an issue or a pull request. A pull request
that changes code also follows [HACKING.md](HACKING.md), which says how the code
is put together: the terminal checks, the shell layer, and how every screen is
drawn and keyed. How every screen and message is worded is in
[`.claude/rules/text.md`](.claude/rules/text.md).

A ttheme palette is someone's reading of a character or a work, in twenty
colors. The built-in palettes are the `ttheme` marketplace, which ships inside
the package: `builtin/ttheme-marketplace.toml` and `builtin/sets/<work>.toml`,
one set of palettes per work. What they are of lives apart from them, in
[aninames](https://github.com/kecan0406/aninames): `authority/works/<work>.toml`,
one file per work with its characters, which every marketplace's palettes name
and no marketplace owns. A merged palette ships with the next release, and
`ttheme update` makes it available to everyone.

## Issues

Every issue starts from a form:

- **Bug report** — paste what `ttheme info` prints in the terminal where it
  happened (`npx @kecan0406/ttheme@latest info` when ttheme is not set up or
  `init` failed), and any error text, or what `TTHEME_DEBUG=1 ttheme …` prints.
- **Feature request** — the situation you are in, before any solution.
- **Something else** — a question or a note.

A work or a character the lists lack, or a picture of one, is asked for in
[aninames' issues](https://github.com/kecan0406/aninames/issues/new/choose), and
added there once it has been talked over.

Report a vulnerability privately, as [SECURITY.md](SECURITY.md) says, never in
a public issue.

## Your own marketplace first

You do not need this repository to share a palette. Every palette you make
lives in a marketplace of your own, and once you publish it, anyone can add it:

```sh
ttheme marketplace init dust       # <you>@dust, in ~/.config/ttheme/marketplace/dust
ttheme new rei --from ttheme/ayanami-rei   # <you>@dust/rei: your own rei, starting from the built-in one's colors
ttheme new dusk                    # <you>@dust/dusk: an original, from the seeds in the palette editor
ttheme edit dusk                   # the same editor; the contrast checks' numbers are shown, never enforced
ttheme share                       # A marketplace on GitHub: creates the repository with gh and pushes, and again whenever it changes
```

[Make a palette](docs/guide/make.md) covers the rest: the files a marketplace
holds, what `subject` and `upstream` say, proposing a work the commons lacks,
and `ttheme marketplace check`. Give the
repository the `ttheme-marketplace` topic — `ttheme share` does for a public
one — and Browse's search and the
[marketplace page](https://ttheme.dev/browse/marketplaces) find it.

Open a pull request here when a palette belongs in the built-in marketplace: it
then has to pass the contrast checks and everything below.

## Works and characters

The list of works and characters palettes are of is
[aninames' authority](https://github.com/kecan0406/aninames/blob/main/authority/README.md),
`authority/works/<work>.toml`, one file per work. Every built-in palette's subject
is in it — `mise run build` refuses one that is not — so a palette of a new work
or character waits until the record is there and ttheme takes a version of
aninames that holds it. Ask for the record with
[an issue](https://github.com/kecan0406/aninames/issues/new/choose); it is added
once it has been talked over. ttheme reads the list when it installs and updates,
so a marketplace's palettes find a new record without a new ttheme.

A new work needs no row in `site/lib/categories.ts`: the site places it by what
the index knows, and a row is for a place the index gets wrong.

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
`~/.config/ttheme/backgrounds/`; they never enter this repository or the npm package.

That line is deliberate. Color values carry no copyright, so a palette named
after a character is safe to share. A character image is a different thing
entirely, and this project stays out of distributing it.

A palette may name posts by number, with how to frame them:

```toml
[[palette.picture]]
site = "yande"          # danbooru, konachan, yande or zerochan
id = 825034             # the post's number on that site — never a URL
size = 60               # optional: "fill" (the default) or a percentage, 20-999
position = "center"     # optional: top-left … bottom-right, top-right by default
strength = 1.5          # optional: how strongly it shows, as a multiple of the opacity ttheme picks for each user's colors and mode (1); 0 to 100
```

`ttheme add` fetches each post from the site itself on the user's machine,
checks it against their own rating and block settings, cuts it out where the
system can, and draws it in their own coloring setting there, as `find` would.
`ttheme new`, `ttheme edit` and `ttheme share` fill this in from the pictures
you have up.

## The set

A set holds one or more palettes, and a built-in one holds one work's:
`builtin/sets/madoka-magica.toml` holds every palette of Madoka Magica, and a
palette of no work would go in `builtin/sets/original.toml`. A palette is a `[[palette]]`
table in it — copy any of them:

```toml
"$schema" = "https://www.schemastore.org/ttheme-set.json"

[[palette]]
slug = "kaname-madoka"                     # its name: ttheme/kaname-madoka
subject = "madoka-magica/kaname-madoka"           # the work and character in the commons

[palette.colors]
background = "#201516"
foreground = "#fbdbdd"
cursor = "#ffc1c6"
selection_background = "#553444"
ansi = [ ... 16 colors ... ]

[palette.colors.light]                     # the same palette in its other mode
background = "#fff8f7"
...
```

The tables after a `[[palette]]` that start with `palette.` belong to it, up to
the next one. The folder holds sets only — the shelf a palette sits on is its
subject's work, whose title, cast and lead live once, in aninames' authority,
never in a set.

## Rules

One palette per pull request. At most three open at a time.

- A `[[palette]]` table in its subject's work's set, `builtin/sets/<work>.toml`
  (`original.toml` for a palette of no work), which `mise run build` holds it
  to. Its `slug` is lowercase letters, digits and single hyphens, at most 40
  characters, and no other built-in palette has it. A palette of a character takes
  the character's `id` for its `slug`.
- `subject` names a work or a character, as `<work>/<character>`. One
  aninames' authority lacks is not refused: its shelf is named by the work's id
  until aninames holds it.
- The character's colors go in `cursor`, `selection` and `foreground`, which
  every screen and card draws a palette by; an ANSI color holds one only where
  its hue fits that color's role.
- Take the ANSI ramp's base scheme from
  [mbadolato/iTerm2-Color-Schemes](https://github.com/mbadolato/iTerm2-Color-Schemes),
  or from a source whose license permits it — say which in the PR.
- `[palette.colors]` is the palette in the mode it was made in, and
  `[palette.colors.light]` (`[palette.colors.dark]` for a light palette) the
  same palette in the other one, which people who use the other mode see. Write
  it with `bun .agents/skills/palette/scripts/light.ts --write <set>`, which
  mirrors each palette's `[palette.colors]` in the set into the other mode;
  `mise run build` refuses a built-in palette without it.
- Every palette passes the contrast gate in both modes (`GATE_RULES` in
  `src/core/contrast.ts`; the rules:
  [docs/guide/make.md](docs/guide/make.md#contrast-checks)): body text
  and ANSI 7 and 15 on the background, and the text on the selection, at 7:1;
  every accent on the background, and black on each accent, at 4.5:1; ANSI 8 on
  the background, and white on ANSI 8, at 3:1; black dark enough in a dark
  palette; each accent's hue inside its ANSI role's band and each bright within
  25° of its normal; no two accents in a row that read as one color at text
  size; and red and green apart for a deuteranope. `mise run build` fails on a
  violation, so every built-in palette passes the gate in both modes.

`.agents/skills/palette/SKILL.md` documents how the existing palettes were
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
git config core.hooksPath .githooks   # a push to main runs the checks CI would
```

Every task is `mise run <task>`; `package.json` has no scripts, and takes none.

## Before you open the PR

```sh
mise run format   # fixes most of what lint would fail on
mise run ci
```

That checks your commit subjects (`<area>: <summary>`, the areas listed in
[`AGENTS.md`](AGENTS.md)), then runs lint, typecheck, tests, the build with its
contrast gate, the shell check, the Ghostty config check (where `ghostty` is
installed, which it is not on CI), the node bundle check, the TUI screens, the
site's typecheck and XSS scan, the cost ratchet and the parity walk — exactly
what CI runs.

```sh
mise run build                # regenerates dist/ for every terminal — fails on bad contrast
mise run build --only kitty   # one terminal's subtree, plus the shared files, still gating every palette
```

A change to the shell layer, a terminal or a screen has checks of its own,
which [HACKING.md](HACKING.md) describes.

## Using AI tools

Use whatever tools you like. You are the author of what you submit, whichever
tool wrote it: read all of it before you ask for a review, run `mise run ci`
yourself, and be ready to answer questions about it in the review.

If a tool wrote a substantial part, say so at the end of the commit message with
the tool's own `Co-Authored-By:` trailer. It only helps the review; nothing is
refused for having it or for leaving it out. The repository's own agent rules
are in `AGENTS.md`.

Claude Code reads `AGENTS.md` only while no `CLAUDE.md`, `.claude/CLAUDE.md` or
`CLAUDE.local.md` sits in your checkout or in a folder above it (your own
`~/.claude/CLAUDE.md` does not count); if you keep one, set **Project
instructions** to `claude-md-and-agents-md` in `/config`, or it reads none of
the `AGENTS.md` files. Gemini CLI reads `AGENTS.md` once its `context.fileName`
setting names it. The repository's skills are in `.agents/skills`, where Codex and
Gemini CLI find them, and Claude Code reads them through the `.claude/skills`
link.
