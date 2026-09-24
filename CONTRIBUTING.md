# Contributing a palette

`themes/*.toml` is the catalog. A merged palette reaches everyone through
`ttheme update`, without waiting for an npm release.

## What this project accepts

**Color values only.** A palette is twenty hex colors, a name, and the series it
belongs to. That is the whole contribution.

**No images.** This repository does not accept, host or redistribute character
art, wallpapers, vector traces, icons, audio, fonts or any other asset —
transparent PNGs least of all. `.gitignore` blocks the common image formats and
a PR that adds one will be closed. Terminal background images are built on your
own machine by a local tool and written to `~/.config/ttheme/backgrounds/`; they
never enter this repository or the npm package.

That line is deliberate. Color values carry no copyright, so a palette named
after a character is safe to share. A character image is a different thing
entirely, and this project stays out of distributing it.

## The file

One file — copy any of `themes/*.toml`:

```toml
[meta]
name = "madoka"                            # must match the filename
group = "Madoka Magica"                    # needs a [[group]] in themes/_groups.toml
order = 15                                 # position in the rotation
ansi_source = "Elegant + Magica"           # what the harmonizer was fed
booru = "kaname_madoka"                    # booru character tag find searches
signature = ["cursor", "ansi1", "ansi3"]   # the three slots the site draws as identity

[colors]
background = "#201516"
foreground = "#fbdbdd"
cursor = "#ffc1c6"
selection_background = "#553444"
ansi = [ ... 16 colors ... ]
```

The series title and its `native` reading live once in `themes/_groups.toml`,
never in a theme file.

## Rules

One palette per pull request. At most three open at a time.

- `themes/<name>.toml`, where `<name>` matches `meta.name` and is lowercase.
- `meta.group` needs a matching `[[group]]` in `themes/_groups.toml`. Adding a
  new series means adding that table, with its `native` title and the `lead`
  palette whose signature colors the group. A theme file never repeats them.
- `meta.signature` names three palette slots that must resolve to three
  different colors — they are what the site draws as the palette's identity.
- `meta.booru` is the character's booru tag (`kaname_madoka`,
  `lucy_(cyberpunk)`), which `preview` searches on danbooru, konachan and
  yande.re when someone looks for a background. Check it on danbooru first —
  it should be a character tag with posts. Leave it out for
  palettes that are not one character (a place, a concept). It is a search
  term, never a post id or a link to an image.
- `meta.ansi_source` records what the ANSI ramp was actually derived from, and
  must stay accurate. Take base schemes from
  [mbadolato/iTerm2-Color-Schemes](https://github.com/mbadolato/iTerm2-Color-Schemes),
  or from a source whose license permits it — say which in the PR.
- Every palette passes the contrast gate: body text at 7:1, accents at 3:1.
  `mise run build` fails on a violation. A waiver needs `[contrast] waive = [...]`
  **plus** a `reason`; a waiver without one fails the test suite.

## Before you open the PR

```sh
mise run ci
```

That runs lint, typecheck, tests, the build with its contrast gate, the shell
check and the node bundle check — exactly what CI runs.

```sh
mise run build                # regenerates dist/ for every terminal — fails on bad contrast
mise run build --only kitty   # just one terminal's subtree
mise run compat               # the terminal compatibility cases, in each installed terminal
```

`mise run compat` opens each installed terminal behind your windows on a
throwaway home (`mise run sandbox`), runs the cases in `tests/compat/cases.zsh`
inside it — adapter detection, OSC set/query/reset, what the window really
paints (read off a screenshot), `ttheme use <palette>` and its restore, cell size,
kitty graphics, synchronized output and focus reporting — and compares them
with `tests/compat/expect.tsv`: a case that used to pass and fails is a
regression and fails the run, and `--update` records what was measured.

Every palette in the catalog passes the gate unwaived — `kyubey` runs tightest,
since as the one light palette every accent has to darken enough to hold
against a near-white background. If a palette genuinely has to break a rule,
waive it by name and say why:

```toml
[contrast]
waive = ["foreground"]     # foreground | accents | ansi0-dark | light-ansi | ansi8-visible
reason = "why this palette is the exception"
```

`.claude/skills/palette/SKILL.md` documents how the existing palettes
were measured and harmonized, if you want to build one the same way.

## Working on the TUIs

Every screen `ttheme` draws is captured and compared against `tests/screens/`.
The scenarios run in tmux at a fixed 100×24 against `tests/fixture.json` — six
palettes across two series, pinned so that adding a palette never rewrites a
screen.

```sh
mise run tui                  # compare (part of `mise run ci`)
mise run tui:update           # accept what the TUIs draw now
mise run demo preview-open    # open one scenario for real, in its fixture
```

`mise run demo` is also the fastest way to reproduce a bug: it builds the
fixture state, hands you the real TUI, and throws the directory away after.

Counts on screen come from the catalog, never from the rows being drawn. A
folded series still reports how many of its palettes are picked, and the
filtered total counts what matches, not what fits on screen. The cursor and the
scroll window are the only things allowed to read the drawn rows.
