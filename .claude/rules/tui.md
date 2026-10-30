---
paths:
  - "src/tui/**"
  - "src/cli/{browse,pictures}*.ts"
  - "shell/preview.zsh"
  - "shell/adapters/_bg.zsh"
---

# Drawing the screens

## Rules

- Every SGR comes from `src/tui/style.ts`, and in the shell from `TTHEME_SGR`; every mark from `MARKS`, and in the shell from `TTHEME_MARKS` (`style.test.ts` fails on any other).
- A closer lists its codes in `closing`'s order.
- Chrome is a role and content is the palette's hex; the accent is slot 6, never a palette's cursor.
- Content: swatches, a lit row's ▌ and selection bar, browse's detail title, preview's `gc`, the scenes, the mock terminal and the mark `>ω`.
- Chrome: tabs and badges, the current ◆, an active work, the ▶ and heavy frame of the part in focus, the editor's title ◆ and its choice pills.
- `fit` and `clip` end a cut with `closing(head)`, never `RESET`.
- Browse, the editor and find draw their key bar, notices, `?` and cut lists with the shared parts (`barLine`, `toned`, `Help`, `moreOf`); a screen grows none of its own.
- `__tt_pv_wrap` and `help.ts`'s `wrap` change together (`help.test.ts`).
- Preview's chrome ends a column short of the window's edge.
- A control with a key of its own draws it after its label, dim, and leaves it off the key bar.
- A key is spelled one way in the source and drawn through `cap` or `capped` (`__tt_cap`, `__tt_capped` in the shell), which `keycaps.test.ts` holds together.
- `src/bin.ts` decides `capsFor` once, and every harness that compares screens sets `TTHEME_KEYS=text`.
- A line given to `capped` never carries outside text.
- `surfaceOf` is the only mix a screen's chrome may draw, and only from colors the screen was told.

## Traps

- A `TTHEME_SGR` key that starts with `/` never sits inside the pattern of `${var/pattern/repl}`: copy it to a local first.
- `__tt_pv_draw` declares `local -i … mt`: grep the function before naming a new local in preview.
- `tests/screens/` hold the plain tier only: check a color change with `mise run look <scenario> <size> --emit txt,styles` before and after.
