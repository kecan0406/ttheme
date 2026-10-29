---
name: palette
description: Add or change the built-in palettes in builtin/ and the works and characters they are of in commons/ — the ttheme-palette skill's steps run from this checkout with `bun src/bin.ts palette … --in builtin`, plus what only the built-in marketplace needs (every subject in the commons, each work's cast order and lead, both modes in its set, the build and a patch release), and the two scripts that keep the shipped palettes' other mode and ANSI roles in step with src/core. Use when adding a work or a character to the built-in palettes, or re-mirroring their other mode.
metadata:
  internal: true
---

# Built-in palettes

Make them as `skills/ttheme-palette/SKILL.md` says — read it first — with the CLI from this checkout: `bun src/bin.ts palette measure`, `consensus` and `make --in builtin`. Decide every step yourself and report to the owner afterwards as its step 8 says; there is no review board and no measurement record. What the built-in marketplace adds:

- Every built-in palette names a subject the commons holds, and the build refuses one that does not. The commons is `commons/works/<work>.toml`, one file per work; CONTRIBUTING.md's "Works and characters" has its rules. `make --in builtin` finds a character by its danbooru tag; for one the commons lacks it needs `--work <id>`, and for a new work `--work-name "<English title>"` (as its fans write it, in its short form where one is common) and `--work-native "<official title>"` (punctuation verified: `・` U+30FB, half-width `!`, a trailing `。` where the title has one), and it writes the character, or the whole work, into `commons/works/<work>.toml` itself.
- `make` appends a character it records, so move its `[[character]]` table to its place in the cast order by hand, and set the work's `lead` to the character the work is known by, whatever their colors. A character who appears in another work too names it in `also`. A work's or a character's id never changes once it ships: other marketplaces' palettes name it.
- Castmates are measured each on their own design and never pushed apart: twins may share a hair flat and a cursor.
- A character's `danbooru` is danbooru's current tag — `consensus` names it when the anchors held an older one — and no other character in the commons has it. A character that carries a `sites` table keeps it; a new one carries danbooru's tag alone.
- A built-in palette is a `[[palette]]` table in its work's set, `builtin/sets/<work>.toml` (`original.toml` for a palette of no work), where `make --in builtin` puts it; the build refuses one anywhere else, and a slug two palettes share.
- Every built-in palette carries its other mode (`[palette.colors.light]` or `[palette.colors.dark]`), which `make --in builtin` writes and the build requires. When the mirror (`src/core/mirror.ts`) changes, write every other mode again: `bun .agents/skills/palette/scripts/light.ts --write builtin/sets/*.toml`, which rewrites each palette of the sets named in place. A role the gate finds unsettled in a shipped palette's ANSI colors: `bun .agents/skills/palette/scripts/ansi-roles.ts --write builtin/sets/<work>.toml [...]`, which turns the hue only, writes the other mode after, and leaves the set's other palettes as they are.
- Finish with `mise run build` and `mise run ci`. A palette or commons change ships as a patch release.
