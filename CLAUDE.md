# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All dev commands are mise tasks. package.json deliberately has **no scripts** — do not add any; the toolchain (bun 1.3) and tasks live in mise.toml.

- `mise run ci` — lint + typecheck + tests + build + shell check (exactly what CI runs)
- `mise run build` (or `--only <terminal>`) — regenerate dist/; fails on contrast violations
- `mise run test` / `mise run check` / `mise run lint` / `mise run format`
- `mise run shell:check` — zsh syntax + runtime check of shell/ (depends on build)
- `bun install` for dependencies

## Conventions

- First-party code carries **no comments** — a deliberate choice; do not add any. `ghostty/shaders/*.glsl` is third-party (MIT) and keeps its headers.
- No backwards-compat shims, deprecated aliases, or legacy fallbacks.
- `themes/*.toml` is the single source of truth; `dist/` is generated, never committed. `[font]` and `[ghostty]` sections inherit from `themes/_defaults.toml`.
- Every palette must pass the contrast gate (src/contrast.ts). Opting out needs `[contrast] waive = [...]` **plus** a `reason` — a waiver without a reason fails the test suite.

## Gotchas

- mise.toml task scripts are rendered as tera templates: zsh's `${#VAR}` reads as a tera comment opener. Wrap such scripts in `{% raw %}` / `{% endraw %}`.
- install.sh intentionally calls `bun src/cli.ts build` directly instead of mise — end users installing the theme should not need mise.
