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

## Rules

One palette per pull request. At most three open at a time.

- `themes/<name>.toml`, where `<name>` matches `meta.name`, is lowercase, and is
  not one of the reserved words in `RESERVED_NAMES` (`src/theme.ts`).
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
