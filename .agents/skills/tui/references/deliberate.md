# Deliberate, not bugs

Before "fixing" one of these, read where it was decided.

| Looks wrong | Why it stays | Decided in |
|---|---|---|
| Preview is zsh while every other screen is Node | A Node screen's first frame was measured past what the move was allowed | `src/tui/AGENTS.md` |
| No comments in first-party code | A project rule | `AGENTS.md`, Rules |
| `for…of` with `push` where an iterator helper reads shorter | Iterator helpers measured several times slower than the array methods | `AGENTS.md`, Traps |
| A cut line ends in `closing(head)`, not `RESET` | A full reset would end a painted row's background | `.claude/rules/tui.md` |
| A Node screen leaves the modes a program around it set | They are `assume`d: set, never put back, since preview keeps them | `src/tui/AGENTS.md` |
| …yet the mouse mode is claimed, never assumed | It goes off with the screen that took it, and preview turns its own back on | `MOUSE` in `src/tui/terminal.ts` |
| No `/` to search; `j` and `k` do not move in preview or Browse (`ctrl+j` and `ctrl+k` do, through `lineStep` in `keys.ts`) | Typing filters at once, so letters are never commands there | HACKING.md, Keys a screen takes |
| `↑` `↓` wrap and the wheel does not | Lists wrap on keys; the wheel moves a row | HACKING.md, Keys a screen takes and The mouse |
| A click acts on the release | A screen that closes on a click must read the release, or it lands in the shell | HACKING.md, The mouse |
| A wheel event within `WHEEL_GAP` of the last one the same way is dropped | Ghostty sends three per notch | `WHEEL_GAP` in `src/tui/keys.ts` |
| init's picker ignores the mouse | It draws below the prompt with no row of its own, and the wheel must keep scrolling the terminal | `src/tui/AGENTS.md` |
| The accent is slot 6, not the palette's cursor | It follows whatever the tab wears and stays right in the scrollback | HACKING.md, Drawing the screens |
| The palette editor never sets the terminal's colors | Only its mock window shows the draft; its own rows keep the terminal's | `src/tui/AGENTS.md` |
| Keys read `⌃⌥⇧↩` on a Mac and names in the tests | `capsFor` decides once per run, and every harness that compares screens sets `TTHEME_KEYS=text` | `.claude/rules/tui.md` |
| `Screen` rewrites whole rows, not cells | A frame's cost was measured in its `view()`, not the write | `src/tui/AGENTS.md` |
| `...(x ? { k: x } : {})` for an optional key | How ttheme writes one; the lint rule against it is off | `AGENTS.md`, Rules |
