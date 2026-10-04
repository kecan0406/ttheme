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

A market is a repository with `palettes/<palette>.toml` and a
`ttheme-market.toml` that names it (`schema = 1`, `owner`, `name`) — nothing is
built: ttheme fetches the repository's archive and reads the TOML files as they
are, so every push is the market. A ttheme refuses a `ttheme-market.toml` with
no `schema`, or a newer one than it reads, and keeps its last copy, and a
palette file it cannot read shows in `ttheme browse`'s Errors tab. Added from GitHub, a market is
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
mise run parity               # every journey in a model of every terminal, held to one spec
```

`mise run compat` opens each installed terminal behind your windows on a
throwaway home (`mise run sandbox`), runs the cases in `tests/compat/cases.zsh`
inside it — adapter detection, OSC set/query/reset, what the window really
paints (read off a screenshot), `ttheme use <palette>` and its restore, cell size,
kitty graphics, synchronized output, focus reporting, whether a shell idle at
its prompt runs a signal's trap at once, and whether a tab that never painted
follows a new default and a tab that went off takes it back —
and compares them with `tests/compat/expect.tsv`: a case that used to pass and
fails is a regression and fails the run, and `--update` records what was
measured. Konsole runs on Linux alone, so `mise run compat:konsole` runs its
cases on a private display in a container, where moving focus takes nothing
from you.

Every terminal is held to one spec, Ghostty included. Each journey in
`tests/parity/journeys.ts` says what the tab in front shows at every look —
which palette, which picture — and `mise run parity` (part of CI) walks the
journeys — a new tab, `ttheme use`, `default`, `off` and `on` across tabs,
preview, pins, browse, pictures tuned or dropped in another tab, a default
reaching Ghostty — in a model of each terminal built from what `mise run
compat` measured, and records what every tab shows against that spec in
`tests/parity/facts.tsv` (a screen's spec is the one Ghostty drew). Each miss
needs a line in `tests/parity/gaps.tsv` saying whether the terminal cannot
express it, ttheme could close it, or it was left out on purpose, and why; a
terminal that lacks a whole capability — pictures, or ttheme's wiring — says
so once, in an `@pictures` or `@wired` line. A line must explain every fact it
names, and one that explains nothing fails. A change that moves a fact fails
until `mise run parity --update` records it; `--only`, `--journey` and `--show
journey.label` narrow a run and print what a tab shows.

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

### Under the Node screens

Browse, init's picker, the palette editor and find share one runtime in
`src/tui/`. `Terminal` sets the terminal's modes and puts them back on every way
out — a return, an error, a signal, the process exiting; `Keys` turns the bytes
the terminal sends into keys, pastes and replies, however the reads split them;
`Screen` writes only the rows that changed since the last frame. A screen is a
model with a key handler and a `view` that returns its rows: open it with
`within`, wait on `terminal.until(…)`, clean up in `finally`. Let `Terminal` set
the modes a screen needs rather than writing them or calling `setRawMode` by
hand, and never subclass clack's `Prompt`.

### Keys a screen takes

Preview and browse filter as you type, so a letter or a digit is never a
command there, and an input method composes letters before the terminal hands
them over. An action takes a key the filter never sees — `tab`, `shift+tab`,
the arrows alone or with `shift`, `enter`, `space`, `esc`, or `ctrl` or `alt`
with a letter — and this table is where to look before binding one. A binding
on a key already in it is a collision: move one of them, or pick another key.
`j` and `k` move like `↓` and `↑` only on the screens that have no filter: the
panel below, preview's settings, the palette editor and find's grid.

| Key | Preview | Browse |
|---|---|---|
| any character | filters | filters (each tab keeps its own) |
| `↑` `↓` `pgup` `pgdn` `home` `end` | move, wrapping | move, wrapping |
| `←` `→` | close or open a series; `→` on a palette opens its panel | close or open a series; on a market, auto-update |
| `enter` | open or close a series; on a palette, apply it, asking where | open or close a series; elsewhere, review every pick and market change, then apply it; close the result |
| `esc` | clear the filter, then restore and close | clear the filter, then cancel |
| `space` | fold or open a series | pick |
| `bksp` `ctrl+u` | edit the filter, clear it | edit the filter, clear it |
| `?` | keys | keys |
| `alt-c` | settings | — |
| `ctrl+e` | open the palette's panel | — |
| `ctrl+r` | — | update the market, or search GitHub again |
| `ctrl+s` | — | narrow Catalog and Installed to the next market, then back to all |
| `shift+←` `shift+→` | example scene | previous or next of its four tabs |
| `tab` | on a palette, open its panel; elsewhere, the next screen of the bare `ttheme` | next screen of the bare `ttheme` |
| `shift+tab` | previous screen of the bare `ttheme` | previous screen of the bare `ttheme` |
| `ctrl+c` | quit | cancel |

The settings panel preview opens over its list and the questions browse asks
take the keys they list on their own last line while they are open. `find`
is a screen of its own and keeps its own keys. The palette editor takes the
Palette column of the panel's table below, so a key means the same in both,
plus its own `*`, `o`, `p` and `⇧←` `⇧→` (another scene in its sample), and its
esc asks before it throws changes away.

Preview's panel (`tab`, `→` or `ctrl+e` on a palette) has no filter, so it uses
letters too. It is one list — the picture's fields, the palette's slots, then an
Apply button — and the part the cursor is in takes the keys:

| Key | Image | Palette | Apply |
|---|---|---|---|
| `↑` `↓` `j` `k` | Images, then colors, size, position, opacity, and past the last one the palette | slot, and past the last one Apply (while tuning, lightness, chroma, hue or ◐ contrast) | the last slot, the top |
| `home` `end` | the top, Apply | same (while tuning, the channel's ends; on ◐, the gate's floor and the most it reaches) | same |
| `←` `→` | on Images, another picture; on a field, a step | normal or bright (while tuning, a step) | — |
| `⇧←` `⇧→` | ×10 | while tuning, ×5 | — |
| `enter` | on the empty frame under Images of a palette with no picture, find one | tune the slot (while tuning, keep it) | apply, saving first and asking where |
| `tab` | — | tune the slot | — |
| `1`-`9` | place | while tuning, jump (on ◐, that ratio) | — |
| `#` `c` `v` `u` `ctrl+r` `space` | — | type a color, copy, paste, undo, redo, show the colors before | — |
| `f` | find a picture | move the colors the gate misses | — |
| `r` `R` | — | reset a slot, all of them | — |
| `g` | — | the relations of every ANSI color, or back to the slots | — |
| `n` `N` | — | the next and the last slot the gate misses | — |
| `a` | — | while tuning, the scope: this, pair, normals, brights, accents | — |
| `=` `+` | reset a field, all | the bright follows its normal, — | — |
| `c` `space` `,` `.` `D` | colors, hide, other pictures, remove one | — | — |
| `shift+enter` | apply | apply | apply |
| `s` | save | save | save |
| `esc` | back to the list, dropping what changed since the last save | same (while tuning, undo) | same |

