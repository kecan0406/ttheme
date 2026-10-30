---
name: tui
description: How to change ttheme's terminal screens — preview and its tuning panel in zsh, the hub's tabs, Browse, init's picker, the palette editor and builder, find: where a key, a click, a color, a shared part or a whole screen goes, which zsh and TypeScript copies must change together, how to check it, and the choices that look like bugs and are not. Use before adding or changing a key, a click, a row, a panel, a notice, a color, a mark or a whole screen, and before reviewing a change to src/tui/, src/cli/browse.ts, src/cli/find/ or shell/preview.zsh.
metadata:
  internal: true
---

# Changing the screens

The rules are in `src/tui/AGENTS.md`, HACKING.md's "Working on the TUIs", `.claude/rules/text.md` and `.claude/rules/tui.md`; find's are in `.claude/rules/find.md`. Where this file and the code disagree, the code is right and this file is fixed.

Look at a screen before reading the code that draws it: `mise run look <scenario> <cols>x<rows> [keys…]` (`mise run look` alone lists the scenarios).

## Copies that change together

Preview draws in zsh what the Node screens draw in TypeScript: change both sides in one change. These fail no test when they drift:

- The hub's tab bar: `hubBar` (`src/tui/hub.ts`) and `__tt_pv_bar`. Compare row 0 of the `hub-few` and `hub-browse` scenarios.
- The release line: `releaseOf` (`src/tui/bar.ts`) and preview's `__tt_pv_standing` and `__tt_pv_foot`.
- The world view: preview's list (`__tt_pv_rows`) and `PaletteList`'s `world` layout shelve the same palettes the same way, and preview's filter matches what `matchesPalette` matches.

What `sync` carries into `palettes.zsh` for preview comes from `src/cli/emit-shell.ts`, so a change to one of its sources reaches preview only after a `sync`.

## Where a change goes

**A key on a Node screen.** Read HACKING.md's "Keys a screen takes" first: where typing filters, a letter or digit is never a command, and a key already in the table is a collision to resolve. Then the handler, the help topic that names the key, and the hint on the key bar.

**A key in preview or its panel.** A case in `__tt_pv_handle` (or the panel's `__tt_te_*`), its line in `PREVIEW_KEYS` (`src/tui/preview-keys.ts`), the bar in `__tt_pv_foot`, and the panel's table in HACKING.md.

**A click.** Every click has a key that does the same and acts on the release. On a Node screen wrap the text in `zone(target, text)` while drawing and pad before marking; find hands rectangles in `Frame.zones`; preview appends to `pvz` and acts in `__tt_pv_press` or `__tt_pv_release`.

**A color, a mark, a badge.** A role from `ROLES`, a glyph from `MARKS`, a part from `src/tui/parts.ts`; a palette's own colors go out as hex. In zsh, `TTHEME_SGR` and `TTHEME_MARKS`.

**A shared part** — the key bar, a notice, Help, a button, a box, the empty, loading and failed lines, `↑ n more`. Change it in `bar.ts`, `help.ts`, `parts.ts` or `notice.ts`, never as a copy in one screen, and look at every state it takes: `mise run look kit:<part> <cols>x<rows>`.

**A new Node screen.** A model whose `view()` returns its rows, opened with `within`, drawn through a `Screen` and fed by `terminal.loop`. Let `Terminal` set the modes, never write them or call `setRawMode`; `?` opens `Help`, the bar is `barLine`, ctrl+c leaves; clack only for inline questions, never a `Prompt` subclass. Give it a line in `SCENARIOS` (`tests/tui.zsh`), then `mise run tui --update <name>`.

**Handing the tab between preview and a Node screen.** The contract is in `.claude/rules/terminals.md`; parity's `hub-back` and `browse-back` journeys hold it.

**A slow frame.** A frame costs its `view()`. Profile with `node --cpu-prof` on an unminified bundle; memoize widths through `cells`, never a derivation of a draft through `memo`.

**Pictures** are kitty graphics sent through `graphic` (`src/terminals/graphics.ts`), which `look` does not draw: use the `sandbox` skill.

## Deliberate, not bugs

Before "fixing" something that looks wrong — preview in zsh, a click that acts on the release, `↑` `↓` that wrap while the wheel does not, the accent in slot 6 — read `references/deliberate.md`.

## Checking a change

Run only the check that answers the change in hand, and only when a round asks to see it (`AGENTS.md`):

- `mise run look <scenario | browse | hub | edit:<palette> | kit:<part>> <cols>x<rows> [keys…] --against HEAD` marks what changed; add `--emit txt,styles --rows a-b` for a change to color.
- `mise run tui [names]` compares the screens in `tests/screens/`; `--update` accepts what they draw now.
- The tests beside the file (`mise run test src/tui/browse`) and `mise run check`.
- A change to preview: `mise run shell:check`.
- Real terminals, pictures, a tab handed over: the `sandbox` skill, and `mise run parity --journey <id>`.
