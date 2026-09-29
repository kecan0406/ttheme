# AGENTS.md

Rules for coding agents working in this repository. The full guides are
`CONTRIBUTING.md` (for contributors) and `CLAUDE.md` (architecture and
conventions); read them before you change anything.

- Run `mise run ci` before you finish. It is exactly what CI runs, on Ubuntu.
- Tasks live in `mise.toml`; `package.json` has no scripts, and none may be added.
- First-party code carries no comments.
- Every screen and message follows "Writing the text" in `CONTRIBUTING.md`.
- No backwards-compat shims, deprecated aliases or legacy fallbacks.
- Shell code must work with both GNU and BSD tools; CI runs GNU's.
- If a tool wrote a substantial part of a commit, end its message with
  `Assisted-by: <tool>`.
