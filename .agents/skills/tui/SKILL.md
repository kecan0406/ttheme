---
name: tui
description: A map of ttheme's terminal screens — preview and its tuning panel in zsh, the hub's tabs, Browse, init's picker, the palette editor and builder, find — and the runtime under them in src/tui: which file holds a screen's keys and which draws it, how a keypress becomes a frame, where a given change goes, which zsh and TypeScript copies must change together, how to check it, and the choices that look like bugs and are not. Use before adding or changing a key, a click, a row, a panel, a notice, a color, a mark or a whole screen, before reviewing a change to src/tui/, src/cli/browse.ts, src/cli/find/ or shell/preview.zsh, and when asked how a screen is built.
metadata:
  internal: true
---

# Finding your way around the screens

This is a map, not the reference. The facts are kept where they already are — `src/tui/AGENTS.md` (the Node runtime, the mouse, Browse, the palette editor), HACKING.md's "Working on the TUIs" (the roles and marks, the key tables, the mouse), `.claude/rules/text.md` (the text rules) and `.claude/rules/tui.md`, which loads once a file its `paths` name is read with the Read tool — and this file says which of them to open for the change in hand. Where a name here and the code disagree, the code is right and this file is fixed.

Look at a screen before reading the code that draws it: `mise run look <scenario> <cols>x<rows> [keys…]` writes a PNG and a text grid (`mise run look` alone lists the scenarios).

## Which screen is which

| Screen | Runs in | Keys and state | Draws | Started by |
|---|---|---|---|---|
| Preview, the hub's first tab | zsh, `shell/preview.zsh` | `__tt_pv_handle`, fed by `__tt_pv_getch`; clicks through `__tt_pv_mouse` | `__tt_pv_draw`, its key bar `__tt_pv_foot`, `?` `__tt_pv_help` | a bare `ttheme` (`__tt_preview hub`) |
| The hub's tab bar | zsh over Preview, Node over Browse | `HUB_TABS` (`src/tui/hub.ts`), carried into `palettes.zsh` as `TTHEME_HUB_TABS` and `TTHEME_HUB_TITLES`; a Node tab asks for the next one by its exit status (`hubTo`, `HUB_SWITCH`) | `__tt_pv_bar` while Preview is up, `hubBar` while Browse is | the hub; preview starts Browse through `__tt_cli browse` |
| Preview's panel beside a palette | zsh | `__tt_te_*`, the picture's `__tt_pv_tune*` | `__tt_pv_te_*`; the palette half is `toneRows` (`src/tui/tone-view.ts`), read through `ttheme tone <palette> show` | `tab`, `→` or `ctrl+e` on a palette |
| Browse, the hub's second tab | Node | `BrowsePanel` (`src/tui/browse/browse.ts`): `key`, `searchKey`, `formKey`, `mouse` | `view()` → `draw()`; its key bar `footer()` through `barLine`, the cards' keys from `cardKeys()`, the search's from `Search`'s `keys()` | `runBrowse` (`src/cli/browse.ts`) through the hidden `browse` verb |
| init's and share's picker | Node, below the prompt (`Inline`) | `PalettePrompt` over `PaletteList` (`src/tui/palette-prompt.ts`) | `PaletteList`'s rows and a hint line of its own under them, no key bar | `init`, `pickPalettes` (`src/cli/installs.ts`) |
| Palette editor | Node | `PaletteEditor.press` (`src/tui/palette-editor.ts`); clicks in `pointEditor` (`editor-screen.ts`) | `renderBuilder` (`builder-screen.ts`) from `TABS_COLS`×`TABS_ROWS` (`src/core/builder-layout.ts`), `renderEditor` (`editor-screen.ts`) below it; its key bar `footer` in `editor-screen.ts`, through `barLine` | `runEditor`: `new`, `edit`, preview's Edit palette (`ttheme tone <palette> edit`) |
| find | Node | `key` and `pressed` in `src/cli/find/find.ts` | `renderFind` (`src/tui/find/screen.ts`), written through `Paint` (`src/tui/find/paint.ts`); its key bar is its own `foot` there, not `barLine` | `runFind`, `findFor` |

