---
name: palette
description: Add or change the built-in palettes in builtin/ and the works and characters they are of in commons/ — the ttheme-palette skill's steps run from this checkout with `bun src/bin.ts palette … --in builtin`, plus what only the built-in marketplace needs (every subject in the commons, each work's cast order and lead, both modes in its set, the build and a patch release), and the two scripts that keep the shipped palettes' other mode and ANSI roles in step with src/core. Use when adding a work or a character to the built-in palettes, or re-mirroring their other mode.
metadata:
  internal: true
---

# Built-in palettes

Make them as `skills/ttheme-palette/SKILL.md` says — read it first — with the CLI from this checkout: `bun src/bin.ts palette measure`, `consensus` and `make --in builtin`. Decide every step yourself and report to the owner afterwards as its step 8 says. What the built-in marketplace adds:

- Every built-in palette names a subject the commons holds (`commons/works/<work>.toml`; CONTRIBUTING.md's "Works and characters"). For a character the commons lacks, `make` needs `--work <id>`, and for a new work `--work-name "<English title>"` (as its fans write it, in its short form where one is common) and `--work-native "<official title>"` (punctuation verified: `・` U+30FB, half-width `!`, a trailing `。` where the title has one).
- Move each `[[character]]` table `make` appends to its place in the cast order by hand, and set the work's `lead` to the character the work is known by.
- A character who appears in another work too names it in `also`.
- A work's or a character's id never changes once it ships.
- Castmates are measured each on their own design and never pushed apart.
- A character's `danbooru` is danbooru's current tag, and no other character in the commons has it. A character that carries a `sites` table keeps it; a new one carries danbooru's tag alone.
- A new work carries its own `danbooru`, the franchise's copyright tag, added by hand.
- A built-in palette is a `[[palette]]` table in `builtin/sets/<work>.toml` (`original.toml` for a palette of no work), and no two palettes share a slug.
- When the mirror (`src/core/mirror.ts`) changes, write every other mode again: `bun .agents/skills/palette/scripts/light.ts --write builtin/sets/*.toml`.
- A role the gate finds unsettled in a shipped palette's ANSI colors: `bun .agents/skills/palette/scripts/ansi-roles.ts --write builtin/sets/<work>.toml [...]`.
- Finish with `mise run build` and `mise run ci`. A palette or commons change ships as a patch release.
