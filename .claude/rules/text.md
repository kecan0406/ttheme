---
paths:
  - "src/**"
  - "shell/**"
  - "docs/**"
  - "README.md"
  - "skills/**"
  - ".github/ISSUE_TEMPLATE/**"
---

# Writing the text

How every screen, CLI message and docs page is worded. CONTRIBUTING.md and
HACKING.md point here; the screens' colors, keys and mouse are HACKING.md's.

Every screen and message is written in sentence case: the first word and proper
nouns take a capital, everything else is lowercase. Never all lowercase as a
look, and never Title Case.

- **Sentence case**: box and panel titles (`Settings`, `Help`), row, column,
  tab and checkbox labels (`Min score`, `Select all`), buttons (`Advanced ›`),
  questions (`Remove ttheme?`), placeholders (`Search…`), status lines and
  notes (`Nothing changed`), the prose half of a two-column list, and every
  `about` line in `src/cli/verbs.ts`.
- **As spelled where they are typed**: anything the user types or `config.zsh`
  holds — values (`fit`, `safe`, `off`), palette and marketplace names (`kita`,
  `kec@dust`), site names on find's tabs (`danbooru`), booru tags, commands and
  flags (`ttheme use`, `--yes`) and key names (`enter`, `ctrl+v`). A line that
  starts with one keeps it as spelled.
- **As their owners spell them**: Ghostty, cmux, iTerm2, WezTerm, Kaku, kitty,
  Alacritty, Rio, Contour, Warp, Windows Terminal, Konsole, Terminal.app, macOS,
  GitHub; acronyms in capitals (PNG, URL, OSC, ANSI).
- **Keys as one name, drawn for the keyboard**: the source spells a key one
  way — `enter`, `esc`, `tab`, `bksp`, `pgup`, `home`, `ctrl+r`, `alt+u`,
  `shift+tab`, `⇧enter` — and a screen draws it through `cap` (a key hint,
  which `hintOf` and find's foot do for it) or `capped` (a line that names
  keys: Help's topics, a note), `src/tui/keycaps.ts`, and the shell layer
  through `__tt_cap` and `__tt_capped`. On a Mac outside ssh they draw
  Apple's symbols — ⌃ ⌥ ⇧ in Control, Option, Shift order, ↩ ⎋ ⇥ ⌫ ⌦ ⇞ ⇟ ↖ ↘, a
  chord's letter in capitals (`⌃R`) — and elsewhere the name as written
  (`TTHEME_KEYS`). A named key turns into its symbol only where a key stands —
  a line's start, after `·`, `—`, two spaces or a word ending in `,` `:` `.`
  `?` `!` — so prose that uses the word (`another tab`) keeps it, and a chord
  turns anywhere. There is no ⌘: a terminal keeps Command for itself. A click
  zone always names the key as written.
- **Lowercase**: key hints in footers and key bars (`↑↓ move   enter save`), and
  error messages, which read the same after the `ttheme:` prefix
  (``ttheme: kita is not installed — `ttheme add kita` first``) and in a status
  line. A notice written for the screen (`No picture on the clipboard`) is not
  an error.
- **Capitals**: only a mode badge (`PREVIEW`, `BROWSE`, `SEARCH`, `EDIT`,
  `PICTURE SEARCH`, `PICTURE PREVIEW`, `PICTURE EDIT`, `HELP`, `SETTINGS`,
  `GROUP`, `UNPIN`), with the state the screen is in after it where the bar says
  so (`PREVIEW (FILTER)`, `BROWSE (APPLY)`, `EDIT (TUNE)`), and the release
  notice's `UPDATE` pill. The tabs of the bare `ttheme` (`Preview`, `Browse`)
  are tab labels, so sentence case.

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

`·` has one job: it stands between short facts on one line
(`6 available · 1 installed`, `1920×1080 PNG · 2.1 MB`), written through `SEP`
(`src/tui/parts.ts`). Keys in a bar are apart by three spaces, names in a list
by commas, a title and its subject by two spaces, and what to do after a state
by ` — ` (`Opaque — x cuts it out`).

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

Counts on screen come from the palettes listed, never from the rows being drawn.
A folded work still reports how many of its palettes are picked, and the
filtered total counts what matches, not what fits on screen. The cursor and the
scroll window are the only things allowed to read the drawn rows.

A question says what it acts on (`Remove alice@pastel? Its installed palettes
stay installed`, `Apply 3 changes before you leave?`, the editor's Save
changes? counting the colors and pictures changed), and a no is answered too:
the bar leads with what was kept (`alice@pastel kept`) until the next key.

A state reads the same on every screen. A list with nothing to show says so in a
dim line where its rows would be — save Search's list, whose state is its one
row, a button `space` loads again —: `No palettes match 'kit'` while a filter
finds nothing (the things in the plural, what was typed in single quotes),
`No palettes yet` while there are none, and what to do after a ` — ` where a key
does it (`No posts of kita on danbooru — tab tries yande.re`). Work under way is
a dim line that names it, led by the spinner where the screen turns one; find's
work on the post in hand (installing, fetching, cutting out) leads its foot in
warn. A failure is drawn in the error role wherever it is named — Browse's card
badge, its panel and the `Update now` note, a Search result's row and detail
(and, below 94 columns, the brief under the list), the editor's bar, find's
foot. A notice a key earns is plain when the key had nothing to act on
(`Nothing to undo`), ok when it did what was asked
(`Already passes every contrast check`), and warn when the key was refused for
something the person can change (`The builder needs a window of at least 96×28`,
`Pick at least one palette`, `No picture on the clipboard`).

Text someone else wrote — a marketplace's files and the names of its files and
folders, the marketplace index, a booru's answer, an error message built from
any of them — has every control and direction character dropped or spelled out
before a screen or a message shows it, so no escape sequence reaches the
terminal and no direction mark reorders what it touches: through
`src/core/text.ts` in Browse, the editor's notices, the readers and the CLI's
errors (`inert` for one line, `inertLines` for a message that keeps its line
breaks, and `quoted` or `escaped` for a value an error echoes), through
`Line.put` and `linked` in find, and through the picture's conf lines for
preview; a reader refuses such a character where a value has no use for one
(`textProblem`).
