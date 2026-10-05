---
paths:
  - "src/tui/**"
  - "src/{ansi,browse,browse-panel,palette-prompt,editor-screen,builder-screen,editor-paint,tone-view,hub,pending,pictures,qr}*.ts"
  - "src/find/screen.ts"
  - "shell/preview.zsh"
  - "shell/adapters/_bg.zsh"
---

# Drawing the screens

## Conventions

- Every SGR comes from `src/tui/style.ts` (`ROLES` through `open`/`close` or `painter`, `RESET`/`FG_RESET`/`BG_RESET`/`INK_RESET`, `slotFg`/`slotBg`, `indexed`, and the content helpers `ansiFg`/`ansiBg`/`ansiBar`/`ansiSquares`) and, in the shell layer, from `TTHEME_SGR` in `shell/ttheme.zsh`; `style.test.ts` fails on any other — a template like `\x1b[${30 + n}m` included — holds the zsh table key for key to `ROLES` plus `reset`, `/fg`, `/bg`, `/ink` and `fg0`–`fg7`, checks that each role closes exactly what it opens (`closing(open(role)) === close(role)`, so a closer lists its codes in `closing`'s order), that slot 6 reads at 3:1 on every official background and `SURFACES` step away from it in order, and that `MARKS` holds no glyph twice. CONTRIBUTING.md's "Drawing the screens" is the reference.
- Chrome against content decides the color: chrome is a role (the accent is slot 6, never a palette's cursor), content is the palette's hex. Content: swatches, a lit row's ▌ and selection bar (`PaletteList.rowText`, browse's `lit`, the editor's sidebar rows in the terminal's own colors), browse's detail title in the palette's cursor, preview's `gc` (the gutter, the cursor row's ■, the sample header), the scenes and the mock terminal. Chrome: tabs and badges (`tabOf`, `pillOf`), the current ◆ (preview's `cdot`, wrapped in `ac` where it is drawn), an active series, the ▶ and heavy frame of the part in focus, the editor's title ◆ and its choice pills.
- Preview builds its accent once a frame in `__tt_pv_draw`: `ac` (accent), `pl` (pill) and `hm` (match) are `TTHEME_SGR`'s, and while `applied` ≠ `painted` they carry the applied palette's ANSI 6 in truecolor, as `__tt_pv_foot`'s `y` carries its ANSI 3 — the terminal's slots still hold the palette painted before. `gc` and `sb` are the applied palette's cursor and selection, the lit row's content colors.
- `fit` and `clip` (`src/ansi.ts`) end a cut with `closing(head)` — only what the kept text opened — never `RESET`, so a cut inside a painted row keeps its background; the runtime's own resets (`Screen`, `cover`) stay full ones.
- `surfaceOf(ground, ink, name)` is the only mix a screen's chrome may draw, and only from colors the screen was told: the palette it painted, or `Look.chrome` from the OSC query, where `runEditor` fills a slot the terminal left unanswered from the palette it opened with (`editor.start`) and the selection from `surfaceOf(…, 'selection')`. Every supported terminal answers OSC 10 and 11; drawing the builder from roles alone when they do not would take a second rendering path, so it is not done.

## Gotchas

- In zsh, a `TTHEME_SGR` key that starts with `/` must not sit inside the pattern of `${var/pattern/repl}` — zsh takes the `/` in `[/dim]` for the separator even inside quotes ("bad pattern"); copy it to a local first (`dx=$TTHEME_SGR[/dim]`, then `${row//$dx/…}`, which zsh matches literally without `GLOB_SUBST`).
- `__tt_pv_draw` declares `local -i … mt=${#TTHEME_ORDER}`: a string local of the same name turns into a math error ("bad math expression: illegal character: ^[") that only the color path reaches, which the `NO_COLOR` screens never run. Name a new local in preview after grepping the function.
- `tests/screens/` are captured under `NO_COLOR` with `capture-pane -p`, so they hold the plain tier only. To check a change to color, capture with a copy of `tests/tui.zsh` that drops `NO_COLOR=1` and uses `capture-pane -e -p`, before and after, and compare the cells' styles: every difference should be one the change meant.
