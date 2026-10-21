---
name: palette
description: Add or change the official palettes in themes/ — the ttheme-palette skill's steps run from this checkout with `bun src/bin.ts palette … --in themes`, plus what only the official marketplace needs (a catalog per series, meta.order, both modes in the file, the build and a patch release), and the two scripts that keep the shipped palettes' other mode and ANSI roles in step with src/core. Use when adding a series or a character to the official palettes, or re-mirroring their other mode.
metadata:
  internal: true
---

# Official palettes

Make them as `skills/ttheme-palette/SKILL.md` says — read it first — with the CLI from this checkout: `bun src/bin.ts palette measure`, `consensus` and `make`. Decide every step yourself and report to the owner afterwards as its step 8 says; there is no review board and no measurement record. What the official marketplace adds:

- A series is a catalog: `themes/palettes/<catalog>/`, named with the series' English title as fans write it, with a `[[catalog]]` table in `themes/ttheme-marketplace.toml` giving `native` (the official title, punctuation verified: `・` U+30FB, half-width `!`, a trailing `。` where the title has one) and `lead` (the character the series is known by, whatever its colors). `make --in themes --catalog "<Series>" --native "<title>" --lead <name>` writes both.
- `meta.order` gives each catalog one block, and the `[[catalog]]` tables follow that order — the build refuses another. `make --in themes` puts a new catalog after the current maximum and a palette added to an existing catalog after that catalog's last; when that number is taken, move the later catalogs' blocks by hand.
- Castmates are measured each on their own design and never pushed apart: twins may share a hair flat and a cursor.
- `meta.booru` is danbooru's current tag — `consensus` names it when the file had an older one. The palettes made before 2026-10-22 keep their `[meta.booru_sites]`; new ones carry danbooru's tag alone.
- Every official palette carries its other mode (`[colors.light]` or `[colors.dark]`), which `make --in themes` writes and the build requires. When the mirror (`src/core/mirror.ts`) changes, write every other mode again: `bun .claude/skills/palette/scripts/light.ts --write themes/palettes/*/*.toml`. A role the gate finds unsettled in a shipped palette's ANSI colors: `bun .claude/skills/palette/scripts/ansi-roles.ts --write <file> [...]`, which turns the hue only and writes the other mode after.
- Finish with `mise run build` and `mise run ci`. A palette change ships as a patch release.
