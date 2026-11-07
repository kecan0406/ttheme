---
name: palette
description: Add or change the built-in palettes in builtin/ — the ttheme-palette skill's steps run from this checkout with `bun src/bin.ts palette … --in builtin`, plus what only the built-in marketplace needs (`--work`, both modes in its set, the build and a patch release), and the two scripts that keep the shipped palettes' other mode and ANSI roles in step with src/core. Use when adding a work or a character to the built-in palettes, or re-mirroring their other mode.
metadata:
  internal: true
---

# Built-in palettes

Make them as `skills/ttheme-palette/SKILL.md` says — read it first — with the CLI from this checkout: `bun src/bin.ts palette measure`, `consensus` and `make --in builtin`. Decide every step yourself and report to the owner afterwards as its step 8 says. What the built-in marketplace adds:

- A built-in palette names its work with `--work <work>`. A work or a character aninames' authority lacks (`authority/works/<work>.toml` in aninames) is not refused: `make --in builtin` writes the palette, and its shelf shows the work's id until the authority holds it. Nothing is written to aninames from here; a record for the authority comes through an aninames issue. `--work-name` and `--work-native` are refused with `--in builtin`, and `make` notes a work or a character that neither the authority nor aninames' index holds: read the notes for a misspelled id before writing.
- A work and its cast exist wherever aninames' index holds them, not only in the authority: `bun .agents/skills/palette/scripts/cast.ts <work-slug>` lists its works and its cast with their danbooru tags and which are leads, so take the work's slug and each character's id from it (the tag without a qualifier, hyphens for underscores).
- When danbooru turns requests away, `consensus` has no answer: the index's tags stand, and a black, white or grey hair is read as step 5's last line says, with that said in the report.
- A palette's slug is its character's id; `mise run build` refuses another.
- Castmates are measured each on their own design and never pushed apart.
- A built-in palette is a `[[palette]]` table in `builtin/sets/<work>.toml` (`original.toml` for a palette of no work), and no two palettes share a slug.
- When the mirror (`src/core/mirror.ts`) changes, write every other mode again: `bun .agents/skills/palette/scripts/light.ts --write builtin/sets/*.toml`.
- A role the gate finds unsettled in a shipped palette's ANSI colors: `bun .agents/skills/palette/scripts/ansi-roles.ts --write builtin/sets/<work>.toml [...]`.
- Finish with `mise run build` and `mise run ci`. A palette change ships as a patch release.
