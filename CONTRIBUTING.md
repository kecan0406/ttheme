# Contributing a palette

`themes/` is the official marketplace: `themes/ttheme-marketplace.toml` and
`themes/palettes/<catalog>/<palette>.toml`. A merged palette ships with the next
release, and `ttheme update` brings it to everyone.

## Your own marketplace first

You do not need this repository to share a palette. Every palette you make
lives in a marketplace of your own, and anyone can add it:

```sh
ttheme marketplace init dust      # <you>@dust, in ~/.config/ttheme/marketplace/dust
ttheme new rei                    # <you>@dust/rei, from blank in the palette editor (--from rei starts from rei)
ttheme edit rei                   # the same editor; the gate's numbers are shown, never enforced — another marketplace's palette is tuned as a tone
ttheme share                      # A marketplace on GitHub: creates the repository with gh and pushes, and again whenever it changes
```

A marketplace is a repository with `palettes/<palette>.toml` and a
`ttheme-marketplace.toml` that names it — nothing is built: ttheme fetches the
repository's archive and reads the TOML files as they are, so every push is the
marketplace:

```toml
"$schema" = "https://www.schemastore.org/ttheme-marketplace.json"
name = "dust"                              # <owner>@dust
description = "Palettes from my favourite shows"   # browse and the marketplace page show it

[owner]
name = "you"                               # your GitHub handle
email = "you@example.com"                  # optional, like url
url = "https://github.com/you"

[renames]                                  # optional: installs of an old name follow it
rei-old = "rei"                            # renamed
gone = false                               # removed — taken off the machines that have it

# force_remove_deleted_palettes = true     # also take off a palette that just disappears
# [metadata]                               # anything of your own; ttheme does not read it

[[catalog]]                                # optional: the folder palettes/night/
name = "night"
native = "夜"                              # shown dim beside it
lead = "dusk"                              # the palette whose colors stand for it
```

