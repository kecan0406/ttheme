# builtin

The built-in marketplace, `ttheme` (`BUILTIN`, `src/core/theme.ts`), and the single source of truth for it: `ttheme-marketplace.toml` (`name`, `description`, no `[owner]`) and `sets/<work>.toml`, which `loadBuiltin` (`src/cli/build.ts`) reads. `dist/` is generated, never committed.

- A palette is a `[[palette]]` table in its subject's work's set, and its `slug` is its name: `slug = "rei"` in `sets/evangelion.toml` is `ttheme/rei`. A palette of no work sits in `sets/original.toml`. `sets/` holds only `<name>.toml` files, no folders.
- The build refuses a slug that is no slug or that two palettes share, a palette outside its work's set, a palette without its other mode, a `subject` the commons does not hold, and a gate violation in either mode.
- Make or change a palette with the `palette` skill (`.agents/skills/palette/SKILL.md`), which runs the public `skills/ttheme-palette/SKILL.md` from this checkout (`bun src/bin.ts palette … --in builtin`). Castmates are measured each on their own design and never pushed apart.
- The palettes ship inside ttheme and reach users only as a release, so every palette change is a patch release. The pull request template's palette checklist (`.github/pull_request_template.md`) is the contract: one palette per pull request, and color values and post numbers only, no images, links or other assets.
