# The built-in palettes

Inside the ttheme repository, the built-in palettes in `builtin/` are made with the steps in `SKILL.md`, with these changes:

- Step 0: run the CLI from the checkout, `bun src/bin.ts palette measure`, `consensus` and `make --in builtin`, never an installed ttheme.
- Step 3: decide the picture yourself, as every other step, and report to the owner afterwards as step 8 says.
- Step 7: name the work with `--work <work>`; `--work-name` and `--work-native` are refused with `--in builtin`. A work or a character aninames' authority (`authority/works/<work>.toml` in aninames) lacks is not refused: `make` writes the palette, and its shelf shows the work's id until the authority holds it. Nothing is written to aninames from here; a record for the authority comes through an aninames issue. `make` notes a work or a character that neither the authority nor aninames' index holds: read the notes for a misspelled id before writing. A `replaces` on a shipped palette is expected when you change that palette.

## The work and its cast

A work and its cast exist wherever aninames' index holds them, not only in the authority. `bun tools/palette/cast.ts <work-slug>` lists its works and its cast with their danbooru tags and which are leads (`*`): take the work's slug and each character's id from it (the tag without a qualifier, hyphens for underscores). When danbooru turns requests away, the index's tags stand, as step 2 says.

## What the build refuses

`mise run build` (`loadBuiltin` and `build` in `src/cli/build.ts`) refuses a built-in palette that breaks one of these, naming the palette and the rule:

- Its slug is not the id aninames' authority gives its character.
- It is not a `[[palette]]` table in its work's set, `builtin/sets/<work>.toml` (`original.toml` for a palette of no work).
- Another palette in any set has its slug.
- It lacks its other mode (`[palette.colors.light]` for a dark palette, `[palette.colors.dark]` for a light one), which `make --in builtin` writes.
- It fails the contrast gate in either mode.

## Keeping the shipped palettes in step with src/core

- When the mirror (`src/core/mirror.ts`) changes, write every other mode again: `bun tools/palette/light.ts --write builtin/sets/*.toml`.
- When the gate finds a role unsettled in a shipped palette's ANSI colors: `bun tools/palette/ansi-roles.ts --write builtin/sets/<work>.toml [...]`, which writes its other mode again too.

## Finishing

Finish with `mise run build` and `mise run ci`. A palette change ships with the next weekly release, one palette per pull request (`.github/pull_request_template.md`).