The `"$schema"` lines give an editor completion and checks (Even Better TOML
reads them, and SchemaStore matches `ttheme-marketplace.toml` by name); ttheme
ignores them. Run `ttheme marketplace check` in the folder before you push: it reads
every file as an install would, warns about keys ttheme does not know and about a
`[[catalog]]` table with no folder or a lead outside it, follows the renames and
prints the gate. Added from GitHub, a marketplace is
`<repository owner>@<name>` and its palettes are `<owner>@<name>/<palette>`;
the TOML files name them bare (`name = "rei"`). A folder under `palettes/` is a
catalog — `palettes/neon/arcade.toml` puts arcade in the neon catalog — so every
list shows the marketplace, then its catalogs, then their palettes, below the
official catalogs; a file straight under `palettes/` sits in no catalog, after
them. The `[[catalog]]` tables are optional: their order is the catalogs' order,
and a folder no table names follows them by name, led by its first palette. The
catalog is not part of the name (still `<owner>@<name>/arcade`), so a palette
name is used once in a marketplace. A marketplace palette has no `order`
and no `role`; `meta.base` names the official palette it varies, which only says
where its ANSI colors came from, and `meta.from` the palette it was copied from
(`<owner>@<marketplace>/<palette>`, or an official palette's name), which
`ttheme share` writes when it copies one in and Browse and the site show. Give the
repository the `ttheme-marketplace` topic — `ttheme share` does for a public one —
and Browse's search and the
[marketplace page](https://ttheme.dev/marketplace) find it.

Open a pull request here when a palette belongs in the official marketplace: it
then has to pass the contrast gate and everything below.

## What this project accepts

**Color values and post numbers only.** A palette is twenty hex colors, a
name, the catalog it belongs to and, optionally, the numbers of booru posts
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

One file — copy any of `themes/palettes/<catalog>/*.toml` into its catalog's folder:

```toml
"$schema" = "https://www.schemastore.org/ttheme-palette.json"

[meta]
name = "madoka"                            # must match the filename
native_names = ["鹿目まどか"]               # the character's names in Japanese, preview searches them
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

[colors.light]                             # the same palette in its other mode
background = "#fff8f7"
...
```

The file's folder is its catalog (`themes/palettes/Madoka Magica/madoka.toml`).
The catalog's `native` title and its lead live once, in its `[[catalog]]` table
in `themes/ttheme-marketplace.toml`, never in a palette file.

## Rules

One palette per pull request. At most three open at a time.

- `themes/palettes/<catalog>/<name>.toml`, where `<name>` matches `meta.name` and
  is lowercase.
- The catalog folder needs a matching `[[catalog]]` in
  `themes/ttheme-marketplace.toml`. Adding a new catalog means adding that
  table, with its `native` title and the `lead` palette whose signature colors
  the catalog, where `meta.order` puts its palettes — the tables follow that
  order. A palette file never repeats them.
- `meta.signature` names three palette slots that must resolve to three
  different colors — they are what the site draws as the palette's identity.
- `meta.booru` is the character's booru tag (`kaname_madoka`,
  `lucy_(cyberpunk)`), which `find` searches on danbooru, konachan,
  yande.re and zerochan when someone looks for a background. Check it on danbooru first —
  it should be a character tag with posts. Leave it out for
  palettes that are not one character (a place, a concept). It is a search
  term; posts go in `[[picture]]`, by number.
- `meta.native_names` lists the character's names in its original language (or
  the Japanese release's), which `preview` searches alongside the palette and
  catalog names: the full name first, then any other it goes by — a code name, an
  avatar name, a civilian one (`["雨宮蓮", "来栖暁", "ジョーカー"]`). A place,
  concept or machine takes its own Japanese name. Check them against the tag's
  danbooru wiki, whose other names list them; a name may not contain `|`.
- `meta.ansi_source` records what the ANSI ramp was actually derived from, and
  must stay accurate. Take base schemes from
  [mbadolato/iTerm2-Color-Schemes](https://github.com/mbadolato/iTerm2-Color-Schemes),
  or from a source whose license permits it — say which in the PR.
- `[colors]` is the palette in the mode it was made in, and `[colors.light]`
  (`[colors.dark]` for a light palette) the same palette in the other one, which
  people who wear the other mode see. Write it with
  `bun .claude/skills/palette/scripts/light.ts --write <file>`, which mirrors
  `[colors]` into the other mode and rewrites the other palettes in its catalog
  folder too, keeping their signatures as far apart as in the mode they were made
  in; `mise run build` refuses an official palette without it.
- Every palette passes the contrast gate in both modes: body text at 7:1, accents and black on
  the six accents at 4.5:1, ANSI 8 and white on it at 3:1, each accent in its
  role and apart from its neighbors at text size, red and green apart for a
  deuteranope (`src/core/contrast.ts`; why each threshold: [docs/gate.md](docs/gate.md)).
  `mise run build` fails on a violation. A waiver needs `[contrast] waive = [...]`
  **plus** a `reason`; a waiver without one fails the test suite.

## Before you open the PR

```sh
mise run ci
```

That runs lint, typecheck, tests, the build with its contrast gate, the shell
check, the Ghostty config check, the node bundle check, the TUI screens, the
site's typecheck and the parity walk — exactly what CI runs.

CI runs on Ubuntu, so the tools are GNU's; macOS ships BSD's, which forgive
more. If a shell step passes for you and fails there, look at those first —
`base64` wraps its output at 76 columns (`base64 -w0` is GNU only, and BSD
never wraps), and `sed -i`, `date` and `stat` differ too. Shell code that has to
work on both should not lean on either's output format.

```sh
mise run build                # regenerates dist/ for every terminal — fails on bad contrast
mise run build --only kitty   # just one terminal's subtree
mise run compat               # the terminal compatibility cases, in each installed terminal
mise run compat konsole       # the same cases in Konsole, from a Linux container (needs Docker)
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
measured. Konsole runs on Linux alone, so `mise run compat konsole` on a machine
without it runs its cases on a private display in a container, where moving
focus takes nothing from you.

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

Every official palette passes the gate unwaived — `kyubey` runs tightest,
since as the one light palette every accent has to darken enough to hold
against a near-white background. If a palette genuinely has to break a rule,
waive it by name and say why:

```toml
[contrast]
waive = ["foreground"]     # foreground | accents | ansi0-dark | light-ansi | ansi8-visible | selection | ansi-role | bright-follows | distinct
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
The scenarios run in tmux at a fixed 100×24 against `tests/fixture.json` — seven
palettes across three catalogs, pinned so that adding a palette never rewrites a
screen.

```sh
mise run tui                  # compare (part of `mise run ci`)
mise run tui 'theme-*'        # compare only the scenarios named, globs too
mise run tui --update         # accept what the TUIs draw now (names narrow it too)
mise run look preview-open 120x34   # draw one scenario, colors on, to a PNG and a text grid
mise run look kit:bar 110x30        # draw one shared part in every state (tests/kit.ts)
```

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

### Drawing the screens

A screen draws two kinds of color. Its own — text, key hints, tabs, badges,
borders, the gate's marks — follows the palette the tab wears, so it never
names a color: it takes a role from `src/tui/style.ts`. A palette's own colors —
its swatches, a row lit in its selection and cursor, the scenes, the inside of
the palette editor's mock terminal, the QR code — are what the screen shows, so
they go out as hex (`ansiFg`, `ansiBar`, `ansiSquares`, `p.fg`, `p.bg`).

The roles are a closed list in `ROLES`, each the SGR that opens it and the one
that closes exactly that, so a role inside a painted row never ends the row:

| Role | Draws | SGR |
|---|---|---|
| `dim` | counts, key hint labels, notes, a tab that is off, box edges, a gate pass ✓ | `2` … `22` |
| `bold` | titles, key names, a gate miss ✗ | `1` … `22` |
| `accent` | the current ◆, an active catalog, the ▶ and frame of the part in focus | slot 6 |
| `pill` | a tab or a choice that is on, a mode badge | reverse, bold, slot 6 |
| `chip` | a button that is not under the cursor | bold on slot 8 |
| `danger` | the button that removes something, while the cursor is on it | reverse, bold, slot 1 |
| `alert` | a newer ttheme: the release notice's `UPDATE` badge and the hub's `⇡ x.y.z available` | reverse, bold, slot 3 |
| `match` | the letters a filter matched | bold, underline, slot 6 |
| `ok`, `warn`, `error` | a notice that something worked, one that something could not be done or a changed slot ●, a failure | slots 2, 3, 1 |
| `under`, `reverse` | the runs a slot draws in a scene, a caret | `4`, `7` |

The accent is the terminal's slot 6 everywhere, never a palette's cursor: it
follows whatever the tab wears without asking the terminal anything, reads on
every official background, and stays right in the scrollback after the tab
changes palette. Preview spells slot 6 out in truecolor only while the terminal
does not hold the palette it shows yet (iTerm2's hover).

A few surfaces need a fixed distance from the background rather than a slot:
the palette editor's stage, the shadow its window casts, its title bar, tab
track and active tab, and the selection where the terminal leaves OSC 17
unanswered. The pictures the editor draws (the picker's panel, the window's
frame) take their fills from `SURFACES` too, and blend only their shadows and
hairlines over what lies under them. `SURFACES` holds how far
each mixes toward the foreground, and `surfaceOf` mixes it from colors the
screen already knows — the palette it painted on the tab, or the answers to the
query it made anyway, where the palette editor fills a slot the terminal left
unanswered from the palette it opened with. Anything left in the scrollback once a screen
closes — `say` lines, browse's closing report, CLI messages — uses roles and
slots only, since the tab may change palette after it.

Under `NO_COLOR` or `TERM=dumb` a screen writes no SGR at all and says in text
what color said: `[Preview]` for the tab that is on, `[EDIT]` for a badge.

`painter(color)` gives a screen the roles as functions (`p.dim`, `p.pill`, …)
that hand text back unchanged when color is off, and `src/tui/parts.ts` holds
the parts several screens draw: `tabOf`, `pillOf`, `hintOf`, `checkOf`,
`boxEdge` and `boxed`. Glyphs that mean a state are in `MARKS`, one meaning
each: ▌ the cursor's row, ◆ the palette worn or handled, ▶ the part in focus, ✦ a signature slot,
▸ ▾ a closed and an open catalog, ● ○ on and off, ✓ ✗ pass and miss, ↑ ↓ more
rows, ⇡ an update, ↻ auto-update, × a removal, ↶ taking one back, ★ stars, ⧉ a link, ⌕ search, ⇠ a bright that
follows its normal, ◐ contrast, ■ a swatch, ▣ pictures.

Three more parts are shared. Browse and the palette editor draw their key bar
with `barLine` (`src/tui/bar.ts`): a badge, a lead, the keys, the key on the
right and the release line — find keeps its own `foot`, which places its links,
and init's picker a hint line under its list. The lead is a question or a
notice, said in its tone through `toned` — `ok` for what worked, `warn` for
what could not be done, `error` for a failure, plain for information — and the
keys stay after it: a narrow window drops the release line first, then a note,
then keys from the end (never the first, `?`, `enter` or the ones a screen
lists in `keep`), then the key on the right, and cuts what still does not fit;
once the line fits, each key it dropped comes back in its own place if it fits
there, so a long key dropped late never leaves room a shorter one could use.
In Browse, the palette editor and find `?` opens `Help` (`src/tui/help.ts`): the
topics of the mode the screen is in, where `↑` `↓` reach every topic and enter
runs the key a topic names — Browse and the editor offer that only where the key
does something —, a filter that typing fills, and a Marks line saying what the
screen's marks mean. A long topic wraps at its `·` parts, the topics scroll in a
short window, the box takes every click inside it and blanks the column beside
it where that column holds another box's edge, so two edges never touch, and
the screen under it keeps no click zones but on its key bar (find clears its
screen first, since its pictures would show through). And a list its window
cuts says what is out of sight with `moreOf` (`↑ 3 more`, `↓ 12 more`).

The shell layer draws with the same roles from `TTHEME_SGR` in
`shell/ttheme.zsh` (`$TTHEME_SGR[dim]` opens, `$TTHEME_SGR[/dim]` closes) and
the same marks from `TTHEME_MARKS` beside it (`$TTHEME_MARKS[current]`).
`src/tui/style.test.ts` holds the first table to `ROLES` and the second to
`MARKS`, fails on an SGR written anywhere else in `src/` or `shell/` (a
truecolor `printf` format in the shell layer is a palette's color and passes)
and on a mark written literally in the shell layer — all but ↑ ↓ × ■ · …, which
also read as text there; it also checks that every role closes what it opens,
that slot 6 and the surfaces hold on every official palette, and that no glyph
in `MARKS` means two things. The screens in `tests/screens/` run
under `NO_COLOR`, so look at a change to color in a real terminal too.

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
| any character | filters | filters every marketplace, landing on the first match in the panel; in the search, filters the marketplace list at once; in the `+ Add marketplace` form, types the source |
| `↑` `↓` `pgup` `pgdn` `home` `end` | move, wrapping | move, wrapping; in a marketplace's panel `↓` past the last palette reaches its actions and `↑` from the first wraps onto them, while the page keys stay among the palettes |
| `←` `→` | close or open a catalog; `→` on a palette opens its panel | `→` on a marketplace moves into its panel; there, close or open a catalog, and `←` at its top level goes back to the marketplaces; `→` on `+ Add marketplace` moves into its form in the panel and on `Search marketplace` opens the search, and `←` in either goes back |
| `enter` | open or close a catalog; on a palette, apply it, asking where | on a marketplace, move into its panel; there, open or close a catalog, or do the action under the palettes (`Update now`, `Auto-update`, `Remove marketplace`); on `+ Add marketplace`, move into its form in the panel, and there fetch the source typed and land in the panel of the marketplace it stages; on `Search marketplace`, open the search, and there add a marketplace and go back to its card, or go back on `← Back`; on a palette, review every pick and marketplace change, then apply it — with nothing changed, it does nothing; close the result |
| `esc` | clear the filter, then restore and close | clear the filter, then leave the panel, then cancel, asking first when something is staged; in the `+ Add marketplace` form, go back, dropping a fetch still running; in the search, clear it, then go back |
| `space` | fold or open a catalog | pick — on a marketplace's card, all of it; on one of its actions, do it; on `+ Add marketplace` or `Search marketplace`, open it; in the search, add a marketplace (again to undo) or load the list again |
| `bksp` `ctrl+u` | edit the filter, clear it | edit the filter or the `+ Add marketplace` form's source, clear it |
| `?` | keys, which preview also shows when it opens beside its list until any key closes them | the help: typing filters it, `↑` `↓` choose a topic and enter runs it, esc clears the filter and then closes it, and its Marks line says what browse's marks mean |
| `alt+c` | settings | — |
| `ctrl+e` | open the palette's panel | — |
| `ctrl+r` | — | in a marketplace's panel, on a palette marked `⇡` or a catalog, stage its update; in the search, load the marketplace list again |
| `shift+←` `shift+→` | example scene | — |
| `tab` | on a palette, open its panel; elsewhere, the next screen of the bare `ttheme` | next screen of the bare `ttheme` |
| `shift+tab` | previous screen of the bare `ttheme` | previous screen of the bare `ttheme` |
| `ctrl+c` | quit | cancel, asking first when something is staged (`y` applies, `n` or a second ctrl+c discards, esc stays) |

The settings panel preview opens over its list and the questions browse asks
take the keys they list on their own last line while they are open. `find`
is a screen of its own and keeps its own keys, and so does the palette editor
(`new`, `edit`, and the Edit palette button of preview's panel); in both, as in
browse, `?` opens the same help (`src/tui/help.ts`) with the keys of the mode
the screen is in, which docs/usage.md describes. The editor's esc, once something changed, opens a
Save changes? dialog (`y` saves and leaves, `n` leaves without saving, esc keeps
editing), and ctrl+c leaves from anywhere in it the same way — a tune it
interrupts is kept, so it counts as a change — while a second ctrl+c in the
dialog leaves without saving. Every Node screen leaves on ctrl+c; browse and
the editor, which hold changes until they are applied or saved, ask first.

Preview's panel (`tab`, `→` or `ctrl+e` on a palette) has no filter, so it uses
letters too. It is one list — the picture's fields, an Edit palette button, then
an Apply button — and the part the cursor is in takes the keys:

| Key | Image | Edit palette | Apply |
|---|---|---|---|
| `↑` `↓` `j` `k` | Images, then colors, size, position, opacity, and past the last one Edit palette | the picture, Apply | Edit palette, the top |
| `home` `end` | the top, Apply | same | same |
| `←` `→` | on Images, another picture; on a field, a step | — | — |
| `⇧←` `⇧→` | ×10 | — | — |
| `enter` | on the empty frame under Images of a palette with no picture, find one | open the palette editor on it | apply, saving first and asking where |
| `1`-`9` | place | — | — |
| `f` | find a picture | — | — |
| `=` `+` | reset a field, all | — | — |
| `c` `space` `,` `.` `D` | colors, hide, other pictures, remove one | — | — |
| `shift+enter` | apply | apply | apply |
| `s` | save | save | save |
| `esc` | back to the list, dropping what changed since the last save | same | same |

### The mouse

Every screen but init's picker takes the mouse, and every mouse action has a key
in the tables above. A press selects — it moves the cursor to a row, opens a
tab, sets a slider to the point — and a release over what was pressed acts: a
key hint presses its key, a ○ picks, a ▸ folds, a button row acts, a double click
does what enter does. Acting on the release keeps a screen that closes on a click from leaving
the release to the shell, and moving off before letting go cancels. The wheel
moves the cursor a row and never wraps.

A button row is an icon, its label and the value after them (`↻ Auto-update   on`,
`+ Add marketplace`) marked as one zone, so a click anywhere on the item acts and
the blank after it does not. The icon and label sit on a chip — `chip`, slot 8,
which every official palette keeps 3.6:1 or more away from its background — and
the chip under the cursor is a `pill`; a button that removes something stays a grey `chip` until the cursor reaches it and then is a red `danger` chip, not a `pill` (red text on the grey chip reads at 1.4–1.7:1, so red is only ever a fill, slot 1 under the background's own color); one with nothing to do is dim, with no chip. A status that is not a
control, like a card's `↻ auto-update` badge, gets no zone of its own.

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
  `about` line in `src/cli/verbs.ts`.
- **As spelled where they are typed**: anything the user types or
  `config.zsh` holds — values (`fit`, `safe`, `off`), palette and marketplace
  names (`kita`, `kec@dust`), site names on find's tabs (`danbooru`), booru
  tags, commands and flags (`ttheme use`, `--yes`) and key names
  (`enter`, `ctrl+v`). A line that starts with one keeps it as spelled.
- **As their owners spell them**: Ghostty, iTerm2, WezTerm, kitty, Alacritty,
  Warp, Windows Terminal, Konsole, Terminal.app, macOS, GitHub; acronyms in
  capitals (PNG, URL, OSC, ANSI).
- **Keys as one name, drawn for the keyboard**: the source spells a key one
  way — `enter`, `esc`, `tab`, `bksp`, `pgup`, `home`, `ctrl+r`, `alt+u`,
  `shift+tab`, `⇧enter` — and a screen draws it through `cap` (a key hint,
  which `hintOf` and find's foot do for it) or `capped` (a line that names
  keys: Help's topics, a note), `src/tui/keycaps.ts`, and the shell layer
  through `__tt_cap` and `__tt_capped`. On a Mac outside ssh they draw
  Apple's symbols — ⌃ ⌥ ⇧ in Control, Option, Shift order, ↩ ⎋ ⇥ ⌫ ⇞ ⇟ ↖ ↘, a
  chord's letter in capitals (`⌃R`) — and elsewhere the name as written
  (`TTHEME_KEYS`). A named key turns into its symbol only where a key stands —
  a line's start, after `·`, `—`, two spaces or a word ending in `,` `:` `.`
  `?` `!` — so prose that uses the word (`another tab`) keeps it, and a chord
  turns anywhere. There is no ⌘: a terminal keeps Command for itself. A click
  zone always names the key as written.
- **Lowercase**: key hints in footers and key bars (`↑↓ move · enter save`),
  and error messages, which read the same after the `ttheme:` prefix
  (`ttheme: not installed: kita`) and in a status line. A notice written for
  the screen (`No picture on the clipboard`) is not an error.
- **Capitals**: only a mode badge (`PREVIEW`, `BROWSE`, `SEARCH`, `EDIT`, `IMAGE SEARCH`, `IMAGE PREVIEW`, `IMAGE EDIT`, `HELP`, `CONFIG`). The tabs of the bare `ttheme` (`Preview`, `Browse`) are tab labels, so sentence case.

Counts on screen come from the palettes listed, never from the rows being drawn. A
folded catalog still reports how many of its palettes are picked, and the
filtered total counts what matches, not what fits on screen. The cursor and the
scroll window are the only things allowed to read the drawn rows.

A question says what it acts on (`Remove alice@pastel? Its installed palettes
stay installed`, `Apply 3 changes before you leave?`, the editor's Save
changes? counting the colors and pictures changed), and a no is answered too:
the bar leads with what was kept (`alice@pastel kept`) until the next key.

A state reads the same on every screen. A list with nothing to show says so
in a dim line where its rows would be — save Search's list, whose state is its
one row, a button `space` loads again —: `No palettes match 'kit'` while a
filter finds nothing (the things in the plural, what was typed in single
quotes), `No palettes yet` while there are none, and what to do after a ` — `
where a key does it (`No posts of kita on danbooru — tab tries yande.re`).
Work under way is a dim line that names it, led by the spinner where the
screen turns one; find's work on the post in hand (installing, fetching,
cutting out) leads its foot in warn. A failure is drawn in the error role
wherever it is named — Browse's card badge, its panel and the `Update now`
note, a Search result's row and detail (and, below 94 columns, the brief under
the list), the editor's bar, find's foot. A notice a key
earns is plain when the key had nothing to act on (`Nothing to undo`), ok when
it did what was asked (`Already passes the gate`), and warn when the key was
refused for something the person can change (`The builder needs a window of at
least 96×28`, `Pick at least one palette`, `No picture on the clipboard`).

Text someone else wrote — a marketplace's files and the names of its files and
folders, the marketplace index, a booru's answer, the names release, an error
message built from any of them — has every control and direction character
dropped or spelled out before a screen or a message shows it, so no escape
sequence reaches the terminal and no direction mark reorders what it touches:
through `src/core/text.ts` in
Browse, the editor's notices, the readers and the CLI's errors (`inert` for one
line, `inertLines` for a message that keeps its line breaks, and `quoted` or
`escaped` for a value an error echoes), through `Line.put` and `linked` in
find, and through `aliasesZsh` and the picture's conf lines for preview; a
reader refuses such a character where a value has no use for one
(`textProblem`).
