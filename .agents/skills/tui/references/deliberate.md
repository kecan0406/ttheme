# Deliberate, not bugs

Before "fixing" one of these, read where it was decided.

| Looks wrong | Decided in |
|---|---|
| Preview is zsh while every other screen is Node | `src/tui/AGENTS.md` |
| No comments in first-party code | `AGENTS.md`, Rules |
| `for…of` with `push` where an iterator helper reads shorter | `AGENTS.md`, Traps |
| A cut line ends in `closing(head)`, not `RESET` | `.claude/rules/tui.md` |
| A Node screen leaves the modes a program around it set | `src/tui/AGENTS.md` |
| …yet the mouse mode is claimed, never assumed | `MOUSE` in `src/tui/terminal.ts` |
| No `/` to search; `j` and `k` do not move in preview or Browse | HACKING.md, Keys a screen takes |
| `↑` `↓` wrap and the wheel does not | HACKING.md, Keys a screen takes and The mouse |
| A click acts on the release | HACKING.md, The mouse |
| A wheel event within `WHEEL_GAP` of the last one the same way is dropped | `WHEEL_GAP` in `src/tui/keys.ts` |
| init's picker ignores the mouse | `src/tui/AGENTS.md` |
| The accent is slot 6, not the palette's cursor | HACKING.md, Drawing the screens |
| The palette editor never sets the terminal's colors | `src/tui/AGENTS.md` |
| Keys read `⌃⌥⇧↩` on a Mac and names in the tests | `.claude/rules/tui.md` |
| `Screen` rewrites whole rows, not cells | `src/tui/AGENTS.md` |
| `...(x ? { k: x } : {})` for an optional key | `AGENTS.md`, Rules |
