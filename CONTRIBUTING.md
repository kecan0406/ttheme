# Contributing a palette

`themes/*.toml` is the official catalog. A merged palette reaches everyone
through `ttheme update`, without waiting for an npm release.

## Your own market first

You do not need this repository to share a palette. Every palette you make
lives in a market of your own, and anyone can add it:

```sh
ttheme market init dust           # <you>@dust, in ~/.config/ttheme/market/dust — prints how to publish it
ttheme new rei                    # <you>@dust/rei, from blank in the palette editor (--from rei starts from rei)
ttheme edit rei                   # the same editor; the gate's numbers are shown, never enforced
```

A market is a repository with `palettes/<palette>.toml`, a `ttheme-market.json`
index that names it (`"owner"`, `"name"`) and a workflow that runs
`kecan0406/ttheme/market@v1` on every push to rebuild the index; `ttheme market
build` does the same by hand. Added from GitHub, a market is
`<repository owner>@<name>` and its palettes are `<owner>@<name>/<palette>`;
the TOML files name them bare (`name = "rei"`). A folder under `palettes/` is a
catalog — `palettes/neon/arcade.toml` puts arcade in the neon catalog — so every
list shows the market, then its catalogs, then their palettes, below the series;
a file straight under `palettes/` sits in no catalog, after them. The catalog is
not part of the name (still `<owner>@<name>/arcade`), so a palette name is used
once in a market, and `meta.group` is not read. A market palette has no `order`
and no `role`; `meta.base` names the official palette it varies, which only says
where its ANSI colors came from. Give the repository the `ttheme-market` topic
and `ttheme market search` and the
[market page](https://kecan0406.github.io/ttheme/market) find it.

Open a pull request here when a palette belongs in the official catalog: it
then has to pass the contrast gate and everything below.

## What this project accepts

**Color values and post numbers only.** A palette is twenty hex colors, a
name, the series it belongs to and, optionally, the numbers of booru posts
that suit it as a background. That is the whole contribution, released under the
project's MIT license.

**No images.** This repository does not accept, host or redistribute character
art, wallpapers, vector traces, icons, audio, fonts or any other asset —
transparent PNGs least of all. `.gitignore` blocks the common image formats and
a PR that adds one will be closed. Terminal background images are built on your
own machine by a local tool and written to `~/.config/ttheme/backgrounds/`; they
never enter this repository or the npm package.

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
opacity = 0.2           # optional: the palette's own tint strength by default
```

`ttheme add` fetches each post from the site itself on the user's machine,
checks it against their own rating and block settings, cuts it out and tints it
there, as `find` would. `ttheme new` and `ttheme share` fill this in from
the pictures you have up.

## The file

One file — copy any of `themes/*.toml`:

```toml
[meta]
name = "madoka"                            # must match the filename
native_names = ["鹿目まどか"]               # the character's names in Japanese, preview searches them
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
  `lucy_(cyberpunk)`), which `preview` searches on danbooru, konachan,
  yande.re and zerochan when someone looks for a background. Check it on danbooru first —
  it should be a character tag with posts. Leave it out for
  palettes that are not one character (a place, a concept). It is a search
  term; posts go in `[[picture]]`, by number.
- `meta.native_names` lists the character's names in its original language (or
  the Japanese release's), which `preview` searches alongside the palette and
  series names: the full name first, then any other it goes by — a code name, an
  avatar name, a civilian one (`["雨宮蓮", "来栖暁", "ジョーカー"]`). A place,
  concept or machine takes its own Japanese name. Check them against the tag's
  danbooru wiki, whose other names list them; a name may not contain `|`.
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
check, the node bundle check, the TUI screens and the parity walk — exactly
what CI runs.

CI runs on Ubuntu, so the tools are GNU's; macOS ships BSD's, which forgive
more. If a shell step passes for you and fails there, look at those first —
`base64` wraps its output at 76 columns (`base64 -w0` is GNU only, and BSD
never wraps), and `sed -i`, `date` and `stat` differ too. Shell code that has to
work on both should not lean on either's output format.

```sh
mise run build                # regenerates dist/ for every terminal — fails on bad contrast
mise run build --only kitty   # just one terminal's subtree
mise run compat               # the terminal compatibility cases, in each installed terminal
mise run compat:konsole       # the same cases in Konsole, from a Linux container (needs Docker)
mise run parity               # every journey in a model of every terminal, held to Ghostty's
```

`mise run compat` opens each installed terminal behind your windows on a
throwaway home (`mise run sandbox`), runs the cases in `tests/compat/cases.zsh`
inside it — adapter detection, OSC set/query/reset, what the window really
paints (read off a screenshot), `ttheme use <palette>` and its restore, cell size,
kitty graphics, synchronized output, focus reporting, and whether a tab that
never painted follows a new default and a tab that went off takes it back —
and compares them with `tests/compat/expect.tsv`: a case that used to pass and
fails is a regression and fails the run, and `--update` records what was
measured. Konsole runs on Linux alone, so `mise run compat:konsole` runs its
cases on a private display in a container, where moving focus takes nothing
from you.

Ghostty is the reference for how every terminal should look and behave.
`mise run parity` (part of CI) walks the same journeys — a new tab, `ttheme
use`, `default`, `off` and `on` across tabs, preview, pins, browse, pictures
tuned or dropped in another tab, a default reaching Ghostty — in a model of
each terminal built from what `mise run compat` measured, and compares what
every tab shows with Ghostty in `tests/parity/facts.tsv`. Each difference needs
a line in `tests/parity/gaps.tsv` saying whether the terminal cannot express it,
ttheme could close it, or it was left out on purpose, and why. A change that
moves a fact fails until `mise run parity --update` records it; `--only`,
`--journey` and `--show journey.label` narrow a run and print what a tab shows.

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

## Using AI tools

Use whatever tools you like. You are the author of what you submit, whichever
tool wrote it: read all of it before you ask for a review, run `mise run ci`
yourself, and be ready to answer questions about it in the review.

If a tool wrote a substantial part, add an `Assisted-by: <tool>` line to the
commit message. It only helps the review; nothing is refused for having it or
for leaving it out. The repository's own agent rules are in `AGENTS.md`.

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

### Keys a screen takes

Preview and browse filter as you type, so a letter or a digit is never a
command there, and an input method composes letters before the terminal hands
them over. An action takes a key the filter never sees — `tab`, `shift+tab`,
the arrows alone or with `shift`, `enter`, `space`, `esc`, or `ctrl` or `alt`
with a letter — and this table is where to look before binding one. A binding
on a key already in it is a collision: move one of them, or pick another key.

| Key | Preview | Browse |
|---|---|---|
| any character | filters | filters (each tab keeps its own) |
| `↑` `↓` `pgup` `pgdn` `home` `end` | move, wrapping | move, wrapping |
| `←` `→` | close or open a series | fold a series; on a market, auto-update |
| `enter` | open theme edit on the palette | apply every pick and market change |
| `esc` | clear the filter, then restore and close | cancel |
| `space` | fold or open a series | pick |
| `bksp` `ctrl+u` | edit the filter, clear it | edit the filter, clear it |
| `?` | keys | — |
| `alt-c` | settings | — |
| `ctrl+r` | — | update the market |
| `shift+←` `shift+→` | example scene | previous or next of its four tabs |
| `tab` `shift+tab` | next or previous screen of the bare `ttheme` | next or previous screen of the bare `ttheme` |
| `ctrl+c` | quit | cancel |

The settings panel preview opens over its list and the questions browse asks
take the keys they list on their own last line while they are open. `find`
and the palette editor are screens of their own and keep their own keys.

Theme edit (`enter` in preview) has no filter, so its two panels use letters
too — one panel takes the keys while it has the focus, and the three that
leave the panel are the same in both:

| Key | Tone panel | Picture panel |
|---|---|---|
| `↑` `↓` | slot (while tuning, lightness, chroma or hue) | field |
| `←` `→` | normal or bright (while tuning, a step) | step |
| `⇧←` `⇧→` | while tuning, ×5 | ×10 |
| `tab` | tune the slot | — |
| `1`-`9` | while tuning, jump | place |
| `#` `c` `v` `u` `ctrl+r` `space` | type a color, copy, paste, undo, redo, show the colors before | — |
| `f` | move the colors the gate misses | find a picture |
| `r` `R` | reset a slot, all of them | — |
| `=` `+` | the bright follows its normal, — | reset a field, all |
| `c` `space` `,` `.` `D` | — | colors, hide, other pictures, remove one |
| `[` `]` | focus the tone panel, the picture panel | same |
| `s` | save | save |
| `enter` | apply, asking where | apply, asking where |
| `esc` | cancel, dropping what changed since the last save | cancel |

### Writing the text

Every screen and message is written in sentence case: the first word and proper
nouns take a capital, everything else is lowercase. Never all lowercase as a
look, and never Title Case.

- **Sentence case**: box and panel titles (`Settings`, `Keys`), row, column,
  tab and checkbox labels (`Min score`, `Select all`), buttons (`Advanced ›`),
  questions (`Remove ttheme?`), placeholders (`Search…`), status lines and
  notes (`Nothing changed`), the prose half of a two-column list, and every
  `about` line in `src/verbs.ts`.
- **As spelled where they are typed**: anything the user types or
  `config.zsh` holds — values (`fit`, `safe`, `off`), palette and market
  names (`kita`, `kec@dust`), site names on find's tabs (`danbooru`), booru
  tags, commands and flags (`ttheme preview`, `--yes`) and key names
  (`enter`, `ctrl+v`). A line that starts with one keeps it as spelled.
- **As their owners spell them**: Ghostty, iTerm2, WezTerm, kitty, Alacritty,
  Warp, Windows Terminal, Konsole, Terminal.app, macOS, GitHub; acronyms in
  capitals (PNG, URL, OSC, ANSI).
- **Lowercase**: key hints in footers and key bars (`↑↓ move · enter save`),
  and error messages, which read the same after the `ttheme:` prefix
  (`ttheme: not installed: kita`) and in a status line. A notice written for
  the screen (`No picture on the clipboard`) is not an error.
- **Capitals**: only a mode badge (`PREVIEW`, `THEME EDIT`, `IMAGE SEARCH`, `IMAGE PREVIEW`, `HELP`, `CONFIG`). The tabs of the bare `ttheme` (`Preview`, `Browse`) are tab labels, so sentence case.

Counts on screen come from the catalog, never from the rows being drawn. A
folded series still reports how many of its palettes are picked, and the
filtered total counts what matches, not what fits on screen. The cursor and the
scroll window are the only things allowed to read the drawn rows.
