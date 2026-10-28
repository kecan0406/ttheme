# The runtime under the screens

## How a keypress becomes a frame

A Node screen:

```
stdin bytes
  Keys (keys.ts)              bytes → Inbound events: key, paste, mouse, focus, and the replies to queries;
                              a sequence split across reads is held until it completes
  terminal.loop(take, after)  hands each event to the screen until take returns a result (terminal.ts)
  the screen's handler        BrowsePanel.key, PaletteEditor.press, find's key; a click asks screen.point(event)
  after → screen.soon()       input paints on the next turn; anything else calls screen.request(), at most once a FRAME_GAP
  Screen (screen.ts)          view() → rows carrying zone(…) marks → lifted(): the marks come out, their zones are kept
                              → only the rows that changed, in one write inside a synchronized update;
                              frame.after() adds what goes over the rows (pictures), frame.ticking runs the BEAT
```

Around it, `within(options, body)` (`terminal.ts`) opens a `Terminal` with the `modes` the screen sets and the ones it `assume`s from a program around it, and puts back exactly what it set on every way out; `terminal.ask(query, pick, wait)` asks the terminal something while the screen is up, holding other input; `terminal.onResize` lets the screen reset and redraw. `BrowsePanel.run` is the plainest whole example; `PalettePrompt` does the same with an `Inline` in place of a `Screen`.

Preview does it in zsh: `__tt_pv_getch` reads a key, decoding a mouse report through `__tt_pv_sgr`; `__tt_pv_handle` acts on it — a click through `__tt_pv_mouse`, which finds its zone with `__tt_pv_spot` and acts in `__tt_pv_press` or `__tt_pv_release` —; `__tt_pv_draw` builds the frame in `out` and appends every clickable thing to `pvz` (`row from to action args`), and `__tt_pv_flush` writes it.

## Layers inside src/tui

`.oxlintrc.json`'s overrides hold them: the runtime (`ansi`, `field`, `keycaps`, `keys`, `motion`, `pending`, `screen`, `style`, `terminal`, `zones`) imports no part, and the parts every screen shares (`bar`, `help`, `hub`, `notice`, `parts`, `qr`) import no screen; every other file is a screen, so a new file is one until those lists name it. Browse's pieces (`staged`, `network`, `review`, `search`, `form`, `panel`, `draw`, `types`) are each handed a `…Host` or the other pieces, never `BrowsePanel`. find's controller is `src/cli/find/find.ts`; only its drawing lives under `src/tui/find/`.