### The mouse

Every screen but init's picker takes the mouse, and every mouse action has a key
in the tables above. A press selects — it moves the cursor to a row, opens a
tab, sets a slider to the point — and a release over what was pressed acts: a
key hint presses its key, a ○ picks, a ▸ folds, a double click does what enter
does. Acting on the release keeps a screen that closes on a click from leaving
the release to the shell, and moving off before letting go cancels. The wheel
moves the cursor a row and never wraps.

A Node screen marks what can be clicked while it draws: `zone(target, text)`
around the text (`keyZone` for a key hint), or a rectangle in `Frame.zones`;
`screen.point(event)` hands back what was under the pointer in the frame on
screen. The width helpers skip the marks but `.length` and `padEnd` do not, so
pad before you mark. Let `pointing()` add the mouse mode, and never assume it
from a program around you. In preview, append a zone to `pvz` where you draw the
thing (`row from to action`) and act on it in `__tt_pv_press` or
`__tt_pv_release`.

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
- **Capitals**: only a mode badge (`PREVIEW`, `EDIT`, `IMAGE SEARCH`, `IMAGE PREVIEW`, `HELP`, `CONFIG`). The tabs of the bare `ttheme` (`Preview`, `Browse`) are tab labels, so sentence case.

Counts on screen come from the catalog, never from the rows being drawn. A
folded series still reports how many of its palettes are picked, and the
filtered total counts what matches, not what fits on screen. The cursor and the
scroll window are the only things allowed to read the drawn rows.
