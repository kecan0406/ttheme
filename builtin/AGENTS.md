# builtin

The built-in marketplace, `ttheme` (`BUILTIN`, `src/core/theme.ts`), and the single source of truth for it: `ttheme-marketplace.toml` (`name`, `description`, `fallback`, no `[owner]`) and `palettes/<slug>.toml`, which `loadBuiltin` (`src/cli/build.ts`) reads. `dist/` is generated, never committed.

- A file's name is the palette's: `palettes/rei.toml` is `ttheme/rei`. `palettes/` holds only `<name>.toml` files, no folders.
- The build refuses a name that is no slug, a palette without its other mode or its `ansi_source`, a `subject` the commons does not hold, a `fallback` that is none of the palettes, and a gate violation in either mode.
- `neutral` is the fallback: kept out of every list and the new-tab rotation (`default: true`), and still used by name.
- Make or change a palette with the `palette` skill (`.claude/skills/palette/SKILL.md`), which runs the public `skills/ttheme-palette/SKILL.md` from this checkout (`bun src/bin.ts palette … --in builtin`). Castmates are measured each on their own design and never pushed apart.
- The palettes ship inside ttheme and reach users only as a release, so every palette change is a patch release. The pull request template's palette checklist (`.github/pull_request_template.md`) is the contract: one palette per pull request, and color values and post numbers only, no images, links or other assets.
