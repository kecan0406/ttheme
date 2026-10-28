# commons

What a palette is of belongs to no marketplace: `works/<work>.toml`, one file per work whose stem is its id (a slug, never `ttheme`), and `renames.toml`. `loadCommons` (`src/cli/build.ts`) reads them, and `works/` holds only `<name>.toml` files, no folders. `CONTRIBUTING.md` ("Works and characters") has the fields and `schemas/ttheme-work.json` the schema.

- A character's `danbooru` is the tag that says who they are, and no other character holds it: one character, one subject. A subject is `<work>` or `<work>/<character>`.
- A work lists its characters in cast order, and its `lead` is the character the work is known by (`leadOf`).
- A built-in palette's subject must exist here, or the build fails. A marketplace's proposals in its own `works/` merge under the commons, never over it.
- `renames.toml` is absent until a subject first moves. It maps an old subject to its new one, renaming a work moves its characters along, and every target is held to the commons.
