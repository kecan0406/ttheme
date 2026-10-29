# Developing ttheme

This file is for changing ttheme's code: the shell layer, the terminal wiring
and the screens. Read [CONTRIBUTING.md](CONTRIBUTING.md) first — it says what
the project takes, how to set up a checkout and what to run before a pull
request. [AGENTS.md](AGENTS.md) holds the rules the code keeps and says where
the rest lives: the tasks are in `mise.toml`, and a folder's `AGENTS.md` has
that folder's conventions. How every screen and message is worded is in
[`.claude/rules/text.md`](.claude/rules/text.md).

## Shell code on GNU and BSD

CI runs on Ubuntu, so the tools are GNU's; macOS ships BSD's, which forgive
more. If a shell step passes for you and fails there, look at those first —
GNU's `base64` wraps its output at 76 columns unless given `-w0`, while macOS's
never wraps unless asked to, and `sed -i`, `date` and `stat` differ too. Shell
code that has to work on both should not lean on either's output format.

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
paints (read off a screenshot), `ttheme use <palette>` and its restore, cell
size, kitty graphics, the kitty keyboard protocol, synchronized output, focus
reporting, the appearance it reports, a program's reset, Konsole's schemes and
Terminal.app's profile pictures, whether a shell idle at its prompt runs a
signal's trap at once, and whether a tab that never painted follows a new
default and a tab that went off takes it back — and compares them with
`tests/compat/expect.tsv`: a case that used to pass and fails is a regression
and fails the run. `--update` writes what was measured into `expect.tsv`
(`expect-linux.tsv` under `--linux`), never a skip over a pass or a fail, and
which version, on which day and at which commit, into
`tests/compat/measured.tsv`. A case about what a tab shows reads it off the
screen where a screenshot can be taken, not only off the colors the terminal
answers, since a terminal can answer one color and draw another. Konsole runs on
Linux alone, so `mise run compat konsole` on a machine without it runs its cases
on a private display in a container, where moving focus takes nothing from you.
The nightly workflow (`.github/workflows/nightly.yml`) runs
`mise run compat --linux` against the pinned builds and against the newest
release of Ghostty (its tag and main's tip), kitty, Rio, Contour and Warp
(`tests/compat/latest.zsh`; Alacritty stays Ubuntu's and WezTerm its nightly),
walks the model at random (`mise run walk --jitter`) and walks parity three
times over, and opens, updates or closes an issue for each of them
(`tests/nightly.zsh`).

Every terminal is held to one spec, Ghostty included. Each journey in
`tests/parity/journeys.ts` says what the tab in front shows at every look —
which palette, which picture — and `mise run parity` (part of CI) walks the
journeys — a new tab, `ttheme use`, `default`, `off` and `on` across tabs,
preview, pins, browse, pictures tuned or dropped in another tab, a default
reaching Ghostty, a real tmux in front of a tab — in a model of each terminal
built from what `mise run compat` measured, and records what every tab shows
against that spec in `tests/parity/facts.tsv` (a screen's spec is the one
Ghostty drew). Each miss needs a line in `tests/parity/gaps.tsv` saying whether
the terminal cannot express it, ttheme could close it, or it was left out on
purpose, and why; a terminal that lacks a whole capability — pictures, or
ttheme's wiring — says so once, in an `@pictures` or `@wired` line. A line must
explain every fact it names, and one that explains nothing fails. A change that
moves a fact fails until `mise run parity --update` records it; `--only`,
`--journey` and `--show journey.label` narrow a run and print what a tab shows.

The journeys are the cases someone thought of. `mise run walk` walks the same
model at random — tabs opened and focused, `use`, `default`, `off` and `on`,
pins, a program's reset, a mode switch, preview — and after every step holds
the tab in front to what it must keep whatever the journey: the shell believes
what the tab shows, the tab shows its palette's picture, and no escape reaches
the screen as text; a step that never settles fails too. `--jitter` makes the
reload of every terminal without a delay of its own land up to 0.3 s late, as
real ones do. A failure is walked again; one that fails twice is shrunk, step
by step, toward the fewest steps that still fail, printed as a journey to start
from and kept in `$TMPDIR/ttheme-walks.json`, which the next run walks first;
a seed replays it.

`mise run costs` (part of CI) holds what each action costs in each terminal's
model to `tests/costs.tsv`: the CLI runs it starts, the reload signals, profile
switches and default changes its shims record (iTerm2's `SetProfile`, an escape,
is not among them), the files it writes and the entries it makes in the folders
the terminal watches. More fails as a regression; fewer fails until
`mise run costs --update` locks it in.

## Working on the TUIs

The screens `tests/tui.zsh`'s scenarios reach — Browse, the hub and preview, the
palette panel, the palette editor below the builder's size and the pin screens —
are captured and compared against `tests/screens/`; find, init's picker, the
builder and `share` are not. The scenarios run in tmux at a fixed 100×24 against
`tests/fixture/` — six made-up built-in palettes in `builtin.json` and their
two made-up works, `briarwood-rocks` and `lumen-song`, in `commons.json` — pinned so that
adding a palette never rewrites a screen. A key written `key@text` in a scenario
waits for the screen to draw `text` before the next key, and text that never
shows within 15 s fails the scenario rather than letting it be compared late.

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
`within`, wait on `terminal.loop(…)` (or `terminal.until(…)` for a promise of
your own), clean up in `finally`. Let `Terminal` set the modes a screen needs
rather than writing them or calling `setRawMode` by hand, and never subclass
clack's `Prompt`.

### Drawing the screens

A screen draws two kinds of color. Its own — text, key hints, tabs, badges,
borders, the gate's marks — follows the palette the tab wears, so it never
names a color: it takes a role from `src/tui/style.ts`. A palette's own colors —
its swatches, a row lit in its selection and cursor, the scenes, the inside of
the palette editor's mock terminal — are what the screen shows, so they go out
as hex (`ansiFg`, `ansiBar`, `ansiSquares`, `p.fg`, `p.bg`). The QR code is
neither: it is black on white through the 256-color indices 16 and 231, which
no palette sets (`src/tui/qr.ts`).

The roles are a closed list in `ROLES`, each the SGR that opens it and the one
that closes exactly that, never a full reset, so a role inside a painted row
never resets the row — though `chip` closes the background it set (`49`), so a
chip inside a row with a ground of its own goes through `grounded`:

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
| `under` | the runs a slot draws in a scene, find's focused choice in a list | `4` |
| `reverse` | find's chosen chips and its lit site labels | `7` |

The accent is the terminal's slot 6 everywhere, never a palette's cursor: it
follows whatever the tab wears without asking the terminal anything, reads on
every built-in background, and stays right in the scrollback after the tab
changes palette. Preview spells slot 6 (and its foot's slot 3 alert) out in
truecolor only while the terminal does not hold the palette it shows yet
(iTerm2's hover).

A few surfaces need a fixed distance from the background rather than a slot: the
palette editor's stage, the shadow its window casts, its title bar, tab track
and active tab, and the selection where the terminal leaves OSC 17 unanswered.
The mock window the editor draws as pictures takes its fills from `SURFACES`
too, blending only its shadow and hairline over what lies under it, while the
picker's panel mixes its own (`surfaceOf` in `src/tui/picker-art.ts`: 7% toward
the foreground on a dark ground, 4% on a light one). `SURFACES` holds how far
each mixes toward the foreground, and `surfaceOf` mixes it from colors the
screen already knows — the palette it painted on the tab, or the answers to the
query it made anyway, where the palette editor fills a slot the terminal left
unanswered from the palette it opened with. Anything left in the scrollback once
a screen closes — `say` lines, browse's closing report, CLI messages — uses
roles and slots only, since the tab may change palette after it.

Under `NO_COLOR` or `TERM=dumb` a screen writes no SGR at all and says in text
what color said: `[Preview]` for the tab that is on, `[EDIT]` for a badge.

`painter(color)` gives a screen most roles as functions (`p.dim`, `p.pill`, …,
and `p.fg` and `p.bg` for a palette's colors; `match`, `under` and `reverse`
only through `open` and `close`) that hand text back unchanged when color is
off, and `src/tui/parts.ts` holds the parts several screens draw: `tabOf`,
`pillOf`, `hintOf`, `buttonOf`, `checkOf`, `markOf`, `boxEdge` and `boxed`.
Glyphs that mean a state are in `MARKS`: ▌ the cursor's row, ◆ the palette worn
or handled, ▶ the part in focus, ✦ a signature slot, ▸ ▾ a closed and an open
work, ● ○ on and off, ✓ ✗ pass and miss, ↑ ↓ more rows, ⇡ an update, ↻
auto-update, × a removal, ↶ taking one back, ★ stars, ⧉ a link, ⌕ search, ⇠ a
bright that follows its normal, ◐ contrast, ■ a swatch, ▣ pictures, · a
separator, – not measured and … text cut short.

Four more parts are shared. Browse and the palette editor draw their key bar
with `barLine` (`src/tui/bar.ts`): a badge, a lead, the keys, the key on the
right and the release line — find keeps its own `foot`, which places its links,
and init's picker a hint line under its list. The lead is a question or a
notice, said in its tone through `toned` — `ok` for what worked, `warn` for what
could not be done, `error` for a failure, plain for information — and the keys
stay after it: a narrow window drops the release line first (a newer release's
only after the key on the right), then a note, then keys from the end (never the
first, `?`, `enter` or the ones a screen lists in `keep`), then the key on the
right, and cuts what still does not fit; once the line fits, each key it dropped
comes back in its own place if it fits there, so a long key dropped late never
leaves room a shorter one could use.

A control with a key of its own — a chip or a toggle that `enter` does not
reach — wears that key after its label, dim (`keyAfter` in `src/tui/parts.ts`,
and preview's chip in `__tt_pv_chip`), and it is the first thing a narrow
window takes off its row: preview's chip lets it go when fewer than two blank
columns would follow it, and the editor's top bar before it gives up its
`· N changed` count. A key that a control carries leaves the key bar, and one
that no control carries stays on it, so a key is drawn once. A bar names only
the keys that do something where the cursor stands: preview's picture rows show
`=` while the size, position or opacity row under the cursor is off its
default, and `+` while any row is, or the picture is hidden.

In Browse, the palette editor and find `?` opens `Help` (`src/tui/help.ts`): the
topics of the mode the screen is in — each group's name beside its first topic,
then the keys and what they do —, where `↑` `↓` reach every topic and enter runs
the key a topic names (Browse and the editor offer that only where the key does
something), a filter that typing fills, the chosen topic's `more` under the
list, and a Marks list saying what the screen's marks mean. The topics scroll in
a short window, the box takes every click inside it and blanks the column beside
it where that column holds another box's edge, so two edges never touch, and the
screen under it keeps no click zones but on its key bar (find clears its screen
first, since its pictures would show through).

Last, a list its window cuts says what is out of sight with `moreOf`
(`↑ 3 more`, `↓ 12 more`).

The shell layer draws with the same roles from `TTHEME_SGR` in
`shell/ttheme.zsh` (`$TTHEME_SGR[dim]` opens, `$TTHEME_SGR[/dim]` closes) and
the same marks from `TTHEME_MARKS` beside it (`$TTHEME_MARKS[current]`).
`src/tui/style.test.ts` holds the first table to `ROLES` and the second to
`MARKS`, fails on an SGR written anywhere else in `src/` or `shell/` (tests and
`shell/check.zsh` aside; a truecolor `printf` format in the shell layer is a
palette's color and passes) and on a mark written literally in the shell layer —
all but ↑ ↓ × ■ · …, which also read as text there; it also checks that every
role closes what it opens, that slot 6, slot 8 (and the foreground on it) and
slot 1 hold 3:1 and the surfaces rise in order on every built-in palette, and
that no glyph sits under two names in `MARKS`. The screens in `tests/screens/`
run under `NO_COLOR`, so look at a change to color in a real terminal too.

### Keys a screen takes

Preview and browse filter as you type, so a letter or a digit is never a command
there, and an input method composes letters before the terminal hands them over.
An action takes a key the filter never sees — `tab`, `shift+tab`, the arrows
alone or with `shift`, `pgup`, `pgdn`, `home`, `end`, `enter`, `space`, `esc`,
`?`, or `ctrl` or `alt` with a letter — and this table is where to look before
binding one. A binding on a key already in it is a collision: move one of them,
or pick another key. `j` and `k` move like `↓` and `↑` only on the screens that
have no filter: the panel below, preview's settings and group menu, the palette
editor and find's grid. `ctrl+j` and `ctrl+k` move like them on every list,
filter or not (a terminal sends `ctrl+j` as a line feed, which no screen reads
as `enter`: that is `\r`; `lineStep` in `src/tui/keys.ts` is the one table, and
a screen without a filter also passes `letters` for `j` and `k`). The screens
that list pictures — find's grid and its try view, and the Pictures row of the
panel below — also take `h` and `l` as `←` and `→`.

| Key | Preview | Browse |
|---|---|---|
| any character | filters | filters every marketplace, landing on the first match in the panel; in the search, filters the marketplace list at once; in the `+ Add marketplace` form, types the source |
| `↑` `↓` `ctrl+j` `ctrl+k` `pgup` `pgdn` `home` `end` | move, wrapping | move, wrapping; in a marketplace's panel `↓` past the last palette reaches its actions and `↑` from the first wraps onto them, while the page keys stay among the palettes |
| `←` `→` | close or open a work while nothing is filtered; `→` on a palette opens its panel | `→` on a marketplace moves into its panel; there, close or open a work while nothing is filtered, and `←` at its top level goes back to the marketplaces; `→` on `+ Add marketplace` moves into its form in the panel and on `Search marketplace` opens the search, and `←` in either goes back |
| `enter` `shift+enter` | open or close a work while nothing is filtered; on a palette, use it — asking where (Default or This tab) in pin mode, or where `TTHEME_TAB_PALETTE` is `off` in a terminal that keeps a default, else in this tab at once | on a marketplace, move into its panel; there, open or close a work while nothing is filtered, or do the action under the palettes (`Update now`, `Auto-update`, `Remove marketplace`); on `+ Add marketplace`, move into its form in the panel, and there fetch the source typed and land in the panel of the marketplace it stages; on `Search marketplace`, open the search, and there add a marketplace and go back to its card, or go back on `← Back`; on a palette, review every pick and marketplace change, then apply it — with nothing changed, it does nothing; close the result |
| `esc` | clear the filter, then put the tab back and close | clear the filter, then leave the panel, then cancel, asking first when something is staged; in the `+ Add marketplace` form, go back, dropping a fetch still running; in the search, clear it, then go back |
| `space` | fold or open a work while nothing is filtered | pick — on a marketplace's card, all of it; on one of its actions, do it; on `+ Add marketplace` or `Search marketplace`, open it; in the search, add a marketplace (again to undo) or load the list again |
| `bksp` `ctrl+u` | edit the filter, clear it | edit the filter, the search's query or the `+ Add marketplace` form's source, clear it |
| `?` | keys, which preview also shows when it opens beside its list until any key closes them | the help: typing filters it, `↑` `↓` choose a topic and enter runs it, esc clears the filter and then closes it, and its Marks list says what browse's marks mean |
| `alt+g` | the group menu: how the list is grouped and sorted | — |
| `alt+c` | settings | — |
| `alt+u` | in the bare `ttheme`, while a newer release is known: close and run `ttheme update` | the same, asking first when something is staged |
| `ctrl+e` | open the palette's panel | — |
| `ctrl+r` | — | in a marketplace's panel, on a palette marked `⇡` or a work, stage its update; in the search, load the marketplace list again |
| `shift+←` `shift+→` | switch the sample | — |
| `tab` | on a palette, open its panel; elsewhere, the next screen of the bare `ttheme` | next screen of the bare `ttheme` |
| `shift+tab` | previous screen of the bare `ttheme` | previous screen of the bare `ttheme` |
| `ctrl+c` | quit | cancel, asking first when something is staged (`y` applies, `n` or a second ctrl+c discards, esc stays) |

The settings panel preview opens beside its list and the questions browse asks
take the keys they list on their own last line while they are open. `find` is a
screen of its own and keeps its own keys, and so does the palette editor (`new`,
`edit`, and the Edit palette button of preview's panel); in both, as in browse,
`?` opens the same help (`src/tui/help.ts`) with the keys of the mode the screen
is in, which docs/reference/keys.md lists. The editor's esc, once something
changed, opens a Save changes? dialog (`y` saves and leaves, `n` leaves without
saving, esc keeps editing), and ctrl+c leaves from anywhere in it the same way —
a tune it interrupts is kept, so it counts as a change — while a second ctrl+c
in the dialog leaves without saving. Every Node screen leaves on ctrl+c; browse
and the editor, which hold changes until they are applied or saved, ask first.

Preview's panel (`tab`, `→` or `ctrl+e` on a palette) has no filter, so it uses
letters too. It is one list — the picture's fields, an Edit palette button, then
an Apply button — and the part the cursor is in takes the keys:

| Key | Picture | Edit palette | Apply |
|---|---|---|---|
| `↑` `↓` `j` `k` | Pictures, then colors, size, position, opacity, and past the last one Edit palette | the picture, Apply | Edit palette, the top |
| `home` `end` | the top, Apply | same | same |
| `←` `→` `h` `l` | on Pictures, another picture; on Colors, own colors or tinted; on another field, a step | the Edit palette and Reset palette buttons | — |
| `⇧←` `⇧→` | on Pictures and Colors, as `←` `→`; on size and opacity, ×10; on position, one place | — | — |
| `enter` | on the empty frame under Pictures of a palette with no picture, find one | open the palette editor on it; on Reset palette, press twice to reset (esc between the two calls it off) | apply, saving first and asking where as enter on a palette does |
| `1`-`9` | place | — | — |
| `f` | find a picture | — | — |
| `=` `+` | reset a field, all | — | — |
| `c` `space` `,` `.` `D` | colors, hide, other pictures, remove one | — | — |
| `y` | copy the picture's credit | — | — |
| `shift+enter` | apply | apply | apply |
| `s` | save | save | save |
| `esc` | back to the list, dropping what changed since the last save | same | same |

### The mouse

Every screen but the inline choosers (init's picker, `ttheme unpin`'s) takes the
mouse, and every mouse action has a key in the tables above. A press selects —
it moves the cursor to a row, picks one of find's site tabs, sets a slider to
the point — and a release over what was pressed acts: a key hint presses its
key, a ○ picks, a ▸ folds, a button row acts, a tab of the bare `ttheme`
switches, and a double click does what enter does, but on a palette in
Browse's panel, where it picks. Acting on the release keeps a screen that
closes on a click from leaving the release to the shell, and moving off before
letting go cancels. In a list the wheel moves the cursor a row and never wraps;
in preview's panel and find's panels it steps as `↑` `↓` do, which wrap, in the
palette editor's picker it moves the value, and in find's try view it goes to
the next picture.

A button row is an icon, its label and the value after them
(`↻ Auto-update   on`, `+ Add marketplace`) marked as one zone, so a click
anywhere on the item acts and the blank after it does not. The icon and label
sit on a chip — `chip`, slot 8, which `style.test.ts` holds at 3:1 or more from
the background on every built-in palette (3.95:1 at the least, in either mode,
on 2026-10-28) — and the chip under the cursor is a `pill`; a button that
removes something stays a grey `chip` until the cursor reaches it and then is a
red `danger` chip, not a `pill` (red text on the grey chip reads at 1.32–1.53:1,
so red is only ever a fill, slot 1 under the background's own color); one with
nothing to do is dim, with no chip. A status that is not a control, like a
card's `↻ auto-update` badge, gets no zone of its own.

A Node screen marks what can be clicked while it draws: `zone(target, text)`
around the text (`keyZone` for a key hint), or a rectangle in `Frame.zones`;
`screen.point(event)` hands back what was under the pointer in the frame on
screen. The width helpers skip the marks but `.length` and `padEnd` do not, so
pad before you mark. Let `pointing()` add the mouse mode, and never assume it
from a program around you. In preview, append a zone to `pvz` where you draw the
thing (`row from to action`) and act on it in `__tt_pv_press` or
`__tt_pv_release`.

### Writing the text

How every screen, CLI message and docs page is worded — sentence case, key names
and hints, the words for each concept, counts, questions, states and text
someone else wrote — is in [`.claude/rules/text.md`](.claude/rules/text.md),
which Claude Code loads by itself when a file that holds such text is open.
