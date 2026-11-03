---
name: palette
description: Add or change the built-in palettes in builtin/ — the ttheme-palette skill's steps run from this checkout with `bun src/bin.ts palette … --in builtin`, plus what only the built-in marketplace needs (every subject in aninames' authority, both modes in its set, the build and a patch release), and the two scripts that keep the shipped palettes' other mode and ANSI roles in step with src/core. Use when adding a work or a character to the built-in palettes, or re-mirroring their other mode.
metadata:
  internal: true
---

# Built-in palettes

Make them as `skills/ttheme-palette/SKILL.md` says — read it first — with the CLI from this checkout: `bun src/bin.ts palette measure`, `consensus` and `make --in builtin`. Decide every step yourself and report to the owner afterwards as its step 8 says. What the built-in marketplace adds:

- Every built-in palette names a subject aninames' authority holds (`authority/works/<work>.toml` in aninames). A character it lacks is added there first, once its issue has been talked over, and then ttheme takes a version of aninames that holds it: `make --in builtin` refuses a subject that is not in it.
- A palette's slug is its character's id; `mise run build` refuses another.
- Castmates are measured each on their own design and never pushed apart.
- A built-in palette is a `[[palette]]` table in `builtin/sets/<work>.toml` (`original.toml` for a palette of no work), and no two palettes share a slug.
- When the mirror (`src/core/mirror.ts`) changes, write every other mode again: `bun .agents/skills/palette/scripts/light.ts --write builtin/sets/*.toml`.
- A role the gate finds unsettled in a shipped palette's ANSI colors: `bun .agents/skills/palette/scripts/ansi-roles.ts --write builtin/sets/<work>.toml [...]`.
- Finish with `mise run build` and `mise run ci`. A palette change ships as a patch release.