Browse also uses `PaletteList` three times (the cards, the panel's palettes, the search's results). find has rules of its own, `.claude/rules/find.md`, which load once a file it covers is read.

How a keypress becomes a frame, on a Node screen and in preview's zsh, and which files under `src/tui` may import which, are in `references/runtime.md`: read it before a new screen or a change to `terminal.ts`, `keys.ts` or `screen.ts`.

## Copies that change together

Preview draws in zsh what the Node screens draw in TypeScript, so several things exist twice. Change both sides in one change. Three pairs fail a test when they drift — the roles and marks, the keycaps and help's wrap, which `.claude/rules/tui.md` describes. Three fail nothing:

- The hub's tab bar: `hubBar` (`src/tui/hub.ts`) over Browse and `__tt_pv_bar` over Preview. Draw the `hub-few` and `hub-browse` scenarios with `mise run look` and compare their row 0.
- The release line at the right end of the key bar: `releaseOf` (`src/tui/bar.ts`) and preview's `__tt_pv_standing` and `__tt_pv_foot`. Only the wording is shared, `STANDING_LINES` (`src/tui/notice.ts`) carried as `TTHEME_STANDING`.
- The world view: preview's list (`__tt_pv_rows`, from `TTHEME_ORDER` or `TTHEME_ABC`, `TTHEME_WORKS`, `TTHEME_ALSO`, `TTHEME_WORK_NAME` and `TTHEME_WORK_NATIVE`) and `PaletteList`'s `world` layout (`pickerRows`, `seatsOf`, `byWorkName`) shelve the same palettes the same way — the works by name, a palette under every work its character's `also` names, then `── Originals` by publisher, `ttheme` first — and preview's filter matches what `matchesPalette` matches. `mise run look preview-open` draws preview's; init's picker has no scenario, so compare it by hand. `worldOrder` (`src/core/commons.ts`) holds the order.

What `sync` carries into `palettes.zsh` for preview (`HUB_TABS`, `STANDING_LINES`, `TTHEME_MARK_INKS`, its help, `PREVIEW_KEYS` from `src/tui/preview-keys.ts`) comes from `src/cli/emit-shell.ts`, so a change to one of those sources reaches preview only after a `sync`.

## Where a change goes

**A key on a Node screen.** First HACKING.md's "Keys a screen takes": where typing filters (preview, Browse) a letter or digit is never a command, and a key already in its table is a collision to resolve, not to add beside. Then the handler (the table above), the help topic that names the key (`topics()` in `BrowsePanel` and `PaletteEditor`, `findTopics` for find; enter on a topic runs its key), the hint on the screen's key bar (the "Draws" column above names where each takes its keys; the key spelled as the source spells it and drawn through `cap`, `src/tui/keycaps.ts`), and `docs/reference/keys.md`.

