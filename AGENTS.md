# AGENTS.md

Rules for coding agents working in this repository. The full guides are
`CONTRIBUTING.md` (for contributors), `HACKING.md` (the terminal checks and how
the screens are drawn, keyed and worded) and `CLAUDE.md` (architecture and
conventions); read them before you change anything.

- Run `mise run format`, then `mise run ci`, once, before the change leaves your
  hands — a pull request, a merge or a push to `main` — not after every edit.
  `ci` is exactly what CI runs, on Ubuntu.
- Tasks live in `mise.toml`; `package.json` has no scripts, and none may be added.
- First-party code carries no comments.
- Every screen and message follows "Writing the text" in `HACKING.md`.
- No backwards-compat shims, deprecated aliases or legacy fallbacks.
- Shell code must work with both GNU and BSD tools; CI runs GNU's.
- If a tool wrote a substantial part of a commit, say so at the end of its
  message: an `Assisted-by: <tool>` line, or the tool's own `Co-Authored-By:`
  trailer.
