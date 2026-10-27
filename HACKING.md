# Developing ttheme

This file is for changing ttheme's code: the shell layer, the terminal wiring
and the screens. Read [CONTRIBUTING.md](CONTRIBUTING.md) first — it says what
the project takes, how to set up a checkout and what to run before a pull
request. [CLAUDE.md](CLAUDE.md) is the full reference: every task in
`mise.toml`, how the source is layered and the conventions the code keeps.

## Shell code on GNU and BSD

CI runs on Ubuntu, so the tools are GNU's; macOS ships BSD's, which forgive
more. If a shell step passes for you and fails there, look at those first —
`base64` wraps its output at 76 columns (`base64 -w0` is GNU only, and BSD
never wraps), and `sed -i`, `date` and `stat` differ too. Shell code that has to
work on both should not lean on either's output format.

## Checking the terminals

```sh
mise run compat               # the terminal compatibility cases, in each installed terminal
mise run compat konsole       # the same cases in Konsole, from a Linux container (needs Docker)
mise run compat --linux       # the same cases in the terminals' Linux builds, in a container (needs Docker)
mise run parity               # every journey in a model of every terminal, held to one spec
mise run walk                 # seeded random walks of that model, held to what every tab must keep
mise run costs                # what each action costs: CLI runs, reload signals, files written
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
measured, and which version on which day at which commit, in
`tests/compat/measured.tsv`. A case about what a tab shows reads it off the
screen where a screenshot can be taken, not only off the colors the terminal
answers, since a terminal can answer one color and draw another. Konsole runs
on Linux alone, so `mise run compat konsole` on a machine without it runs its
cases on a private display in a container, where moving focus takes nothing
from you. The nightly workflow runs `mise run compat --linux` against the
pinned builds and against each terminal's newest release, and files an issue
when either leaves its expected results.

Every terminal is held to one spec, Ghostty included. Each journey in
`tests/parity/journeys.ts` says what the tab in front shows at every look —
which palette, which picture — and `mise run parity` (part of CI) walks the
journeys — a new tab, `ttheme use`, `default`, `off` and `on` across tabs,
preview, pins, browse, pictures tuned or dropped in another tab, a default
reaching Ghostty, a real tmux in front of a tab — in a model of each terminal
built from what `mise run compat` measured, and records what every tab shows against that spec in
`tests/parity/facts.tsv` (a screen's spec is the one Ghostty drew). Each miss
needs a line in `tests/parity/gaps.tsv` saying whether the terminal cannot
express it, ttheme could close it, or it was left out on purpose, and why; a
terminal that lacks a whole capability — pictures, or ttheme's wiring — says
so once, in an `@pictures` or `@wired` line. A line must explain every fact it
names, and one that explains nothing fails. A change that moves a fact fails
until `mise run parity --update` records it; `--only`, `--journey` and `--show
journey.label` narrow a run and print what a tab shows.

The journeys are the cases someone thought of. `mise run walk` walks the same
model at random — tabs opened and focused, `use`, `default`, `off` and `on`,
pins, a program's reset, a mode switch, preview — and after every step holds
each tab to what it must keep whatever the journey: the shell believes what
the tab shows, the tab shows its palette's picture, and no escape reaches the
screen as text. `--jitter` makes every terminal's reload land up to 0.3 s
late, as real ones do. A failure is walked again, shrunk to the fewest steps
that still fail, and printed as a journey to start from; a seed replays it.

`mise run costs` (part of CI) holds what each action costs in each terminal's
model to `tests/costs.tsv`: the CLI runs it starts, the reload signals and
profile switches it sends, the files it writes and the entries it makes in the
folders the terminal watches. More fails as a regression; fewer fails until
`mise run costs --update` locks it in.

## Working on the TUIs

Every screen `ttheme` draws is captured and compared against `tests/screens/`.
The scenarios run in tmux at a fixed 100×24 against `tests/fixture/` — seven
built-in palettes in `builtin.json` and their two works, `bocchi-the-rock` and
`lucky-star`, in `commons.json` — pinned so that adding a palette never
rewrites a screen. A key written `key@text` in a scenario waits for the screen
to draw `text` before the next key, and text that never shows within 15 s
fails the scenario rather than letting it be compared late.

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
| `accent` | the current ◆, an active work, the ▶ and frame of the part in focus | slot 6 |
| `pill` | a tab or a choice that is on, a mode badge | reverse, bold, slot 6 |
| `chip` | a button that is not under the cursor | bold on slot 8 |
| `danger` | the button that removes something, while the cursor is on it | reverse, bold, slot 1 |
| `alert` | a newer ttheme: the release notice's `UPDATE` badge and the hub's `⇡ x.y.z available` | reverse, bold, slot 3 |
| `match` | the letters a filter matched | bold, underline, slot 6 |
| `ok`, `warn`, `error` | a notice that something worked, one that something could not be done or a changed slot ●, a failure | slots 2, 3, 1 |
| `under`, `reverse` | the runs a slot draws in a scene, a caret | `4`, `7` |

The accent is the terminal's slot 6 everywhere, never a palette's cursor: it
follows whatever the tab wears without asking the terminal anything, reads on
every built-in background, and stays right in the scrollback after the tab
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
▸ ▾ a closed and an open work, ● ○ on and off, ✓ ✗ pass and miss, ↑ ↓ more
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
A control with a key of its own — a chip or a toggle that `enter` does not
reach — wears that key after its label, dim (`keyAfter` in `src/tui/parts.ts`,
and preview's chip in `__tt_pv_chip`), and it is the first thing a narrow
window takes off its row: preview's chip lets it go when fewer than two blank
columns would follow it, and the editor's top bar before it gives up the
`unsaved` count. A key that a control carries leaves the key bar, and one that
no control carries stays on it, so a key is drawn once. A bar names only the
keys that do something where the cursor stands: preview's picture rows show
`=` and `+` while a row is off its default.
In Browse, the palette editor and find `?` opens `Help` (`src/tui/help.ts`): the
topics of the mode the screen is in, in two columns under their group's name —
the keys, then what they do —, where `↑` `↓` reach every topic and enter runs
the key a topic names (Browse and the editor offer that only where the key does
something), a filter that typing fills, the chosen topic's `more` under the list,
and a Marks list saying what the screen's marks mean. The topics scroll in a
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
that slot 6 and the surfaces hold on every built-in palette, and that no glyph
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
panel below, preview's settings, the palette editor and find's grid. `ctrl+j`
and `ctrl+k` move like them on every list, filter or not (a terminal sends
`ctrl+j` as a line feed, which no screen reads as `enter`: that is `\r`;
`lineStep` in `src/tui/keys.ts` is the one table, and a screen without a filter
also passes `letters` for `j` and `k`). The
screens that list pictures — find's grid and its try view, and the Pictures row of
the panel below — also take `h` and `l` as `←` and `→`.

| Key | Preview | Browse |
|---|---|---|
| any character | filters | filters every marketplace, landing on the first match in the panel; in the search, filters the marketplace list at once; in the `+ Add marketplace` form, types the source |
| `↑` `↓` `ctrl+j` `ctrl+k` `pgup` `pgdn` `home` `end` | move, wrapping | move, wrapping; in a marketplace's panel `↓` past the last palette reaches its actions and `↑` from the first wraps onto them, while the page keys stay among the palettes |
| `←` `→` | close or open a work; `→` on a palette opens its panel | `→` on a marketplace moves into its panel; there, close or open a work, and `←` at its top level goes back to the marketplaces; `→` on `+ Add marketplace` moves into its form in the panel and on `Search marketplace` opens the search, and `←` in either goes back |
| `enter` | open or close a work; on a palette, use it, asking where | on a marketplace, move into its panel; there, open or close a work, or do the action under the palettes (`Update now`, `Auto-update`, `Remove marketplace`); on `+ Add marketplace`, move into its form in the panel, and there fetch the source typed and land in the panel of the marketplace it stages; on `Search marketplace`, open the search, and there add a marketplace and go back to its card, or go back on `← Back`; on a palette, review every pick and marketplace change, then apply it — with nothing changed, it does nothing; close the result |
| `esc` | clear the filter, then put the tab back and close | clear the filter, then leave the panel, then cancel, asking first when something is staged; in the `+ Add marketplace` form, go back, dropping a fetch still running; in the search, clear it, then go back |
| `space` | fold or open a work | pick — on a marketplace's card, all of it; on one of its actions, do it; on `+ Add marketplace` or `Search marketplace`, open it; in the search, add a marketplace (again to undo) or load the list again |
| `bksp` `ctrl+u` | edit the filter, clear it | edit the filter or the `+ Add marketplace` form's source, clear it |
| `?` | keys, which preview also shows when it opens beside its list until any key closes them | the help: typing filters it, `↑` `↓` choose a topic and enter runs it, esc clears the filter and then closes it, and its Marks list says what browse's marks mean |
| `alt+g` | the group menu: how the list is grouped and sorted | — |
| `alt+c` | settings | — |
| `ctrl+e` | open the palette's panel | — |
| `ctrl+r` | — | in a marketplace's panel, on a palette marked `⇡` or a work, stage its update; in the search, load the marketplace list again |
| `shift+←` `shift+→` | switch the sample | — |
| `tab` | on a palette, open its panel; elsewhere, the next screen of the bare `ttheme` | next screen of the bare `ttheme` |
| `shift+tab` | previous screen of the bare `ttheme` | previous screen of the bare `ttheme` |
| `ctrl+c` | quit | cancel, asking first when something is staged (`y` applies, `n` or a second ctrl+c discards, esc stays) |

The settings panel preview opens over its list and the questions browse asks
take the keys they list on their own last line while they are open. `find`
is a screen of its own and keeps its own keys, and so does the palette editor
(`new`, `edit`, and the Edit palette button of preview's panel); in both, as in
browse, `?` opens the same help (`src/tui/help.ts`) with the keys of the mode
the screen is in, which docs/reference/keys.md lists. The editor's esc, once something changed, opens a
Save changes? dialog (`y` saves and leaves, `n` leaves without saving, esc keeps
editing), and ctrl+c leaves from anywhere in it the same way — a tune it
interrupts is kept, so it counts as a change — while a second ctrl+c in the
dialog leaves without saving. Every Node screen leaves on ctrl+c; browse and
the editor, which hold changes until they are applied or saved, ask first.

Preview's panel (`tab`, `→` or `ctrl+e` on a palette) has no filter, so it uses
letters too. It is one list — the picture's fields, an Edit palette button, then
an Apply button — and the part the cursor is in takes the keys:

| Key | Picture | Edit palette | Apply |
|---|---|---|---|
| `↑` `↓` `j` `k` | Pictures, then colors, size, position, opacity, and past the last one Edit palette | the picture, Apply | Edit palette, the top |
| `home` `end` | the top, Apply | same | same |
| `←` `→` `h` `l` | on Pictures, another picture; on a field, a step | the Edit palette and Reset palette buttons | — |
| `⇧←` `⇧→` | ×10 | — | — |
| `enter` | on the empty frame under Pictures of a palette with no picture, find one | open the palette editor on it | apply, saving first and asking where |
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
which every built-in palette keeps 3.6:1 or more away from its background — and
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
- **As their owners spell them**: Ghostty, cmux, iTerm2, WezTerm, Kaku, kitty,
  Alacritty, Rio, Contour, Warp, Windows Terminal, Konsole, Terminal.app, macOS,
  GitHub; acronyms in capitals (PNG, URL, OSC, ANSI).
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
- **Lowercase**: key hints in footers and key bars (`↑↓ move   enter save`),
  and error messages, which read the same after the `ttheme:` prefix
  (`ttheme: not installed: kita`) and in a status line. A notice written for
  the screen (`No picture on the clipboard`) is not an error.
- **Capitals**: only a mode badge (`PREVIEW`, `BROWSE`, `SEARCH`, `EDIT`, `PICTURE SEARCH`, `PICTURE PREVIEW`, `PICTURE EDIT`, `HELP`, `CONFIG`, `GROUP`). The tabs of the bare `ttheme` (`Preview`, `Browse`) are tab labels, so sentence case.

A key hint is the key and one or two lowercase words: a verb, or the name of
what the key opens or switches (`settings`, `keys`, `colors`, `sample`). The
same action takes the same word on every screen — `move`, `open`, `close`,
`back`, `pick`, `change`, `reset`, `use`, `apply`, `save`, `undo`, `clear` and,
for `esc`, one of four: `back` (one level up), `cancel` (leave, dropping what
changed), `close` (an overlay) and `clear` (a field). A question's own answers
are the exception (`y save`, `n discard`, `esc keep editing`). A tab hint names
the screen it goes to (`tab Browse`).

A Help topic is its keys, as typed and apart by two spaces, and what they do: a
verb phrase in sentence case, about six words, with no period (`Open the
picker`), or the name of the value a key moves (`↑↓  Lightness`). How it works,
the exceptions and the numbers go in the topic's `more`, which shows only for
the topic chosen; a longer story belongs in `docs/`. A line that describes the
row under the cursor (a panel's foot, a button's note) says what the person gets
in one sentence, never how ttheme does it.

`·` has one job: it stands between short facts on one line (`6 available ·
1 installed`, `1920×1080 PNG · 2.1 MB`), written through `SEP`
(`src/tui/parts.ts`). Keys in a bar are apart by three spaces, names in a list by
commas, a title and its subject by two spaces, and what to do after a state by
` — ` (`Opaque — x cuts it out`).

One concept takes one word, on the screens and in `docs/`, whatever the code
calls it — never the words in the left column:

| Not | But | For |
|---|---|---|
| wear, paint | use (a palette in a tab), shows (what a tab has on) | the palette a tab shows |
| gate, misses | contrast checks, fails | the readability rules a palette is measured by |
| tone | tuning, tuned | the colors you changed over a marketplace's palette |
| tone | tinted | a picture drawn in one color of its palette (`tone` stays only as the value `config.zsh` holds) |
| image | picture | a background picture |
| official, comes with ttheme | built-in (`Built in` on Browse's card) | the `ttheme` marketplace that ships inside ttheme, and its palettes |
| catalog, series | work | a series, a game or a franchise: the shelf a palette sits on |
| loose, uncategorized | original | a palette that is of no work or character |
| Read in place | Always up to date | a marketplace in a folder |
| slot | color | one of a palette's twenty colors, outside the code |

Counts on screen come from the palettes listed, never from the rows being drawn. A
folded work still reports how many of its palettes are picked, and the
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
folders, the marketplace index, a booru's answer, an error message built from
any of them — has every control and direction character
dropped or spelled out before a screen or a message shows it, so no escape
sequence reaches the terminal and no direction mark reorders what it touches:
through `src/core/text.ts` in
Browse, the editor's notices, the readers and the CLI's errors (`inert` for one
line, `inertLines` for a message that keeps its line breaks, and `quoted` or
`escaped` for a value an error echoes), through `Line.put` and `linked` in
find, and through the picture's conf lines for preview; a
reader refuses such a character where a value has no use for one
(`textProblem`).