**A key in preview or its panel.** A case in `__tt_pv_handle` (or the panel's `__tt_te_*`), its line in `PREVIEW_KEYS` (`src/tui/preview-keys.ts`, which `__tt_pv_help` reads through `palettes.zsh`), the bar in `__tt_pv_foot`, the panel's table in HACKING.md, and `docs/reference/keys.md`. A key is drawn through `__tt_cap` and `__tt_capped`.

**A click.** Every click has a key that does the same. In a Node screen wrap the text in `zone(target, text)` (`keyZone` for a key hint — `hintOf` already does) while drawing, and pad before marking, since `.length` and `padEnd` count the marks; act in the screen's mouse handler, on the release (`count >= 2` is a double click). find hands rectangles in `Frame.zones` instead. In preview append to `pvz` where the thing is drawn and act in `__tt_pv_press` or `__tt_pv_release`. HACKING.md's "The mouse".

**A color, a mark, a badge.** A role from `ROLES` (through `painter`), a glyph from `MARKS`, a part from `src/tui/parts.ts`; a palette's own colors go out as hex (`ansiFg`, `ansiBar`, `ansiSquares`). Which is chrome and which is content: `.claude/rules/tui.md`. In zsh, `TTHEME_SGR` and `TTHEME_MARKS`. `src/tui/style.test.ts` fails on any other SGR or mark.

**A shared part** — the key bar, a notice, Help, a button, a box, the empty, loading and failed lines, `↑ n more`. Change it in `bar.ts`, `help.ts`, `parts.ts` or `notice.ts` rather than growing a copy in one screen, and look at every state it takes at once: `mise run look kit:<part> <cols>x<rows>` (`tests/kit.ts`: `bar`, `buttons`, `states`, `boxes`, `help`, `help-filtered`, `help-empty`, `help-short`).

**Words.** `.claude/rules/text.md`: sentence case, values and keys as typed, key hints and errors lowercase, one wording per state, counts from the palettes listed and never from the rows drawn, the key bar's verbs, a Help topic's `keys`, `does` and `more`, `·` only between facts through `SEP`, and the word list there, which the screens and `docs/` keep to. Text someone else wrote goes through `inert`, `inertLines`, `quoted` or `escaped` (`src/core/text.ts`).

**A new Node screen.** A model whose `view()` returns its rows; open it with `within`, draw through a `Screen` over that `view`, take events with `terminal.loop`; let `Terminal` set the modes (`pointing()` for the mouse), never write them or call `setRawMode` by hand; `?` opens `Help`, the bar is `barLine`, ctrl+c leaves, asking first while something is held; clack only for inline questions, never a `Prompt` subclass. Add it to `.oxlintrc.json`'s lists only if it is runtime or a part. Give it a line in `SCENARIOS` (`tests/tui.zsh`: name, state, target, keys, where `Enter@ADD` presses enter and waits for `ADD` on screen; a new target needs a case in `command_for`), then `mise run tui --update <name>`.

**Handing the tab between preview and a Node screen.** Preview gives the tab its own look before it hands it over (`__tt_pv_leave`), the Node screen is told that look as `TTHEME_HUB_LOOK` and gives it back when the hub closes from it, and preview assumes nothing when it takes the tab back (`__tt_pv_back`, `__tt_pv_lost`). The contract is in `.claude/rules/terminals.md`; parity's `hub-back` and `browse-back` journeys hold it.

**A slow frame.** A frame costs its `view()`, not the diff or the write. Profile with `node --cpu-prof` on an unminified bundle; memoize widths through `cells` (`src/core/text.ts`), never a derivation of a draft through `memo`, which keeps every entry it is given. `chase` and `Glide` (`motion.ts`) move a scroll position smoothly.

**Pictures** — preview's layers, find's tiles, the editor's backdrop, picture picker and relations charts, share's QR code — are kitty graphics, sent in chunks through `graphic` (`src/terminals/graphics.ts`). `look` does not draw them (where a text form exists, as the charts and the QR code have, it shows that): use the `sandbox` skill.

## Deliberate, not bugs

Some choices look wrong and are not: preview in zsh, no comments, `for…of` with `push` over an iterator helper, a click that acts on the release, `↑` `↓` that wrap while the wheel does not, the accent in slot 6. Before "fixing" one, read `references/deliberate.md`, which says why each stays and where it was decided.

## Checking a change

A round of changes with the user runs none of these unless it asks to see the screen, and the whole `mise run ci` runs once, right before the change reaches `main` (`AGENTS.md`). When one is run, run the check that answers the change in hand, once — not every one below:

- `mise run look <scenario | browse | hub | edit:<palette> | kit:<part>> <cols>x<rows> [keys…] --against HEAD` draws the screen before and after the change and prints the rows that differ; `--emit txt,styles --rows a-b` for a change to color, since `tests/screens/` hold the `NO_COLOR` tier only.
- `mise run tui [names]` compares every screen in `tests/screens/`; `--update` accepts what they draw now.
- The tests beside the file (`mise run test src/tui/browse`) and `mise run check`.
- A change to preview: `mise run shell:check` (zsh syntax, `tests/latency.zsh check`, the fork ratchet).
- Real terminals, pictures, a tab handed over: the `sandbox` skill, and `mise run parity --journey <id>` where what a terminal shows is the question.
